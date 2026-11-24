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
let bgmGateTimerMs = 0;

// =========================================================================
// 1. PASSIVE BUZZER SFX NOTE TABLES ([freqHz, durMs], 0 = rest)
//    vol: 0.0~0.12 (maps to ESP32 PWM duty), cutoff: lowpass Hz for warmth
// =========================================================================
const SFX_TABLE = {
  // High-frequency traversal SFX: ultra-short, soft, warm low-mid (zero ear fatigue)
  web_shoot:           { prio: 3,  cd: 75,  vol: 0.042, cutoff: 1350, notes: [[240, 14], [370, 16], [494, 14]] },
  web_release:         { prio: 3,  cd: 85,  vol: 0.036, cutoff: 1250, notes: [[330, 14], [440, 18]] },
  perfect_release:     { prio: 6,  cd: 130, vol: 0.062, cutoff: 2000, notes: [[440, 18], [659, 20], [880, 34]] },
  jump:                { prio: 3,  cd: 80,  vol: 0.042, cutoff: 1350, notes: [[220, 16], [330, 20]] },
  bounce:              { prio: 4,  cd: 70,  vol: 0.058, cutoff: 1650, notes: [[185, 16], [330, 18], [494, 22], [370, 16]] },

  // Combat initiation SFX: distinct weight/speed without shrill square high-end
  strike_dive:         { prio: 5,  cd: 90,  vol: 0.064, cutoff: 1700, notes: [[523, 16], [349, 18], [220, 22], [110, 30]] },
  strike_pull:         { prio: 5,  cd: 90,  vol: 0.052, cutoff: 1650, notes: [[392, 14], [0, 10], [587, 22]] },
  strike_hyper:        { prio: 6,  cd: 90,  vol: 0.062, cutoff: 2050, notes: [[440, 14], [659, 14], [988, 26]] },

  // Combat impact SFX: clear 3-tier punch contrast (normal < heavy < crit)
  hit:                 { prio: 4,  cd: 48,  vol: 0.058, cutoff: 1650, notes: [[220, 14], [131, 18], [88, 22]] },
  hit_heavy:           { prio: 5,  cd: 60,  vol: 0.084, cutoff: 1950, notes: [[330, 14], [165, 18], [98, 24], [65, 36]] },
  hit_crit:            { prio: 5,  cd: 60,  vol: 0.072, cutoff: 2250, notes: [[659, 14], [440, 14], [988, 20], [1319, 28]] },
  enemy_kill:          { prio: 6,  cd: 65,  vol: 0.068, cutoff: 1850, notes: [[392, 16], [262, 18], [175, 22], [110, 34]] },
  shockwave:           { prio: 6,  cd: 90,  vol: 0.082, cutoff: 1600, notes: [[165, 24], [117, 28], [87, 36], [65, 48]] },

  // Progression & damage SFX: concise and clean
  rank_up:             { prio: 7,  cd: 550, vol: 0.056, cutoff: 1850, notes: [[392, 26], [523, 28], [659, 52]] },
  player_hit:          { prio: 8,  cd: 160, vol: 0.086, cutoff: 1800, notes: [[277, 30], [196, 32], [138, 40], [98, 66]] },

  draft_open:          { prio: 8,  cd: 160, vol: 0.068, cutoff: 2000, notes: [[440, 32], [587, 34], [740, 40], [880, 78]] },
  ui_move:             { prio: 4,  cd: 42,  vol: 0.044, cutoff: 1700, notes: [[659, 16]] },
  ui_confirm:          { prio: 8,  cd: 110, vol: 0.070, cutoff: 2100, notes: [[523, 28], [784, 34], [1047, 68]] },

  boss_alarm:          { prio: 9,  cd: 260, vol: 0.085, cutoff: 2200, notes: [[740, 68], [523, 68], [740, 68], [523, 68], [370, 120]] },
  boss_groggy:         { prio: 9,  cd: 200, vol: 0.090, cutoff: 2400, notes: [[784, 30], [587, 30], [988, 38], [1319, 46], [1568, 92]] },
  boss_clear:          { prio: 10, cd: 300, vol: 0.095, cutoff: 2500, notes: [[523, 64], [659, 64], [784, 64], [1047, 102], [0, 28], [784, 58], [1047, 195]] },
  gameover:            { prio: 10, cd: 300, vol: 0.085, cutoff: 1800, notes: [[349, 88], [330, 88], [311, 88], [294, 108], [220, 210]] },

  // Step 4 Lv.3 APEX CUT: Time-stop freeze + 6 concept-matched ultimate signatures
  apex_freeze:         { prio: 9,  cd: 180, vol: 0.086, cutoff: 2200, notes: [[1175, 24], [880, 28], [587, 34], [392, 42], [220, 58], [110, 115]] },
  apex_release:        { prio: 9,  cd: 180, vol: 0.092, cutoff: 2400, notes: [[220, 24], [440, 24], [880, 28], [1319, 36], [165, 52]] },
  // 1. 초중력 슈트: 초저음 대기 압착 붕괴 (검증 완료 원형 유지)
  apex_heavy_suit:     { prio: 10, cd: 180, vol: 0.110, cutoff: 2600, notes: [[880, 22], [440, 24], [220, 28], [110, 38], [73, 52], [62, 88]] },
  // 2. 오버드라이브: 음속벽 소닉붐(저음) -> 초음속 일섬 찢김 + 번개 잔향
  apex_overdrive:      { prio: 10, cd: 180, vol: 0.096, cutoff: 2600, notes: [[110, 22], [73, 28], [0, 14], [1319, 16], [1976, 16], [2637, 22], [1480, 14], [2217, 16], [988, 26], [165, 48]] },
  // 3. 고탄성 번지줄: 팽팽한 거미줄 절단 스냅 -> 구름 돌파 수직 급상승
  apex_bungee_web:     { prio: 10, cd: 180, vol: 0.096, cutoff: 2300, notes: [[196, 18], [131, 22], [0, 14], [262, 18], [392, 18], [523, 20], [784, 22], [1047, 26], [1568, 56]] },
  // 4. 올가미 스윙 (2단계 싱크): 수축 장력 차지 -> 중앙 1점 초신성 파열
  apex_lasso_pull:     { prio: 10, cd: 150, vol: 0.076, cutoff: 1900, notes: [[262, 34], [311, 34], [370, 36], [440, 38], [523, 42], [622, 48]] },
  apex_lasso_burst:    { prio: 10, cd: 150, vol: 0.110, cutoff: 2500, notes: [[1175, 18], [587, 22], [294, 28], [147, 42], [98, 54], [65, 84]] },
  // 5. 연쇄 핀볼 (6연타 1:1 싱크): 1~5타 고속 전기 도탄 연타 + 6타 피니시 파열
  apex_pinball_hit:    { prio: 10, cd: 35,  vol: 0.086, cutoff: 2400, notes: [[392, 14], [659, 16], [880, 20], [196, 22]] },
  apex_pinball_finish: { prio: 10, cd: 60,  vol: 0.108, cutoff: 2600, notes: [[1047, 18], [1568, 20], [2093, 24], [330, 30], [165, 42], [82, 74]] },
  // 6. 탄성 반발: 벽 콘크리트 파열(저음 크랙) -> V자 도탄 튕김 -> 카운터 강타
  apex_elastic:        { prio: 10, cd: 180, vol: 0.105, cutoff: 2400, notes: [[147, 22], [98, 28], [68, 34], [0, 18], [330, 14], [659, 16], [1175, 22], [0, 10], [880, 16], [220, 34], [110, 56]] }
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
    audioFilter.frequency.value = 2200;
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

function setBuzzerTone(freqHz, gainLevel, cutoffHz = 2200) {
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
  if (audioFilter) {
    audioFilter.frequency.setTargetAtTime(cutoffHz || 2200, now, 0.004);
  }
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
  const vol = def.vol != null ? def.vol : 0.075;
  const cutoff = def.cutoff != null ? def.cutoff : 2200;
  sfxActive = {
    notes: def.notes,
    idx: 0,
    timerMs: def.notes[0][1],
    prio: def.prio,
    pitchScale: pitchScale || 1.0,
    vol: vol,
    cutoff: cutoff
  };

  const f0 = def.notes[0][0];
  setBuzzerTone(f0 > 0 ? f0 * sfxActive.pitchScale : 0, vol, cutoff);
}

function resetAudioForNewRun() {
  bgmStepIdx = 0;
  bgmStepTimerMs = 0;
  bgmGateTimerMs = 0;
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
        setBuzzerTone(freq, sfxActive.vol, sfxActive.cutoff);
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
    bgmGateTimerMs = 0;
  }

  const steps = bgmTrack === 'BOSS' ? BGM_BOSS_STEPS : BGM_SWING_STEPS;
  // Slightly faster tempo at Rank S (index 4) or Boss Phase 2
  const isHyperTempo = (bgmTrack === 'BOSS' && typeof bossStage !== 'undefined' && bossStage >= 2)
    || (bgmTrack === 'SWING' && typeof styleRankIdx !== 'undefined' && styleRankIdx >= 4);
  const stepDurMs = bgmTrack === 'BOSS' ? (isHyperTempo ? 84 : 94) : (isHyperTempo ? 96 : 108);

  // Staccato gate: cut BGM note after ~56% of step so it stays airy and gentle
  if (bgmGateTimerMs > 0) {
    bgmGateTimerMs -= dtMs;
    if (bgmGateTimerMs <= 0 && audioCurFreq !== 0) {
      setBuzzerTone(0, 0, 1450);
    }
  }

  bgmStepTimerMs -= dtMs;
  if (bgmStepTimerMs <= 0) {
    const freq = steps[bgmStepIdx];
    bgmStepIdx = (bgmStepIdx + 1) % steps.length;
    bgmStepTimerMs = stepDurMs;
    bgmGateTimerMs = freq > 0 ? stepDurMs * 0.56 : 0;
    // Gentle background volume (0.016) so SFX clearly pop over the music
    const bgmGain = (typeof isApexSlowPhase === 'function' && isApexSlowPhase()) ? 0.008 : 0.016;
    setBuzzerTone(freq, freq > 0 ? bgmGain : 0, 1450);
  }
}
