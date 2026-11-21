#include "control.h"
#include "config.h"
#include "settings.h"
#include "sensors.h"

namespace Control {

float pidOut = 0, effTemp = 37.8f, effHum = 55.0f;
bool effTurn = true;
bool heaterOn = false, fanOn = false, humOn = false, pumpOn = false;
bool safety = false, critHigh = false, critLow = false;
Water water = WTR_OK;
uint8_t phase = 2;
int day = 0;

static float integ = 0, lastMeas = NAN;
static uint32_t lastPid = 0, winStart = 0, pumpStart = 0, purgeUntil = 0;
static bool lowArmed = false, fanLatch = false;
static bool manualPumpOverride = false, manualPumpOn = false;
static uint32_t manualPumpUntil = 0;

static inline void out(uint8_t pin, bool on) { digitalWrite(pin, on ? OUT_ON : OUT_OFF); }

void begin() {
#if FEATURE_PUMP
  const uint8_t outs[] = {PIN_HEATER, PIN_FAN, PIN_HUMIDIFIER, PIN_PUMP};
#else
  const uint8_t outs[] = {PIN_HEATER, PIN_FAN, PIN_HUMIDIFIER};
#endif
  for (uint8_t p : outs) { pinMode(p, OUTPUT); out(p, false); }
  lastPid = millis();
  winStart = millis();
}

void pumpPurge(uint16_t sec) {
#if FEATURE_PUMP
  purgeUntil = millis() + (uint32_t)sec * 1000UL;
#else
  (void)sec;
#endif
}

bool setManualPump(bool on) {
#if FEATURE_PUMP
  if (on && water == WTR_EMPTY) return false;
  uint16_t durationSec = S.pumpMaxSec < 60 ? S.pumpMaxSec : 60;
  if (durationSec == 0) return false;
  manualPumpOverride = true;
  manualPumpOn = on;
  manualPumpUntil = millis() + (uint32_t)durationSec * 1000UL;
  return true;
#else
  (void)on;
  return false;
#endif
}

static void phaseUpdate() {
  uint32_t now = Sensors::nowEpoch();
  day = (S.startEpoch && now >= S.startEpoch) ? (int)((now - S.startEpoch) / 86400UL) + 1 : 0;
  if (S.phaseAuto && day > 0) {
    if (day <= 18) { phase = 0; effTemp = 37.8f; effHum = 55.0f; effTurn = true; }
    else           { phase = 1; effTemp = 37.2f; effHum = 65.0f; effTurn = false; }
  } else {
    phase = 2; effTemp = S.tempSet; effHum = S.humSet; effTurn = true;
  }
}

static void pidStep(float meas, float dt) {
  float err = effTemp - meas;
  float p = S.kp * err;
  float d = isnan(lastMeas) ? 0.0f : -S.kd * (meas - lastMeas) / dt;
  lastMeas = meas;
  float iTerm = integ + S.ki * err * dt;
  float o = p + iTerm + d;
  if (o > 100.0f)      { o = 100.0f; if (err < 0) integ = iTerm; }
  else if (o < 0.0f)   { o = 0.0f;   if (err > 0) integ = iTerm; }
  else                 { integ = iTerm; }
  integ = constrain(integ, 0.0f, 100.0f);
  pidOut = o;
}

void update() {
  uint32_t now = millis();
  phaseUpdate();

  float t = Sensors::temp, h = Sensors::hum;
  safety = !Sensors::dhtOk || isnan(t) || isnan(h);

  if (!safety) {
    if (t >= TEMP_CRIT_HIGH) critHigh = true; else if (t < TEMP_CRIT_HIGH - 0.5f) critHigh = false;
    if (t >= effTemp - 1.0f) lowArmed = true;
    if (lowArmed && t <= TEMP_LOW) critLow = true; else if (t > TEMP_LOW + 0.5f) critLow = false;
  }

  if (safety) { pidOut = 0; integ = 0; lastMeas = NAN; }
  else if (now - lastPid >= PID_SAMPLE_MS) {
    float dt = (now - lastPid) / 1000.0f;
    lastPid = now;
    pidStep(t, dt);
  }

  float duty = pidOut;
  if (critLow) duty = 100.0f;
  if (safety || critHigh) duty = 0.0f;
  if (now - winStart >= HEATER_WINDOW_MS) winStart = now;
  heaterOn = duty > 0 && (now - winStart) < (uint32_t)(duty * HEATER_WINDOW_MS / 100.0f);
  out(PIN_HEATER, heaterOn);

  if (S.fanMode == 1) fanOn = true;
  else if (S.fanMode == 2) fanOn = false;
  else {
    if (!safety) {
      if (t > effTemp + S.tempHyst) fanLatch = true;
      else if (t < effTemp + S.tempHyst * 0.5f) fanLatch = false;
    }
    fanOn = fanLatch;
  }
  if (critHigh) fanOn = true;
  out(PIN_FAN, fanOn);

  if (Sensors::waterOk) water = WTR_OK;
#if FEATURE_WATER_LEVEL
  else {
    if (water == WTR_OK) { water = WTR_LOW; pumpStart = now; }
    if (water == WTR_LOW && now - pumpStart >= (uint32_t)S.pumpMaxSec * 1000UL) water = WTR_EMPTY;
  }
#else
  else {
    water = WTR_OK;
  }
#endif
#if FEATURE_PUMP
  if (manualPumpOverride && (int32_t)(now - manualPumpUntil) >= 0) {
    manualPumpOverride = false;
  }
  pumpOn = manualPumpOverride
      ? (manualPumpOn && water != WTR_EMPTY)
      : ((water == WTR_LOW) || ((int32_t)(purgeUntil - now) > 0));
#else
  pumpOn = false;
#endif

  if (safety || water == WTR_EMPTY) humOn = false;
  else if (h < effHum - S.humHyst) humOn = true;
  else if (h >= effHum) humOn = false;
  out(PIN_HUMIDIFIER, humOn);
}

}
