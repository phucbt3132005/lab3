/**
 * Runner Monitoring System – ESP32 Firmware
 * 
 * Phần cứng:
 *   - ESP32 DevKit V1
 *   - Cảm biến BMP180 (I2C: SDA=GPIO21, SCL=GPIO22)
 *   - LED: GPIO 26
 *   - Buzzer: GPIO 27
 * 
 * Chức năng:
 *   - FreeRTOS: 3 Task, 2 Queue
 *   - Kết nối Wi-Fi + MQTT (HiveMQ Public Broker)
 *   - Publish dữ liệu cảm biến lên MQTT
 *   - Subscribe lệnh điều khiển LED, Buzzer từ Website
 *   - Cảnh báo tự động qua LED và Buzzer
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BMP085.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"

// ============================================================
// CẤU HÌNH WI-FI
// ============================================================
#define WIFI_SSID       "Wokwi-GUEST"
#define WIFI_PASSWORD   ""

// ============================================================
// CẤU HÌNH MQTT
// ============================================================
#define MQTT_HOST       "broker.hivemq.com"
#define MQTT_PORT       1883
#define MQTT_CLIENT_ID  "esp32-runner-01"

// MQTT Topics – ESP32 → Website
#define TOPIC_TEMPERATURE   "runner01/temperature"
#define TOPIC_PRESSURE      "runner01/pressure"
#define TOPIC_ALTITUDE      "runner01/altitude"
#define TOPIC_DATA          "runner01/data"
#define TOPIC_LED_STATE     "runner01/led/state"
#define TOPIC_BUZZER_STATE  "runner01/buzzer/state"
#define TOPIC_STATUS        "runner01/status"

// MQTT Topics – Website → ESP32
#define TOPIC_LED_SET       "runner01/led/set"
#define TOPIC_BUZZER_SET    "runner01/buzzer/set"

// ============================================================
// CHÂN GPIO
// ============================================================
#define PIN_LED     26
#define PIN_BUZZER  27
#define BMP_SDA     21
#define BMP_SCL     22

// ============================================================
// NGƯỠNG CẢNH BÁO
// ============================================================
#define TEMP_HIGH_THRESHOLD     38.0f   // °C – nhiệt độ quá cao
#define TEMP_LOW_THRESHOLD      10.0f   // °C – nhiệt độ quá thấp
#define ALTITUDE_CHANGE_THRESHOLD 15.0f // m   – thay đổi độ cao đột ngột
#define ALERT_HOLD_MS           5000    // ms  – giữ cảnh báo tối thiểu

// ============================================================
// TASK CONFIGURATION
// ============================================================
#define READ_INTERVAL_MS    1000   // Chu kỳ đọc cảm biến
#define QUEUE_SIZE          5      // Độ dài Queue chính
#define ALERT_QUEUE_SIZE    1      // Queue cảnh báo – chỉ cần giá trị mới nhất

// ============================================================
// CẤU TRÚC DỮ LIỆU
// ============================================================
typedef struct {
  float temperature;  // °C
  float pressure;     // hPa
  float altitude;     // m
  uint32_t timestamp; // ms (millis())
} SensorData;

typedef struct {
  float temperature;  // °C
  float altitude;     // m
} AlertData;

// ============================================================
// QUEUE HANDLES
// ============================================================
QueueHandle_t dataQueue  = NULL;  // TaskReadData → TaskTransmitData
QueueHandle_t dataAlert  = NULL;  // TaskReadData → TaskAlert

// ============================================================
// MUTEX – bảo vệ biến trạng thái dùng chung
// ============================================================
SemaphoreHandle_t stateMutex = NULL;

// ============================================================
// TRẠNG THÁI ĐIỀU KHIỂN (chia sẻ giữa TaskAlert & TaskTransmitData)
// ============================================================
volatile bool autoAlert    = false;  // Trạng thái cảnh báo tự động
volatile bool manualLed    = false;  // Người dùng bật LED
volatile bool manualBuzzer = false;  // Người dùng bật Buzzer

// ============================================================
// ĐỐI TƯỢNG TOÀN CỤC
// ============================================================
Adafruit_BMP085 bmp;
WiFiClient      wifiClient;
PubSubClient    mqttClient(wifiClient);

bool bmpReady = false;

// ============================================================
// FORWARD DECLARATIONS
// ============================================================
void TaskReadData(void *pvParameters);
void TaskTransmitData(void *pvParameters);
void TaskAlert(void *pvParameters);
void mqttCallback(char *topic, byte *payload, unsigned int length);
void connectWiFi();
void connectMQTT();
void applyOutput();
void publishStatus();

// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("=== Runner Monitoring System – ESP32 ===");

  // Khởi tạo GPIO
  pinMode(PIN_LED,    OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_LED,    LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // Khởi tạo I2C và BMP180
  Wire.begin(BMP_SDA, BMP_SCL);
  if (bmp.begin()) {
    bmpReady = true;
    Serial.println("[BMP180] Khởi tạo thành công.");
  } else {
    bmpReady = false;
    Serial.println("[BMP180] KHÔNG tìm thấy cảm biến! Kiểm tra kết nối I2C.");
  }

  // Tạo Mutex
  stateMutex = xSemaphoreCreateMutex();
  if (stateMutex == NULL) {
    Serial.println("[FreeRTOS] KHÔNG tạo được Mutex!");
    while (1) {}
  }

  // Tạo Queue
  dataQueue = xQueueCreate(QUEUE_SIZE, sizeof(SensorData));
  if (dataQueue == NULL) {
    Serial.println("[FreeRTOS] KHÔNG tạo được dataQueue!");
    while (1) {}
  }

  dataAlert = xQueueCreate(ALERT_QUEUE_SIZE, sizeof(AlertData));
  if (dataAlert == NULL) {
    Serial.println("[FreeRTOS] KHÔNG tạo được dataAlert!");
    while (1) {}
  }
  Serial.println("[FreeRTOS] Tạo Queue thành công.");

  // Tạo các Task
  xTaskCreatePinnedToCore(TaskReadData,     "TaskReadData",     4096, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(TaskTransmitData, "TaskTransmitData", 8192, NULL, 1, NULL, 0);
  xTaskCreatePinnedToCore(TaskAlert,        "TaskAlert",        4096, NULL, 2, NULL, 1);

  Serial.println("[FreeRTOS] Các Task đã được khởi tạo.");
  Serial.println("=========================================");
}

void loop() {
  // FreeRTOS quản lý – loop() không dùng
  vTaskDelay(portMAX_DELAY);
}

// ============================================================
// TASK 1: ĐỌC DỮ LIỆU CẢM BIẾN (Core 1)
// ============================================================
void TaskReadData(void *pvParameters) {
  Serial.println("[TaskReadData] Bắt đầu chạy trên Core 1.");

  SensorData sensorData;
  AlertData  alertData;

  while (1) {
    if (bmpReady) {
      // Đọc dữ liệu từ BMP180
      sensorData.temperature = bmp.readTemperature();        // °C
      sensorData.pressure    = bmp.readPressure() / 100.0f;  // Pa → hPa
      sensorData.altitude    = bmp.readAltitude(101325);     // m
      sensorData.timestamp   = millis();

      // Hiển thị qua Serial Monitor
      Serial.println("----------------------------------------");
      Serial.printf("[Sensor] Nhiệt độ   : %.2f °C\n",  sensorData.temperature);
      Serial.printf("[Sensor] Áp suất    : %.2f hPa\n", sensorData.pressure);
      Serial.printf("[Sensor] Độ cao     : %.2f m\n",   sensorData.altitude);
      Serial.printf("[Sensor] Timestamp  : %lu ms\n",   sensorData.timestamp);

      // Gửi dữ liệu đầy đủ vào dataQueue (ghi đè nếu đầy)
      if (xQueueSend(dataQueue, &sensorData, 0) != pdTRUE) {
        // Queue đầy – lấy phần tử cũ ra rồi ghi mới vào
        SensorData dummy;
        xQueueReceive(dataQueue, &dummy, 0);
        xQueueSend(dataQueue, &sensorData, 0);
        Serial.println("[TaskReadData] dataQueue đầy – đã ghi đè.");
      }

      // Gửi AlertData vào dataAlert (ghi đè luôn – Queue size = 1)
      alertData.temperature = sensorData.temperature;
      alertData.altitude    = sensorData.altitude;
      xQueueOverwrite(dataAlert, &alertData);

    } else {
      Serial.println("[TaskReadData] BMP180 không sẵn sàng.");
    }

    vTaskDelay(pdMS_TO_TICKS(READ_INTERVAL_MS));
  }
}

// ============================================================
// MQTT CALLBACK – nhận lệnh từ Website
// ============================================================
void mqttCallback(char *topic, byte *payload, unsigned int length) {
  String topicStr(topic);
  String payloadStr = "";
  for (unsigned int i = 0; i < length; i++) {
    payloadStr += (char)payload[i];
  }
  payloadStr.trim();

  Serial.printf("[MQTT] Nhận: topic=%s payload=%s\n", topic, payloadStr.c_str());

  if (xSemaphoreTake(stateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
    if (topicStr == TOPIC_LED_SET) {
      manualLed = (payloadStr == "1");
      Serial.printf("[MQTT] Manual LED = %s\n", manualLed ? "ON" : "OFF");
    } else if (topicStr == TOPIC_BUZZER_SET) {
      manualBuzzer = (payloadStr == "1");
      Serial.printf("[MQTT] Manual Buzzer = %s\n", manualBuzzer ? "ON" : "OFF");
    }
    xSemaphoreGive(stateMutex);
  }

  // Áp dụng ngay sau khi nhận lệnh
  applyOutput();
}

// ============================================================
// KẾT NỐI WI-FI (không block vô hạn)
// ============================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WiFi] Đang kết nối tới '%s'...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint32_t startMs = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startMs < 15000) {
    vTaskDelay(pdMS_TO_TICKS(500));
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WiFi] Kết nối thành công! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[WiFi] Kết nối thất bại. Sẽ thử lại sau.");
  }
}

// ============================================================
// KẾT NỐI MQTT
// ============================================================
void connectMQTT() {
  if (mqttClient.connected()) return;
  if (WiFi.status() != WL_CONNECTED) return;

  Serial.printf("[MQTT] Đang kết nối tới %s:%d...\n", MQTT_HOST, MQTT_PORT);

  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setKeepAlive(60);
  mqttClient.setBufferSize(512);

  if (mqttClient.connect(MQTT_CLIENT_ID, NULL, NULL, TOPIC_STATUS, 0, true, "offline")) {
    Serial.println("[MQTT] Kết nối thành công!");

    // Subscribe các topic điều khiển
    mqttClient.subscribe(TOPIC_LED_SET);
    mqttClient.subscribe(TOPIC_BUZZER_SET);
    Serial.println("[MQTT] Đã subscribe: " TOPIC_LED_SET ", " TOPIC_BUZZER_SET);

    // Publish trạng thái online
    mqttClient.publish(TOPIC_STATUS, "online", true);
  } else {
    Serial.printf("[MQTT] Kết nối thất bại, rc=%d. Sẽ thử lại sau.\n", mqttClient.state());
  }
}

// ============================================================
// ÁP DỤNG TRẠNG THÁI LED/BUZZER
// Output = AUTO_ALERT OR MANUAL
// ============================================================
void applyOutput() {
  bool ledOut = false;
  bool buzzerOut = false;

  if (xSemaphoreTake(stateMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
    ledOut = autoAlert || manualLed;
    buzzerOut = autoAlert || manualBuzzer;

    xSemaphoreGive(stateMutex);
  }

  // Dieu khien LED
  digitalWrite(PIN_LED, ledOut ? HIGH : LOW);

  // Dieu khien Buzzer bang tan so 2000Hz
  if (buzzerOut) {
    tone(PIN_BUZZER, 2000);
  } else {
    noTone(PIN_BUZZER);
  }
}

// ============================================================
// PUBLISH TRẠNG THÁI LED/BUZZER
// ============================================================
void publishStatus() {
  if (!mqttClient.connected()) return;

  bool ledOut    = false;
  bool buzzerOut = false;

  if (xSemaphoreTake(stateMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
    ledOut    = autoAlert || manualLed;
    buzzerOut = autoAlert || manualBuzzer;
    xSemaphoreGive(stateMutex);
  }

  mqttClient.publish(TOPIC_LED_STATE,    ledOut    ? "1" : "0", false);
  mqttClient.publish(TOPIC_BUZZER_STATE, buzzerOut ? "1" : "0", false);
}

// ============================================================
// TASK 2: TRUYỀN DỮ LIỆU (Core 0)
// ============================================================
void TaskTransmitData(void *pvParameters) {
  Serial.println("[TaskTransmitData] Bắt đầu chạy trên Core 0.");

  uint32_t lastReconnectAttemptWifi  = 0;
  uint32_t lastReconnectAttemptMqtt  = 0;
  uint32_t lastStatusPublish         = 0;
  const uint32_t RECONNECT_INTERVAL  = 5000;  // ms
  const uint32_t STATUS_INTERVAL     = 10000; // ms

  // Kết nối lần đầu
  connectWiFi();
  connectMQTT();

  while (1) {
    uint32_t now = millis();

    // Kiểm tra Wi-Fi, tự kết nối lại
    if (WiFi.status() != WL_CONNECTED) {
      if (now - lastReconnectAttemptWifi > RECONNECT_INTERVAL) {
        lastReconnectAttemptWifi = now;
        Serial.println("[TaskTransmitData] Wi-Fi mất kết nối. Đang thử lại...");
        connectWiFi();
      }
      // Không thể gửi MQTT nếu không có Wi-Fi
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }

    // Kiểm tra MQTT, tự kết nối lại
    if (!mqttClient.connected()) {
      if (now - lastReconnectAttemptMqtt > RECONNECT_INTERVAL) {
        lastReconnectAttemptMqtt = now;
        Serial.println("[TaskTransmitData] MQTT mất kết nối. Đang thử lại...");
        connectMQTT();
      }
      // Vẫn gọi loop dù chưa kết nối
      mqttClient.loop();
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }

    // Xử lý bản tin MQTT nhận về (phải gọi thường xuyên)
    mqttClient.loop();

    // Đọc dữ liệu từ dataQueue (không block để tránh cản loop())
    SensorData data;
    if (xQueueReceive(dataQueue, &data, 0) == pdTRUE) {
      // Tạo JSON payload
      StaticJsonDocument<256> doc;
      doc["temperature"] = round(data.temperature * 100.0f) / 100.0f;
      doc["pressure"]    = round(data.pressure    * 10.0f)  / 10.0f;
      doc["altitude"]    = round(data.altitude    * 100.0f) / 100.0f;
      doc["timestamp"]   = data.timestamp;

      char jsonBuf[256];
      size_t jsonLen = serializeJson(doc, jsonBuf);

      // Publish từng topic riêng lẻ
      char tempStr[16], pressStr[16], altStr[16];
      snprintf(tempStr,  sizeof(tempStr),  "%.2f", data.temperature);
      snprintf(pressStr, sizeof(pressStr), "%.2f", data.pressure);
      snprintf(altStr,   sizeof(altStr),   "%.2f", data.altitude);

      mqttClient.publish(TOPIC_TEMPERATURE, tempStr,  false);
      mqttClient.publish(TOPIC_PRESSURE,    pressStr, false);
      mqttClient.publish(TOPIC_ALTITUDE,    altStr,   false);
      mqttClient.publish(TOPIC_DATA,        jsonBuf,  false);

      Serial.printf("[MQTT] Publish: T=%.2f°C P=%.2fhPa Alt=%.2fm\n",
                    data.temperature, data.pressure, data.altitude);
      Serial.printf("[MQTT] JSON: %s\n", jsonBuf);
    }

    // Định kỳ publish trạng thái LED/Buzzer
    if (now - lastStatusPublish > STATUS_INTERVAL) {
      lastStatusPublish = now;
      publishStatus();
    }

    vTaskDelay(pdMS_TO_TICKS(50)); // yield để gọi loop() đủ thường xuyên
  }
}

// ============================================================
// TASK 3: CẢNH BÁO (Core 1)
// ============================================================
void TaskAlert(void *pvParameters) {
  Serial.println("[TaskAlert] Bắt đầu chạy trên Core 1.");

  float    prevAltitude       = -9999.0f;
  bool     altChangeAlert     = false;
  uint32_t altAlertStartTime  = 0;

  while (1) {
    AlertData alertData;

    // Nhận dữ liệu từ dataAlert (block tối đa 1500 ms)
    if (xQueueReceive(dataAlert, &alertData, pdMS_TO_TICKS(1500)) == pdTRUE) {
      float temp = alertData.temperature;
      float alt  = alertData.altitude;

      bool tempAlert = (temp > TEMP_HIGH_THRESHOLD || temp < TEMP_LOW_THRESHOLD);

      // Kiểm tra thay đổi độ cao đột ngột
      if (prevAltitude > -9000.0f) {
        float altChange = fabs(alt - prevAltitude);
        if (altChange >= ALTITUDE_CHANGE_THRESHOLD) {
          altChangeAlert    = true;
          altAlertStartTime = millis();
          Serial.printf("[Alert] Độ cao thay đổi đột ngột: %.2f m\n", altChange);
        }
      }
      prevAltitude = alt;

      // Giữ cảnh báo độ cao trong ALERT_HOLD_MS
      if (altChangeAlert && (millis() - altAlertStartTime >= ALERT_HOLD_MS)) {
        altChangeAlert = false;
        Serial.println("[Alert] Hết thời gian giữ cảnh báo độ cao.");
      }

      bool newAutoAlert = tempAlert || altChangeAlert;

      // Log trạng thái cảnh báo
      if (newAutoAlert) {
        Serial.println("[Alert] *** CẢNH BÁO ĐANG HOẠT ĐỘNG ***");
        if (temp > TEMP_HIGH_THRESHOLD) Serial.printf("[Alert] NHIỆT ĐỘ CAO: %.2f°C > %.1f°C\n", temp, TEMP_HIGH_THRESHOLD);
        if (temp < TEMP_LOW_THRESHOLD)  Serial.printf("[Alert] NHIỆT ĐỘ THẤP: %.2f°C < %.1f°C\n", temp, TEMP_LOW_THRESHOLD);
        if (altChangeAlert)              Serial.println("[Alert] ĐỘ CAO THAY ĐỔI ĐỘT NGỘT");
      } else {
        Serial.println("[Alert] Hệ thống bình thường.");
      }

      // Cập nhật autoAlert qua Mutex
      if (xSemaphoreTake(stateMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        autoAlert = newAutoAlert;
        xSemaphoreGive(stateMutex);
      }

      // Áp dụng output
      applyOutput();
    }

    // Kiểm tra định kỳ nếu không nhận được dữ liệu
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}
