#include "input.h"
#include "pins.h"
#include <Arduino.h>
#include <math.h>

namespace {
constexpr float JOY_SMOOTH_ALPHA = 0.35f;
constexpr uint32_t DEBOUNCE_MS   = 18;

bool prevSwingState  = false;
bool prevStrikeState = false;
bool rawSwingPrev    = false;
bool rawStrikePrev   = false;
uint32_t lastSwingChangeMs  = 0;
uint32_t lastStrikeChangeMs = 0;

float smoothTurn = 0.0f;
float smoothFwd  = 0.0f;

float mapAxis(int raw, int center, bool invert) {
  // ESP32-S3 12-bit ADC range: 0..4095
  float diff = (float)(raw - center);
  float span = (diff >= 0.0f) ? (float)(4095 - center) : (float)center;
  if (span < 400.0f) span = 400.0f;
  // Slightly boost usable range because many analog sticks saturate ~10% before rail
  float norm = diff / (span * 0.88f);
  if (norm > 1.0f) norm = 1.0f;
  if (norm < -1.0f) norm = -1.0f;
  if (invert) norm = -norm;

  float absV = fabsf(norm);
  if (absV < JOY_DEADZONE) return 0.0f;
  float scaled = (absV - JOY_DEADZONE) / (1.0f - JOY_DEADZONE);
  return (norm >= 0.0f) ? scaled : -scaled;
}
} // namespace

void inputInit(InputState& in) {
  in = {};
  in.centerAdcX = 2048;
  in.centerAdcY = 2048;

  pinMode(PIN_BTN_SWING_INT, INPUT_PULLUP);
  pinMode(PIN_BTN_SWING_EXT, INPUT_PULLUP);
  pinMode(PIN_BTN_STRIKE_INT, INPUT_PULLUP);
  pinMode(PIN_BTN_STRIKE_EXT, INPUT_PULLUP);

  if (JOY_ENABLE_ADC) {
    analogReadResolution(12);
    analogSetPinAttenuation(PIN_JOY_X, ADC_11db);
    analogSetPinAttenuation(PIN_JOY_Y, ADC_11db);
    inputCalibrateCenter(in);
  }
}

void inputCalibrateCenter(InputState& in) {
  if (!JOY_ENABLE_ADC) {
    in.centerAdcX = 2048;
    in.centerAdcY = 2048;
    return;
  }
  long sumX = 0;
  long sumY = 0;
  constexpr int SAMPLES = 32;
  for (int i = 0; i < SAMPLES; i++) {
    sumX += analogRead(PIN_JOY_X);
    sumY += analogRead(PIN_JOY_Y);
    delay(2);
  }
  int cx = (int)(sumX / SAMPLES);
  int cy = (int)(sumY / SAMPLES);

  // Guard against floating/unwired pins pinned at rail (<300 or >3800)
  in.centerAdcX = (cx > 300 && cx < 3800) ? cx : 2048;
  in.centerAdcY = (cy > 300 && cy < 3800) ? cy : 2048;
  smoothTurn = 0.0f;
  smoothFwd  = 0.0f;
}

void inputUpdate(InputState& in, float dt) {
  const uint32_t nowMs = millis();

  // 1) Tactile switches (active-LOW; built-in OR external)
  in.rawSwingInt  = (digitalRead(PIN_BTN_SWING_INT)  == LOW);
  in.rawSwingExt  = (digitalRead(PIN_BTN_SWING_EXT)  == LOW);
  in.rawStrikeInt = (digitalRead(PIN_BTN_STRIKE_INT) == LOW);
  in.rawStrikeExt = (digitalRead(PIN_BTN_STRIKE_EXT) == LOW);

  const bool rawSwing  = in.rawSwingInt  || in.rawSwingExt;
  const bool rawStrike = in.rawStrikeInt || in.rawStrikeExt;

  if (rawSwing != rawSwingPrev) {
    rawSwingPrev = rawSwing;
    lastSwingChangeMs = nowMs;
  }
  bool debouncedSwing = prevSwingState;
  if ((nowMs - lastSwingChangeMs) >= DEBOUNCE_MS) {
    debouncedSwing = rawSwing;
  }

  if (rawStrike != rawStrikePrev) {
    rawStrikePrev = rawStrike;
    lastStrikeChangeMs = nowMs;
  }
  bool debouncedStrike = prevStrikeState;
  if ((nowMs - lastStrikeChangeMs) >= DEBOUNCE_MS) {
    debouncedStrike = rawStrike;
  }

  in.swingPressed   = (debouncedSwing && !prevSwingState);
  in.swingReleased  = (!debouncedSwing && prevSwingState);
  in.swingHeld      = debouncedSwing;
  prevSwingState    = debouncedSwing;

  in.strikePressed  = (debouncedStrike && !prevStrikeState);
  in.strikeReleased = (!debouncedStrike && prevStrikeState);
  in.strikeHeld     = debouncedStrike;
  prevStrikeState   = debouncedStrike;

  if (in.strikeHeld) {
    in.strikeHoldSec += dt;
  } else {
    in.strikeHoldSec = 0.0f;
  }

  // 2) Analog Joystick (4x oversample to reduce ESP32 ADC noise)
  if (JOY_ENABLE_ADC) {
    int rx = (analogRead(PIN_JOY_X) + analogRead(PIN_JOY_X) +
              analogRead(PIN_JOY_X) + analogRead(PIN_JOY_X)) >> 2;
    int ry = (analogRead(PIN_JOY_Y) + analogRead(PIN_JOY_Y) +
              analogRead(PIN_JOY_Y) + analogRead(PIN_JOY_Y)) >> 2;
    in.rawAdcX = rx;
    in.rawAdcY = ry;

    float targetTurn = mapAxis(rx, in.centerAdcX, JOY_INVERT_X);
    float targetFwd  = mapAxis(ry, in.centerAdcY, JOY_INVERT_Y);

    smoothTurn += (targetTurn - smoothTurn) * JOY_SMOOTH_ALPHA;
    smoothFwd  += (targetFwd  - smoothFwd)  * JOY_SMOOTH_ALPHA;
    if (fabsf(smoothTurn) < 0.02f && targetTurn == 0.0f) smoothTurn = 0.0f;
    if (fabsf(smoothFwd)  < 0.02f && targetFwd  == 0.0f) smoothFwd  = 0.0f;

    in.turn = smoothTurn;
    in.fwd  = smoothFwd;
  } else {
    in.rawAdcX = 2048;
    in.rawAdcY = 2048;
    in.turn = 0.0f;
    in.fwd  = 0.0f;
  }
}
