'use strict';
// Spider 3D — Step 5: ESP32-S3 Passive Buzzer (ledcWriteTone) 1:1 Monophonic Chiptune Engine
// Single-channel square-wave tone synthesizer driven by [freqHz, durMs] note tables.
// Maps 1:1 to ESP32-S3 C++: struct BuzzerNote { uint16_t freq; uint16_t durMs; }; + ledcWriteTone().

const AUDIO_MODES = ['ALL', 'SFX', 'OFF'];
let audioModeIdx = 0; // 0: ALL (BGM+SFX), 1: SFX ONLY, 2: OFF (MUTE)

let audioCtx = null;
let audioOsc = null;
let audioGain = null;
let audioFilter = null;
let audioUnlocked = false;
let audioCurFreq = 0;

// Monophonic Buzzer Arbiter State (ESP32 1-channel priority preemption)
let sfxActive = null;      // { notes, idx, timerMs, prio, pitchScale }
let sfxLastPlayMs = {};    // per-SFX cooldown map

// 1-Channel Buzzer BGM Sequencer State
let bgmTrack = 'NONE';     // 'NONE' | 'SWING' | 'BOSS'
let bgmStepIdx = 0;
let bgmStepTimerMs = 0;

// =========================================================================
// 1. PASSIVE BUZZER SFX NOTE TABLES ([freqHz, durMs], 0 = rest)
// =========================================================================
const SFX_TABLE = {
  web_shoot:       { prio: 3,  cd: 65,  notes: [[520, 20], [780, 20], [1180, 26], [1560, 20]] },
  web_release:     { prio: 3,  cd: 75,  notes: [[660, 22], [990, 24], [1320, 30]] },
  perfect_release: { prio: 6,  cd: 120, notes: [[880, 28], [1109, 28], [1319, 34], [1760, 62]] },
  jump:            { prio: 3,  cd: 75,  notes: [[330, 26], [494, 28], [659, 34]] },
  bounce:          { prio: 4,  cd: 65,  notes: [[260, 20], [440, 22], [660, 26], [520, 20]] },

  strike_dive:     { prio: 5,  cd: 85,  notes: [[1175, 22], [880, 22], [587, 26], [392, 30], [262, 38]] },
  strike_pull:     { prio: 5,  cd: 85,  notes: [[784, 22], [0, 12], [1175, 26], [1568, 36]] },
  strike_hyper:    { prio: 6,  cd: 85,  notes: [[659, 18], [988, 18], [1319, 22], [1976, 46]] },

  hit:             { prio: 4,  cd: 42,  notes: [[240, 18], [147, 26]] },
  hit_crit:        { prio: 5,  cd: 55,  notes: [[880, 16], [440, 20], [1319, 22], [220, 30]] },
  enemy_kill:      { prio: 6,  cd: 58,  notes: [[523, 20], [392, 20], [294, 24], [196, 28], [131, 42]] },
  shockwave:       { prio: 6,  cd: 85,  notes: [[165, 28], [123, 32], [98, 40], [73, 50]] },

  rank_up:         { prio: 7,  cd: 180, notes: [[523, 38], [659, 38], [784, 42], [1047, 48], [1319, 92]] },
  player_hit:      { prio: 8,  cd: 150, notes: [[311, 34], [233, 34], [175, 42], [117, 72]] },

  draft_open:      { prio: 8,  cd: 140, notes: [[587, 42], [740, 42], [880, 48], [1175, 105]] },
  ui_move:         { prio: 4,  cd: 38,  notes: [[988, 20]] },
  ui_confirm:      { prio: 8,  cd: 100, notes: [[784, 34], [1047, 42], [1568, 82]] },

  boss_alarm:      { prio: 9,  cd: 250, notes: [[880, 75], [622, 75], [880, 75], [622, 75], [440, 130]] },
  boss_groggy:     { prio: 9,  cd: 200, notes: [[1047, 34], [784, 34], [1319, 44], [1568, 52], [2093, 105]] },
  boss_clear:      { prio: 10, cd: 300, notes: [[523, 68], [659, 68], [784, 68], [1047, 108], [0, 32], [784, 62], [1047, 210]] },
  gameover:        { prio: 10, cd: 300, notes: [[392, 92], [370, 92], [349, 92], [330, 115], [262, 230]] },

  apex_freeze:     { prio: 9,  cd: 180, notes: [[1568, 28], [1175, 32], [880, 38], [587, 46], [294, 66], [147, 125]] },
  apex_release:    { prio: 9,  cd: 180, notes: [[220, 26], [440, 26], [880, 30], [1319, 34], [1760, 72], [220, 52]] }
};

// =========================================================================
// 2. 1-CHANNEL PASSIVE BUZZER BGM PATTERNS (Heroic E-Minor & Boss D-Minor)
// =========================================================================
// Each entry is a frequency in Hz (0 = short staccato rest) for a 16th-note step.
const BGM_SWING_STEPS = [
  330, 0,   392, 440, 494, 0,   659, 587,
  494, 0,   392, 0,   440, 494, 392, 0,
  330, 0,   392, 440, 494, 0,   784, 659,
  587, 0,   494, 440, 494, 0,   0,   0,
  523, 0,   659, 587, 523, 0,   494, 440,
  392, 0,   494, 440, 392, 0,   330, 0,
  294, 0,   330, 392, 440, 0,   494, 587,
  659, 0,   587, 494, 494, 0,   0,   0
];

const BGM_BOSS_STEPS = [
  294, 294, 0,   349, 330, 0,   294, 262,
  294, 0,   440, 0,   415, 392, 349, 0,
  294, 294, 0,   349, 330, 0,   440, 466,
  523, 0,   466, 440, 392, 0,   349, 0,
  233, 233, 0,   294, 349, 0,   330, 294,
  262, 262, 0,   330, 392, 0,   349, 330,
  294, 0,   440, 0,   523, 0,   587, 0,
  554, 523, 466, 440, 392, 349, 330, 0
];

// =========================================================================
// 3. WEBAUDIO SINGLE-OSCILLATOR BUZZER DRIVER (ESP32 ledcWriteTone 1:1)
// =========================================================================
function getAudioMode() {
  return AUDIO_MODES[audioModeIdx];
}

function getAudioButtonLabel() {
  const m = getAudioMode();
  if (m === 'ALL') return 'BZR: ALL';
  if (m === 'SFX') return 'BZR: SFX';
  return 'BZR: OFF';
}

function ensureAudioEngine() {
  if (audioCtx) return true;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  try {
    audioCtx = new Ctx();
    audioOsc = audioCtx.createOscillator();
    audioOsc.type = 'square'; // Passive piezo buzzer fundamental waveform
    audioOsc.frequency.value = 440;

    // Gentle low-pass to tame harsh desktop/mobile upper harmonics while keeping crisp buzzer bite
    audioFilter = audioCtx.createBiquadFilter();
    audioFilter.type = 'lowpass';
    audioFilter.frequency.value = 3400;
    audioFilter.Q.value = 0.7;

    audioGain = audioCtx.createGain();
    audioGain.gain.value = 0.0;

    audioOsc.connect(audioFilter);
    audioFilter.connect(audioGain);
    audioGain.connect(audioCtx.destination);
    audioOsc.start();
    return true;
  } catch (err) {
    audioCtx = null;
    return false;
  }
}

function unlockAudio() {
  if (!ensureAudioEngine()) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  audioUnlocked = true;
}

function setBuzzerTone(freqHz, gainLevel) {
  if (!audioCtx || !audioOsc || !audioGain) return;
  const now = audioCtx.currentTime;
  if (freqHz <= 0 || gainLevel <= 0) {
    if (audioCurFreq !== 0) {
      audioGain.gain.setTargetAtTime(0.0, now, 0.004);
      audioCurFreq = 0;
    }
    return;
  }
  const clampedFreq = Math.max(55, Math.min(4200, freqHz));
  audioOsc.frequency.setValueAtTime(clampedFreq, now);
  audioGain.gain.setTargetAtTime(gainLevel, now, 0.003);
  audioCurFreq = clampedFreq;
}

function stopBuzzerAll() {
  sfxActive = null;
  setBuzzerTone(0, 0);
}

function cycleAudioMode() {
  audioModeIdx = (audioModeIdx + 1) % AUDIO_MODES.length;
  const mode = getAudioMode();
  if (mode === 'OFF') {
    stopBuzzerAll();
  } else {
    unlockAudio();
    playSfx('ui_move');
  }
  return mode;
}

function playSfx(id, pitchScale = 1.0) {
  if (getAudioMode() === 'OFF') return;
  const def = SFX_TABLE[id];
  if (!def || !def.notes || def.notes.length === 0) return;

  if (!audioUnlocked) unlockAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  const nowMs = performance.now();
  const prevMs = sfxLastPlayMs[id] || 0;
  if (nowMs - prevMs < def.cd) return;

  // Monophonic priority preemption (higher or equal priority overrides)
  if (sfxActive && sfxActive.prio > def.prio) return;

  sfxLastPlayMs[id] = nowMs;
  sfxActive = {
    notes: def.notes,
    idx: 0,
    timerMs: def.notes[0][1],
    prio: def.prio,
    pitchScale: pitchScale || 1.0
  };

  const f0 = def.notes[0][0];
  setBuzzerTone(f0 > 0 ? f0 * sfxActive.pitchScale : 0, 0.11);
}

function resetAudioForNewRun() {
  bgmStepIdx = 0;
  bgmStepTimerMs = 0;
  sfxActive = null;
  setBuzzerTone(0, 0);
}

// Called every frame from tick(rawDt) — drives both SFX note steps and 1-channel BGM
function updateAudio(rawDt) {
  const mode = getAudioMode();
  if (mode === 'OFF' || !audioCtx || audioCtx.state === 'suspended') {
    if (audioCurFreq !== 0) setBuzzerTone(0, 0);
    return;
  }

  const dtMs = rawDt * 1000.0;

  // 1) Active SFX owns the single passive buzzer channel until complete
  if (sfxActive) {
    sfxActive.timerMs -= dtMs;
    if (sfxActive.timerMs <= 0) {
      sfxActive.idx++;
      if (sfxActive.idx >= sfxActive.notes.length) {
        sfxActive = null;
        setBuzzerTone(0, 0);
      } else {
        const note = sfxActive.notes[sfxActive.idx];
        sfxActive.timerMs = note[1];
        const freq = note[0] > 0 ? note[0] * sfxActive.pitchScale : 0;
        setBuzzerTone(freq, 0.11);
      }
    }
    return;
  }

  // 2) No SFX active -> play 1-channel BGM if mode === 'ALL' and gameplay is active
  if (mode !== 'ALL') {
    if (audioCurFreq !== 0) setBuzzerTone(0, 0);
    return;
  }

  const shouldPlayBgm = (
    typeof openingPhase !== 'undefined' &&
    openingPhase === 'ACTIVE' &&
    !gameOver &&
    !augmentDraftOpen &&
    !(typeof isApexFreezePhase === 'function' && isApexFreezePhase()) &&
    !(typeof bossActive !== 'undefined' && bossActive && (bossPhase === 'INTRO' || bossPhase === 'DEFEATED'))
  );

  if (!shouldPlayBgm) {
    if (audioCurFreq !== 0) setBuzzerTone(0, 0);
    return;
  }

  const desiredTrack = (typeof bossActive !== 'undefined' && bossActive) ? 'BOSS' : 'SWING';
  if (bgmTrack !== desiredTrack) {
    bgmTrack = desiredTrack;
    bgmStepIdx = 0;
    bgmStepTimerMs = 0;
  }

  const steps = bgmTrack === 'BOSS' ? BGM_BOSS_STEPS : BGM_SWING_STEPS;
  // Slightly faster tempo at Rank S (index 4) or Boss Phase 2
  const isHyperTempo = (bgmTrack === 'BOSS' && typeof bossStage !== 'undefined' && bossStage >= 2)
    || (bgmTrack === 'SWING' && typeof styleRankIdx !== 'undefined' && styleRankIdx >= 4);
  const stepDurMs = bgmTrack === 'BOSS' ? (isHyperTempo ? 82 : 92) : (isHyperTempo ? 92 : 104);

  bgmStepTimerMs -= dtMs;
  if (bgmStepTimerMs <= 0) {
    const freq = steps[bgmStepIdx];
    bgmStepIdx = (bgmStepIdx + 1) % steps.length;
    bgmStepTimerMs = stepDurMs;
    // Soft volume for BGM so SFX preemption stands out clearly
    const bgmGain = (typeof isApexAct2Phase === 'function' && isApexAct2Phase()) ? 0.025 : 0.048;
    setBuzzerTone(freq, freq > 0 ? bgmGain : 0);
  }
}
