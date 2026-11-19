#include <Wire.h>
#include <DHT.h>
#include <RTClib.h>
#include "sensors.h"
#include "config.h"

namespace Sensors {

float temp = NAN, hum = NAN;
bool dhtOk = true, rtcOk = false, limL = false, limR = false, waterOk = true;

static DHT dht(PIN_DHT22, DHT22);
static RTC_DS3231 rtc;
static uint32_t lastRead = 0, lastValid = 0;
static uint32_t epoch0 = FALLBACK_EPOCH, ms0 = 0, lastRtc = 0;

struct Deb { bool raw; bool state; uint32_t t; };
static Deb dL, dR, dW;

static bool rdL() { return digitalRead(PIN_LIMIT_L) == LOW; }
static bool rdR() { return digitalRead(PIN_LIMIT_R) == LOW; }
static bool rdW() { return digitalRead(PIN_WATER_LEVEL) == HIGH; }

static bool debounce(Deb& d, bool raw, uint32_t now) {
  if (raw != d.raw) { d.raw = raw; d.t = now; }
  if (now - d.t >= 20) d.state = raw;
  return d.state;
}

void begin() {
  pinMode(PIN_LIMIT_L, INPUT);
  pinMode(PIN_LIMIT_R, INPUT);
  pinMode(PIN_WATER_LEVEL, INPUT);
  dL = {rdL(), rdL(), 0};
  dR = {rdR(), rdR(), 0};
  dW = {rdW(), rdW(), 0};
  limL = dL.state; limR = dR.state; waterOk = dW.state;

  dht.begin();

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  rtcOk = rtc.begin();
  if (rtcOk) {
    if (rtc.lostPower()) rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    epoch0 = rtc.now().unixtime();
  }
  ms0 = millis();
}

void update() {
  uint32_t now = millis();

  if (now - lastRead >= DHT_PERIOD_MS) {
    lastRead = now;
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h) && t > -20 && t < 80 && h >= 0 && h <= 100) {
      temp = t; hum = h; lastValid = now;
    }
  }
  dhtOk = (now - lastValid) < DHT_LOST_MS;

  limL = debounce(dL, rdL(), now);
  limR = debounce(dR, rdR(), now);
  waterOk = debounce(dW, rdW(), now);

  if (rtcOk && now - lastRtc >= 1000) {
    lastRtc = now;
    epoch0 = rtc.now().unixtime();
    ms0 = now;
  }
}

uint32_t nowEpoch() { return epoch0 + (millis() - ms0) / 1000; }

void splitEpoch(uint32_t e, int& y, int& mo, int& d, int& h, int& mi) {
  DateTime dt(e);
  y = dt.year(); mo = dt.month(); d = dt.day(); h = dt.hour(); mi = dt.minute();
}

void getTime(int& y, int& mo, int& d, int& h, int& mi) {
  splitEpoch(nowEpoch(), y, mo, d, h, mi);
}

void setTime(int y, int mo, int d, int h, int mi) {
  DateTime dt(y, mo, d, h, mi, 0);
  if (rtcOk) rtc.adjust(dt);
  epoch0 = dt.unixtime();
  ms0 = millis();
  lastRtc = ms0;
}

}
