#pragma once
#include <Arduino.h>

namespace Turner {
enum State : uint8_t { T_IDLE, T_RUN, T_FAULT };
extern State state;
extern bool fault;

void begin();
void update();
void requestTurn();
void ackFault();
long secondsToNext();
}
