#pragma once
// Spider 3D — ESP32-S3 Passive Buzzer (ledcWriteTone) 1:1 Monophonic Chiptune Driver

#include <stdint.h>

enum class SfxId : uint8_t {
  BOOT_CHIME = 0,
  WEB_SHOOT,
  WEB_RELEASE,
  PERFECT_RELEASE,
  JUMP,
  WALL_SLIDE,
  PLAYER_HIT,
  STRIKE_PING,
  COUNT
};

enum class AudioMode : uint8_t {
  SFX_ONLY = 0, // Phase 1 default: crisp SFX without nonstop buzzer BGM during HW testing
  ALL,          // SFX + 1-channel BGM
  MUTE
};

void audioInit();
void audioPlaySfx(SfxId id);
void audioCycleMode();
AudioMode audioGetMode();
const char* audioModeLabel();
void audioUpdate(float dtSec);
