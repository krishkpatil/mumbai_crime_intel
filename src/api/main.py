import logging
import os
import sys
import warnings
from pathlib import Path

# ── Bootstrap: path + env must be set before ANY local imports ────────────────
_ROOT = Path(__file__).resolve().parents[2]
os.chdir(_ROOT)
sys.path.insert(0, str(_ROOT / "src/api"))
sys.path.insert(0, str(_ROOT / "src/ingestion"))

from dotenv import load_dotenv
load_dotenv(_ROOT / ".env")

warnings.filterwarnings("ignore")
logging.getLogger("prophet").setLevel(logging.ERROR)
logging.getLogger("cmdstanpy").setLevel(logging.ERROR)

# ── Local imports (sys.path is now set) ───────────────────────────────────────
import db
import dependencies
from routers import analytics, chat, export
from routers import forecast as forecast_router
from routers import pipeline
from scheduler import start_scheduler

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(title="Mumbai Crime Data API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analytics.router)
app.include_router(forecast_router.router)
app.include_router(chat.router)
app.include_router(pipeline.router)
app.include_router(export.router)

# ── Startup ───────────────────────────────────────────────────────────────────
db.init_schema()
dependencies.init()
start_scheduler()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
