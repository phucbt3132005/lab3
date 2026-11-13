# 🏃 Runner Monitoring System

Hệ thống giám sát và cảnh báo người chạy bộ sử dụng ESP32 + FreeRTOS + MQTT + React Dashboard.

---

## 1. Giới thiệu hệ thống

Hệ thống thu thập dữ liệu môi trường từ cảm biến BMP180 (nhiệt độ, áp suất khí quyển, độ cao) thông qua ESP32. Dữ liệu được xử lý bằng FreeRTOS và truyền lên MQTT Broker để hiển thị trên Web Dashboard theo thời gian thực.

**Tính năng chính:**
- Đọc dữ liệu BMP180 mỗi 1 giây
- Cảnh báo tự động khi nhiệt độ bất thường hoặc độ cao thay đổi đột ngột
- Điều khiển LED và Buzzer từ Web Dashboard
- Biểu đồ thời gian thực cập nhật theo MQTT

---

## 2. Sơ đồ kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                        ESP32 DevKit V1                       │
│                                                             │
│  ┌─────────────┐    dataQueue    ┌──────────────────────┐   │
│  │ TaskReadData│ ─────────────▶ │  TaskTransmitData     │   │
│  │  (Core 1)   │                │  (Core 0)             │   │
│  │             │    dataAlert   │  Wi-Fi + MQTT Publish │   │
│  │  BMP180     │ ─────────────▶ ├──────────────────────┤   │
│  │  I2C Read   │                │  MQTT Subscribe       │   │
│  └─────────────┘                │  LED/Buzzer Control   │   │
│         │                       └──────────────────────┘   │
│         │ dataAlert                        │                │
│         ▼                                  │ MQTT Callback  │
│  ┌─────────────┐                           ▼                │
│  │  TaskAlert  │ ◀──────────── manualLed / manualBuzzer    │
│  │  (Core 1)   │                                           │
│  │  LED/Buzzer │ ──▶ OUTPUT = AUTO_ALERT OR MANUAL         │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
              │ MQTT TCP (1883)
              ▼
     ┌─────────────────┐
     │  HiveMQ Public  │
     │  Broker         │
     │  broker.hivemq  │
     │  .com           │
     └─────────────────┘
              │ MQTT WebSocket (8000)
              ▼
     ┌─────────────────┐
     │  React Website  │
     │  Dashboard      │
     │  (Browser)      │
     └─────────────────┘
```

---

## 3. Sơ đồ kết nối phần cứng

| Linh kiện  | Chân linh kiện | GPIO ESP32 |
|------------|---------------|------------|
| BMP180     | SDA           | GPIO 21    |
| BMP180     | SCL           | GPIO 22    |
| BMP180     | VCC           | 3V3        |
| BMP180     | GND           | GND        |
| LED (đỏ)   | Anode (+)     | GPIO 26 (qua R 220Ω) |
| LED (đỏ)   | Cathode (-)   | GND        |
| Buzzer     | +             | GPIO 27    |
| Buzzer     | -             | GND        |

---

## 4. Ba FreeRTOS Task

### TaskReadData (Core 1 – Priority 2)
- Đọc nhiệt độ, áp suất, độ cao từ BMP180 mỗi 1000 ms
- In dữ liệu ra Serial Monitor
- Gửi `SensorData` đầy đủ vào `dataQueue`
- Gửi `AlertData` (nhiệt độ + độ cao) vào `dataAlert`

### TaskTransmitData (Core 0 – Priority 1)
- Kết nối Wi-Fi (SSID: Wokwi-GUEST)
- Kết nối MQTT Broker qua TCP port 1883
- Nhận `SensorData` từ `dataQueue`, chuyển thành JSON, Publish lên MQTT
- Subscribe `runner01/led/set` và `runner01/buzzer/set`
- Tự động reconnect Wi-Fi và MQTT khi mất kết nối
- Gọi `mqttClient.loop()` liên tục để xử lý bản tin nhận về

### TaskAlert (Core 1 – Priority 2)
- Nhận `AlertData` từ `dataAlert`
- Kiểm tra nhiệt độ so với ngưỡng
- Kiểm tra thay đổi độ cao giữa hai mẫu liên tiếp
- Điều khiển LED và Buzzer: `OUTPUT = AUTO_ALERT OR MANUAL`
- Giữ cảnh báo độ cao trong 5 giây để tránh cảnh báo thoáng qua

---

## 5. Hai Queue

| Queue      | Kiểu      | Kích thước | Từ              | Đến                 |
|------------|-----------|-----------|-----------------|---------------------|
| dataQueue  | SensorData| 5         | TaskReadData    | TaskTransmitData    |
| dataAlert  | AlertData | 1         | TaskReadData    | TaskAlert           |

- **dataQueue**: Queue bình thường, kích thước 5. Nếu đầy, phần tử cũ nhất bị loại bỏ.
- **dataAlert**: Queue kích thước 1. Dùng `xQueueOverwrite()` để luôn giữ giá trị mới nhất.

---

## 6. Danh sách MQTT Topic

### ESP32 → Website

| Topic                | Nội dung           | Đơn vị |
|---------------------|--------------------|--------|
| `runner01/temperature` | Nhiệt độ        | °C     |
| `runner01/pressure`    | Áp suất khí quyển | hPa  |
| `runner01/altitude`    | Độ cao           | m      |
| `runner01/data`        | JSON tổng hợp    | —      |
| `runner01/led/state`   | Trạng thái LED   | 0/1    |
| `runner01/buzzer/state`| Trạng thái Buzzer| 0/1    |
| `runner01/status`      | online/offline   | string |

### Website → ESP32

| Topic              | Payload | Mô tả        |
|-------------------|---------|--------------|
| `runner01/led/set`    | `1` / `0` | Bật/Tắt LED    |
| `runner01/buzzer/set` | `1` / `0` | Bật/Tắt Buzzer |

### JSON Payload cho `runner01/data`

```json
{
  "temperature": 30.5,
  "pressure": 1008.2,
  "altitude": 60.3,
  "timestamp": 123456
}
```

---

## 7. Cài thư viện Firmware

### Cách 1: Wokwi (khuyến nghị)

File `firmware/libraries.txt` đã có sẵn. Wokwi sẽ tự động cài khi load project:

```
Adafruit BMP085 Library
Adafruit BusIO
PubSubClient
ArduinoJson
```

### Cách 2: PlatformIO

```bash
cd firmware
pio lib install "adafruit/Adafruit BMP085 Library"
pio lib install "adafruit/Adafruit BusIO"
pio lib install "knolleary/PubSubClient"
pio lib install "bblanchon/ArduinoJson"
```

### Cách 3: Arduino IDE

Vào **Tools → Manage Libraries** và tìm kiếm cài từng thư viện:
- `Adafruit BMP085 Library` by Adafruit
- `Adafruit BusIO` by Adafruit
- `PubSubClient` by Nick O'Leary
- `ArduinoJson` by Benoit Blanchon

---

## 8. Chạy Firmware trên Wokwi

1. Truy cập [https://wokwi.com](https://wokwi.com)
2. Tạo project mới → chọn **ESP32**
3. Upload các file:
   - `firmware/sketch.ino` → vào tab **sketch.ino**
   - `firmware/diagram.json` → vào tab **diagram.json**
   - `firmware/libraries.txt` → vào tab **libraries.txt**
4. Nhấn nút **▶ Play** để chạy mô phỏng
5. Mở **Serial Monitor** để xem log
6. Chờ kết nối Wi-Fi và MQTT thành công (khoảng 5–15 giây)

> **Lưu ý:** Wokwi dùng BMP280 để mô phỏng BMP180 (tương thích API). File `diagram.json` đã cấu hình sẵn.

---

## 9. Chạy Website

```bash
# Vào thư mục web
cd runner-monitoring/web

# Cài dependencies
npm install

# Chạy development server
npm run dev
```

Truy cập: **http://localhost:5173**

### Build production

```bash
npm run build
npm run preview
```

---

## 10. Kiểm tra MQTT

### Dùng MQTTX (Desktop Client)

1. Tải [MQTTX](https://mqttx.app/)
2. Tạo kết nối mới:
   - Host: `broker.hivemq.com`
   - Port: `1883` (TCP) hoặc `8000` (WebSocket)
3. Subscribe `runner01/#` để xem tất cả message
4. Publish test:
   - Topic: `runner01/led/set` → Payload: `1`

### Dùng mosquitto_pub / mosquitto_sub

```bash
# Subscribe tất cả topic
mosquitto_sub -h broker.hivemq.com -t "runner01/#" -v

# Bật LED
mosquitto_pub -h broker.hivemq.com -t "runner01/led/set" -m "1"

# Tắt Buzzer
mosquitto_pub -h broker.hivemq.com -t "runner01/buzzer/set" -m "0"
```

---

## 11. Thử nghiệm điều kiện cảnh báo

### Cảnh báo nhiệt độ cao (> 38°C)

Trong Wokwi, nhấp vào **BMP180** → thay đổi thuộc tính `temperature` thành `39` hoặc cao hơn.

### Cảnh báo nhiệt độ thấp (< 10°C)

Thay `temperature` thành `5`.

### Cảnh báo độ cao đột ngột (≥ 15 m)

Thay đổi `pressure` đột ngột để độ cao tính toán thay đổi ≥ 15 m giữa hai lần đọc liên tiếp.
Ví dụ: thay `pressure` từ `1008` xuống `850` (mô phỏng leo núi nhanh).

### Điều chỉnh ngưỡng (trong code)

```c
// firmware/sketch.ino – phần NGƯỠNG CẢNH BÁO
#define TEMP_HIGH_THRESHOLD     38.0f   // °C
#define TEMP_LOW_THRESHOLD      10.0f   // °C
#define ALTITUDE_CHANGE_THRESHOLD 15.0f // m
#define ALERT_HOLD_MS           5000    // ms
```

---

## 12. Điều khiển LED và Buzzer

### Từ Web Dashboard

1. Mở Website tại `http://localhost:5173`
2. Chờ kết nối MQTT (badge "MQTT Connected" màu xanh)
3. Chờ ESP32 Online (badge "ESP32 Online")
4. Nhấn **Bật** / **Tắt** trong phần **Manual Control**

### Logic ưu tiên

```
LED_OUTPUT    = AUTO_ALERT  OR  MANUAL_LED
BUZZER_OUTPUT = AUTO_ALERT  OR  MANUAL_BUZZER
```

> Khi đang có cảnh báo tự động, nút **Tắt** thủ công sẽ không có tác dụng. Dashboard sẽ hiển thị thông báo "Đang bật do cảnh báo tự động".

---

## Cấu trúc project

```
runner-monitoring/
├── firmware/
│   ├── sketch.ino          ← Chương trình ESP32 chính
│   ├── diagram.json        ← Sơ đồ Wokwi
│   ├── libraries.txt       ← Thư viện Wokwi
│   └── platformio.ini      ← Cấu hình PlatformIO
│
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx       ← Header + status badges
│   │   │   ├── SensorCards.tsx  ← 3 card dữ liệu cảm biến
│   │   │   ├── Charts.tsx       ← 2 biểu đồ thời gian thực
│   │   │   ├── ControlPanel.tsx ← Điều khiển LED/Buzzer
│   │   │   └── AlertPanel.tsx   ← Hiển thị cảnh báo
│   │   ├── hooks/
│   │   │   └── useMqtt.ts       ← Hook quản lý MQTT
│   │   ├── services/
│   │   │   └── mqttService.ts   ← MQTT client factory
│   │   ├── types/
│   │   │   └── index.ts         ← TypeScript types
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── index.html
│
└── README.md
```

---

## Thông số kỹ thuật

| Thành phần | Chi tiết |
|-----------|---------|
| Vi điều khiển | ESP32 DevKit V1 |
| Cảm biến | BMP180 (I2C) |
| RTOS | FreeRTOS (tích hợp ESP-IDF) |
| Số Task | 3 (Read, Transmit, Alert) |
| Số Queue | 2 (dataQueue, dataAlert) |
| Broker | HiveMQ Public (broker.hivemq.com) |
| ESP32 Protocol | MQTT TCP Port 1883 |
| Web Protocol | MQTT WebSocket Port 8000 |
| Chu kỳ đọc | 1000 ms |
| Giữ cảnh báo | 5000 ms |
| Max chart points | 50 điểm |
