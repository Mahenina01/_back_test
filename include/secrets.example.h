#pragma once

#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

#define MQTT_HOST "your-broker-hostname"
#define MQTT_PORT 8883
#define MQTT_USERNAME "your-device-user"
#define MQTT_PASSWORD "your-device-password"

// Paste the broker's trusted root CA certificate here, including PEM markers.
#define MQTT_ROOT_CA \
  "-----BEGIN CERTIFICATE-----\n" \
  "paste-your-root-ca-certificate-here\n" \
  "-----END CERTIFICATE-----\n"
