#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

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

constexpr uint8_t LED_PIN = 2;
constexpr char COMMAND_TOPIC[] = "esp32-devkit-v1/led/command";
constexpr char STATE_TOPIC[] = "esp32-devkit-v1/led/state";
constexpr char STATUS_TOPIC[] = "esp32-devkit-v1/status";
constexpr unsigned long RECONNECT_INTERVAL_MS = 5000;

WiFiClientSecure tlsClient;
PubSubClient mqtt(tlsClient);
bool ledOn = false;
unsigned long lastReconnectAttempt = 0;

bool configurationIsComplete() {
  return WIFI_SSID[0] != '\0' &&
         WIFI_PASSWORD[0] != '\0' &&
         MQTT_HOST[0] != '\0' &&
         MQTT_USERNAME[0] != '\0' &&
         MQTT_PASSWORD[0] != '\0' &&
         MQTT_ROOT_CA[0] != '\0';
}

void setLed(bool on) {
  ledOn = on;
  digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
  if (mqtt.connected()) {
    mqtt.publish(STATE_TOPIC, ledOn ? "ON" : "OFF", true);
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, COMMAND_TOPIC) != 0) {
    return;
  }

  if (length == 2 && memcmp(payload, "ON", 2) == 0) {
    setLed(true);
  } else if (length == 3 && memcmp(payload, "OFF", 3) == 0) {
    setLed(false);
  } else {
    Serial.println("Commande MQTT ignoree (valeur attendue : ON ou OFF).");
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
  mqtt.subscribe(COMMAND_TOPIC);
  mqtt.publish(STATE_TOPIC, ledOn ? "ON" : "OFF", true);
  Serial.println("Connecte au broker MQTT.");
  return true;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  if (!configurationIsComplete()) {
    Serial.println("Configuration manquante : renseignez include/secrets.h.");
    return;
  }

  tlsClient.setCACert(MQTT_ROOT_CA);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Connexion au Wi-Fi...");
}

void loop() {
  if (!configurationIsComplete()) {
    delay(1000);
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    delay(100);
    return;
  }

  if (!mqtt.connected()) {
    const unsigned long now = millis();
    if (now - lastReconnectAttempt >= RECONNECT_INTERVAL_MS) {
      lastReconnectAttempt = now;
      if (!connectMqtt()) {
        Serial.printf("Connexion MQTT echouee (code %d).\n", mqtt.state());
      }
    }
    return;
  }

  mqtt.loop();
}
