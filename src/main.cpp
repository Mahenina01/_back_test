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
#include "matrix_display.h"

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

constexpr char MATRIX_COMMAND_TOPIC[] = "esp32-devkit-v1/matrix/command";
constexpr char MATRIX_STATE_TOPIC[] = "esp32-devkit-v1/matrix/state";
constexpr char STATUS_TOPIC[] = "esp32-devkit-v1/status";
constexpr unsigned long RECONNECT_INTERVAL_MS = 5000;

WiFiClientSecure tlsClient;
PubSubClient mqtt(tlsClient);
uint8_t displayedDigit = 0;
unsigned long lastReconnectAttempt = 0;

bool configurationIsComplete() {
  return WIFI_SSID[0] != '\0' &&
         WIFI_PASSWORD[0] != '\0' &&
         MQTT_HOST[0] != '\0' &&
         MQTT_USERNAME[0] != '\0' &&
         MQTT_PASSWORD[0] != '\0' &&
         MQTT_ROOT_CA[0] != '\0';
}

void publishMatrixState() {
  const char payload[] = {static_cast<char>('0' + displayedDigit), '\0'};
  if (mqtt.connected() &&
      !mqtt.publish(MATRIX_STATE_TOPIC, payload, true)) {
    Serial.println("Publication MQTT de l'etat de la matrice echouee.");
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, MATRIX_COMMAND_TOPIC) != 0) {
    return;
  }

  if (length != 1 || payload[0] < '0' || payload[0] > '9') {
    Serial.println("Commande matrice ignoree (un chiffre de 0 a 9 est attendu).");
    return;
  }

  displayedDigit = payload[0] - '0';
  MatrixDisplay::showDigit(displayedDigit);
  publishMatrixState();
  Serial.printf("Chiffre %u affiche sur la matrice.\n", displayedDigit);
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

  if (!mqtt.subscribe(MATRIX_COMMAND_TOPIC, 1)) {
    Serial.println("Abonnement MQTT aux commandes de la matrice echoue.");
    mqtt.disconnect();
    return false;
  }

  mqtt.publish(STATUS_TOPIC, "online", true);
  publishMatrixState();
  Serial.println("Connecte au broker MQTT.");
  return true;
}

void setup() {
  Serial.begin(115200);

  settingsBegin();
  Sensors::begin();
  Control::begin();
  Turner::begin();
  Alarms::begin();
  Ui::begin();
  MatrixDisplay::begin();
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
  mqtt.setCallback(onMqttMessage);
  WiFi.mode(Net::apOn ? WIFI_AP_STA : WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Connexion au Wi-Fi...");
}

void loop() {
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
