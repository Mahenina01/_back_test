#pragma once
#include <Arduino.h>

namespace Control {
enum Water : uint8_t { WTR_OK, WTR_LOW, WTR_EMPTY };

extern float pidOut;
extern float effTemp, effHum;
extern bool effTurn;
extern bool heaterOn, fanOn, humOn, pumpOn;
extern bool safety;
extern bool critHigh, critLow;
extern Water water;
extern uint8_t phase;
extern int day;

void begin();
void update();
void pumpPurge(uint16_t sec);
bool setManualPump(bool on);
}
