#pragma once
#include <Arduino.h>

#define FW_VERSION "0.3.0"

#define PIN_DHT22        16

#define PIN_HEATER       25
#define PIN_FAN          26
#define PIN_HUMIDIFIER   27
#define PIN_PUMP         17
#define PIN_MOTOR_IN1    32
#define PIN_MOTOR_IN2    33
#define PIN_BUZZER       14

#define PIN_LIMIT_L      34
#define PIN_LIMIT_R      35
#define PIN_WATER_LEVEL  39

#define PIN_I2C_SDA      21
#define PIN_I2C_SCL      22

#define PIN_TFT_BL       -1

#define OUT_ON   HIGH
#define OUT_OFF  LOW

#define TEMP_CRIT_HIGH     38.8f
#define TEMP_LOW           35.5f
#define PID_SAMPLE_MS      1000UL
#define HEATER_WINDOW_MS   2000UL
#define DHT_PERIOD_MS      2000UL
#define DHT_LOST_MS        10000UL
#define MOTOR_TIMEOUT_MS   30000UL
#define WDT_TIMEOUT_S      4
#define UI_ROTATION       1
#define SLEEP_MS           60000UL
#define TOUCH_Z_MIN        350
#define JOURNAL_MAX        10
#define FALLBACK_EPOCH     1767225600UL

#define AP_SSID  "Couveuse-ESP32"
#define AP_PASS  "couveuse123"