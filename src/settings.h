#pragma once
#include <Arduino.h>

struct Settings {
  float tempSet = 37.8f;
  float tempHyst = 0.5f;
  float kp = 15.0f, ki = 0.05f, kd = 30.0f;
  float humSet = 55.0f;
  float humHyst = 3.0f;
  uint16_t pumpMaxSec = 60;
  uint8_t turnIntervalH = 3;
  uint8_t fanMode = 0;
  bool turnAuto = true;
  bool phaseAuto = true;
  bool apEnabled = false;
  int8_t lastDir = 1;
  uint32_t startEpoch = 0;
  uint32_t lastTurnEpoch = 0;
};

extern Settings S;
void settingsBegin();
void settingsSave();
