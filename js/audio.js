// ==========================================
// audio.js - Web Audio API Sound Synthesizer
// ==========================================

let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(freq, type, duration, targetFreq = null) {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (targetFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(
        targetFreq,
        audioCtx.currentTime + duration,
      );
    }

    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + duration,
    );

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio restriction fallback
  }
}

function playEatSound() {
  playTone(520, "sine", 0.12, 880);
}

function playGameOverSound() {
  playTone(280, "sawtooth", 0.35, 70);
}

function playTurnSound() {
  playTone(320, "triangle", 0.04);
}
