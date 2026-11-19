#include <Preferences.h>
#include "settings.h"

Settings S;
static const uint32_t MAGIC = 0xC0DE0003;

void settingsSave() {
  Preferences pr;
  pr.begin("couv", false);
  pr.putUInt("magic", MAGIC);
  pr.putBytes("cfg", &S, sizeof(S));
  pr.end();
}

void settingsBegin() {
  Preferences pr;
  pr.begin("couv", true);
  bool ok = pr.getUInt("magic", 0) == MAGIC && pr.getBytesLength("cfg") == sizeof(S);
  if (ok) pr.getBytes("cfg", &S, sizeof(S));
  pr.end();
  if (!ok) settingsSave();
}
