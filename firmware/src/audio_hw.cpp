#include "audio_hw.h"
#include "pins.h"
#include <Arduino.h>

namespace {

struct BuzzerNote {
  uint16_t freq;
  uint16_t durMs;
};

struct SfxDef {
  uint8_t prio;
  uint16_t cdMs;
  const BuzzerNote* notes;
  uint8_t count;
};

// 1:1 Note Tables from js/audio.js
constexpr BuzzerNote NOTES_BOOT[]    = { {392, 32}, {523, 36}, {659, 44}, {784, 72} };
constexpr BuzzerNote NOTES_SHOOT[]   = { {240, 14}, {370, 16}, {494, 14} };
constexpr BuzzerNote NOTES_RELEASE[] = { {330, 14}, {440, 18} };
constexpr BuzzerNote NOTES_PERFECT[] = { {440, 18}, {659, 20}, {880, 34} };
constexpr BuzzerNote NOTES_JUMP[]    = { {220, 16}, {330, 20} };
constexpr BuzzerNote NOTES_SLIDE[]   = { {392, 14}, {523, 18} };
constexpr BuzzerNote NOTES_HIT[]     = { {277, 30}, {196, 32}, {138, 40}, {98, 66} };
constexpr BuzzerNote NOTES_STRIKE[]  = { {440, 14}, {659, 14}, {988, 26} };

constexpr SfxDef SFX_DEFS[(int)SfxId::COUNT] = {
  { 9,  200, NOTES_BOOT,    4 }, // BOOT_CHIME
  { 3,  75,  NOTES_SHOOT,   3 }, // WEB_SHOOT
  { 3,  85,  NOTES_RELEASE, 2 }, // WEB_RELEASE
  { 6,  130, NOTES_PERFECT, 3 }, // PERFECT_RELEASE
  { 3,  80,  NOTES_JUMP,    2 }, // JUMP
  { 4,  90,  NOTES_SLIDE,   2 }, // WALL_SLIDE
  { 8,  160, NOTES_HIT,     4 }, // PLAYER_HIT
  { 6,  90,  NOTES_STRIKE,  3 }, // STRIKE_PING
};

// 1-Channel Heroic E-Minor Swing BGM (from js/audio.js BGM_SWING_STEPS)
constexpr uint16_t BGM_SWING_STEPS[64] = {
  330, 0,   392, 440, 494, 0,   659, 587,
  494, 0,   392, 0,   440, 494, 392, 0,
  330, 0,   392, 440, 494, 0,   784, 659,
  587, 0,   494, 440, 494, 0,   0,   0,
  523, 0,   659, 587, 523, 0,   494, 440,
  392, 0,   494, 440, 392, 0,   330, 0,
  294, 0,   330, 392, 440, 0,   494, 587,
  659, 0,   587, 494, 494, 0,   0,   0
};

AudioMode mode = AudioMode::SFX_ONLY;
uint16_t  curFreq = 0;

bool     sfxRunning = false;
uint8_t  sfxActiveId = 0;
uint8_t  sfxNoteIdx = 0;
float    sfxNoteTimerMs = 0.0f;
uint8_t  sfxActivePrio = 0;
uint32_t sfxLastPlayMs[(int)SfxId::COUNT] = {};

uint8_t  bgmStepIdx = 0;
float    bgmStepTimerMs = 0.0f;
float    bgmGateTimerMs = 0.0f;
constexpr float BGM_STEP_MS = 135.0f;
constexpr float BGM_GATE_MS = 82.0f;

void setTone(uint16_t freq) {
  if (freq == curFreq) return;
  curFreq = freq;
  if (freq == 0) {
    ledcWriteTone(BUZZER_LEDC_CH, 0);
    ledcWrite(BUZZER_LEDC_CH, 0);
  } else {
    ledcWriteTone(BUZZER_LEDC_CH, freq);
  }
}

} // namespace

void audioInit() {
  ledcSetup(BUZZER_LEDC_CH, 2000, 10);
  ledcAttachPin(PIN_BUZZER, BUZZER_LEDC_CH);
  ledcWriteTone(BUZZER_LEDC_CH, 0);
  curFreq = 0;
  sfxRunning = false;
  bgmStepIdx = 0;
  bgmStepTimerMs = 0.0f;
  bgmGateTimerMs = 0.0f;
}

void audioPlaySfx(SfxId id) {
  if (mode == AudioMode::MUTE) return;
  const int idx = (int)id;
  if (idx < 0 || idx >= (int)SfxId::COUNT) return;

  const SfxDef& def = SFX_DEFS[idx];
  const uint32_t nowMs = millis();
  if ((nowMs - sfxLastPlayMs[idx]) < def.cdMs) return;
  if (sfxRunning && def.prio < sfxActivePrio) return;

  sfxLastPlayMs[idx] = nowMs;
  sfxRunning     = true;
  sfxActiveId    = (uint8_t)idx;
  sfxNoteIdx     = 0;
  sfxNoteTimerMs = (float)def.notes[0].durMs;
  sfxActivePrio  = def.prio;
  setTone(def.notes[0].freq);
}

void audioCycleMode() {
  if (mode == AudioMode::SFX_ONLY) mode = AudioMode::ALL;
  else if (mode == AudioMode::ALL) mode = AudioMode::MUTE;
  else mode = AudioMode::SFX_ONLY;

  if (mode == AudioMode::MUTE) {
    sfxRunning = false;
    setTone(0);
  }
}

AudioMode audioGetMode() {
  return mode;
}

const char* audioModeLabel() {
  switch (mode) {
    case AudioMode::ALL:      return "ALL";
    case AudioMode::SFX_ONLY: return "SFX";
    default:                  return "OFF";
  }
}

void audioUpdate(float dtSec) {
  if (mode == AudioMode::MUTE) {
    setTone(0);
    return;
  }

  const float dtMs = dtSec * 1000.0f;

  // 1) Active SFX has priority over BGM (1-channel buzzer arbiter)
  if (sfxRunning) {
    sfxNoteTimerMs -= dtMs;
    if (sfxNoteTimerMs <= 0.0f) {
      const SfxDef& def = SFX_DEFS[sfxActiveId];
      sfxNoteIdx++;
      if (sfxNoteIdx >= def.count) {
        sfxRunning = false;
        sfxActivePrio = 0;
        setTone(0);
      } else {
        sfxNoteTimerMs = (float)def.notes[sfxNoteIdx].durMs;
        setTone(def.notes[sfxNoteIdx].freq);
      }
    }
    return;
  }

  // 2) Optional 1-channel BGM when AudioMode::ALL
  if (mode != AudioMode::ALL) {
    setTone(0);
    return;
  }

  bgmStepTimerMs -= dtMs;
  bgmGateTimerMs -= dtMs;
  if (bgmStepTimerMs <= 0.0f) {
    const uint16_t f = BGM_SWING_STEPS[bgmStepIdx];
    bgmStepIdx = (bgmStepIdx + 1) & 63;
    bgmStepTimerMs = BGM_STEP_MS;
    bgmGateTimerMs = BGM_GATE_MS;
    setTone(f);
  } else if (bgmGateTimerMs <= 0.0f) {
    setTone(0);
  }
}
