"""
Shared application state: singleton service instances + pipeline progress tracker.

main.py calls `init()` once at startup. The `/api/reload` endpoint calls `reinit()`
to hot-swap all engines without restarting the server.

Routers access engines as:
    import dependencies
    dependencies.store.get_summary(...)
"""

from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from services.store import CrimeDataStore
    from services.forecast import ForecastEngine
    from services.chat import ChatEngine

# ── Singleton engines (None until init() is called) ───────────────────────────

store: "CrimeDataStore | None" = None
forecast_engine: "ForecastEngine | None" = None
chat_engine: "ChatEngine | None" = None


def init():
    """Instantiate all service singletons. Called once by main.py at startup."""
    global store, forecast_engine, chat_engine
    from services.store import CrimeDataStore
    from services.forecast import ForecastEngine
    from services.chat import ChatEngine
    store = CrimeDataStore()
    forecast_engine = ForecastEngine(store.df)
    chat_engine = ChatEngine(store.df)


def reinit():
    """
    Hot-reload: clear DB caches, re-seed from crime.json, rebuild all engines.
    Called by POST /api/reload after a pipeline run writes new data.
    """
    import db
    if db.DATABASE_URL:
        db.clear_records()
        db.seed_from_json("data/processed/crime.json")
        db.store_anomalies([])
        db.store_forecasts({})
    init()


# ── Pipeline progress (in-memory, resets on server restart) ──────────────────

_pipeline_progress: dict = {
    "running":        False,
    "phase":          None,   # 'scraping'|'processing'|'canonicalizing'|'reloading'|'done'|'error'
    "current_file":   None,
    "files_done":     0,
    "files_total":    0,
    "new_pdfs_found": 0,
    "log":            [],     # last 30 lines
    "started_at":     None,
    "error":          None,
    "last_heartbeat": None,
}


def _progress_update(**kwargs):
    msg = kwargs.pop("msg", None)
    _pipeline_progress.update(kwargs)
    _pipeline_progress["last_heartbeat"] = datetime.utcnow().isoformat()
    if msg:
        _pipeline_progress["log"] = (_pipeline_progress["log"] + [msg])[-30:]
