"""
Postgres persistence layer.

Falls back gracefully to no-op / empty returns when DATABASE_URL is not set
so local dev with JSON files continues to work unchanged.
"""
import os
import json
import psycopg2
from psycopg2.extras import execute_values
import pandas as pd
from datetime import datetime

DATABASE_URL = os.environ.get("DATABASE_URL")


def get_conn():
    if not DATABASE_URL:
        return None
    try:
        conn = psycopg2.connect(DATABASE_URL, sslmode="require")
        return conn
    except Exception as e:
        print(f"[DB] Connection failed: {e}")
        return None


def init_schema():
    conn = get_conn()
    if not conn:
        print("[DB] No DATABASE_URL — using JSON fallback")
        return
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS crime_records (
                    id               SERIAL PRIMARY KEY,
                    report_date      TEXT,
                    filename         TEXT,
                    page             INTEGER,
                    extraction_score REAL,
                    semantic_score   REAL,
                    crime_type       TEXT,
                    canonical_type   TEXT,
                    domain           TEXT,
                    group_name       TEXT,
                    registered       INTEGER,
                    detected         INTEGER,
                    registered_ytd   INTEGER,
                    detected_ytd     INTEGER,
                    is_total         BOOLEAN,
                    layout           TEXT
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS forecasts (
                    id          SERIAL PRIMARY KEY,
                    group_name  TEXT,
                    ds          TEXT,
                    yhat        INTEGER,
                    yhat_lower  INTEGER,
                    yhat_upper  INTEGER,
                    is_forecast BOOLEAN,
                    computed_at TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS anomalies (
                    id              SERIAL PRIMARY KEY,
                    date            TEXT,
                    type            TEXT,
                    severity        TEXT,
                    details         TEXT,
                    isolation_score REAL,
                    computed_at     TIMESTAMP DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS pipeline_runs (
                    id            SERIAL PRIMARY KEY,
                    started_at    TEXT,
                    finished_at   TEXT,
                    trigger_type  TEXT,
                    new_pdfs      INTEGER,
                    status        TEXT,
                    error         TEXT,
                    records_total INTEGER
                )
            """)
        conn.commit()
        print("[DB] Schema ready")
    finally:
        conn.close()


def is_empty(table: str) -> bool:
    conn = get_conn()
    if not conn:
        return True
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            return cur.fetchone()[0] == 0
    finally:
        conn.close()


def seed_from_json(json_path: str):
    """Flatten crime.json and insert all records into crime_records."""
    conn = get_conn()
    if not conn:
        return
    try:
        with open(json_path) as f:
            data = json.load(f)

        rows = []
        for entry in data:
            meta   = entry.get("lineage", {})
            scores = entry.get("scores", {})
            for rec in entry.get("records", []):
                rows.append((
                    meta.get("report_date"),
                    meta.get("filename"),
                    rec.get("page"),
                    scores.get("extraction"),
                    scores.get("semantic"),
                    rec.get("crime_type"),
                    rec.get("canonical_type"),
                    rec.get("domain"),
                    rec.get("group"),
                    int(rec.get("registered", 0) or 0),
                    int(rec.get("detected", 0) or 0),
                    int(rec.get("registered_ytd", 0) or 0),
                    int(rec.get("detected_ytd", 0) or 0),
                    bool(rec.get("is_total", False)),
                    rec.get("layout"),
                ))

        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO crime_records (
                    report_date, filename, page, extraction_score, semantic_score,
                    crime_type, canonical_type, domain, group_name,
                    registered, detected, registered_ytd, detected_ytd, is_total, layout
                ) VALUES %s
            """, rows)
        conn.commit()
        print(f"[DB] Seeded {len(rows)} records")
    finally:
        conn.close()


def clear_records():
    conn = get_conn()
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM crime_records")
        conn.commit()
    finally:
        conn.close()


def _parse_date(d_str):
    if not d_str or "Unknown" in str(d_str):
        return None
    try:
        if "-" in d_str:
            parts = d_str.split("-")
            if parts[1].isdigit():
                return datetime(int(parts[0]), int(parts[1]), 1)
        return datetime.strptime(d_str, "%Y-%B")
    except Exception:
        return None


def get_df() -> pd.DataFrame:
    """Return all crime_records as a DataFrame matching the CrimeDataStore format."""
    conn = get_conn()
    if not conn:
        return pd.DataFrame()
    try:
        df = pd.read_sql("""
            SELECT report_date,
                   filename,
                   page,
                   extraction_score AS extraction,
                   semantic_score   AS semantic,
                   crime_type,
                   canonical_type,
                   domain,
                   group_name       AS "group",
                   registered,
                   detected,
                   registered_ytd,
                   detected_ytd,
                   is_total,
                   layout
            FROM crime_records
        """, conn)

        df["dt"] = df["report_date"].apply(_parse_date)
        for col in ["registered", "detected", "registered_ytd", "detected_ytd"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)
        return df
    finally:
        conn.close()


# ── Forecasts ─────────────────────────────────────────────────────────────────

def store_forecasts(forecasts_dict: dict):
    conn = get_conn()
    if not conn:
        return
    try:
        rows = []
        for group, points in forecasts_dict.items():
            for p in points:
                rows.append((group, p["ds"], p["yhat"], p["yhat_lower"], p["yhat_upper"], p["is_forecast"]))
        with conn.cursor() as cur:
            cur.execute("DELETE FROM forecasts")
            if rows:
                execute_values(cur, """
                    INSERT INTO forecasts (group_name, ds, yhat, yhat_lower, yhat_upper, is_forecast)
                    VALUES %s
                """, rows)
        conn.commit()
        print(f"[DB] Stored forecasts for {len(forecasts_dict)} groups")
    finally:
        conn.close()


def get_forecasts() -> dict:
    conn = get_conn()
    if not conn:
        return {}
    try:
        df = pd.read_sql("""
            SELECT group_name, ds, yhat, yhat_lower, yhat_upper, is_forecast
            FROM forecasts
            ORDER BY group_name, ds
        """, conn)
        if df.empty:
            return {}
        result = {}
        for group, gdf in df.groupby("group_name"):
            result[group] = gdf.drop("group_name", axis=1).to_dict(orient="records")
        return result
    finally:
        conn.close()


# ── Anomalies ─────────────────────────────────────────────────────────────────

def store_anomalies(anomalies_list: list):
    conn = get_conn()
    if not conn:
        return
    try:
        rows = [(a["date"], a["type"], a["severity"], a["details"], a.get("isolation_score")) for a in anomalies_list]
        with conn.cursor() as cur:
            cur.execute("DELETE FROM anomalies")
            if rows:
                execute_values(cur, """
                    INSERT INTO anomalies (date, type, severity, details, isolation_score)
                    VALUES %s
                """, rows)
        conn.commit()
        print(f"[DB] Stored {len(anomalies_list)} anomalies")
    finally:
        conn.close()


def get_anomalies_cached() -> list:
    conn = get_conn()
    if not conn:
        return []
    try:
        df = pd.read_sql("""
            SELECT date, type, severity, details, isolation_score
            FROM anomalies
            ORDER BY date
        """, conn)
        if df.empty:
            return []
        records = df.to_dict(orient="records")
        # isolation_score may be None for CUSUM entries — keep as-is
        return records
    finally:
        conn.close()


# ── Pipeline runs ─────────────────────────────────────────────────────────────

def store_pipeline_run(run: dict):
    conn = get_conn()
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO pipeline_runs
                    (started_at, finished_at, trigger_type, new_pdfs, status, error, records_total)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                run.get("started_at"),
                run.get("finished_at"),
                run.get("trigger"),
                run.get("new_pdfs", 0),
                run.get("status"),
                run.get("error"),
                run.get("records_total", 0),
            ))
        conn.commit()
    finally:
        conn.close()


def get_pipeline_runs(limit: int = 10) -> list:
    conn = get_conn()
    if not conn:
        return []
    try:
        df = pd.read_sql(f"""
            SELECT started_at, finished_at, trigger_type AS trigger,
                   new_pdfs, status, error, records_total
            FROM pipeline_runs
            ORDER BY id DESC
            LIMIT {limit}
        """, conn)
        if df.empty:
            return []
        return df.to_dict(orient="records")
    finally:
        conn.close()
