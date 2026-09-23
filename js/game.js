// ==========================================
// game.js - Core Snake Game Logic & Engine
// ==========================================

function resetGame() {
  const startX = Math.floor(cols / 2);
  const startY = Math.floor(rows / 2);

  snake = [
    { x: startX, y: startY },
    { x: startX, y: startY + 1 },
    { x: startX, y: startY + 2 },
  ];
  direction = DIRECTIONS.UP;
  inputQueue = [];
  score = 0;
  if (currentScoreEl) {
    currentScoreEl.textContent = "0";
  }
  spawnFood();
}

function spawnFood() {
  let attempts = 0;
  while (attempts < 100) {
    const rx = Math.floor(Math.random() * cols);
    const ry = Math.floor(Math.random() * rows);
    const hitSnake = snake.some((seg) => seg.x === rx && seg.y === ry);
    if (!hitSnake) {
      food = { x: rx, y: ry };
      return;
    }
    attempts++;
  }

  // Fallback for dense board
  const emptyCells = [];
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if (!snake.some((seg) => seg.x === x && seg.y === y)) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length === 0) {
    handleGameOver(true);
    return;
  }

  const randomIndex = Math.floor(Math.random() * emptyCells.length);
  food = emptyCells[randomIndex];
}

function getCurrentStepDelay() {
  const baseDelay = SPEED_LEVELS[speedLevel - 1];
  return Math.max(30, baseDelay - Math.floor(score / 5) * 2);
}

function queueDirection(newDir) {
  if (gameState !== GAME_STATES.RUNNING) return;

  const lastQueued =
    inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : direction;

  // Prevent reversing into self
  const isOpposite =
    newDir.x === -lastQueued.x && newDir.y === -lastQueued.y;
  const isSame = newDir.x === lastQueued.x && newDir.y === lastQueued.y;

  if (!isOpposite && !isSame && inputQueue.length < 2) {
    inputQueue.push(newDir);
    playTurnSound();
  }
}

function update() {
  if (inputQueue.length > 0) {
    direction = inputQueue.shift();
  }

  const head = snake[0];
  const newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y,
  };

  // Wall collision check
  if (
    newHead.x < 0 ||
    newHead.x >= cols ||
    newHead.y < 0 ||
    newHead.y >= rows
  ) {
    handleGameOver(false);
    return false;
  }

  // Self collision check
  const selfCollision = snake.some(
    (segment) => segment.x === newHead.x && segment.y === newHead.y,
  );
  if (selfCollision) {
    handleGameOver(false);
    return false;
  }

  // Move snake forward
  snake.unshift(newHead);

  // Check food collision
  if (newHead.x === food.x && newHead.y === food.y) {
    score += 10;
    if (currentScoreEl) {
      currentScoreEl.textContent = score;
    }
    updateHighScore();
    playEatSound();
    spawnFood();
  } else {
    // Remove tail
    snake.pop();
  }
  return true;
}

function handleGameOver(isVictory) {
  gameState = GAME_STATES.GAMEOVER;
  isThinking = false;
  if (aiAbortController) {
    aiAbortController.abort();
    aiAbortController = null;
  }
  if (aiStatusPill) {
    aiStatusPill.className = "ai-status-pill error";
    aiStatusPill.textContent = "● Game Over";
  }
  if (aiStepIndicator) {
    aiStepIndicator.textContent = "Ended";
    aiStepIndicator.classList.remove("active");
  }

  playGameOverSound();

  if (overlayTitle) {
    overlayTitle.textContent = isVictory ? "YOU WIN!" : "GAME OVER";
    overlayTitle.className = isVictory ? "" : "gameover";
  }
  if (overlayMsg) {
    overlayMsg.innerHTML = `Final Score: <strong>${score}</strong>${score >= highScore && score > 0 ? " (New High Score!)" : ""}<br>Click anywhere or press Space to play again.`;
  }
  if (overlayBtn) {
    overlayBtn.textContent = "Play Again";
  }
  if (overlayEl) {
    overlayEl.classList.remove("hidden");
  }
}

function startGame() {
  initAudio();
  resetGame();
  gameState = GAME_STATES.RUNNING;
  if (overlayEl) overlayEl.classList.add("hidden");
  if (aiErrorOverlay) aiErrorOverlay.classList.add("hidden");
  lastStepTime = performance.now();
  aiStepCount = 0;

  if (aiMode) {
    if (aiStatusPill) {
      aiStatusPill.className = "ai-status-pill ready";
      aiStatusPill.textContent = "● Connected";
    }
    requestAiMove();
  }
}

function togglePause() {
  if (gameState === GAME_STATES.RUNNING) {
    gameState = GAME_STATES.PAUSED;
    if (overlayTitle) {
      overlayTitle.textContent = "PAUSED";
      overlayTitle.className = "";
    }
    if (overlayMsg) {
      overlayMsg.textContent = "Click anywhere or press Space to resume.";
    }
    if (overlayBtn) {
      overlayBtn.textContent = "Resume";
    }
    if (overlayEl) {
      overlayEl.classList.remove("hidden");
    }
    if (aiStatusPill && aiMode) {
      aiStatusPill.className = "ai-status-pill";
      aiStatusPill.textContent = "● Paused";
    }
  } else if (gameState === GAME_STATES.PAUSED) {
    gameState = GAME_STATES.RUNNING;
    if (overlayEl) {
      overlayEl.classList.add("hidden");
    }
    lastStepTime = performance.now();
    if (aiMode && !isThinking) {
      requestAiMove();
    }
  }
}
