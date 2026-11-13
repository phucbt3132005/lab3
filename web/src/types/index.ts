// Kiểu dữ liệu cảm biến
export interface SensorData {
  temperature: number;   // °C
  pressure: number;      // hPa
  altitude: number;      // m
  timestamp: number;     // ms (từ ESP32)
  receivedAt: number;    // ms (Date.now() khi nhận)
}

// Điểm dữ liệu cho biểu đồ
export interface ChartPoint {
  time: string;          // Chuỗi thời gian hiển thị
  value: number;
}

// Trạng thái MQTT
export type MqttStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// Trạng thái cảnh báo
export type AlertType = 'normal' | 'high_temp' | 'low_temp' | 'altitude_change' | 'no_data';

export interface AlertState {
  type: AlertType;
  message: string;
}

// Trạng thái LED / Buzzer
export interface ActuatorState {
  ledOn: boolean;        // Trạng thái LED (auto OR manual)
  buzzerOn: boolean;     // Trạng thái Buzzer (auto OR manual)
  manualLed: boolean;    // Lệnh manual từ user
  manualBuzzer: boolean; // Lệnh manual từ user
}

// Cấu hình MQTT
export interface MqttConfig {
  host: string;
  port: number;
  path: string;
  topicPrefix: string;
}
