// ==========================================
// renderer.js - Canvas Graphics & Drawing
// ==========================================

function resizeCanvas() {
  const container = canvas ? canvas.parentElement : null;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  if (width <= 0 || height <= 0) return;

  // Calculate maximum whole cells that fit in container
  const newCols = Math.max(10, Math.floor(width / CELL_SIZE));
  const newRows = Math.max(10, Math.floor(height / CELL_SIZE));

  cols = newCols;
  rows = newRows;
  canvasWidth = cols * CELL_SIZE;
  canvasHeight = rows * CELL_SIZE;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Clamp entities into bounds if screen shrunk
  if (snake && snake.length > 0) {
    snake.forEach((seg) => {
      seg.x = Math.max(0, Math.min(cols - 1, seg.x));
      seg.y = Math.max(0, Math.min(rows - 1, seg.y));
    });
  }
  if (food) {
    food.x = Math.max(0, Math.min(cols - 1, food.x));
    food.y = Math.max(0, Math.min(rows - 1, food.y));
  }

  render();
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= cols; x++) {
    const px = x * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, canvasHeight);
    ctx.stroke();
  }

  for (let y = 0; y <= rows; y++) {
    const py = y * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(canvasWidth, py);
    ctx.stroke();
  }
}

function drawFood() {
  if (!food) return;
  const cx = food.x * CELL_SIZE + CELL_SIZE / 2;
  const cy = food.y * CELL_SIZE + CELL_SIZE / 2;
  const radius = CELL_SIZE * 0.42;

  // Food glow
  const pulse = Math.sin(Date.now() / 180) * 2;
  ctx.save();
  ctx.shadowColor = "rgba(244, 63, 94, 0.7)";
  ctx.shadowBlur = 10 + pulse;

  // Fruit body
  ctx.fillStyle = "#f43f5e";
  ctx.beginPath();
  ctx.arc(cx, cy + 1, radius, 0, Math.PI * 2);
  ctx.fill();

  // Little leaf
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#4ade80";
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy - radius + 1, 3, 5, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();

  // Highlight reflection
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.beginPath();
  ctx.arc(
    cx - radius * 0.35,
    cy - radius * 0.35,
    radius * 0.25,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.restore();
}

function drawSnake() {
  if (snake.length === 0) return;

  const len = snake.length;

  for (let i = len - 1; i >= 0; i--) {
    const segment = snake[i];
    const px = segment.x * CELL_SIZE;
    const py = segment.y * CELL_SIZE;
    const pad = 1.5;

    ctx.save();

    if (i === 0) {
      // Snake Head
      ctx.shadowColor = "rgba(34, 197, 94, 0.6)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#22c55e";

      drawRoundedRect(
        ctx,
        px + pad,
        py + pad,
        CELL_SIZE - pad * 2,
        CELL_SIZE - pad * 2,
        6,
      );
      ctx.fill();

      // Eyes on the head
      drawEyes(px, py, direction);
    } else {
      // Snake Body Segment
      const progress = i / len;
      const greenVal = Math.floor(197 - progress * 40);
      const blueVal = Math.floor(94 + progress * 50);
      ctx.fillStyle = `rgb(34, ${greenVal}, ${blueVal})`;

      const segmentRadius = Math.max(2, 5 - progress * 2);
      drawRoundedRect(
        ctx,
        px + pad,
        py + pad,
        CELL_SIZE - pad * 2,
        CELL_SIZE - pad * 2,
        segmentRadius,
      );
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawEyes(headX, headY, dir) {
  ctx.save();
  ctx.fillStyle = "#ffffff";

  const eyeSize = 3.5;
  const pupilSize = 1.8;
  let eye1 = { x: 0, y: 0 };
  let eye2 = { x: 0, y: 0 };
  let pupilOffset = { x: 0, y: 0 };

  if (dir.x === 1) {
    // Right
    eye1 = { x: headX + CELL_SIZE * 0.65, y: headY + CELL_SIZE * 0.25 };
    eye2 = { x: headX + CELL_SIZE * 0.65, y: headY + CELL_SIZE * 0.75 };
    pupilOffset = { x: 1, y: 0 };
  } else if (dir.x === -1) {
    // Left
    eye1 = { x: headX + CELL_SIZE * 0.35, y: headY + CELL_SIZE * 0.25 };
    eye2 = { x: headX + CELL_SIZE * 0.35, y: headY + CELL_SIZE * 0.75 };
    pupilOffset = { x: -1, y: 0 };
  } else if (dir.y === 1) {
    // Down
    eye1 = { x: headX + CELL_SIZE * 0.25, y: headY + CELL_SIZE * 0.65 };
    eye2 = { x: headX + CELL_SIZE * 0.75, y: headY + CELL_SIZE * 0.65 };
    pupilOffset = { x: 0, y: 1 };
  } else {
    // Up
    eye1 = { x: headX + CELL_SIZE * 0.25, y: headY + CELL_SIZE * 0.35 };
    eye2 = { x: headX + CELL_SIZE * 0.75, y: headY + CELL_SIZE * 0.35 };
    pupilOffset = { x: 0, y: -1 };
  }

  // Draw whites
  ctx.beginPath();
  ctx.arc(eye1.x, eye1.y, eyeSize, 0, Math.PI * 2);
  ctx.arc(eye2.x, eye2.y, eyeSize, 0, Math.PI * 2);
  ctx.fill();

  // Draw pupils
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(
    eye1.x + pupilOffset.x,
    eye1.y + pupilOffset.y,
    pupilSize,
    0,
    Math.PI * 2,
  );
  ctx.arc(
    eye2.x + pupilOffset.x,
    eye2.y + pupilOffset.y,
    pupilSize,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.restore();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function render() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  drawGrid();
  drawFood();
  drawSnake();
}
