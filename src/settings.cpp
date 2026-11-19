#include <Preferences.h>
#include "settings.h"

Settings S;
static const uint32_t MAGIC = 0xC0DE0003;

void settingsSave() {
  Preferences pr;
  if (!pr.begin("couv", false)) {
    Serial.println("Preferences: ouverture du namespace NVS 'couv' impossible.");
    return;
  }
  const size_t magicBytes = pr.putUInt("magic", MAGIC);
  const size_t configBytes = pr.putBytes("cfg", &S, sizeof(S));
  pr.end();
  if (magicBytes != sizeof(MAGIC) || configBytes != sizeof(S)) {
    Serial.println("Preferences: sauvegarde de la configuration NVS incomplete.");
  }
}

void settingsBegin() {
  Preferences pr;
  if (!pr.begin("couv", false)) {
    Serial.println("Preferences: ouverture du namespace NVS 'couv' impossible; configuration par defaut conservee.");
    return;
  }
  bool ok = pr.getUInt("magic", 0) == MAGIC && pr.getBytesLength("cfg") == sizeof(S);
  if (ok) pr.getBytes("cfg", &S, sizeof(S));
  pr.end();
  if (!ok) settingsSave();
}
