"""
APScheduler setup — daily pipeline run at 03:00 UTC.
Only active when ENABLE_SCHEDULER=true environment variable is set.
"""

import os
import logging

log = logging.getLogger("scheduler")


def start_scheduler():
    if os.environ.get("ENABLE_SCHEDULER", "false").lower() != "true":
        return
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from pipeline import run_pipeline  # type: ignore  (src/ingestion in sys.path)
        import dependencies

        scheduler = BackgroundScheduler(timezone="UTC")
        scheduler.add_job(
            lambda: run_pipeline(trigger="scheduler", progress_cb=dependencies._progress_update),
            "cron",
            hour=3,
            minute=0,
        )
        scheduler.start()
        log.info("[Scheduler] Daily pipeline registered at 03:00 UTC")
    except Exception as e:
        log.error(f"[Scheduler] Failed to start: {e}")
