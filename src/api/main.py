import json
import logging
import os
import sys
from pathlib import Path
import warnings
from dotenv import load_dotenv

# Resolve project root so all relative paths work regardless of launch dir.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
os.chdir(PROJECT_ROOT)
sys.path.insert(0, str(PROJECT_ROOT / "src/ingestion"))

load_dotenv(PROJECT_ROOT / ".env")
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

warnings.filterwarnings("ignore")          # suppress Prophet / Stan noise
logging.getLogger("prophet").setLevel(logging.ERROR)
logging.getLogger("cmdstanpy").setLevel(logging.ERROR)

app = FastAPI(title="Mumbai Crime Data API")

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class CrimeDataStore:
    def __init__(self, json_path="data/processed/crime.json"):
        self.df = self._load_and_flatten(json_path)
        
    def _load_and_flatten(self, path):
        try:
            with open(path, 'r') as f:
                data = json.load(f)
        except Exception as e:
            print(f"Error loading {path}: {e}")
            return pd.DataFrame()
            
        flat = []
        for entry in data:
            meta = entry.get('lineage', {})
            scores = entry.get('scores', {})
            for rec in entry.get('records', []):
                # Flatten meta and scores into row
                row = {**meta, **scores, **rec}
                flat.append(row)
        
        if not flat:
            return pd.DataFrame()

        df = pd.DataFrame(flat)
        
        # Convert report_date to datetime
        def parse_date(d_str):
            if not d_str or "Unknown" in d_str:
                return None
            try:
                # Handle formats: 2024-7 or 2024-July 
                if "-" in d_str:
                    parts = d_str.split("-")
                    if parts[1].isdigit():
                        return datetime(int(parts[0]), int(parts[1]), 1)
                return datetime.strptime(d_str, "%Y-%B")
            except:
                return None
        
        df['dt'] = df['report_date'].apply(parse_date)
        
        # Ensure counts are numeric (and drop strings like "1 2 3")
        for col in ['registered', 'detected', 'registered_ytd', 'detected_ytd']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
        
        return df

    def get_summary(self, domain=None, group=None):
        # Overall trend by month (excluding totals and unknowns)
        df = self.df[(self.df['dt'].notnull()) & (self.df['is_total'] == False)]
        if domain:
            df = df[df['domain'] == domain]
        if group:
            df = df[df['group'] == group]
            
        trends = df.groupby('dt').agg({
            'registered': 'sum',
            'detected': 'sum'
        }).reset_index()
        trends = trends.rename(columns={
            'dt': 'report_date',
            'registered': 'Registered',
            'detected': 'Detected'
        })
        trends['report_date'] = trends['report_date'].dt.strftime('%Y-%m')
        return trends.to_dict(orient='records')

    def get_categories(self, year=None):
        df = self.df[self.df['is_total'] == False]
        if year:
            df = df[df['report_date'].str.contains(str(year))]
            
        cats = df.groupby('group').agg({
            'registered': 'sum',
            'detected': 'sum'
        }).reset_index()
        cats = cats.rename(columns={
            'group': 'category',
            'registered': 'Registered',
            'detected': 'Detected'
        })
        return cats.sort_values('Registered', ascending=False).to_dict(orient='records')

    def get_reliability(self):
        # Average semantic score by year-month
        df = self.df.dropna(subset=['dt'])
        rel = df.groupby('dt').agg({
            'semantic': 'mean',
            'extraction': 'mean'
        }).reset_index()
        rel = rel.rename(columns={
            'semantic': 'semantic_score',
            'extraction': 'extraction_score'
        })
        rel['date'] = rel['dt'].dt.strftime('%Y-%m')
        return rel.sort_values('dt').to_dict(orient='records')

    def get_anomalies(self):
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import StandardScaler
        import numpy as np

        base = self.df[(self.df['dt'].notnull()) & (self.df['is_total'] == False)]

        # ── Build monthly feature matrix ───────────────────────────────────────
        # Features: per-group registered counts + detection rate, one row per month
        groups = ["Women Crimes", "Fatal Crimes", "Kidnapping", "Misc",
                  "Theft & Robbery", "Violent Crimes", "White Collar", "Cyber Crime"]

        monthly_total = (
            base.groupby("dt")
            .agg(registered=("registered", "sum"), detected=("detected", "sum"))
            .reset_index()
            .sort_values("dt")
        )
        monthly_total["detection_rate"] = (
            monthly_total["detected"] / monthly_total["registered"].replace(0, 1)
        )

        group_pivot = (
            base[base["group"].isin(groups)]
            .groupby(["dt", "group"])["registered"]
            .sum()
            .unstack(fill_value=0)
            .reindex(monthly_total["dt"])
            .fillna(0)
        )

        feature_df = monthly_total.set_index("dt")[["registered", "detection_rate"]]
        feature_df = feature_df.join(group_pivot)

        X = feature_df.values
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # ── Isolation Forest ───────────────────────────────────────────────────
        clf = IsolationForest(
            n_estimators=200,
            contamination=0.08,   # expect ~8% of months to be anomalous
            random_state=42,
        )
        scores = clf.fit_predict(X_scaled)               # -1 = anomaly, 1 = normal
        raw_scores = clf.decision_function(X_scaled)     # lower = more anomalous

        anomalies = []
        dates = feature_df.index

        for i, (dt, label, score) in enumerate(zip(dates, scores, raw_scores)):
            if label != -1:
                continue

            reg = int(monthly_total.iloc[i]["registered"])
            rate = float(monthly_total.iloc[i]["detection_rate"])

            # Determine severity by how far below zero the score is
            severity = "Critical" if score < -0.15 else "High" if score < -0.05 else "Medium"

            # Characterise the anomaly
            if rate < 0.4:
                anomaly_type = "Detection Drop"
                detail = f"Detection rate collapsed to {rate:.1%} ({reg} cases registered)"
            elif reg < monthly_total["registered"].quantile(0.10):
                anomaly_type = "Volume Drop"
                detail = f"Only {reg} cases registered — bottom 10th percentile"
            elif reg > monthly_total["registered"].quantile(0.90):
                anomaly_type = "Volume Spike"
                detail = f"{reg} cases registered — top 10th percentile"
            else:
                anomaly_type = "Multivariate Outlier"
                detail = f"Unusual crime mix detected (IF score: {score:.3f})"

            anomalies.append({
                "date": dt.strftime("%Y-%m"),
                "type": anomaly_type,
                "severity": severity,
                "details": detail,
                "isolation_score": round(float(score), 4),
            })

        # ── CUSUM change-point detection ───────────────────────────────────────
        series = monthly_total["registered"].values.astype(float)
        mu = series.mean()
        std = series.std()
        cusum_pos, cusum_neg = 0.0, 0.0
        threshold = 4.0 * std
        k = 0.5 * std   # allowance

        changepoints = []
        for i, val in enumerate(series):
            cusum_pos = max(0, cusum_pos + (val - mu) - k)
            cusum_neg = max(0, cusum_neg - (val - mu) - k)
            if cusum_pos > threshold or cusum_neg > threshold:
                changepoints.append({
                    "date": dates[i].strftime("%Y-%m"),
                    "type": "Change Point",
                    "severity": "Info",
                    "details": (
                        f"CUSUM detected structural break — "
                        f"{'upward' if cusum_pos > threshold else 'downward'} shift "
                        f"from baseline of {int(mu)} cases/month"
                    ),
                    "isolation_score": None,
                })
                cusum_pos, cusum_neg = 0.0, 0.0   # reset after flagging

        # Merge, sort by date
        all_events = anomalies + changepoints
        all_events.sort(key=lambda x: x["date"])
        return all_events

    def get_insights(self):
        df = self.df[(self.df['dt'].notnull()) & (self.df['is_total'] == False)]
        
        # Most frequent crime group
        top_group = df.groupby('group')['registered'].sum().idxmax()
        total_reg = df['registered'].sum()
        
        # Compute real detection rate comparison: 2018 baseline vs BNS era (2024+)
        base_2018 = df[df['dt'].dt.year == 2018]
        base_bns  = df[df['dt'].dt.year >= 2024]
        rate_2018 = (base_2018['detected'].sum() / base_2018['registered'].replace(0, 1).sum()) if len(base_2018) else 0
        rate_bns  = (base_bns['detected'].sum()  / base_bns['registered'].replace(0, 1).sum())  if len(base_bns)  else 0
        rate_delta = ((rate_bns - rate_2018) / rate_2018 * 100) if rate_2018 > 0 else 0
        direction = "improvement" if rate_delta >= 0 else "decline"

        insights = [
            {
                "title": "Top Crime Contributor",
                "text": f"{top_group} crimes account for the largest registered volume in the dataset.",
                "type": "standard"
            },
            {
                "title": "Detection Rate Trend",
                "text": (
                    f"Detection rates show a {abs(rate_delta):.1f}% {direction} in BNS-era reports "
                    f"(2024+) vs 2018 baseline ({rate_bns:.1%} vs {rate_2018:.1%})."
                ),
                "type": "positive" if rate_delta >= 0 else "warning"
            }
        ]
        
        # Recent trend
        latest_month = df['dt'].max()
        if latest_month:
            latest_data = df[df['dt'] == latest_month]['registered'].sum()
            insights.append({
                "title": f"Recent Volume ({latest_month.strftime('%B %Y')})",
                "text": f"Captured {latest_data} total registration events in the latest report.",
                "type": "info"
            })
            
        return insights

    def get_lineage(self, date_str: str):
        # date_str is typically "YYYY-MM" from the frontend
        try:
            # Parse the incoming date string (e.g., "2024-07")
            target_dt = datetime.strptime(date_str, "%Y-%m")
            df = self.df[self.df['dt'] == target_dt]
        except:
            # Fallback to direct string match if parsing fails
            df = self.df[self.df['report_date'] == date_str]
        
        if df.empty:
            return []
            
        # Group by source file to show extraction quality and location
        sources = df.groupby(['filename', 'page']).agg({
            'extraction': 'mean',
            'semantic': 'mean'
        }).reset_index()
        
        return sources.to_dict(orient='records')

# ── LLM Chat ──────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    history: Optional[list[dict]] = []   # [{role, content}, ...]


class ChatEngine:
    """
    Natural-language Q&A over the crime dataset powered by Groq + Llama.

    Builds a compact structured context summary once at init and reuses it
    for all queries. Groq's inference is fast enough for interactive chat
    without streaming.
    """

    MODEL = "llama-3.3-70b-versatile"

    SYSTEM_PROMPT = """You are a crime data analyst for the Mumbai Crime Intelligence Platform.
You have access to official Mumbai Police monthly crime statistics from 2018 to early 2026.
Answer questions using ONLY the data provided in <data_context>. Be specific: cite months,
numbers, and percentage changes where relevant. If the data does not contain enough information
to answer the question, say so clearly — do not speculate or fabricate figures.
Keep responses concise (3–6 sentences) unless the user asks for detail."""

    def __init__(self, df: pd.DataFrame):
        self.context = self._build_context(df) if not df.empty else "No data loaded."
        self._client = None   # lazy-init so startup doesn't fail if key is missing

    @property
    def client(self):
        if self._client is None:
            from groq import Groq
            api_key = os.environ.get("GROQ_API_KEY")
            if not api_key:
                raise HTTPException(
                    status_code=503,
                    detail="GROQ_API_KEY not set. Export it in the environment to enable chat."
                )
            self._client = Groq(api_key=api_key)
        return self._client

    def _build_context(self, df: pd.DataFrame) -> str:
        """Builds a compact plaintext summary of the dataset for the LLM context."""
        lines = ["=== Mumbai Crime Dataset Summary ==="]
        lines.append("Coverage: monthly reports, 2018-01 through 2026-02 (90 months)")
        lines.append(f"Total records: {len(df[df['is_total'] == False])}")
        lines.append("")

        base = df[(df["dt"].notnull()) & (df["is_total"] == False)]

        lines.append("--- Monthly Registered Crime Totals (all groups) ---")
        monthly = (
            base.groupby("dt")["registered"].sum()
            .reset_index()
            .sort_values("dt")
        )
        for _, row in monthly.iterrows():
            lines.append(f"  {row['dt'].strftime('%Y-%m')}: {int(row['registered'])}")

        lines.append("")
        lines.append("--- Per-Group Annual Totals ---")
        annual = (
            base.assign(year=base["dt"].dt.year)
            .groupby(["year", "group"])["registered"]
            .sum()
            .reset_index()
        )
        for year in sorted(annual["year"].unique()):
            lines.append(f"  {year}:")
            yr = annual[annual["year"] == year].sort_values("registered", ascending=False)
            for _, row in yr.iterrows():
                lines.append(f"    {row['group']}: {int(row['registered'])}")

        lines.append("")
        lines.append("--- Detection Rates by Group (all-time avg %) ---")
        det = base.groupby("group").agg(
            registered=("registered", "sum"),
            detected=("detected", "sum")
        ).reset_index()
        for _, row in det.iterrows():
            rate = (row["detected"] / row["registered"] * 100) if row["registered"] > 0 else 0
            lines.append(f"  {row['group']}: {rate:.1f}% detection rate")

        lines.append("")
        lines.append("--- Key Structural Events ---")
        lines.append("  2020-03 to 2020-06: COVID-19 lockdown (expect significant drops)")
        lines.append("  2024-07 onwards: IPC replaced by BNS legal framework")

        return "\n".join(lines)

    def ask(self, question: str, history: list[dict]) -> str:
        if not history:
            messages = [
                {
                    "role": "user",
                    "content": f"<data_context>\n{self.context}\n</data_context>\n\n{question}"
                }
            ]
        else:
            messages = list(history) + [{"role": "user", "content": question}]

        response = self.client.chat.completions.create(
            model=self.MODEL,
            messages=[{"role": "system", "content": self.SYSTEM_PROMPT}] + messages,
            max_tokens=512,
            temperature=0.3,   # lower = more factual
        )
        return response.choices[0].message.content


# ── Forecasting ───────────────────────────────────────────────────────────────

class ForecastEngine:
    """
    Pre-computes 6-month Prophet forecasts at startup for each crime group
    that has sufficient history (≥ 24 months).

    Changepoints are set explicitly for:
      - 2020-03: COVID-19 lockdown
      - 2024-07: IPC → BNS legal framework transition
    """

    # Groups with full or near-full 90-month series
    FORECASTABLE_GROUPS = ["Women Crimes", "Fatal Crimes", "Kidnapping", "Misc"]
    CHANGEPOINTS = ["2020-03-01", "2024-07-01"]
    HORIZON_MONTHS = 6

    def __init__(self, df: pd.DataFrame):
        self.forecasts: dict[str, list] = {}
        if df.empty or "dt" not in df.columns:
            print("[ForecastEngine] Empty dataframe — skipping forecast build")
            return
        self._build(df)

    def _build(self, df: pd.DataFrame):
        from prophet import Prophet

        base = df[(df["dt"].notnull()) & (df["is_total"] == False)]

        for group in self.FORECASTABLE_GROUPS:
            gdf = (
                base[base["group"] == group]
                .groupby("dt")["registered"]
                .sum()
                .reset_index()
                .rename(columns={"dt": "ds", "registered": "y"})
                .sort_values("ds")
            )

            if len(gdf) < 24:
                continue

            # Clip outliers at 3-sigma before fitting
            mu, sigma = gdf["y"].mean(), gdf["y"].std()
            gdf["y"] = gdf["y"].clip(upper=mu + 3 * sigma)

            valid_cps = [cp for cp in self.CHANGEPOINTS if pd.Timestamp(cp) < gdf["ds"].max()]

            m = Prophet(
                changepoints=valid_cps,
                changepoint_prior_scale=0.15,   # moderate flexibility
                seasonality_mode="additive",
                yearly_seasonality=True,
                weekly_seasonality=False,
                daily_seasonality=False,
                interval_width=0.80,
            )
            m.fit(gdf)

            future = m.make_future_dataframe(periods=self.HORIZON_MONTHS, freq="MS")
            forecast = m.predict(future)

            # Return both historical fitted values and future predictions
            merged = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
            merged["is_forecast"] = merged["ds"] > gdf["ds"].max()
            merged["ds"] = merged["ds"].dt.strftime("%Y-%m")
            merged["yhat"] = merged["yhat"].clip(lower=0).round().astype(int)
            merged["yhat_lower"] = merged["yhat_lower"].clip(lower=0).round().astype(int)
            merged["yhat_upper"] = merged["yhat_upper"].clip(lower=0).round().astype(int)

            self.forecasts[group] = merged.to_dict(orient="records")

        print(f"[ForecastEngine] Built forecasts for: {list(self.forecasts.keys())}")

    def get(self, group: str | None = None) -> dict:
        if group:
            if group not in self.forecasts:
                return {}
            return {group: self.forecasts[group]}
        return self.forecasts


# Singleton Store
store = CrimeDataStore()
forecast_engine = ForecastEngine(store.df)
chat_engine = ChatEngine(store.df)

@app.get("/api/trends")
def get_trends(domain: str = None, group: str = None):
    return store.get_summary(domain, group)

@app.get("/api/categories")
def get_categories(year: int = None):
    return store.get_categories(year)

@app.get("/api/reliability")
def get_reliability():
    return store.get_reliability()

@app.get("/api/anomalies")
def get_anomalies():
    return store.get_anomalies()

@app.get("/api/insights")
def get_insights():
    return store.get_insights()

@app.get("/api/lineage")
def get_lineage(date: str):
    return store.get_lineage(date)

@app.get("/api/forecast")
def get_forecast(group: str = None):
    """
    Returns Prophet-generated 6-month forecasts with 80% confidence intervals.
    Includes historical fitted values so the frontend can render a continuous line.

    Query params:
      group — one of: Women Crimes, Fatal Crimes, Kidnapping, Misc
              (omit to get all groups)
    """
    result = forecast_engine.get(group)
    if group and not result:
        raise HTTPException(
            status_code=404,
            detail=f"No forecast for group '{group}'. "
                   f"Available: {list(forecast_engine.forecasts.keys())}"
        )
    return result

@app.post("/api/chat")
def chat(req: ChatRequest):
    """
    Natural-language Q&A endpoint.

    Body: { "question": "...", "history": [{role, content}, ...] }
    Returns: { "answer": "...", "history": [...updated history...] }

    Pass `history` from the previous response back on each follow-up
    to maintain a multi-turn conversation.
    """
    answer = chat_engine.ask(req.question, req.history or [])

    # Build updated history for the client to pass back next turn
    if not req.history:
        updated_history = [
            {
                "role": "user",
                "content": f"<data_context>\n{chat_engine.context}\n</data_context>\n\n{req.question}"
            },
            {"role": "assistant", "content": answer},
        ]
    else:
        updated_history = list(req.history) + [
            {"role": "user", "content": req.question},
            {"role": "assistant", "content": answer},
        ]

    return {"answer": answer, "history": updated_history}


@app.get("/api/forecast/groups")
def get_forecast_groups():
    """Lists which groups have a precomputed forecast."""
    return {"groups": list(forecast_engine.forecasts.keys())}

@app.get("/api/health")
def health():
    return {"status": "ok", "records": len(store.df), "forecast_groups": len(forecast_engine.forecasts)}


# ── Data reload + pipeline status ─────────────────────────────────────────────

@app.post("/api/reload")
def reload_data():
    """
    Hot-reload crime.json without restarting the server.
    Called automatically by the pipeline after a successful run.
    """
    global store, forecast_engine, chat_engine
    store          = CrimeDataStore()
    forecast_engine = ForecastEngine(store.df)
    chat_engine    = ChatEngine(store.df)
    return {"status": "reloaded", "records": len(store.df), "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/pipeline/status")
def pipeline_status():
    """Returns the last 10 pipeline run logs."""
    log_path = PROJECT_ROOT / "data/pipeline_log.json"
    if not log_path.exists():
        return {"runs": []}
    try:
        data = json.loads(log_path.read_text())
        return {"runs": data.get("runs", [])[:10]}
    except Exception:
        return {"runs": []}


@app.post("/api/pipeline/trigger")
def trigger_pipeline():
    """
    Manually trigger the full pipeline from the API.
    Runs in a background thread so the request returns immediately.
    """
    import threading
    from pipeline import run_pipeline  # type: ignore  (on sys.path via PROJECT_ROOT/src/ingestion)

    def _run():
        run_pipeline(trigger="api")

    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return {"status": "pipeline started", "message": "Check /api/pipeline/status for progress."}


# ── Scheduler (daily auto-update) ────────────────────────────────────────────

def _start_scheduler():
    """
    Start APScheduler to run the full pipeline once daily at 03:00 UTC.
    Only starts if ENABLE_SCHEDULER=true in the environment.
    """
    if os.environ.get("ENABLE_SCHEDULER", "false").lower() != "true":
        return

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from pipeline import run_pipeline  # type: ignore
        scheduler = BackgroundScheduler(timezone="UTC")
        scheduler.add_job(
            lambda: run_pipeline(trigger="scheduler"),
            trigger="cron",
            hour=3,
            minute=0,
            id="daily_pipeline",
        )
        scheduler.start()
        print("[Scheduler] Daily pipeline scheduled at 03:00 UTC.")
    except ImportError:
        print("[Scheduler] apscheduler not installed — skipping.")
    except Exception as e:
        print(f"[Scheduler] Failed to start: {e}")


_start_scheduler()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
