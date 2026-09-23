// ==========================================
// ai.js - Laya Model AI Decision Engine Integration
// ==========================================

/**
 * Returns the 3 legal directions from current direction (excluding 180° reverse).
 * E.g., if moving DOWN, opposite is UP, so legal directions are DOWN, LEFT, RIGHT.
 */
function getThreeLegalMoves(currentDir) {
  const allDirs = [
    DIRECTIONS.UP,
    DIRECTIONS.DOWN,
    DIRECTIONS.LEFT,
    DIRECTIONS.RIGHT,
  ];
  return allDirs.filter(
    (d) => !(d.x === -currentDir.x && d.y === -currentDir.y),
  );
}

/**
 * Evaluates candidate move and calculates target coordinates, safety, and food proximity.
 */
function evaluateCandidateMove(dir) {
  const head = snake[0];
  const targetX = head.x + dir.x;
  const targetY = head.y + dir.y;
  const targetPixelX = targetX * CELL_SIZE;
  const targetPixelY = targetY * CELL_SIZE;

  // Obstacle & collision checks
  const isWall =
    targetX < 0 || targetX >= cols || targetY < 0 || targetY >= rows;
  const isBody = snake.some(
    (seg, idx) => idx > 0 && seg.x === targetX && seg.y === targetY,
  );
  const isFatal = isWall || isBody;

  // Manhattan distance change to food
  const dx = food.x - head.x;
  const dy = food.y - head.y;
  const currentDist = Math.abs(dx) + Math.abs(dy);
  const newDist = Math.abs(food.x - targetX) + Math.abs(food.y - targetY);

  let statusText = "";
  let criterion = "";

  if (isWall) {
    statusText = "⚠️ Wall crash";
    criterion =
      "FATAL COLLISION: Crashes directly into the wall boundary, causing instant death";
  } else if (isBody) {
    statusText = "⚠️ Self collision";
    criterion =
      "FATAL COLLISION: Crashes directly into snake body, causing instant death";
  } else if (newDist < currentDist) {
    statusText = `Closer to food (${newDist} steps)`;
    criterion =
      "BEST MOVE: Clear safe path moving directly closer towards target food";
  } else if (newDist === currentDist) {
    statusText = `Same distance (${newDist} steps)`;
    criterion =
      "NEUTRAL MOVE: Clear safe path maintaining distance from target food";
  } else {
    statusText = `Further from food (${newDist} steps)`;
    criterion =
      "SUBOPTIMAL MOVE: Clear safe path moving further away from target food";
  }

  // Informative coordinate and status description for UI
  const desc = `${dir.name} → (${targetX}, ${targetY}) • ${statusText}`;

  return {
    dir,
    targetX,
    targetY,
    targetPixelX,
    targetPixelY,
    isFatal,
    isWall,
    isBody,
    criterion,
    desc,
  };
}

/**
 * Builds the request payload for Laya /predict endpoint.
 * Provides clear relative position to food, canvas boundaries, and semantic criteria
 * describing whether each candidate move is optimal, suboptimal, or fatal.
 */
function buildLayaPayload(legalMoves) {
  const head = snake[0];

  const dx = food.x - head.x;
  const dy = food.y - head.y;

  const targetDesc = [];
  if (dx > 0) targetDesc.push(`${dx} steps RIGHT`);
  else if (dx < 0) targetDesc.push(`${Math.abs(dx)} steps LEFT`);

  if (dy > 0) targetDesc.push(`${dy} steps DOWN`);
  else if (dy < 0) targetDesc.push(`${Math.abs(dy)} steps UP`);

  const foodRelativeDirection =
    targetDesc.length > 0 ? targetDesc.join(" and ") : "at current spot";

  // Criteria for legal moves showing semantic safety & proximity to food
  const criteria = {};
  legalMoves.forEach((c) => {
    criteria[c.dir.name] = c.criterion;
  });

  return {
    state: {
      current_position: `Snake head is at position x=${head.x}, y=${head.y}`,
      previous_direction: direction.name,
      food_direction: `Food is located ${foodRelativeDirection}`,
      canvas_bounds: `Grid size is ${cols} columns by ${rows} rows`,
      decision_goal:
        "Pick the best safe move that approaches the food and avoids fatal obstacles.",
    },
    questions: {
      next_move: {
        type: "choice",
        instructions: "Which move should the snake take to safely reach the food?",
        criteria: criteria,
      },
    },
  };
}

/**
 * Updates the AI Telemetry UI panel with the latest decision and probabilities.
 */
function updateAiTelemetryUI(
  chosenMoveName,
  probabilities,
  confidence,
  latency,
  candidates,
  payload,
) {
  if (aiChosenVal) {
    aiChosenVal.textContent = chosenMoveName || "-";
  }
  if (aiConfidenceVal) {
    aiConfidenceVal.textContent =
      confidence !== undefined ? `${(confidence * 100).toFixed(0)}%` : "-%";
  }
  if (aiLatencyVal) {
    aiLatencyVal.textContent = latency !== undefined ? `${latency} ms` : "- ms";
  }
  if (aiPayloadPreview && payload) {
    aiPayloadPreview.textContent = JSON.stringify(payload, null, 2);
  }

  if (aiCandidatesList && candidates && candidates.length > 0) {
    aiCandidatesList.innerHTML = "";
    candidates.forEach((cand) => {
      const prob =
        probabilities && probabilities[cand.dir.name] !== undefined
          ? probabilities[cand.dir.name]
          : 0;
      const isChosen = cand.dir.name === chosenMoveName;

      const card = document.createElement("div");
      card.className = `candidate-card ${isChosen ? "chosen" : ""}`;
      card.innerHTML = `
        <div class="candidate-row">
          <div class="candidate-dir">
            <span class="candidate-dir-icon">${cand.dir.icon}</span>
            <span>${cand.dir.name}</span>
            ${isChosen ? '<span style="font-size:10px; color:#4ade80; margin-left:4px;">★ SELECTED</span>' : ""}
          </div>
          <span class="candidate-prob">${(prob * 100).toFixed(1)}%</span>
        </div>
        <div class="candidate-bar-bg">
          <div class="candidate-bar-fill" style="width: ${Math.max(2, prob * 100).toFixed(1)}%;"></div>
        </div>
        <div class="candidate-desc">${cand.desc}</div>
      `;
      aiCandidatesList.appendChild(card);
    });
  }
}

/**
 * Turn-based AI move execution: calls Laya /predict and advances snake.
 */
async function requestAiMove() {
  if (gameState !== GAME_STATES.RUNNING || !aiMode || isThinking) {
    return;
  }

  isThinking = true;
  aiStepCount++;

  if (aiStatusPill) {
    aiStatusPill.className = "ai-status-pill thinking";
    aiStatusPill.textContent = "● Thinking...";
  }
  if (aiStepIndicator) {
    aiStepIndicator.textContent = `Step #${aiStepCount}`;
    aiStepIndicator.classList.add("active");
  }

  // 1. Get exactly 3 legal moves (excluding 180° reverse)
  const candidateDirs = getThreeLegalMoves(direction);
  const candidates = candidateDirs.map((d) => evaluateCandidateMove(d));
  lastAiCandidates = candidates;

  // 2. Build Laya prompt payload
  const payload = buildLayaPayload(candidates);
  if (aiPayloadPreview) {
    aiPayloadPreview.textContent = JSON.stringify(payload, null, 2);
  }

  const startTime = performance.now();
  aiAbortController = new AbortController();
  const timeoutId = setTimeout(() => aiAbortController.abort(), 8000);

  try {
    const response = await fetch(LAYA_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: aiAbortController.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const latency = Math.round(performance.now() - startTime);

    if (aiStatusPill) {
      aiStatusPill.className = "ai-status-pill ready";
      aiStatusPill.textContent = "● Connected";
    }

    // 3. Extract model choice and probabilities
    const moveAnswer = data?.answers?.next_move || {};
    let chosenName = moveAnswer.choice;
    const probs = moveAnswer.probabilities || {};
    const confidence = moveAnswer.confidence;

    // Verify chosen direction is among the 3 legal candidate options
    const validCandidate = candidates.find((c) => c.dir.name === chosenName);
    if (!validCandidate) {
      chosenName = candidates[0].dir.name;
    }

    // Safety guardrail: if the chosen candidate is fatal (wall or body crash)
    // but safe candidate options exist, select the best safe candidate
    const selectedCand = candidates.find((c) => c.dir.name === chosenName);
    if (selectedCand && selectedCand.isFatal) {
      const safeCandidates = candidates.filter((c) => !c.isFatal);
      if (safeCandidates.length > 0) {
        safeCandidates.sort(
          (a, b) => (probs[b.dir.name] || 0) - (probs[a.dir.name] || 0),
        );
        chosenName = safeCandidates[0].dir.name;
      }
    }

    // 4. Update Telemetry UI
    updateAiTelemetryUI(
      chosenName,
      probs,
      confidence,
      latency,
      candidates,
      payload,
    );

    // 5. Apply chosen direction and advance step
    direction = DIRECTIONS[chosenName];
    playTurnSound();

    isThinking = false;
    const stepSuccess = update();

    // 6. If game is still running, schedule next turn
    if (stepSuccess && gameState === GAME_STATES.RUNNING && aiMode) {
      setTimeout(() => {
        if (gameState === GAME_STATES.RUNNING && aiMode) {
          requestAiMove();
        }
      }, 50); // Brief visual pause between turns
    }
  } catch (err) {
    clearTimeout(timeoutId);
    isThinking = false;

    if (err.name === "AbortError") {
      console.warn("Laya AI request aborted or timed out");
    } else {
      console.error("Laya AI request failed:", err);
    }

    if (gameState === GAME_STATES.RUNNING && aiMode) {
      handleAiConnectionError(err);
    }
  }
}

/**
 * Handles API connection errors by gracefully pausing and showing retry overlay.
 */
function handleAiConnectionError(err) {
  gameState = GAME_STATES.PAUSED;
  if (aiStatusPill) {
    aiStatusPill.className = "ai-status-pill error";
    aiStatusPill.textContent = "● Offline";
  }
  if (aiErrorMsg) {
    aiErrorMsg.innerHTML = `Could not get decision from Laya model at <code>${LAYA_API_URL}</code>.<br><small style="color:#f87171;">${err.message || "Connection failed"}</small>`;
  }
  if (aiErrorOverlay) {
    aiErrorOverlay.classList.remove("hidden");
  }
}

/**
 * Toggle AI Autopilot on/off
 */
function toggleAiAutopilot(forceState = null) {
  aiMode = forceState !== null ? forceState : !aiMode;

  if (aiModeBtn) {
    aiModeBtn.classList.toggle("active", aiMode);
  }
  if (aiModeLabel) {
    aiModeLabel.textContent = aiMode ? "AI Autopilot: ON" : "AI Autopilot: OFF";
  }
  if (manualSpeedControl) {
    manualSpeedControl.style.opacity = aiMode ? "0.4" : "1";
    manualSpeedControl.style.pointerEvents = aiMode ? "none" : "auto";
  }

  if (aiMode) {
    if (aiStatusPill) {
      aiStatusPill.className = "ai-status-pill ready";
      aiStatusPill.textContent = "● Connected";
    }
    // If game is running, kick off AI loop
    if (gameState === GAME_STATES.RUNNING && !isThinking) {
      requestAiMove();
    } else if (gameState === GAME_STATES.IDLE) {
      startGame();
    }
  } else {
    // Switched to manual
    if (aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
    }
    isThinking = false;
    lastStepTime = performance.now();
  }
}
