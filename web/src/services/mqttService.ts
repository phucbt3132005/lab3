import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { MqttConfig } from '../types';

export const DEFAULT_CONFIG: MqttConfig = {
  host: 'broker.hivemq.com',
  port: 8000,
  path: '/mqtt',
  topicPrefix: 'runner01',
};

// Tạo các topic từ prefix
export const getTopics = (prefix: string) => ({
  // ESP32 → Website
  temperature:  `${prefix}/temperature`,
  pressure:     `${prefix}/pressure`,
  altitude:     `${prefix}/altitude`,
  data:         `${prefix}/data`,
  ledState:     `${prefix}/led/state`,
  buzzerState:  `${prefix}/buzzer/state`,
  status:       `${prefix}/status`,

  // Website → ESP32
  ledSet:       `${prefix}/led/set`,
  buzzerSet:    `${prefix}/buzzer/set`,
});

export type MqttTopics = ReturnType<typeof getTopics>;

// Tạo MQTT client kết nối qua WebSocket
export function createMqttClient(config: MqttConfig): MqttClient {
  const url = `ws://${config.host}:${config.port}${config.path}`;
  const clientId = `web-runner-${Math.random().toString(16).slice(2, 10)}`;

  const options: IClientOptions = {
    clientId,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000,
    keepalive: 60,
  };

  console.log(`[MQTT] Đang kết nối tới: ${url}`);
  return mqtt.connect(url, options);
}
