#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include <ArduinoOTA.h>
#include "net.h"
#include "config.h"
#include "core.h"
#include "settings.h"
#include "sensors.h"
#include "control.h"
#include "alarms.h"
#include "turner.h"

#if __has_include("cloud_secrets.h")
#include "cloud_secrets.h"
#else
#define CLOUD_WIFI_SSID ""
#define CLOUD_WIFI_PASSWORD ""
#define CLOUD_API_URL ""
#define CLOUD_INCUBATOR_ID ""
#define CLOUD_DEVICE_KEY ""
#define CLOUD_ROOT_CA ""
#endif

namespace Net {

bool apOn = false;

static WebServer server(80);
static WebSocketsServer ws(81);
static bool handlersSet = false;
static uint32_t lastPush = 0;
static uint32_t lastCloudPush = 0;

struct CloudReading {
  float temperature;
  float humidity;
  float heatingPwm;
  bool fanOn;
  bool pumpOn;
  bool waterLow;
  bool waterEmpty;
  bool endstopLeft;
  bool endstopRight;
  bool motorFault;
  bool sensorFault;
};

struct CloudCommand {
  char id[37];
  char actuator[24];
  char action[16];
};

struct CloudAck {
  char id[37];
  bool success;
};

static QueueHandle_t cloudQueue = nullptr;
static QueueHandle_t cloudCommandQueue = nullptr;
static QueueHandle_t cloudAckQueue = nullptr;
static char recentCommandIds[20][37] = {};
static uint8_t recentCommandIndex = 0;

static bool cloudConfigured() {
  return CLOUD_WIFI_SSID[0] && CLOUD_WIFI_PASSWORD[0] && CLOUD_API_URL[0]
      && CLOUD_INCUBATOR_ID[0] && CLOUD_DEVICE_KEY[0];
}

static String incubatorUrl(const String& suffix) {
  String url = String(CLOUD_API_URL);
  while (url.endsWith("/")) url.remove(url.length() - 1);
  url += "/incubators/" CLOUD_INCUBATOR_ID;
  url += suffix;
  return url;
}

template <typename ClientType>
static void postReading(ClientType& client, const CloudReading& reading) {
  HTTPClient http;
  String url = incubatorUrl("/telemetry/readings");

  if (!http.begin(client, url)) {
    Serial.println("Cloud: impossible d'ouvrir la requete HTTP");
    return;
  }

  char body[384];
  snprintf(body, sizeof(body),
    "{\"temperature\":%.2f,\"humidity\":%.2f,\"heating_pwm\":%.1f,"
    "\"mixing_fan_on\":%s,\"extraction_fan_on\":false,\"pump_on\":%s,"
    "\"water_level_low\":%s,\"water_level_empty\":%s,"
    "\"motor_endstop_left\":%s,\"motor_endstop_right\":%s,"
    "\"motor_fault\":%s,\"sensor_fault\":%s}",
    reading.temperature, reading.humidity, reading.heatingPwm,
    reading.fanOn ? "true" : "false", reading.pumpOn ? "true" : "false",
    reading.waterLow ? "true" : "false", reading.waterEmpty ? "true" : "false",
    reading.endstopLeft ? "true" : "false", reading.endstopRight ? "true" : "false",
    reading.motorFault ? "true" : "false", reading.sensorFault ? "true" : "false");

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", CLOUD_DEVICE_KEY);
  http.setConnectTimeout(2500);
  http.setTimeout(2500);
  int status = http.POST(reinterpret_cast<uint8_t*>(body), strlen(body));
  if (status < 200 || status >= 300) {
    Serial.printf("Cloud: envoi echoue (HTTP %d)\n", status);
  }
  http.end();
}

template <typename ClientType>
static void pollCommands(ClientType& client) {
  HTTPClient http;
  String url = incubatorUrl("/commands/pending");
  if (!http.begin(client, url)) {
    Serial.println("Cloud: impossible d'ouvrir la file de commandes");
    return;
  }
  http.addHeader("X-Device-Key", CLOUD_DEVICE_KEY);
  http.setConnectTimeout(2500);
  http.setTimeout(2500);
  int status = http.GET();
  if (status != HTTP_CODE_OK) {
    Serial.printf("Cloud: lecture des commandes echouee (HTTP %d)\n", status);
    http.end();
    return;
  }

  DynamicJsonDocument document(8192);
  DeserializationError error = deserializeJson(document, http.getString());
  http.end();
  if (error) {
    Serial.printf("Cloud: reponse de commandes invalide (%s)\n", error.c_str());
    return;
  }

  JsonArray commands = document.as<JsonArray>();
  for (JsonObject item : commands) {
    CloudCommand command = {};
    const char* id = item["id"] | "";
    const char* actuator = item["actuator"] | "";
    const char* action = item["action"] | "";
    if (!id[0] || !actuator[0] || !action[0]) continue;

    bool duplicate = false;
    for (const auto& recentId : recentCommandIds) {
      if (strcmp(recentId, id) == 0) {
        duplicate = true;
        break;
      }
    }
    if (duplicate) continue;

    strncpy(command.id, id, sizeof(command.id) - 1);
    strncpy(command.actuator, actuator, sizeof(command.actuator) - 1);
    strncpy(command.action, action, sizeof(command.action) - 1);
    if (xQueueSend(cloudCommandQueue, &command, 0) == pdTRUE) {
      strncpy(recentCommandIds[recentCommandIndex], id, sizeof(recentCommandIds[0]) - 1);
      recentCommandIndex = (recentCommandIndex + 1) % (sizeof(recentCommandIds) / sizeof(recentCommandIds[0]));
    } else {
      Serial.println("Cloud: file locale de commandes pleine");
      break;
    }
  }
}

static void forgetCommandId(const char* id) {
  for (auto& recentId : recentCommandIds) {
    if (strcmp(recentId, id) == 0) {
      recentId[0] = '\0';
      return;
    }
  }
}

template <typename ClientType>
static bool postCommandAck(ClientType& client, const CloudAck& ack) {
  HTTPClient http;
  String url = incubatorUrl(String("/commands/") + ack.id + "/ack");
  if (!http.begin(client, url)) {
    Serial.println("Cloud: impossible d'ouvrir l'accuse de commande");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", CLOUD_DEVICE_KEY);
  http.setConnectTimeout(2500);
  http.setTimeout(2500);
  const char* body = ack.success
      ? "{\"status\":\"acknowledged\"}"
      : "{\"status\":\"failed\"}";
  int status = http.POST(body);
  if (status < 200 || status >= 300) {
    Serial.printf("Cloud: accuse de commande echoue (HTTP %d)\n", status);
  }
  http.end();
  return status >= 200 && status < 300;
}

static void cloudTask(void*) {
  uint32_t lastCommandPoll = 0;
  CloudAck pendingAck = {};
  bool hasPendingAck = false;
  for (;;) {
    CloudReading reading;
    bool hasReading = xQueueReceive(cloudQueue, &reading, pdMS_TO_TICKS(250)) == pdTRUE;

    if (WiFi.status() != WL_CONNECTED) continue;

    if (hasReading) {
      if (String(CLOUD_API_URL).startsWith("https://")) {
        if (!CLOUD_ROOT_CA[0]) {
          Serial.println("Cloud: certificat racine TLS manquant");
        } else {
          WiFiClientSecure client;
          client.setCACert(CLOUD_ROOT_CA);
          postReading(client, reading);
        }
      } else {
        WiFiClient client;
        postReading(client, reading);
      }
    }

    if (!hasPendingAck) {
      hasPendingAck = xQueueReceive(cloudAckQueue, &pendingAck, 0) == pdTRUE;
    }
    if (hasPendingAck) {
      bool acknowledged = false;
      if (String(CLOUD_API_URL).startsWith("https://")) {
        if (CLOUD_ROOT_CA[0]) {
          WiFiClientSecure client;
          client.setCACert(CLOUD_ROOT_CA);
          acknowledged = postCommandAck(client, pendingAck);
        }
      } else {
        WiFiClient client;
        acknowledged = postCommandAck(client, pendingAck);
      }
      if (acknowledged) {
        forgetCommandId(pendingAck.id);
        hasPendingAck = false;
      }
    }

    uint32_t now = millis();
    if (now - lastCommandPoll >= 5000) {
      lastCommandPoll = now;
      if (String(CLOUD_API_URL).startsWith("https://")) {
        if (!CLOUD_ROOT_CA[0]) {
          Serial.println("Cloud: certificat racine TLS manquant");
        } else {
          WiFiClientSecure client;
          client.setCACert(CLOUD_ROOT_CA);
          pollCommands(client);
        }
      } else {
        WiFiClient client;
        pollCommands(client);
      }
    }
  }
}

static bool applyCloudCommand(const CloudCommand& command) {
  if (strcmp(command.actuator, "turning_motor") == 0 && strcmp(command.action, "trigger") == 0) {
    if (Turner::fault || Turner::state != Turner::T_IDLE) return false;
    Turner::requestTurn();
    return true;
  }
  if (strcmp(command.actuator, "pump") == 0
      && (strcmp(command.action, "on") == 0 || strcmp(command.action, "off") == 0)) {
    return Control::setManualPump(strcmp(command.action, "on") == 0);
  }
  if (strcmp(command.actuator, "mixing_fan") == 0
      && (strcmp(command.action, "on") == 0 || strcmp(command.action, "off") == 0)) {
    S.fanMode = strcmp(command.action, "on") == 0 ? 1 : 2;
    settingsSave();
    return true;
  }
  return false;
}

static const char PAGE[] PROGMEM = R"HTML(<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Couveuse</title>
<body style="font-family:sans-serif;background:#111;color:#eee"><h2>Couveuse intelligente</h2><pre id=d style="font-size:18px">connexion...</pre>
<script>
var w=new WebSocket('ws://'+location.hostname+':81');
w.onmessage=function(e){var j=JSON.parse(e.data);document.getElementById('d').textContent=
'Temp: '+j.t+' C (cons '+j.ts+')\nHum: '+j.h+' % (cons '+j.hs+')\nChauffage: '+j.pid+' %\nVentilateur: '+(j.fan?'ON':'OFF')+'\nHumidificateur: '+(j.hum?'ON':'OFF')+'\nEau: '+j.eau+'\nAlarme: '+j.al+'\nJour: '+j.day;};
w.onclose=function(){document.getElementById('d').textContent='deconnecte';};
</script>)HTML";

static void startAp() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID, AP_PASS);
  if (!handlersSet) {
    handlersSet = true;
    server.on("/", []() { server.send_P(200, "text/html", PAGE); });
    ArduinoOTA.setHostname("couveuse");
    ArduinoOTA.onStart([]() { Core::wdtPause(); });
    ArduinoOTA.onEnd([]() { Core::wdtResume(); });
    ArduinoOTA.onError([](ota_error_t) { Core::wdtResume(); });
  }
  server.begin();
  ws.begin();
  ArduinoOTA.begin();
  apOn = true;
}

static void stopAp() {
  ws.close();
  server.stop();
  ArduinoOTA.end();
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_STA);
  apOn = false;
}

void begin() {
  if (S.apEnabled) startAp();
  if (!cloudConfigured()) return;

  if (!S.apEnabled) WiFi.mode(WIFI_STA);
  WiFi.begin(CLOUD_WIFI_SSID, CLOUD_WIFI_PASSWORD);
  cloudQueue = xQueueCreate(1, sizeof(CloudReading));
  cloudCommandQueue = xQueueCreate(20, sizeof(CloudCommand));
  cloudAckQueue = xQueueCreate(20, sizeof(CloudAck));
  if (cloudQueue && cloudCommandQueue && cloudAckQueue) {
    BaseType_t created = xTaskCreatePinnedToCore(cloudTask, "cloud-uplink", 8192, nullptr, 1, nullptr, 0);
    if (created != pdPASS) {
      vQueueDelete(cloudQueue);
      vQueueDelete(cloudCommandQueue);
      vQueueDelete(cloudAckQueue);
      cloudQueue = nullptr;
      cloudCommandQueue = nullptr;
      cloudAckQueue = nullptr;
      Serial.println("Cloud: impossible de demarrer la tache reseau");
    }
  } else {
    if (cloudQueue) vQueueDelete(cloudQueue);
    if (cloudCommandQueue) vQueueDelete(cloudCommandQueue);
    if (cloudAckQueue) vQueueDelete(cloudAckQueue);
    cloudQueue = nullptr;
    cloudCommandQueue = nullptr;
    cloudAckQueue = nullptr;
    Serial.println("Cloud: impossible de creer les files reseau");
  }
}

void setAp(bool on) {
  if (on == apOn) return;
  if (on) startAp(); else stopAp();
  S.apEnabled = on;
  settingsSave();
}

String ip() { return apOn ? WiFi.softAPIP().toString() : String("-"); }
int clients() { return apOn ? WiFi.softAPgetStationNum() : 0; }

void update() {
  uint32_t now = millis();
  if (apOn) {
    server.handleClient();
    ws.loop();
    ArduinoOTA.handle();
  }

  if (apOn && now - lastPush >= 2000) {
    lastPush = now;
    const char* eau = Control::water == Control::WTR_OK ? "OK" : Control::water == Control::WTR_LOW ? "BASSE" : "VIDE";
    char buf[220];
    snprintf(buf, sizeof buf,
             "{\"t\":%.1f,\"ts\":%.1f,\"h\":%.1f,\"hs\":%.0f,\"pid\":%.0f,\"fan\":%d,\"hum\":%d,\"pump\":%d,\"eau\":\"%s\",\"al\":\"%s\",\"day\":%d,\"sensor_fault\":%s}",
             isnan(Sensors::temp) ? 0.0f : Sensors::temp, Control::effTemp,
             isnan(Sensors::hum) ? 0.0f : Sensors::hum, Control::effHum,
             Control::pidOut, Control::fanOn ? 1 : 0, Control::humOn ? 1 : 0,
             Control::pumpOn ? 1 : 0, eau, Alarms::name(Alarms::top()), Control::day,
             Sensors::dhtOk ? "false" : "true");
    ws.broadcastTXT(buf);
  }

  if (cloudCommandQueue && cloudAckQueue) {
    CloudCommand command;
    while (xQueueReceive(cloudCommandQueue, &command, 0) == pdTRUE) {
      bool success = applyCloudCommand(command);
      CloudAck ack = {};
      strncpy(ack.id, command.id, sizeof(ack.id) - 1);
      ack.success = success;
      if (xQueueSend(cloudAckQueue, &ack, 0) != pdTRUE) {
        Serial.println("Cloud: file d'accuses pleine");
      }
      if (!success) {
        Serial.printf("Cloud: commande non prise en charge (%s/%s)\n",
                      command.actuator, command.action);
      }
    }
  }

  if (cloudQueue && now - lastCloudPush >= 5000) {
    lastCloudPush = now;
    CloudReading reading = {
      Sensors::dhtOk ? Sensors::temp : 0.0f,
      Sensors::dhtOk ? Sensors::hum : 0.0f,
      Control::pidOut,
      Control::fanOn,
      Control::pumpOn,
      Control::water == Control::WTR_LOW,
      Control::water == Control::WTR_EMPTY,
      Sensors::limL,
      Sensors::limR,
      Turner::fault,
      !Sensors::dhtOk,
    };
    xQueueOverwrite(cloudQueue, &reading);
  }
}

}
