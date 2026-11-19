#pragma once
#include <Arduino.h>

namespace Net {
extern bool apOn;
void begin();
void update();
void setAp(bool on);
String ip();
int clients();
}
