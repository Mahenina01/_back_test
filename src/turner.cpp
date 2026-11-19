#include "turner.h"
#include "config.h"
#include "settings.h"
#include "sensors.h"
#include "control.h"

namespace Turner {

State state = T_IDLE;
bool fault = false;

static bool manualReq = false;
static int8_t dir = 1;
static uint32_t startMs = 0;

static void motorStop() { digitalWrite(PIN_MOTOR_IN1, OUT_OFF); digitalWrite(PIN_MOTOR_IN2, OUT_OFF); }
static void motorRun(int8_t d) {
  if (d > 0) { digitalWrite(PIN_MOTOR_IN2, OUT_OFF); digitalWrite(PIN_MOTOR_IN1, OUT_ON); }
  else       { digitalWrite(PIN_MOTOR_IN1, OUT_OFF); digitalWrite(PIN_MOTOR_IN2, OUT_ON); }
}

void begin() {
  pinMode(PIN_MOTOR_IN1, OUTPUT);
  pinMode(PIN_MOTOR_IN2, OUTPUT);
  motorStop();
  if (S.lastTurnEpoch == 0) { S.lastTurnEpoch = Sensors::nowEpoch(); settingsSave(); }
}

void requestTurn() { manualReq = true; }

void ackFault() {
  fault = false;
  state = T_IDLE;
  S.lastTurnEpoch = Sensors::nowEpoch();
  settingsSave();
}

long secondsToNext() {
  if (!Control::effTurn || !S.turnAuto) return -1;
  long total = (long)S.turnIntervalH * 3600L;
  long el = (long)(Sensors::nowEpoch() - S.lastTurnEpoch);
  long rem = total - el;
  return rem < 0 ? 0 : rem;
}

static void startTurn(uint32_t ne) {
  dir = (S.lastDir > 0) ? -1 : 1;
  bool target = (dir > 0) ? Sensors::limR : Sensors::limL;
  if (target) {
    S.lastDir = dir; S.lastTurnEpoch = ne; settingsSave();
    return;
  }
  motorRun(dir);
  startMs = millis();
  state = T_RUN;
}

void update() {
  uint32_t ne = Sensors::nowEpoch();
  switch (state) {
    case T_IDLE: {
      bool due = Control::effTurn && S.turnAuto && ne >= S.lastTurnEpoch &&
                 (ne - S.lastTurnEpoch) >= (uint32_t)S.turnIntervalH * 3600UL;
      if (!fault && (due || manualReq)) startTurn(ne);
      manualReq = false;
      break;
    }
    case T_RUN: {
      bool target = (dir > 0) ? Sensors::limR : Sensors::limL;
      if (target) {
        motorStop();
        S.lastDir = dir; S.lastTurnEpoch = ne;
        settingsSave();
        state = T_IDLE;
      } else if (millis() - startMs >= MOTOR_TIMEOUT_MS) {
        motorStop();
        fault = true;
        state = T_FAULT;
      }
      break;
    }
    case T_FAULT:
      motorStop();
      break;
  }
}

}
