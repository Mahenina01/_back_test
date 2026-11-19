#pragma once
#include <Arduino.h>

namespace Sensors {
extern float temp, hum;
extern bool dhtOk, rtcOk;
extern bool limL, limR;
extern bool waterOk;

void begin();
void update();

uint32_t nowEpoch();
void getTime(int& y, int& mo, int& d, int& h, int& mi);
void splitEpoch(uint32_t e, int& y, int& mo, int& d, int& h, int& mi);
void setTime(int y, int mo, int d, int h, int mi);
}
