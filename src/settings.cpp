#include <Preferences.h>
#include "settings.h"

Settings S;
static const uint32_t PREVIOUS_MAGIC = 0xC0DE0003;
static const uint32_t MAGIC = 0xC0DE0004;

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
  const uint32_t storedMagic = pr.getUInt("magic", 0);
  const bool compatible = (storedMagic == MAGIC || storedMagic == PREVIOUS_MAGIC)
      && pr.getBytesLength("cfg") == sizeof(S);
  if (compatible) pr.getBytes("cfg", &S, sizeof(S));
  pr.end();
  if (storedMagic == PREVIOUS_MAGIC && compatible) S.apEnabled = false;
  if (!compatible || storedMagic == PREVIOUS_MAGIC) settingsSave();
}
