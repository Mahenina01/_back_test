#include <Arduino.h>
#include <esp_task_wdt.h>
#include "core.h"
#include "config.h"

namespace Core {

void wdtBegin() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t cfg = {};
  cfg.timeout_ms = WDT_TIMEOUT_S * 1000;
  cfg.idle_core_mask = 0;
  cfg.trigger_panic = true;
  if (esp_task_wdt_reconfigure(&cfg) != ESP_OK) esp_task_wdt_init(&cfg);
#else
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif
  esp_task_wdt_add(NULL);
}

void wdtFeed()   { esp_task_wdt_reset(); }
void wdtPause()  { esp_task_wdt_delete(NULL); }
void wdtResume() { esp_task_wdt_add(NULL); }

}
