// ==========================================
// constants.js - Game Configuration & State
// ==========================================

// --- Grid & Canvas Configuration ---
const CELL_SIZE = 24; // Pixel size of each grid cell

const DIRECTIONS = {
  UP: { x: 0, y: -1, name: "UP", icon: "⬆️" },
  DOWN: { x: 0, y: 1, name: "DOWN", icon: "⬇️" },
  LEFT: { x: -1, y: 0, name: "LEFT", icon: "⬅️" },
  RIGHT: { x: 1, y: 0, name: "RIGHT", icon: "➡️" },
};

const GAME_STATES = {
  IDLE: "IDLE",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  GAMEOVER: "GAMEOVER",
};

// Speed Configuration (ms per tick for levels 1 through 7)
const SPEED_LEVELS = [250, 200, 160, 120, 90, 65, 45];
let speedLevel = 3;

// --- Dynamic Grid Dimensions ---
let cols = 20;
let rows = 20;
let canvasWidth = 400;
let canvasHeight = 400;

// --- DOM Elements ---
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const currentScoreEl = document.getElementById("current-score");
const highScoreEl = document.getElementById("high-score");
const overlayEl = document.getElementById("game-overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const overlayBtn = document.getElementById("overlay-btn");
const speedDecBtn = document.getElementById("speed-dec");
const speedIncBtn = document.getElementById("speed-inc");
const speedValueEl = document.getElementById("speed-value");
const manualSpeedControl = document.getElementById("manual-speed-control");

// --- AI Autopilot & Telemetry Elements ---
const aiModeBtn = document.getElementById("ai-mode-btn");
const aiModeLabel = document.getElementById("ai-mode-label");
const aiInspectorBtn = document.getElementById("ai-inspector-btn");
const aiPanel = document.getElementById("ai-panel");
const aiStatusPill = document.getElementById("ai-status-pill");
const aiChosenVal = document.getElementById("ai-chosen-val");
const aiConfidenceVal = document.getElementById("ai-confidence-val");
const aiLatencyVal = document.getElementById("ai-latency-val");
const aiStepIndicator = document.getElementById("ai-step-indicator");
const aiCandidatesList = document.getElementById("ai-candidates-list");
const aiPayloadPreview = document.getElementById("ai-payload-preview");
const aiErrorOverlay = document.getElementById("ai-error-overlay");
const aiErrorMsg = document.getElementById("ai-error-msg");
const aiRetryBtn = document.getElementById("ai-retry-btn");
const aiFallbackManualBtn = document.getElementById("ai-fallback-manual-btn");

// --- Game State Variables ---
let snake = [];
let food = { x: 0, y: 0 };
let direction = DIRECTIONS.UP;
let inputQueue = [];
let score = 0;
let highScore = 0;
let gameState = GAME_STATES.IDLE;
let soundEnabled = true;

// Timing
let lastStepTime = 0;
let animationFrameId = null;

// --- AI State Variables ---
const LAYA_API_URL =
  window.location.protocol.startsWith("http")
    ? `${window.location.origin}/predict`
    : "http://127.0.0.1:8000/predict";
let aiMode = false;
let isThinking = false;
let aiAbortController = null;
let aiStepCount = 0;
let lastAiCandidates = [];
