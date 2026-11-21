#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include "config.h"
#include "settings.h"
#include "sensors.h"
#include "control.h"
#include "turner.h"
#include "alarms.h"
#include "ui.h"
#include "net.h"
#include "core.h"

#if __has_include("secrets.h")
#include "secrets.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif
#ifndef MQTT_HOST
#define MQTT_HOST ""
#endif
#ifndef MQTT_PORT
#define MQTT_PORT 8883
#endif
#ifndef MQTT_USERNAME
#define MQTT_USERNAME ""
#endif
#ifndef MQTT_PASSWORD
#define MQTT_PASSWORD ""
#endif
#ifndef MQTT_ROOT_CA
#define MQTT_ROOT_CA ""
#endif

constexpr uint8_t VIBRATION_PIN = 2;
constexpr char VIBRATION_TOPIC[] = "esp32-devkit-v1/vibration/state";
constexpr char STATUS_TOPIC[] = "esp32-devkit-v1/status";
constexpr unsigned long RECONNECT_INTERVAL_MS = 5000;
constexpr unsigned long VIBRATION_DEBOUNCE_MS = 20;

WiFiClientSecure tlsClient;
PubSubClient mqtt(tlsClient);
bool vibrationDetected = false;
bool vibrationCandidate = false;
unsigned long vibrationCandidateSince = 0;
unsigned long lastReconnectAttempt = 0;

bool configurationIsComplete() {
  return WIFI_SSID[0] != '\0' &&
         WIFI_PASSWORD[0] != '\0' &&
         MQTT_HOST[0] != '\0' &&
         MQTT_USERNAME[0] != '\0' &&
         MQTT_PASSWORD[0] != '\0' &&
         MQTT_ROOT_CA[0] != '\0';
}

void publishVibrationState() {
  if (mqtt.connected() &&
      !mqtt.publish(VIBRATION_TOPIC, vibrationDetected ? "ON" : "OFF", true)) {
    Serial.println("Publication MQTT de l'etat du capteur echouee.");
  }
}

void updateVibration() {
  const bool reading = digitalRead(VIBRATION_PIN) == HIGH;
  const unsigned long now = millis();

  if (reading != vibrationCandidate) {
    vibrationCandidate = reading;
    vibrationCandidateSince = now;
  }

  if (reading != vibrationDetected &&
      now - vibrationCandidateSince >= VIBRATION_DEBOUNCE_MS) {
    vibrationDetected = reading;
    Serial.printf("Vibration %s\n", vibrationDetected ? "detectee" : "terminee");
    publishVibrationState();
  }
}

bool connectMqtt() {
  const uint64_t chipId = ESP.getEfuseMac();
  char clientId[32];
  snprintf(clientId, sizeof(clientId), "esp32-%04X%08X",
           static_cast<uint16_t>(chipId >> 32),
           static_cast<uint32_t>(chipId));

  if (!mqtt.connect(clientId, MQTT_USERNAME, MQTT_PASSWORD,
                    STATUS_TOPIC, 1, true, "offline")) {
    return false;
  }

  mqtt.publish(STATUS_TOPIC, "online", true);
  publishVibrationState();
  Serial.println("Connecte au broker MQTT.");
  return true;
}

void setup() {
  Serial.begin(115200);
  pinMode(VIBRATION_PIN, INPUT);
  vibrationDetected = digitalRead(VIBRATION_PIN) == HIGH;
  vibrationCandidate = vibrationDetected;
  vibrationCandidateSince = millis();

  settingsBegin();
  Sensors::begin();
  Control::begin();
  Turner::begin();
  Alarms::begin();
  Ui::begin();
  Net::begin();
  Core::wdtBegin();
  Serial.println("Couveuse v" FW_VERSION " demarree");

  if (!configurationIsComplete()) {
    Serial.println("Configuration MQTT manquante : supervision distante desactivee.");
    return;
  }

  tlsClient.setCACert(MQTT_ROOT_CA);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setSocketTimeout(2);
  WiFi.mode(Net::apOn ? WIFI_AP_STA : WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Connexion au Wi-Fi...");
}

void loop() {
  updateVibration();
  Sensors::update();
  Control::update();
  Turner::update();
  Alarms::update();
  Ui::update();
  Net::update();

  if (configurationIsComplete()) {
    const wl_status_t wifiStatus = WiFi.status();
    static int lastWifiStatus = -1;
    if (static_cast<int>(wifiStatus) != lastWifiStatus) {
      lastWifiStatus = static_cast<int>(wifiStatus);
      if (wifiStatus == WL_CONNECTED) {
        Serial.printf("Wi-Fi connecte. Adresse IP: %s\n", WiFi.localIP().toString().c_str());
      } else {
        Serial.printf("Wi-Fi non connecte (statut %d).\n", lastWifiStatus);
      }
    }

    if (wifiStatus == WL_CONNECTED) {
      if (mqtt.connected()) {
        mqtt.loop();
      } else {
        const unsigned long now = millis();
        if (now - lastReconnectAttempt >= RECONNECT_INTERVAL_MS) {
          lastReconnectAttempt = now;
          Core::wdtPause();
          const bool connected = connectMqtt();
          Core::wdtResume();
          if (!connected) {
            Serial.printf("Connexion MQTT echouee (code %d).\n", mqtt.state());
          }
        }
      }
    }
  }

  Core::wdtFeed();
  delay(1);
}
