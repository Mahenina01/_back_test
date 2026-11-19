#pragma once
#include <Arduino.h>

enum AlarmId : uint8_t { AL_NONE = 0, AL_TEMP_HIGH, AL_TEMP_LOW, AL_WATER_EMPTY, AL_MOTOR, AL_DHT_LOST, AL_COUNT };

struct AlarmEntry { uint32_t epoch; uint8_t id; uint8_t pad[3]; };

namespace Alarms {
void begin();
void update();
void ack();
bool active(AlarmId id);
AlarmId top();
bool anyUnacked();
const char* name(AlarmId id);
const char* shortName(AlarmId id);
uint8_t journalCount();
AlarmEntry journalEntry(uint8_t i);
}
