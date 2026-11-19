#include <TFT_eSPI.h>
#include <Preferences.h>
#include <math.h>
#include "ui.h"
#include "config.h"
#include "core.h"
#include "settings.h"
#include "sensors.h"
#include "control.h"
#include "turner.h"
#include "alarms.h"
#include "net.h"

#define COL(r, g, b) ((((r) & 0xF8) << 8) | (((g) & 0xFC) << 3) | ((b) >> 3))
#define C_RED      COL(255, 59, 48)
#define C_ORANGE   COL(255, 159, 28)
#define C_YELLOW   COL(255, 204, 0)
#define C_BLUE     COL(52, 152, 255)
#define C_BLUE_DIM COL(30, 80, 140)
#define C_GREEN    COL(52, 199, 89)
#define C_CREAM    COL(240, 220, 170)
#define C_DIM      COL(150, 160, 175)
#define C_DARK     COL(60, 66, 78)
#define C_SLEEP    COL(80, 86, 100)
#define C_LINE     COL(40, 46, 58)
#define C_BORDER   COL(90, 100, 120)
#define C_OK       COL(21, 128, 61)
#define C_WARN     COL(153, 27, 27)
#define C_GRAY     COL(51, 65, 85)
#define C_BTN      COL(30, 41, 59)

namespace Ui {

static TFT_eSPI tft;

enum Scr : uint8_t { S_DASH, S_MENU, S_TEMP, S_HUM, S_TURN, S_WATER, S_RTC, S_WIFI, S_ALARM, S_INFO, S_SLEEP };
static Scr scr = S_DASH;

static uint32_t lastActivity = 0, lastTick = 0, lastPoll = 0, pressMs = 0, repMs = 0, confirmUntil = 0;
static bool wasT = false, repeatable = false, dirty = false;
static uint16_t tx = 0, ty = 0;
static uint16_t cal[5];

struct Btn { int16_t x, y, w, h; const char* label; uint16_t bg, fg; };

static bool hit(const Btn& b, int x, int y, int pad = 0) {
  return x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
}

static void drawBtn(const Btn& b, const char* label = nullptr) {
  const char* l = label ? label : b.label;
  tft.fillRoundRect(b.x, b.y, b.w, b.h, 6, b.bg);
  tft.drawRoundRect(b.x, b.y, b.w, b.h, 6, C_BORDER);
  int font = (b.h < 30 || (int)strlen(l) * 14 > b.w - 8) ? 2 : 4;
  tft.setTextDatum(MC_DATUM);
  tft.setTextPadding(0);
  tft.setTextColor(b.fg, b.bg);
  tft.drawString(l, b.x + b.w / 2, b.y + b.h / 2, font);
}

static const Btn B_MENU  = {242, 3, 72, 22, "MENU", C_BTN, TFT_WHITE};
static const Btn B_ALARM = {242, 27, 72, 22, "ALARMES", C_BTN, TFT_WHITE};
static const Btn B_BACK  = {8, 204, 304, 32, "Retour", C_GRAY, TFT_WHITE};

struct MItem { Btn b; Scr s; };
static const MItem MENU[8] = {
  {{8,   44, 70, 72, "Temp.",   C_BTN, TFT_WHITE}, S_TEMP},
  {{86,  44, 70, 72, "Humid.",  C_BTN, TFT_WHITE}, S_HUM},
  {{164, 44, 70, 72, "Retour.", C_BTN, TFT_WHITE}, S_TURN},
  {{242, 44, 70, 72, "Reserv.", C_BTN, TFT_WHITE}, S_WATER},
  {{8,  124, 70, 72, "Heure",   C_BTN, TFT_WHITE}, S_RTC},
  {{86, 124, 70, 72, "Wi-Fi",   C_BTN, TFT_WHITE}, S_WIFI},
  {{164,124, 70, 72, "Alarmes", C_BTN, TFT_WHITE}, S_ALARM},
  {{242,124, 70, 72, "Systeme", C_BTN, TFT_WHITE}, S_INFO},
};

#define NCACHE 24
static char cacheS[NCACHE][40];
static uint16_t cacheC[NCACHE];
static void cacheClear() { memset(cacheS, 0, sizeof cacheS); memset(cacheC, 0, sizeof cacheC); }

static void txt(uint8_t id, const char* s, int x, int y, uint8_t font, uint16_t fg, int pad,
                uint8_t datum = TL_DATUM, uint16_t bg = TFT_BLACK) {
  if (id < NCACHE) {
    if (cacheC[id] == fg && strncmp(cacheS[id], s, 39) == 0) return;
    strncpy(cacheS[id], s, 39); cacheS[id][39] = 0; cacheC[id] = fg;
  }
  tft.setTextDatum(datum);
  tft.setTextPadding(pad);
  tft.setTextColor(fg, bg);
  tft.drawString(s, x, y, font);
  tft.setTextPadding(0);
}

static void dynBtn(uint8_t id, const Btn& b, const char* label) {
  if (strncmp(cacheS[id], label, 39) == 0) return;
  strncpy(cacheS[id], label, 39); cacheS[id][39] = 0;
  drawBtn(b, label);
}

static void title(const char* t) {
  tft.fillScreen(TFT_BLACK);
  cacheClear();
  tft.setTextDatum(TL_DATUM);
  tft.setTextPadding(0);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString(t, 8, 5, 4);
  tft.drawFastHLine(0, 34, 320, C_ORANGE);
}

enum RT : uint8_t { R_F, R_U8, R_U16, R_I, R_FAN };
struct Row { const char* label; void* p; RT type; float mn, mx, step; uint8_t dec; };

static int edDay, edMon, edYear, edHour, edMin;

static const Row ROWS_TEMP[] = {
  {"Consigne (C)",   &S.tempSet, R_F, 30.0f, 40.0f, 0.1f, 1},
  {"Hysteresis (C)", &S.tempHyst, R_F, 0.1f, 3.0f, 0.1f, 1},
  {"Kp",             &S.kp, R_F, 0.0f, 100.0f, 1.0f, 1},
  {"Ki",             &S.ki, R_F, 0.0f, 5.0f, 0.01f, 2},
  {"Kd",             &S.kd, R_F, 0.0f, 200.0f, 1.0f, 0},
};
static const Row ROWS_HUM[] = {
  {"Consigne (%)",   &S.humSet, R_F, 30.0f, 90.0f, 1.0f, 0},
  {"Hysteresis (%)", &S.humHyst, R_F, 1.0f, 15.0f, 1.0f, 0},
  {"Pompe max (s)",  &S.pumpMaxSec, R_U16, 10, 300, 5, 0},
  {"Ventilation",    &S.fanMode, R_FAN, 0, 2, 1, 0},
};
static const Row ROWS_TURN[] = {
  {"Intervalle (h)", &S.turnIntervalH, R_U8, 1, 12, 1, 0},
};
static const Row ROWS_RTC[] = {
  {"Jour",   &edDay,  R_I, 1, 31, 1, 0},
  {"Mois",   &edMon,  R_I, 1, 12, 1, 0},
  {"Annee",  &edYear, R_I, 2024, 2099, 1, 0},
  {"Heure",  &edHour, R_I, 0, 23, 1, 0},
  {"Minute", &edMin,  R_I, 0, 59, 1, 0},
};

static const Row* rows = nullptr;
static uint8_t nrows = 0;
static int rowY0 = 40, rowPitch = 32;
static bool rowSave = true;

static void setRows(const Row* r, uint8_t n, int y0, int pitch, bool save) {
  rows = r; nrows = n; rowY0 = y0; rowPitch = pitch; rowSave = save;
}

static void rowVal(const Row& r, char* o, size_t n) {
  switch (r.type) {
    case R_F:   snprintf(o, n, "%.*f", r.dec, *(float*)r.p); break;
    case R_U8:  snprintf(o, n, "%u", *(uint8_t*)r.p); break;
    case R_U16: snprintf(o, n, "%u", *(uint16_t*)r.p); break;
    case R_I:   snprintf(o, n, "%d", *(int*)r.p); break;
    case R_FAN: { static const char* m[] = {"AUTO", "ON", "OFF"}; snprintf(o, n, "%s", m[*(uint8_t*)r.p % 3]); } break;
  }
}

static bool rowAdjust(const Row& r, int dir) {
  switch (r.type) {
    case R_F: {
      float f = powf(10.0f, r.dec);
      float v = constrain(*(float*)r.p + dir * r.step, r.mn, r.mx);
      v = roundf(v * f) / f;
      if (v == *(float*)r.p) return false;
      *(float*)r.p = v; return true;
    }
    case R_U8:  { int v = constrain((int)*(uint8_t*)r.p + dir * (int)r.step, (int)r.mn, (int)r.mx);
                  if (v == *(uint8_t*)r.p) return false; *(uint8_t*)r.p = v; return true; }
    case R_U16: { int v = constrain((int)*(uint16_t*)r.p + dir * (int)r.step, (int)r.mn, (int)r.mx);
                  if (v == *(uint16_t*)r.p) return false; *(uint16_t*)r.p = v; return true; }
    case R_I:   { int v = constrain(*(int*)r.p + dir * (int)r.step, (int)r.mn, (int)r.mx);
                  if (v == *(int*)r.p) return false; *(int*)r.p = v; return true; }
    case R_FAN: { *(uint8_t*)r.p = (*(uint8_t*)r.p + dir + 3) % 3; return true; }
  }
  return false;
}

static void refreshRows() {
  for (uint8_t i = 0; i < nrows; i++) {
    int cy = rowY0 + i * rowPitch + rowPitch / 2;
    char b[16];
    rowVal(rows[i], b, sizeof b);
    txt(i, b, 214, cy, 4, C_ORANGE, 64, MR_DATUM);
  }
}

static void drawRows() {
  for (uint8_t i = 0; i < nrows; i++) {
    int y = rowY0 + i * rowPitch;
    tft.setTextDatum(ML_DATUM);
    tft.setTextPadding(0);
    tft.setTextColor(TFT_LIGHTGREY, TFT_BLACK);
    tft.drawString(rows[i].label, 8, y + rowPitch / 2, 2);
    Btn m = {222, (int16_t)(y + 1), 44, (int16_t)(rowPitch - 2), "-", C_GRAY, TFT_WHITE};
    Btn p = {270, (int16_t)(y + 1), 44, (int16_t)(rowPitch - 2), "+", C_GRAY, TFT_WHITE};
    drawBtn(m); drawBtn(p);
  }
  refreshRows();
}

static bool rowTouch(int x, int y) {
  for (uint8_t i = 0; i < nrows; i++) {
    int ry = rowY0 + i * rowPitch;
    if (y < ry || y > ry + rowPitch) continue;
    int dir = (x >= 216 && x <= 267) ? -1 : (x >= 268) ? 1 : 0;
    if (!dir) continue;
    if (rowAdjust(rows[i], dir)) { if (rowSave) dirty = true; refreshRows(); }
    return true;
  }
  return false;
}

static const char* calKey() {
  static char k[8];
  snprintf(k, sizeof k, "calr%d", UI_ROTATION);
  return k;
}

static bool loadCal() {
  Preferences p;
  p.begin("touch", true);
  bool ok = p.getBytesLength(calKey()) == sizeof(cal);
  if (ok) p.getBytes(calKey(), cal, sizeof(cal));
  p.end();
  return ok;
}

static void runCal() {
  Core::wdtPause();
  tft.fillScreen(TFT_BLACK);
  tft.setTextDatum(MC_DATUM);
  tft.setTextPadding(0);
  tft.setTextColor(TFT_WHITE, TFT_BLACK);
  tft.drawString("Touchez les coins", 160, 120, 4);
  tft.calibrateTouch(cal, TFT_MAGENTA, TFT_BLACK, 15);
  Preferences p;
  p.begin("touch", false);
  p.putBytes(calKey(), cal, sizeof(cal));
  p.end();
  tft.setTouch(cal);
  Core::wdtResume();
}

static uint16_t icCol[6];
static int lastBarT = -1, lastBarH = -1;

static void icSun(int cx, int cy, int r, uint16_t c) {
  int rin = r + r / 3 + 1, rout = r + (r * 2) / 3 + 3, rc = rout + 1;
  tft.fillRect(cx - rc, cy - rc, 2 * rc + 1, 2 * rc + 1, TFT_BLACK);
  tft.fillCircle(cx, cy, r, c);
  for (int k = 0; k < 8; k++) {
    float a = k * 0.785398f;
    tft.drawLine(cx + (int)(cosf(a) * rin), cy + (int)(sinf(a) * rin),
                 cx + (int)(cosf(a) * rout), cy + (int)(sinf(a) * rout), c);
  }
}
static void icDrop(int cx, int cy, int s, uint16_t c) {
  tft.fillRect(cx - s, cy - s - 1, 2 * s + 1, 2 * s + 3, TFT_BLACK);
  int r = (s * 3) / 4;
  tft.fillTriangle(cx, cy - s, cx - r, cy + s / 5, cx + r, cy + s / 5, c);
  tft.fillCircle(cx, cy + s / 4, r, c);
}
static void icFan(int cx, int cy, int r, uint16_t c) {
  tft.fillRect(cx - r - 1, cy - r - 1, 2 * r + 3, 2 * r + 3, TFT_BLACK);
  for (int k = 0; k < 4; k++) {
    float a = k * 1.570796f + 0.4f;
    tft.fillCircle(cx + (int)(cosf(a) * r * 0.55f), cy + (int)(sinf(a) * r * 0.55f), (int)(r * 0.42f), c);
  }
  tft.fillCircle(cx, cy, r / 5, TFT_BLACK);
}
static void icEgg(int cx, int cy, int r, uint16_t c) {
  tft.fillRect(cx - r, cy - r - 1, 2 * r + 1, 2 * r + 3, TFT_BLACK);
  tft.fillEllipse(cx, cy, (r * 3) / 4, r, c);
}
static void icon(uint8_t slot, uint16_t c, void (*fn)(int, int, int, uint16_t), int cx, int cy, int r) {
  if (icCol[slot] == c) return;
  icCol[slot] = c;
  fn(cx, cy, r, c);
}

static void bar(int x, int y, int w, float frac, uint16_t col, int* last) {
  if (isnan(frac)) frac = 0;
  int f = constrain((int)(frac * w), 0, w);
  if (*last == f) return;
  *last = f;
  tft.fillRect(x, y, f, 6, col);
  tft.fillRect(x + f, y, w - f, 6, C_LINE);
}

static void drawDash() {
  tft.fillScreen(TFT_BLACK);
  cacheClear();
  memset(icCol, 0, sizeof icCol);
  lastBarT = lastBarH = -1;
  tft.setTextPadding(0);
  tft.setTextDatum(TL_DATUM);
  tft.setTextColor(C_DIM, TFT_BLACK);
  tft.drawString("TEMPERATURE", 8, 54, 2);
  tft.drawString("HUMIDITE", 168, 54, 2);
  tft.drawCircle(127, 80, 3, C_RED);
  tft.drawCircle(127, 80, 2, C_RED);
  tft.setTextColor(C_RED, TFT_BLACK);
  tft.drawString("C", 133, 75, 4);
  tft.setTextColor(C_BLUE, TFT_BLACK);
  tft.drawString("%", 240, 82, 4);
  tft.drawFastVLine(160, 56, 90, C_LINE);
  tft.drawFastHLine(8, 150, 304, C_LINE);
  static const char* lab[4] = {"CHAUFF", "VENTIL", "EAU", "RETOUR"};
  tft.setTextDatum(TC_DATUM);
  tft.setTextColor(C_DIM, TFT_BLACK);
  for (int i = 0; i < 4; i++) tft.drawString(lab[i], 40 + i * 80, 154, 2);
  drawBtn(B_MENU);
  drawBtn(B_ALARM);
}

static const char* DOW[7] = {"DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"};
static const char* MON3[12] = {"JAN", "FEV", "MAR", "AVR", "MAI", "JUN", "JUL", "AOU", "SEP", "OCT", "NOV", "DEC"};

static void refreshDash() {
  char b[48];
  int y, mo, d, h, mi;
  Sensors::getTime(y, mo, d, h, mi);

  snprintf(b, sizeof b, "%02d:%02d", h, mi);
  txt(0, b, 8, 0, 6, TFT_WHITE, 0, TL_DATUM);
  snprintf(b, sizeof b, "%s %02d %s", DOW[(Sensors::nowEpoch() / 86400UL + 4) % 7], d, MON3[(mo - 1) % 12]);
  txt(1, b, 192, 6, 2, TFT_WHITE, 92, TC_DATUM);
  snprintf(b, sizeof b, "WiFi: %s", Net::apOn ? "AP" : "OFF");
  txt(2, b, 192, 28, 2, Net::apOn ? C_GREEN : C_DIM, 92, TC_DATUM);

  if (isnan(Sensors::temp)) snprintf(b, sizeof b, "--.-"); else snprintf(b, sizeof b, "%.1f", Sensors::temp);
  txt(3, b, 8, 70, 6, C_RED, 112, TL_DATUM);
  uint16_t heatCol = Control::pidOut > 1 ? C_YELLOW : C_DARK;
  icon(0, heatCol, icSun, 140, 62, 5);
  bar(8, 120, 140, Control::pidOut / 100.0f, C_RED, &lastBarT);
  snprintf(b, sizeof b, "Cons %.1f", Control::effTemp);
  txt(4, b, 8, 130, 2, C_ORANGE, 80, TL_DATUM);
  snprintf(b, sizeof b, "PID %.0f%%", Control::pidOut);
  txt(5, b, 152, 130, 2, C_ORANGE, 64, TR_DATUM);

  if (isnan(Sensors::hum)) snprintf(b, sizeof b, "--"); else snprintf(b, sizeof b, "%.0f", Sensors::hum);
  txt(6, b, 168, 70, 6, C_BLUE, 64, TL_DATUM);
  icon(1, Control::humOn ? C_BLUE : C_BLUE_DIM, icDrop, 300, 62, 9);
  bar(168, 120, 144, Sensors::hum / 100.0f, C_BLUE, &lastBarH);
  snprintf(b, sizeof b, "Cons %.0f%%", Control::effHum);
  txt(7, b, 168, 130, 2, C_ORANGE, 80, TL_DATUM);
  snprintf(b, sizeof b, "Humid %s", Control::humOn ? "ON" : "OFF");
  txt(8, b, 312, 130, 2, C_ORANGE, 72, TR_DATUM);

  icon(2, heatCol, icSun, 40, 186, 5);
  snprintf(b, sizeof b, "%.0f%%", Control::pidOut);
  txt(9, b, 40, 204, 2, Control::pidOut > 1 ? C_YELLOW : C_DIM, 70, TC_DATUM);

  icon(3, Control::fanOn ? C_GREEN : C_DARK, icFan, 120, 186, 9);
  const char* fm = S.fanMode == 0 ? "AUTO" : S.fanMode == 1 ? "ON" : "OFF";
  txt(10, fm, 120, 204, 2, Control::fanOn ? C_GREEN : C_DIM, 70, TC_DATUM);

  const char* eau = Control::water == Control::WTR_OK ? "OK" : Control::water == Control::WTR_LOW ? "BASSE" : "VIDE";
  uint16_t ec = Control::water == Control::WTR_OK ? C_BLUE : Control::water == Control::WTR_LOW ? C_ORANGE : C_RED;
  icon(4, ec, icDrop, 200, 186, 9);
  txt(11, eau, 200, 204, 2, ec, 70, TC_DATUM);

  uint16_t eggCol = Turner::fault ? C_RED : Turner::state == Turner::T_RUN ? C_ORANGE
                   : (Control::effTurn && S.turnAuto) ? C_CREAM : C_DARK;
  icon(5, eggCol, icEgg, 280, 186, 9);
  long s = Turner::secondsToNext();
  if (Turner::state == Turner::T_RUN) snprintf(b, sizeof b, "TOURNE");
  else if (Turner::fault) snprintf(b, sizeof b, "DEFAUT");
  else if (s < 0) snprintf(b, sizeof b, "OFF");
  else snprintf(b, sizeof b, "%ldh%02ld", s / 3600, (s % 3600) / 60);
  txt(12, b, 280, 204, 2, eggCol == C_DARK ? C_DIM : eggCol, 70, TC_DATUM);

  AlarmId a = Alarms::top();
  if (a != AL_NONE) txt(13, Alarms::name(a), 160, 224, 2, TFT_WHITE, 316, TC_DATUM, TFT_RED);
  else {
    const char* ph = Control::phase == 0 ? "PHASE 1" : Control::phase == 1 ? "PHASE 2" : "PROFIL PERSO";
    if (Control::day > 0) snprintf(b, sizeof b, "%s - JOUR %d   |   Aucune alarme", ph, Control::day);
    else snprintf(b, sizeof b, "%s   |   Aucune alarme", ph);
    txt(13, b, 160, 224, 2, C_DIM, 316, TC_DATUM);
  }
}

static void drawMenu() {
  title("Menu");
  for (const MItem& m : MENU) drawBtn(m.b);
  drawBtn(B_BACK);
}

static void drawTemp() {
  title("Temperature");
  setRows(ROWS_TEMP, 5, 40, 32, true);
  drawRows();
  drawBtn(B_BACK);
}
static void drawHum() {
  title("Humidite");
  setRows(ROWS_HUM, 4, 40, 32, true);
  drawRows();
  drawBtn(B_BACK);
}

static const Btn B_TMODE = {8, 80, 148, 40, "Mode", C_BTN, TFT_WHITE};
static const Btn B_TNOW  = {164, 80, 148, 40, "Tourner maintenant", C_OK, TFT_WHITE};

static void drawTurn() {
  title("Retournement");
  setRows(ROWS_TURN, 1, 40, 32, true);
  drawRows();
  drawBtn(B_TNOW);
  drawBtn(B_BACK);
}
static void refreshTurn() {
  dynBtn(8, B_TMODE, S.turnAuto ? "Mode: AUTO" : "Mode: MANUEL");
  char b[48];
  const char* st = Turner::state == Turner::T_RUN ? "EN COURS" : Turner::fault ? "DEFAUT MOTEUR" : "Repos";
  snprintf(b, sizeof b, "Etat: %s", st);
  txt(9, b, 8, 134, 2, Turner::fault ? C_RED : C_GREEN, 304);
  long s = Turner::secondsToNext();
  if (s < 0) snprintf(b, sizeof b, "Prochain retournement: --");
  else snprintf(b, sizeof b, "Prochain retournement: %ldh%02ld", s / 3600, (s % 3600) / 60);
  txt(10, b, 8, 156, 2, TFT_LIGHTGREY, 304);
  snprintf(b, sizeof b, "Fins de course   G: %s    D: %s", Sensors::limL ? "ON" : "-", Sensors::limR ? "ON" : "-");
  txt(11, b, 8, 178, 2, TFT_LIGHTGREY, 304);
}

static const Btn B_PURGE = {8, 160, 304, 36, "Purge pompe 5 s", C_BTN, TFT_WHITE};

static void drawWater() {
  title("Reservoir");
  drawBtn(B_PURGE);
  drawBtn(B_BACK);
}
static void refreshWater() {
  char b[48];
  const char* eau = Control::water == Control::WTR_OK ? "OK" : Control::water == Control::WTR_LOW ? "BASSE" : "VIDE";
  uint16_t ec = Control::water == Control::WTR_OK ? C_BLUE : Control::water == Control::WTR_LOW ? C_ORANGE : C_RED;
  snprintf(b, sizeof b, "Niveau: %s", eau);
  txt(8, b, 8, 44, 4, ec, 304);
  snprintf(b, sizeof b, "Pompe: %s", Control::pumpOn ? "ON" : "OFF");
  txt(9, b, 8, 80, 4, Control::pumpOn ? C_YELLOW : TFT_LIGHTGREY, 304);
  snprintf(b, sizeof b, "Capteur: %s", Sensors::waterOk ? "eau detectee" : "pas d'eau");
  txt(10, b, 8, 118, 2, TFT_LIGHTGREY, 304);
  snprintf(b, sizeof b, "Duree max pompe: %u s", S.pumpMaxSec);
  txt(11, b, 8, 138, 2, TFT_LIGHTGREY, 304);
}

static const Btn B_RAPPLY = {8, 174, 92, 26, "Appliquer", C_OK, TFT_WHITE};
static const Btn B_RPHASE = {104, 174, 112, 26, "Phase", C_BTN, TFT_WHITE};
static const Btn B_RSTART = {220, 174, 92, 26, "Demarrer", C_BTN, TFT_WHITE};

static int daysInMonth(int y, int m) {
  static const uint8_t d[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  if (m == 2 && ((y % 4 == 0 && y % 100 != 0) || y % 400 == 0)) return 29;
  return d[m - 1];
}

static void drawRtc() {
  title("Horloge");
  int y, mo, d, h, mi;
  Sensors::getTime(y, mo, d, h, mi);
  edYear = y; edMon = mo; edDay = d; edHour = h; edMin = mi;
  setRows(ROWS_RTC, 5, 40, 26, false);
  drawRows();
  drawBtn(B_RAPPLY);
  drawBtn(B_BACK);
}
static void refreshRtc() {
  dynBtn(9, B_RPHASE, S.phaseAuto ? "Phase AUTO" : "Phase PERSO");
  const char* l = millis() < confirmUntil ? "Confirmer?" : (S.startEpoch ? "Redemarrer" : "Demarrer");
  dynBtn(10, B_RSTART, l);
}

static const Btn B_WTOG = {8, 150, 304, 40, "Wi-Fi", C_BTN, TFT_WHITE};

static void drawWifi() {
  title("Wi-Fi");
  tft.setTextDatum(TL_DATUM);
  tft.setTextPadding(0);
  tft.setTextColor(TFT_LIGHTGREY, TFT_BLACK);
  tft.drawString("SSID: " AP_SSID, 8, 46, 2);
  tft.drawString("Mot de passe: " AP_PASS, 8, 66, 2);
  tft.drawString("WebSocket: port 81    OTA: couveuse.local", 8, 126, 2);
  drawBtn(B_BACK);
}
static void refreshWifi() {
  char b[48];
  snprintf(b, sizeof b, "IP: %s", Net::ip().c_str());
  txt(8, b, 8, 86, 2, TFT_WHITE, 304);
  snprintf(b, sizeof b, "Clients connectes: %d", Net::clients());
  txt(9, b, 8, 106, 2, TFT_WHITE, 304);
  dynBtn(10, B_WTOG, Net::apOn ? "Point d'acces: ON" : "Point d'acces: OFF");
}

static const Btn B_ACK   = {8, 204, 148, 32, "Acquitter", C_WARN, TFT_WHITE};
static const Btn B_ABACK = {164, 204, 148, 32, "Retour", C_GRAY, TFT_WHITE};

static void drawAlarm() {
  title("Alarmes");
  drawBtn(B_ACK);
  drawBtn(B_ABACK);
}
static void refreshAlarm() {
  uint8_t n = Alarms::journalCount();
  if (n == 0) { txt(8, "Aucune alarme enregistree", 8, 46, 2, C_DIM, 304); return; }
  if (n > 8) n = 8;
  for (uint8_t i = 0; i < n; i++) {
    AlarmEntry e = Alarms::journalEntry(i);
    int y, mo, d, h, mi;
    Sensors::splitEpoch(e.epoch, y, mo, d, h, mi);
    char b[48];
    snprintf(b, sizeof b, "%02d/%02d %02d:%02d   %s", d, mo, h, mi, Alarms::shortName((AlarmId)e.id));
    txt(8 + i, b, 8, 42 + i * 20, 2, Alarms::active((AlarmId)e.id) ? C_RED : TFT_LIGHTGREY, 304);
  }
}

static const Btn B_RECAL = {8, 150, 304, 40, "Recalibrer tactile", C_BTN, TFT_WHITE};

static void drawInfo() {
  title("Systeme");
  drawBtn(B_RECAL);
  drawBtn(B_BACK);
}
static void refreshInfo() {
  char b[40];
  snprintf(b, sizeof b, "Firmware v%s", FW_VERSION);
  txt(8, b, 8, 44, 2, TFT_WHITE, 150);
  uint32_t up = millis() / 1000;
  snprintf(b, sizeof b, "Up: %lud%02luh%02lum", (unsigned long)(up / 86400), (unsigned long)((up % 86400) / 3600), (unsigned long)((up % 3600) / 60));
  txt(9, b, 8, 68, 2, TFT_LIGHTGREY, 150);
  snprintf(b, sizeof b, "Heap: %u o", (unsigned)ESP.getFreeHeap());
  txt(10, b, 8, 92, 2, TFT_LIGHTGREY, 150);
  snprintf(b, sizeof b, "DHT22: %s", Sensors::dhtOk ? "OK" : "ERREUR");
  txt(11, b, 8, 116, 2, Sensors::dhtOk ? C_GREEN : C_RED, 150);
  snprintf(b, sizeof b, "RTC: %s", Sensors::rtcOk ? "OK" : "ABSENTE");
  txt(12, b, 168, 44, 2, Sensors::rtcOk ? C_GREEN : C_RED, 144);
  snprintf(b, sizeof b, "Fin course G:%s D:%s", Sensors::limL ? "ON" : "-", Sensors::limR ? "ON" : "-");
  txt(13, b, 168, 68, 2, TFT_LIGHTGREY, 144);
  snprintf(b, sizeof b, "Capteur eau: %s", Sensors::waterOk ? "eau" : "VIDE");
  txt(14, b, 168, 92, 2, TFT_LIGHTGREY, 144);
}

static void drawSleep() {
  tft.fillScreen(TFT_BLACK);
  cacheClear();
}
static void refreshSleep() {
  int y, mo, d, h, mi;
  Sensors::getTime(y, mo, d, h, mi);
  char b[32];
  snprintf(b, sizeof b, "%02d:%02d", h, mi);
  txt(0, b, 160, 70, 6, C_SLEEP, 0, TC_DATUM);
  if (isnan(Sensors::temp)) snprintf(b, sizeof b, "-- C    -- %%");
  else snprintf(b, sizeof b, "%.1f C    %.0f %%", Sensors::temp, Sensors::hum);
  txt(1, b, 160, 140, 4, C_SLEEP, 260, TC_DATUM);
}

static void refresh() {
  if (scr != S_DASH && scr != S_SLEEP) {
    int y, mo, d, h, mi;
    Sensors::getTime(y, mo, d, h, mi);
    char hb[8];
    snprintf(hb, sizeof hb, "%02d:%02d", h, mi);
    txt(23, hb, 312, 12, 2, C_DIM, 50, TR_DATUM);
  }
  switch (scr) {
    case S_DASH:  refreshDash(); break;
    case S_TEMP:
    case S_HUM:   refreshRows(); break;
    case S_TURN:  refreshRows(); refreshTurn(); break;
    case S_WATER: refreshWater(); break;
    case S_RTC:   refreshRows(); refreshRtc(); break;
    case S_WIFI:  refreshWifi(); break;
    case S_ALARM: refreshAlarm(); break;
    case S_INFO:  refreshInfo(); break;
    case S_SLEEP: refreshSleep(); break;
    default: break;
  }
}

static void go(Scr s) {
  if (dirty) { settingsSave(); dirty = false; }
  scr = s;
  confirmUntil = 0;
  if (PIN_TFT_BL >= 0) digitalWrite(PIN_TFT_BL, s == S_SLEEP ? LOW : HIGH);
  switch (s) {
    case S_DASH:  drawDash(); break;
    case S_MENU:  drawMenu(); break;
    case S_TEMP:  drawTemp(); break;
    case S_HUM:   drawHum(); break;
    case S_TURN:  drawTurn(); break;
    case S_WATER: drawWater(); break;
    case S_RTC:   drawRtc(); break;
    case S_WIFI:  drawWifi(); break;
    case S_ALARM: drawAlarm(); break;
    case S_INFO:  drawInfo(); break;
    case S_SLEEP: drawSleep(); break;
  }
  refresh();
}

static bool onTouch(int x, int y) {
  switch (scr) {
    case S_DASH:
      if (hit(B_MENU, x, y, 3)) go(S_MENU);
      else if (hit(B_ALARM, x, y, 3)) go(S_ALARM);
      break;
    case S_MENU:
      for (const MItem& m : MENU) if (hit(m.b, x, y)) { go(m.s); return false; }
      if (hit(B_BACK, x, y)) go(S_DASH);
      break;
    case S_TEMP:
    case S_HUM:
      if (rowTouch(x, y)) return true;
      if (hit(B_BACK, x, y)) go(S_MENU);
      break;
    case S_TURN:
      if (rowTouch(x, y)) return true;
      if (hit(B_TMODE, x, y)) { S.turnAuto = !S.turnAuto; settingsSave(); refreshTurn(); }
      else if (hit(B_TNOW, x, y)) Turner::requestTurn();
      else if (hit(B_BACK, x, y)) go(S_MENU);
      break;
    case S_WATER:
      if (hit(B_PURGE, x, y)) Control::pumpPurge(5);
      else if (hit(B_BACK, x, y)) go(S_MENU);
      break;
    case S_RTC:
      if (rowTouch(x, y)) return true;
      if (hit(B_RAPPLY, x, y)) {
        int d = min(edDay, daysInMonth(edYear, edMon));
        Sensors::setTime(edYear, edMon, d, edHour, edMin);
        edDay = d;
        refreshRows();
      } else if (hit(B_RPHASE, x, y)) { S.phaseAuto = !S.phaseAuto; settingsSave(); refreshRtc(); }
      else if (hit(B_RSTART, x, y)) {
        if ((int32_t)(confirmUntil - millis()) > 0) {
          S.startEpoch = Sensors::nowEpoch();
          S.lastTurnEpoch = S.startEpoch;
          settingsSave();
          confirmUntil = 0;
        } else confirmUntil = millis() + 5000;
        refreshRtc();
      } else if (hit(B_BACK, x, y)) go(S_MENU);
      break;
    case S_WIFI:
      if (hit(B_WTOG, x, y)) { Net::setAp(!Net::apOn); refreshWifi(); }
      else if (hit(B_BACK, x, y)) go(S_MENU);
      break;
    case S_ALARM:
      if (hit(B_ACK, x, y)) Alarms::ack();
      else if (hit(B_ABACK, x, y)) go(S_DASH);
      break;
    case S_INFO:
      if (hit(B_RECAL, x, y)) { runCal(); go(S_INFO); }
      else if (hit(B_BACK, x, y)) go(S_MENU);
      break;
    default: break;
  }
  return false;
}

void begin() {
  if (PIN_TFT_BL >= 0) { pinMode(PIN_TFT_BL, OUTPUT); digitalWrite(PIN_TFT_BL, HIGH); }
  tft.init();
  tft.setRotation(UI_ROTATION);
  if (loadCal()) tft.setTouch(cal); else runCal();
  lastActivity = millis();
  go(S_DASH);
}

void update() {
  uint32_t now = millis();

  if (Serial.available() && Serial.read() == 'c') { runCal(); go(S_DASH); }

  if (now - lastPoll >= 20) {
    lastPoll = now;
    uint16_t x, y;
    bool t = tft.getTouch(&x, &y, TOUCH_Z_MIN);
    static uint32_t lastDbg = 0;
    if (!t && now - lastDbg > 300) {
      uint16_t z = tft.getTouchRawZ();
      if (z > 100) { lastDbg = now; Serial.printf("Tactile Z=%u (seuil %u)\n", z, (unsigned)TOUCH_Z_MIN); }
    }
    if (t && !wasT) {
      lastActivity = now;
      Serial.printf("Appui x=%u y=%u\n", x, y);
      if (scr == S_SLEEP) go(S_DASH);
      else { tx = x; ty = y; pressMs = repMs = now; repeatable = onTouch(x, y); }
    } else if (t && wasT && repeatable && scr != S_SLEEP) {
      lastActivity = now;
      if (now - pressMs > 500 && now - repMs >= 150) { repMs = now; onTouch(tx, ty); }
    } else if (!t && wasT) {
      if (dirty) { settingsSave(); dirty = false; }
      repeatable = false;
    }
    wasT = t;
  }

  if (Alarms::anyUnacked() && scr == S_SLEEP) { lastActivity = now; go(S_DASH); }

  if (scr != S_SLEEP && now - lastActivity > SLEEP_MS && !Alarms::anyUnacked()) go(S_SLEEP);

  if (now - lastTick >= 250) { lastTick = now; refresh(); }
}

}