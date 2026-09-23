// ==========================================
// storage.js - LocalStorage & Game Settings
// ==========================================

function loadHighScore() {
  try {
    const saved = localStorage.getItem("snake_high_score");
    highScore = saved ? parseInt(saved, 10) : 0;
  } catch (e) {
    highScore = 0;
  }
  if (highScoreEl) {
    highScoreEl.textContent = highScore;
  }
}

function updateHighScore() {
  if (score > highScore) {
    highScore = score;
    if (highScoreEl) {
      highScoreEl.textContent = highScore;
    }
    try {
      localStorage.setItem("snake_high_score", highScore.toString());
    } catch (e) {}
  }
}

function loadSpeedSetting() {
  try {
    const saved = localStorage.getItem("snake_speed_level");
    if (saved !== null) {
      const val = parseInt(saved, 10);
      if (val >= 1 && val <= SPEED_LEVELS.length) {
        speedLevel = val;
      }
    }
  } catch (e) {}
  updateSpeedUI();
}

function setSpeedLevel(level) {
  speedLevel = Math.max(1, Math.min(SPEED_LEVELS.length, level));
  try {
    localStorage.setItem("snake_speed_level", speedLevel.toString());
  } catch (e) {}
  updateSpeedUI();
  playTone(320 + speedLevel * 50, "sine", 0.05);
}

function updateSpeedUI() {
  if (speedValueEl) {
    speedValueEl.textContent = speedLevel;
  }
  if (speedDecBtn) {
    const isMin = speedLevel <= 1;
    speedDecBtn.disabled = isMin;
    speedDecBtn.style.opacity = isMin ? "0.35" : "1";
    speedDecBtn.style.cursor = isMin ? "not-allowed" : "pointer";
  }
  if (speedIncBtn) {
    const isMax = speedLevel >= SPEED_LEVELS.length;
    speedIncBtn.disabled = isMax;
    speedIncBtn.style.opacity = isMax ? "0.35" : "1";
    speedIncBtn.style.cursor = isMax ? "not-allowed" : "pointer";
  }
}
