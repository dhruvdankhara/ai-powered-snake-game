// ==========================================
// input.js - Game Loop, Event Handlers & Init
// ==========================================

// --- Main Game Loop ---
function gameLoop(timestamp) {
  if (gameState === GAME_STATES.RUNNING) {
    if (!aiMode) {
      const elapsed = timestamp - lastStepTime;
      const stepDelay = getCurrentStepDelay();

      if (elapsed >= stepDelay) {
        update();
        lastStepTime = timestamp;
      }
    }
  }

  render();
  animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Keyboard Input Handling ---
window.addEventListener("keydown", (e) => {
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
  ) {
    e.preventDefault();
  }

  // M key toggles AI Autopilot mode
  if (e.code === "KeyM") {
    toggleAiAutopilot();
    return;
  }

  // Spacebar handles Start, Pause, Resume, Restart
  if (e.code === "Space") {
    if (gameState === GAME_STATES.IDLE || gameState === GAME_STATES.GAMEOVER) {
      startGame();
    } else {
      togglePause();
    }
    return;
  }

  // If in AI mode, pressing an arrow or WASD key seamlessly switches back to manual control
  if (
    aiMode &&
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
    ].includes(e.code)
  ) {
    toggleAiAutopilot(false);
  }

  // If game is idle or over, pressing a direction key starts immediately
  if (gameState === GAME_STATES.IDLE || gameState === GAME_STATES.GAMEOVER) {
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
      ].includes(e.code)
    ) {
      startGame();
    }
  }

  // Speed controls: - / + or [ / ] or number keys 1-5
  if (e.key === "-" || e.key === "_" || e.code === "BracketLeft") {
    setSpeedLevel(speedLevel - 1);
    return;
  }
  if (e.key === "+" || e.key === "=" || e.code === "BracketRight") {
    setSpeedLevel(speedLevel + 1);
    return;
  }
  if (
    ["1", "2", "3", "4", "5"].includes(e.key) &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey
  ) {
    setSpeedLevel(parseInt(e.key, 10));
    return;
  }

  // Direction controls
  switch (e.code) {
    case "ArrowUp":
    case "KeyW":
      queueDirection(DIRECTIONS.UP);
      break;
    case "ArrowDown":
    case "KeyS":
      queueDirection(DIRECTIONS.DOWN);
      break;
    case "ArrowLeft":
    case "KeyA":
      queueDirection(DIRECTIONS.LEFT);
      break;
    case "ArrowRight":
    case "KeyD":
      queueDirection(DIRECTIONS.RIGHT);
      break;
  }
});

// --- Speed Button Handlers ---
if (speedDecBtn) {
  speedDecBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setSpeedLevel(speedLevel - 1);
  });
}

if (speedIncBtn) {
  speedIncBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setSpeedLevel(speedLevel + 1);
  });
}

// --- AI Controls & Overlay Event Listeners ---
if (aiModeBtn) {
  aiModeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleAiAutopilot();
  });
}

if (aiInspectorBtn && aiPanel) {
  aiInspectorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    aiPanel.classList.toggle("collapsed");
    aiInspectorBtn.classList.toggle(
      "active",
      !aiPanel.classList.contains("collapsed"),
    );
    setTimeout(resizeCanvas, 50);
  });
}

if (aiRetryBtn) {
  aiRetryBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (aiErrorOverlay) aiErrorOverlay.classList.add("hidden");
    gameState = GAME_STATES.RUNNING;
    if (aiStatusPill) {
      aiStatusPill.className = "ai-status-pill thinking";
      aiStatusPill.textContent = "● Retrying...";
    }
    requestAiMove();
  });
}

if (aiFallbackManualBtn) {
  aiFallbackManualBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (aiErrorOverlay) aiErrorOverlay.classList.add("hidden");
    toggleAiAutopilot(false);
    gameState = GAME_STATES.RUNNING;
    lastStepTime = performance.now();
  });
}

// --- Overlay Click / Tap ---
if (overlayEl) {
  overlayEl.addEventListener("click", () => {
    if (gameState === GAME_STATES.PAUSED) {
      togglePause();
    } else {
      startGame();
    }
  });
}

// --- Touch Screen Gestures ---
let touchStartX = 0;
let touchStartY = 0;

if (canvas) {
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
      if (
        gameState === GAME_STATES.IDLE ||
        gameState === GAME_STATES.GAMEOVER
      ) {
        startGame();
      }
    },
    { passive: true },
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      if (e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) > 20) {
        if (absDx > absDy) {
          queueDirection(dx > 0 ? DIRECTIONS.RIGHT : DIRECTIONS.LEFT);
        } else {
          queueDirection(dy > 0 ? DIRECTIONS.DOWN : DIRECTIONS.UP);
        }
      }
    },
    { passive: true },
  );
}

// --- Window Resize ---
window.addEventListener("resize", () => {
  resizeCanvas();
});

// --- Initialization ---
function init() {
  loadHighScore();
  loadSpeedSetting();
  resizeCanvas();
  resetGame();
  render();
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
