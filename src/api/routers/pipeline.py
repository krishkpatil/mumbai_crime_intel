"""
Pipeline router — status, real-time progress, trigger, and hot-reload endpoints.
"""

import json
import threading
from datetime import datetime

import db
import dependencies
from config import PROJECT_ROOT
from fastapi import APIRouter

router = APIRouter()


@router.get("/api/pipeline/status")
def pipeline_status():
    runs = db.get_pipeline_runs(10)
    if runs:
        return {"runs": runs}

    log_path = PROJECT_ROOT / "data/pipeline_log.json"
    if not log_path.exists():
        return {"runs": []}
    try:
        data = json.loads(log_path.read_text())
        return {"runs": data.get("runs", [])[:10]}
    except Exception:
        return {"runs": []}


@router.get("/api/pipeline/progress")
def pipeline_progress():
    p = dict(dependencies._pipeline_progress)
    if p["running"] and p.get("last_heartbeat"):
        try:
            delta = (datetime.utcnow() - datetime.fromisoformat(p["last_heartbeat"])).total_seconds()
            if delta > 180:
                p["stale"] = True
        except Exception:
            pass
    return p


@router.post("/api/pipeline/trigger")
def trigger_pipeline():
    if dependencies._pipeline_progress.get("running"):
        return {"status": "already_running", "message": "Pipeline is already running."}

    from pipeline import run_pipeline  # type: ignore  (src/ingestion in sys.path)

    dependencies._pipeline_progress.update({
        "running": True, "phase": "starting", "current_file": None,
        "files_done": 0, "files_total": 0, "new_pdfs_found": 0,
        "log": [], "started_at": datetime.utcnow().isoformat(),
        "error": None, "last_heartbeat": datetime.utcnow().isoformat(),
    })

    def _run():
        try:
            run_pipeline(trigger="api", progress_cb=dependencies._progress_update)
        except Exception as e:
            dependencies._progress_update(running=False, phase="error", error=str(e))
            return
        if dependencies._pipeline_progress.get("phase") != "error":
            dependencies._progress_update(running=False, phase="done")

    threading.Thread(target=_run, daemon=True).start()
    return {"status": "pipeline started", "message": "Check /api/pipeline/progress for real-time updates."}


@router.post("/api/reload")
def reload_data():
    """Hot-reload: re-seed DB from crime.json, rebuild all engines."""
    dependencies.reinit()
    return {
        "status": "reloaded",
        "records": len(dependencies.store.df),
        "timestamp": datetime.utcnow().isoformat(),
    }
