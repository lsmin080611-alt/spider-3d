// Spider 3D — LILYGO T-Display-S3 Main Entry (Phase 1: Hardware Bring-up & 60fps Web Swing)

#include <Arduino.h>
#include "pins.h"
#include "types.h"
#include "input.h"
#include "audio_hw.h"
#include "world.h"
#include "physics.h"
#include "renderer.h"

namespace {

InputState  gInput{};
GameState   gState{};
NearbyWorld gWorld{};

uint32_t lastFrameUs    = 0;
uint32_t fpsAccumFrames = 0;
uint32_t fpsLastMs      = 0;
uint32_t serialLastMs   = 0;
bool     longHoldHandled = false;

} // namespace

void setup() {
  Serial.begin(115200);
  delay(80);
  Serial.println("\n[Spider 3D] T-Display-S3 Phase 1 Booting...");

  audioInit();
  inputInit(gInput);

  if (!rendererInit()) {
    Serial.println("[Spider 3D] ERROR: Failed to allocate 320x170 RGB565 framebuffer!");
    while (true) { delay(500); }
  }

  gState.showDiagHud = true; // Enable live HW diagnostics by default in Phase 1
  physicsReset(gState);
  worldGatherNearby(gState.px, gState.pz, gState.simTime, gWorld);

  audioPlaySfx(SfxId::BOOT_CHIME);

  lastFrameUs = micros();
  fpsLastMs   = millis();
  serialLastMs = fpsLastMs;

  Serial.printf("[Spider 3D] Ready! Joy center=(%d, %d), Free DRAM=%lu B, PSRAM=%lu B\n",
                gInput.centerAdcX, gInput.centerAdcY,
                (unsigned long)ESP.getFreeHeap(),
                (unsigned long)ESP.getFreePsram());
}

void loop() {
  const uint32_t frameStartUs = micros();
  uint32_t elapsedUs = frameStartUs - lastFrameUs;
  lastFrameUs = frameStartUs;

  float dt = (float)elapsedUs * 1e-6f;
  if (dt < 0.001f) dt = 0.001f;
  if (dt > 0.050f) dt = 0.050f; // Clamp delta to prevent tunneling on stalls

  // 1) Read Joystick + 4 Tactile Switches
  inputUpdate(gInput, dt);

  // Phase 1 STRIKE button utilities:
  // - Short tap: Buzzer test ping + sparks + cycle BZR mode (if held with SWING) OR toggle HW Diag HUD
  // - Long hold (> 1.1s): Recalibrate joystick center & reset to 124m spawn!
  if (gInput.strikePressed) {
    longHoldHandled = false;
  }
  if (gInput.strikeHeld && !longHoldHandled && gInput.strikeHoldSec >= 1.1f) {
    longHoldHandled = true;
    inputCalibrateCenter(gInput);
    physicsReset(gState);
    physicsSetPopup(gState, "RECENTER + RESET!", COL_EMERALD, 1.3f);
    audioPlaySfx(SfxId::BOOT_CHIME);
  }
  if (gInput.strikeReleased && !longHoldHandled) {
    if (gInput.swingHeld) {
      audioCycleMode();
      char msg[24];
      snprintf(msg, sizeof(msg), "BUZZER: %s", audioModeLabel());
      physicsSetPopup(gState, msg, COL_GOLD, 1.0f);
      audioPlaySfx(SfxId::STRIKE_PING);
    } else {
      gState.showDiagHud = !gState.showDiagHud;
      physicsSpawnSparks(gState, gState.px, gState.py, gState.pz, COL_GOLD, 10, 28.0f);
      physicsSetPopup(gState, gState.showDiagHud ? "DIAG HUD: ON" : "DIAG HUD: OFF", COL_GOLD, 0.9f);
      audioPlaySfx(SfxId::STRIKE_PING);
    }
  }

  // 2) Update Manhattan Nearby World, 3D Pendulum Physics & Passive Buzzer
  worldGatherNearby(gState.px, gState.pz, gState.simTime, gWorld);
  physicsStep(gState, gInput, gWorld, dt);
  audioUpdate(dt);

  // 3) Render 320x170 RGB565 Frame & Push to ST7789
  rendererDrawFrame(gState, gInput, gWorld);

  // 4) Measure frame time & FPS
  const uint32_t frameWorkUs = micros() - frameStartUs;
  gState.frameUs = frameWorkUs;

  fpsAccumFrames++;
  const uint32_t nowMs = millis();
  if ((nowMs - fpsLastMs) >= 500) {
    gState.fps = (float)fpsAccumFrames * 1000.0f / (float)(nowMs - fpsLastMs);
    fpsAccumFrames = 0;
    fpsLastMs = nowMs;
  }

  // Serial telemetry every 1s for quick PC monitor inspection
  if ((nowMs - serialLastMs) >= 1000) {
    serialLastMs = nowMs;
    Serial.printf("FPS=%.1f work=%luus | JOY=(%+.2f,%+.2f raw %d/%d) SW=%d%d ST=%d%d | ALT=%.0fm\n",
                  gState.fps, (unsigned long)gState.frameUs,
                  gInput.turn, gInput.fwd, gInput.rawAdcX, gInput.rawAdcY,
                  gInput.rawSwingInt ? 1 : 0, gInput.rawSwingExt ? 1 : 0,
                  gInput.rawStrikeInt ? 1 : 0, gInput.rawStrikeExt ? 1 : 0,
                  gState.py);
  }

  // Optional 60fps pacing (yields gently if frame finished under 16.6ms)
  constexpr uint32_t TARGET_FRAME_US = 16667;
  if (frameWorkUs < TARGET_FRAME_US) {
    const uint32_t remainUs = TARGET_FRAME_US - frameWorkUs;
    if (remainUs > 1500) delayMicroseconds(remainUs - 500);
  }
}
