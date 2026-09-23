import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Union

# Set USE_TF=0 to prevent abseil/TensorFlow probe deadlocks during model load (per Laya documentation)
os.environ.setdefault("USE_TF", "0")

import anyio
import torch
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

# Optimizations from Laya docs (BENCHMARKS.md CPU tuning):
# Pin inter-op threads to 1 because system_one runs a single forward pass per request.
# Eliminates inter-thread synchronization overhead and CPU thrashing.
try:
    torch.set_num_interop_threads(1)
except RuntimeError:
    pass

import laya
from laya.email import clean_email_body

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("laya-snake-api")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager:
    Preloads ONLY the high-performance English Laya model (convaiinnovations/laya)
    once upon server startup, keeping it resident in memory for all incoming requests.
    Conducts a lightweight warm-up inference pass to eliminate cold-start latency for the first caller.
    """
    logger.info("Initializing and preloading English Laya model (convaiinnovations/laya)...")
    try:
        # Load only the English checkpoint (ModernBERT-large, 421M params, ~808 MB)
        # Avoids loading unused multilingual and synthetic checkpoints (~1.16B total), saving ~1.5GB RAM
        agent = laya.load("convaiinnovations/laya")

        # Warmup pass: initializes CUDA/CPU memory allocators and tokenizers ahead of time
        logger.info("Running warmup pass on English model...")
        warmup_state = "System warmup check"
        warmup_q = {"ready": {"type": "noul", "instructions": "Is the system ready?"}}
        with torch.inference_mode():
            agent.predict(warmup_state, warmup_q)

        app.state.agent = agent
        app.state.router = agent
        logger.info("English Laya model preloaded, warmed up, and ready for inference.")
    except Exception as e:
        logger.error(f"Failed to load English Laya model on startup: {e}", exc_info=True)
        app.state.agent = None
        app.state.router = None
        raise e

    yield

    logger.info("Shutting down Laya service...")
    app.state.agent = None
    app.state.router = None


app = FastAPI(
    title="AI-Powered Snake Game & Laya Decision Engine",
    description="High-performance AI backend and game host serving the English Laya decision engine and Snake game frontend.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files directory for game scripts
js_path = os.path.join(BASE_DIR, "js")
if os.path.exists(js_path):
    app.mount("/js", StaticFiles(directory=js_path), name="js")


class PredictRequest(BaseModel):
    state: Union[dict[str, Any], str, list[Any]] = Field(
        ...,
        description="Input context: structured dictionary (e.g. snake head position, food direction, canvas bounds), raw text string, or conversation turns list.",
    )
    questions: dict[str, Any] = Field(
        ...,
        description="Dictionary mapping question IDs to question definitions (e.g. choice, score, or noul).",
    )
    clean_email: bool = Field(
        default=False,
        description="Optional: if True, strips email boilerplates, quoted replies, and signatures to fit within context budget.",
    )

    @field_validator("questions")
    @classmethod
    def validate_questions(cls, v: dict[str, Any]) -> dict[str, Any]:
        if not v or not isinstance(v, dict):
            raise ValueError("Questions dictionary must not be empty.")
        for qid, qdef in v.items():
            if not isinstance(qdef, dict):
                raise ValueError(f"Question '{qid}' definition must be an object.")
            if "type" not in qdef:
                raise ValueError(f"Question '{qid}' missing required field 'type' (choice, score, or noul).")
            if qdef["type"] not in ("choice", "score", "noul"):
                raise ValueError(f"Question '{qid}' has invalid type '{qdef['type']}'. Must be choice, score, or noul.")
            if "instructions" not in qdef:
                raise ValueError(f"Question '{qid}' missing required field 'instructions'.")
        return v


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)


@app.get("/style.css", include_in_schema=False)
async def get_style():
    style_path = os.path.join(BASE_DIR, "style.css")
    if os.path.exists(style_path):
        return FileResponse(style_path, media_type="text/css")
    raise HTTPException(status_code=404, detail="style.css not found")


@app.get("/")
async def root():
    """Serves the Snake Game UI if accessed in browser, or fallback info."""
    index_path = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return {
        "service": "AI-Powered Snake Game with Laya Decision Engine",
        "status": "running",
        "model": "convaiinnovations/laya (English)",
        "docs_url": "/docs",
        "health_url": "/health",
        "predict_url": "/predict",
    }


@app.get("/api/info")
async def api_info():
    """API service status and documentation endpoints."""
    return {
        "service": "AI-Powered Snake Game with Laya Decision Engine",
        "status": "running",
        "model": "convaiinnovations/laya (English)",
        "docs_url": "/docs",
        "health_url": "/health",
        "predict_url": "/predict",
    }


@app.get("/health")
async def health(request: Request):
    """Health check endpoint to verify server status and model readiness."""
    agent = getattr(request.app.state, "agent", None)
    is_ready = agent is not None
    return {
        "status": "ok" if is_ready else "degraded",
        "model_loaded": is_ready,
        "model": "convaiinnovations/laya",
    }


def _run_inference(
    agent: Any,
    state: Union[dict[str, Any], str, list[Any]],
    questions: dict[str, Any],
    clean_email: bool,
) -> dict[str, Any]:
    """Execute prediction inside a worker thread using torch.inference_mode()."""
    if clean_email:
        if isinstance(state, dict):
            state = dict(state)
            if "body" in state and isinstance(state["body"], str):
                state["body"] = clean_email_body(state["body"])
        elif isinstance(state, str):
            state = clean_email_body(state)

    with torch.inference_mode():
        result = agent.predict(state, questions)

    # Ensure routing metadata indicates English checkpoint
    if "routing" not in result:
        result["routing"] = {
            "model": "english",
            "repo": "convaiinnovations/laya",
            "reason": "Dedicated English ModernBERT-large model",
        }
    return result


@app.post("/predict")
async def predict(req: PredictRequest, request: Request):
    """
    Perform decision prediction using the preloaded English Laya model.
    Runs inference off the main asyncio thread to avoid blocking FastAPI event loop.
    """
    agent = getattr(request.app.state, "agent", None)
    if agent is None:
        raise HTTPException(
            status_code=503,
            detail="Model is not ready or failed to initialize.",
        )

    try:
        # Offload CPU-bound PyTorch inference to worker thread
        result = await anyio.to_thread.run_sync(
            _run_inference, agent, req.state, req.questions, req.clean_email
        )
        return result
    except Exception as e:
        logger.error(f"Inference error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error executing prediction: {str(e)}",
        )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
