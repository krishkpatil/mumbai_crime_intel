"""
MCIP Auto-Update Pipeline
--------------------------
Orchestrates the full data lifecycle:
  1. Scrape  — detect and download new PDFs from Mumbai Police portal
  2. Process — extract, clean, and score records from all PDFs
  3. Canonicalize — NLP deduplication of crime type strings
  4. Reload  — hot-reload the running API without restart

Run manually:
    python3 src/ingestion/pipeline.py

The API also calls this on a schedule via APScheduler (see src/api/main.py).
"""

import json
import os
import sys
import time
import hashlib
import logging
import requests
from datetime import datetime, timezone
from pathlib import Path

# ── paths (always relative to project root) ───────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[2]
PDF_DIR      = PROJECT_ROOT / "data/raw/pdfs/official_english"
LOG_FILE     = PROJECT_ROOT / "data/pipeline_log.json"

# ── logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("pipeline")

BASE_URL    = "https://mumbaipolice.gov.in/files/Cstat/{id}.pdf"
MAX_PROBE   = 20          # probe this many IDs beyond the current max before giving up
REQUEST_GAP = 0.8         # seconds between downloads (polite crawling)
API_RELOAD  = os.environ.get("API_RELOAD_URL", "http://localhost:8000/api/reload")


# ── helpers ───────────────────────────────────────────────────────────────────

def _load_log() -> dict:
    if LOG_FILE.exists():
        try:
            return json.loads(LOG_FILE.read_text())
        except Exception:
            pass
    return {"runs": []}


def _save_log(data: dict):
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _current_max_id() -> int:
    """Largest numeric PDF id already on disk."""
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    ids = [
        int(p.stem) for p in PDF_DIR.glob("*.pdf")
        if p.stem.isdigit()
    ]
    return max(ids) if ids else 0


def _file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            h.update(chunk)
    return h.hexdigest()


# ── step 1: scrape ─────────────────────────────────────────────────────────────

def scrape_new_pdfs() -> list[Path]:
    """
    Probes the Mumbai Police portal for IDs beyond what we already have.
    Stops after MAX_PROBE consecutive 404s.
    Returns list of newly downloaded file paths.
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://mumbaipolice.gov.in/CrimeStatistics",
    }

    start_id   = _current_max_id() + 1
    downloaded = []
    misses      = 0

    log.info(f"Probing for new PDFs starting at ID {start_id}…")

    for file_id in range(start_id, start_id + MAX_PROBE + 1):
        url      = BASE_URL.format(id=file_id)
        out_path = PDF_DIR / f"{file_id}.pdf"

        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code == 200 and len(resp.content) > 1024:
                out_path.write_bytes(resp.content)
                downloaded.append(out_path)
                log.info(f"  ✓ Downloaded {file_id}.pdf ({len(resp.content)//1024} KB)")
                misses = 0
                time.sleep(REQUEST_GAP)
            else:
                misses += 1
                if misses >= MAX_PROBE:
                    log.info(f"  {MAX_PROBE} consecutive misses — no more new files.")
                    break
        except Exception as e:
            log.warning(f"  Error fetching ID {file_id}: {e}")
            misses += 1

    log.info(f"Scrape complete. {len(downloaded)} new PDF(s) downloaded.")
    return downloaded


# ── step 2: process ────────────────────────────────────────────────────────────

def run_processor() -> dict:
    """Runs the PDF extraction pipeline, returns quality summary."""
    log.info("Running ingestion processor…")

    # Import here so the pipeline can be run standalone without the full venv
    sys.path.insert(0, str(PROJECT_ROOT / "src/ingestion"))
    from processor import process_pipeline  # type: ignore

    old_cwd = os.getcwd()
    os.chdir(PROJECT_ROOT)
    try:
        process_pipeline()
    finally:
        os.chdir(old_cwd)

    # Read quality report
    q_path = PROJECT_ROOT / "data/processed/quality.json"
    if q_path.exists():
        quality = json.loads(q_path.read_text())
        success = sum(1 for q in quality if q.get("status") == "SUCCESS")
        errors  = sum(1 for q in quality if q.get("status") == "ERROR")
        log.info(f"Processor: {len(quality)} PDFs — {success} success, {errors} errors.")
        return {"total": len(quality), "success": success, "errors": errors}
    return {}


# ── step 3: canonicalize ───────────────────────────────────────────────────────

def run_canonicalizer() -> int:
    """Runs NLP canonicalization. Returns number of canonical clusters."""
    log.info("Running NLP canonicalization…")

    sys.path.insert(0, str(PROJECT_ROOT / "src/ingestion"))
    from canonicalizer import build_canonical_map, apply_canonical_map  # type: ignore

    old_cwd = os.getcwd()
    os.chdir(PROJECT_ROOT)
    try:
        canon_map = build_canonical_map()
        apply_canonical_map(canon_map)
        clusters = len(set(canon_map.values()))
        log.info(f"Canonicalization: {len(canon_map)} strings → {clusters} canonical types.")
        return clusters
    finally:
        os.chdir(old_cwd)


# ── step 4: reload API ────────────────────────────────────────────────────────

def reload_api() -> bool:
    """POST to the running API's reload endpoint so it picks up new data."""
    try:
        resp = requests.post(API_RELOAD, timeout=60)
        if resp.status_code == 200:
            data = resp.json()
            log.info(f"API reloaded — {data.get('records', '?')} records now loaded.")
            return True
        else:
            log.warning(f"API reload returned {resp.status_code}.")
            return False
    except Exception as e:
        log.warning(f"Could not reach API for reload ({e}). Data will load on next restart.")
        return False


# ── full pipeline ─────────────────────────────────────────────────────────────

def run_pipeline(trigger: str = "manual") -> dict:
    """
    Run the full MCIP pipeline.
    Returns a run-log entry dict.
    """
    started_at = datetime.now(timezone.utc).isoformat()
    log.info(f"=== MCIP Pipeline started (trigger={trigger}) ===")

    result = {
        "started_at":  started_at,
        "trigger":     trigger,
        "new_pdfs":    0,
        "processor":   {},
        "canon_clusters": 0,
        "api_reloaded": False,
        "status":      "error",
        "error":       None,
    }

    try:
        # 1. Scrape
        new_files = scrape_new_pdfs()
        result["new_pdfs"] = len(new_files)

        # 2. Always re-process (new PDFs or not — handles retries on partial runs)
        result["processor"] = run_processor()

        # 3. Canonicalize
        result["canon_clusters"] = run_canonicalizer()

        # 4. Reload
        result["api_reloaded"] = reload_api()

        result["status"] = "success"

    except Exception as e:
        log.error(f"Pipeline failed: {e}", exc_info=True)
        result["error"] = str(e)

    result["finished_at"] = datetime.now(timezone.utc).isoformat()

    # Persist log
    log_data = _load_log()
    log_data["runs"].insert(0, result)  # newest first
    log_data["runs"] = log_data["runs"][:50]  # keep last 50 runs
    _save_log(log_data)

    log.info(f"=== Pipeline finished: {result['status']} ===")
    return result


if __name__ == "__main__":
    run_pipeline(trigger="manual")
