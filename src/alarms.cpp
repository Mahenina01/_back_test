#include <Preferences.h>
#include "alarms.h"
#include "config.h"
#include "sensors.h"
#include "control.h"
#include "turner.h"

namespace Alarms {

static bool act[AL_COUNT], acked[AL_COUNT];

struct Store { uint8_t head; uint8_t count; uint8_t pad[2]; AlarmEntry e[JOURNAL_MAX]; };
static Store store;

static const AlarmId PRIO[] = {AL_TEMP_HIGH, AL_DHT_LOST, AL_MOTOR, AL_WATER_EMPTY, AL_TEMP_LOW};

const char* name(AlarmId id) {
  switch (id) {
    case AL_TEMP_HIGH:   return "TEMP CRITIQUE HAUTE";
    case AL_TEMP_LOW:    return "TEMPERATURE BASSE";
    case AL_WATER_EMPTY: return "NIVEAU EAU VIDE";
    case AL_MOTOR:       return "MOTEUR BLOQUE";
    case AL_DHT_LOST:    return "PERTE SONDE DHT";
    default:             return "AUCUNE";
  }
}
const char* shortName(AlarmId id) {
  switch (id) {
    case AL_TEMP_HIGH:   return "T HAUTE";
    case AL_TEMP_LOW:    return "T BASSE";
    case AL_WATER_EMPTY: return "EAU VIDE";
    case AL_MOTOR:       return "MOTEUR";
    case AL_DHT_LOST:    return "SONDE DHT";
    default:             return "-";
  }
}

static void saveStore() {
  Preferences pr;
  if (!pr.begin("alarm", false)) {
    Serial.println("Preferences: ouverture du namespace NVS 'alarm' impossible.");
    return;
  }
  const size_t bytes = pr.putBytes("j", &store, sizeof(store));
  pr.end();
  if (bytes != sizeof(store)) {
    Serial.println("Preferences: sauvegarde du journal d'alarmes NVS incomplete.");
  }
}

static void logAlarm(AlarmId id) {
  store.e[store.head] = {Sensors::nowEpoch(), (uint8_t)id, {0, 0, 0}};
  store.head = (store.head + 1) % JOURNAL_MAX;
  if (store.count < JOURNAL_MAX) store.count++;
  saveStore();
}

void begin() {
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, OUT_OFF);
  memset(&store, 0, sizeof(store));
  Preferences pr;
  if (!pr.begin("alarm", false)) {
    Serial.println("Preferences: ouverture du namespace NVS 'alarm' impossible; journal vide.");
    return;
  }
  if (pr.isKey("j") && pr.getBytesLength("j") == sizeof(store)) {
    pr.getBytes("j", &store, sizeof(store));
  }
  pr.end();
  if (store.head >= JOURNAL_MAX || store.count > JOURNAL_MAX) memset(&store, 0, sizeof(store));
}

bool active(AlarmId id) { return id < AL_COUNT && act[id]; }

AlarmId top() {
  for (AlarmId id : PRIO) if (act[id]) return id;
  return AL_NONE;
}

static AlarmId topUnacked() {
  for (AlarmId id : PRIO) if (act[id] && !acked[id]) return id;
  return AL_NONE;
}

bool anyUnacked() { return topUnacked() != AL_NONE; }

void ack() {
  for (uint8_t i = 1; i < AL_COUNT; i++) if (act[i]) acked[i] = true;
  if (Turner::fault) Turner::ackFault();
}

static bool pattern(AlarmId id, uint32_t t) {
  switch (id) {
    case AL_TEMP_HIGH:
    case AL_DHT_LOST:    return true;
    case AL_TEMP_LOW:    t %= 5000;  return (t < 150) || (t >= 300 && t < 450);
    case AL_WATER_EMPTY: t %= 10000; return (t < 150) || (t >= 300 && t < 450) || (t >= 600 && t < 750);
    case AL_MOTOR:       t %= 2000;  return t < 1000;
    default:             return false;
  }
}

void update() {
  bool c[AL_COUNT] = {};
  c[AL_TEMP_HIGH]   = Control::critHigh;
  c[AL_TEMP_LOW]    = Control::critLow;
#if FEATURE_WATER_LEVEL
  c[AL_WATER_EMPTY] = (Control::water == Control::WTR_EMPTY);
#else
  c[AL_WATER_EMPTY] = false;
#endif
  c[AL_MOTOR]       = Turner::fault;
  c[AL_DHT_LOST]    = !Sensors::dhtOk;

  for (uint8_t i = 1; i < AL_COUNT; i++) {
    if (c[i] && !act[i]) { act[i] = true; acked[i] = false; logAlarm((AlarmId)i); }
    else if (!c[i] && act[i]) { act[i] = false; acked[i] = false; }
  }

  static AlarmId lastTop = AL_NONE;
  static uint32_t t0 = 0;
  AlarmId t = topUnacked();
  if (t != lastTop) { lastTop = t; t0 = millis(); }
  bool on = (t != AL_NONE) && pattern(t, millis() - t0);
  digitalWrite(PIN_BUZZER, on ? OUT_ON : OUT_OFF);
}

uint8_t journalCount() { return store.count; }

AlarmEntry journalEntry(uint8_t i) {
  uint8_t idx = (store.head + JOURNAL_MAX * 2 - 1 - i) % JOURNAL_MAX;
  return store.e[idx];
}

}
