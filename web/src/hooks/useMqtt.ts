import { useState, useEffect, useCallback, useRef } from 'react';
import { MqttClient } from 'mqtt';
import {
  SensorData,
  ChartPoint,
  MqttStatus,
  AlertState,
  ActuatorState,
  AlertType,
} from '../types';
import {
  DEFAULT_CONFIG,
  getTopics,
  createMqttClient,
} from '../services/mqttService';

const MAX_CHART_POINTS = 50;

// Ngưỡng cảnh báo (phải đồng bộ với firmware)
const TEMP_HIGH = 38;
const TEMP_LOW  = 10;
const ALT_CHANGE = 15;

export function useMqtt() {
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>('connecting');
  const [deviceOnline, setDeviceOnline]   = useState(false);
  const [lastUpdate, setLastUpdate]       = useState<number | null>(null);
  const [sensorData, setSensorData]       = useState<SensorData | null>(null);
  const [tempHistory, setTempHistory]     = useState<ChartPoint[]>([]);
  const [altHistory, setAltHistory]       = useState<ChartPoint[]>([]);
  const [alertState, setAlertState]       = useState<AlertState>({ type: 'no_data', message: 'Chưa nhận được dữ liệu' });
  const [actuator, setActuator]           = useState<ActuatorState>({
    ledOn: false,
    buzzerOn: false,
    manualLed: false,
    manualBuzzer: false,
  });

  const clientRef      = useRef<MqttClient | null>(null);
  const prevAltRef     = useRef<number | null>(null);
  const topicsRef      = useRef(getTopics(DEFAULT_CONFIG.topicPrefix));

  // Tính toán alert dựa trên dữ liệu mới
  const computeAlert = useCallback((temp: number, alt: number): AlertState => {
    if (temp > TEMP_HIGH) {
      return { type: 'high_temp', message: `HIGH TEMPERATURE: ${temp.toFixed(1)}°C > ${TEMP_HIGH}°C` };
    }
    if (temp < TEMP_LOW) {
      return { type: 'low_temp', message: `LOW TEMPERATURE: ${temp.toFixed(1)}°C < ${TEMP_LOW}°C` };
    }
    if (prevAltRef.current !== null) {
      const delta = Math.abs(alt - prevAltRef.current);
      if (delta >= ALT_CHANGE) {
        return { type: 'altitude_change', message: `SUDDEN ALTITUDE CHANGE: Δ${delta.toFixed(1)} m` };
      }
    }
    return { type: 'normal', message: 'NORMAL – Hệ thống hoạt động bình thường' };
  }, []);

  // Thêm điểm mới vào lịch sử biểu đồ
  const pushChartPoint = useCallback((
    setter: React.Dispatch<React.SetStateAction<ChartPoint[]>>,
    value: number
  ) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setter(prev => {
      const updated = [...prev, { time: timeStr, value }];
      return updated.length > MAX_CHART_POINTS ? updated.slice(updated.length - MAX_CHART_POINTS) : updated;
    });
  }, []);

  // Publish MQTT
  const publish = useCallback((topic: string, payload: string) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish(topic, payload, { qos: 0 });
      console.log(`[MQTT] Publish → ${topic}: ${payload}`);
    } else {
      console.warn('[MQTT] Không thể publish – chưa kết nối');
    }
  }, []);

  // Điều khiển LED
  const setLed = useCallback((on: boolean) => {
    publish(topicsRef.current.ledSet, on ? '1' : '0');
    setActuator(prev => ({ ...prev, manualLed: on }));
  }, [publish]);

  // Điều khiển Buzzer
  const setBuzzer = useCallback((on: boolean) => {
    publish(topicsRef.current.buzzerSet, on ? '1' : '0');
    setActuator(prev => ({ ...prev, manualBuzzer: on }));
  }, [publish]);

  // Xóa lịch sử biểu đồ
  const clearHistory = useCallback(() => {
    setTempHistory([]);
    setAltHistory([]);
    prevAltRef.current = null;
  }, []);

  // Khởi tạo MQTT client
  useEffect(() => {
    const client = createMqttClient(DEFAULT_CONFIG);
    clientRef.current = client;
    const topics = topicsRef.current;

    client.on('connect', () => {
      console.log('[MQTT] Đã kết nối!');
      setMqttStatus('connected');

      // Subscribe tất cả topic cần theo dõi
      const subs = [
        topics.data, topics.temperature, topics.pressure, topics.altitude,
        topics.ledState, topics.buzzerState, topics.status,
      ];
      client.subscribe(subs, { qos: 0 }, (err) => {
        if (err) console.error('[MQTT] Subscribe lỗi:', err);
        else console.log('[MQTT] Đã subscribe:', subs.join(', '));
      });
    });

    client.on('reconnect', () => {
      console.log('[MQTT] Đang kết nối lại...');
      setMqttStatus('connecting');
    });

    client.on('disconnect', () => {
      console.log('[MQTT] Ngắt kết nối.');
      setMqttStatus('disconnected');
      setDeviceOnline(false);
    });

    client.on('error', (err) => {
      console.error('[MQTT] Lỗi:', err.message);
      setMqttStatus('error');
    });

    client.on('offline', () => {
      setMqttStatus('disconnected');
    });

    client.on('message', (topic: string, message: Buffer) => {
      const payload = message.toString().trim();
      console.log(`[MQTT] Nhận ← ${topic}: ${payload}`);

      // Xử lý topic data (JSON tổng hợp)
      if (topic === topics.data) {
        try {
          const parsed = JSON.parse(payload) as {
            temperature?: unknown;
            pressure?: unknown;
            altitude?: unknown;
            timestamp?: unknown;
          };

          const temp  = typeof parsed.temperature === 'number' ? parsed.temperature : parseFloat(String(parsed.temperature));
          const press = typeof parsed.pressure    === 'number' ? parsed.pressure    : parseFloat(String(parsed.pressure));
          const alt   = typeof parsed.altitude    === 'number' ? parsed.altitude    : parseFloat(String(parsed.altitude));
          const ts    = typeof parsed.timestamp   === 'number' ? parsed.timestamp   : parseInt(String(parsed.timestamp));

          if (isNaN(temp) || isNaN(press) || isNaN(alt)) {
            console.warn('[MQTT] Payload JSON không hợp lệ:', payload);
            return;
          }

          const data: SensorData = {
            temperature: temp,
            pressure:    press,
            altitude:    alt,
            timestamp:   isNaN(ts) ? 0 : ts,
            receivedAt:  Date.now(),
          };

          setSensorData(data);
          setLastUpdate(Date.now());
          setDeviceOnline(true);

          // Tính cảnh báo
          const alert = computeAlert(temp, alt);
          setAlertState(alert);

          // Cập nhật biểu đồ
          pushChartPoint(setTempHistory, temp);
          pushChartPoint(setAltHistory,  alt);

          prevAltRef.current = alt;

        } catch (e) {
          console.error('[MQTT] Lỗi parse JSON:', e, payload);
        }
        return;
      }

      // Trạng thái LED từ ESP32
      if (topic === topics.ledState) {
        const on = payload === '1';
        setActuator(prev => ({ ...prev, ledOn: on }));
        return;
      }

      // Trạng thái Buzzer từ ESP32
      if (topic === topics.buzzerState) {
        const on = payload === '1';
        setActuator(prev => ({ ...prev, buzzerOn: on }));
        return;
      }

      // Trạng thái thiết bị
      if (topic === topics.status) {
        setDeviceOnline(payload === 'online');
        return;
      }
    });

    return () => {
      client.end(true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    mqttStatus,
    deviceOnline,
    lastUpdate,
    sensorData,
    tempHistory,
    altHistory,
    alertState,
    actuator,
    setLed,
    setBuzzer,
    clearHistory,
  };
}
