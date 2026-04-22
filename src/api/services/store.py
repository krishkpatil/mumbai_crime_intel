"""
CrimeDataStore — loads crime records from Postgres (primary) or crime.json (fallback).
Provides all query methods consumed by the analytics router.
"""

import json
from pathlib import Path
from datetime import datetime

import pandas as pd

import db


class CrimeDataStore:
    def __init__(self):
        self.df = self._load()

    def _load(self) -> pd.DataFrame:
        # 1. Try Postgres
        if db.DATABASE_URL:
            df = db.get_df()
            if not df.empty:
                print(f"[Store] Loaded {len(df)} records from Postgres")
                return df
            # DB is empty — seed from JSON then reload
            json_path = "data/processed/crime.json"
            if Path(json_path).exists():
                print("[Store] DB empty — seeding from crime.json")
                db.seed_from_json(json_path)
                df = db.get_df()
                if not df.empty:
                    print(f"[Store] Seeded and loaded {len(df)} records")
                    return df

        # 2. Fallback: load directly from JSON (local dev / no DB)
        return self._load_json("data/processed/crime.json")

    def _load_json(self, path: str) -> pd.DataFrame:
        try:
            with open(path) as f:
                data = json.load(f)
        except Exception as e:
            print(f"[Store] Error loading {path}: {e}")
            return pd.DataFrame()

        flat = []
        for entry in data:
            meta   = entry.get("lineage", {})
            scores = entry.get("scores", {})
            for rec in entry.get("records", []):
                flat.append({**meta, **scores, **rec})

        if not flat:
            return pd.DataFrame()

        df = pd.DataFrame(flat)

        def parse_date(d_str):
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

        df["dt"] = df["report_date"].apply(parse_date)
        for col in ["registered", "detected", "registered_ytd", "detected_ytd"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)
        return df

    # ── Query methods ─────────────────────────────────────────────────────────

    def get_summary(self, domain=None, group=None, year=None):
        df = self.df[(self.df["dt"].notnull()) & (self.df["is_total"] == False)]
        if domain:
            df = df[df["domain"] == domain]
        if group:
            df = df[df["group"] == group]
        if year:
            try:
                df = df[df["dt"].dt.year == int(year)]
            except (ValueError, TypeError):
                pass
        trends = (
            df.groupby("dt")
            .agg(registered=("registered", "sum"), detected=("detected", "sum"))
            .reset_index()
            .rename(columns={"dt": "report_date", "registered": "Registered", "detected": "Detected"})
        )
        trends["report_date"] = trends["report_date"].dt.strftime("%Y-%m")
        return trends.to_dict(orient="records")

    def get_categories(self, year=None):
        df = self.df[self.df["is_total"] == False]
        if year:
            df = df[df["report_date"].str.contains(str(year))]
        cats = (
            df.groupby("group")
            .agg(registered=("registered", "sum"), detected=("detected", "sum"))
            .reset_index()
            .rename(columns={"group": "category", "registered": "Registered", "detected": "Detected"})
        )
        return cats.sort_values("Registered", ascending=False).to_dict(orient="records")

    def get_reliability(self):
        df = self.df.dropna(subset=["dt"])
        rel = (
            df.groupby("dt")
            .agg(semantic_score=("semantic", "mean"), extraction_score=("extraction", "mean"))
            .reset_index()
        )
        rel["date"] = rel["dt"].dt.strftime("%Y-%m")
        return rel.sort_values("dt").to_dict(orient="records")

    def get_anomalies(self):
        cached = db.get_anomalies_cached()
        if cached:
            return cached
        result = self._compute_anomalies()
        if result and db.DATABASE_URL:
            db.store_anomalies(result)
        return result

    def _compute_anomalies(self):
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import StandardScaler
        import numpy as np

        base = self.df[(self.df["dt"].notnull()) & (self.df["is_total"] == False)]
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
        X_scaled = StandardScaler().fit_transform(X)

        clf = IsolationForest(n_estimators=200, contamination=0.08, random_state=42)
        scores = clf.fit_predict(X_scaled)
        raw_scores = clf.decision_function(X_scaled)

        anomalies = []
        dates = feature_df.index

        for i, (dt, label, score) in enumerate(zip(dates, scores, raw_scores)):
            if label != -1:
                continue
            reg  = int(monthly_total.iloc[i]["registered"])
            rate = float(monthly_total.iloc[i]["detection_rate"])
            severity = "Critical" if score < -0.15 else "High" if score < -0.05 else "Medium"

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

        # CUSUM change-point detection
        series = monthly_total["registered"].values.astype(float)
        mu, std = series.mean(), series.std()
        cusum_pos, cusum_neg = 0.0, 0.0
        threshold = 4.0 * std
        k = 0.5 * std

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
                cusum_pos, cusum_neg = 0.0, 0.0

        all_events = anomalies + changepoints
        all_events.sort(key=lambda x: x["date"])
        return all_events

    def get_insights(self):
        df = self.df[(self.df["dt"].notnull()) & (self.df["is_total"] == False)]
        top_group  = df.groupby("group")["registered"].sum().idxmax()
        base_2018  = df[df["dt"].dt.year == 2018]
        base_bns   = df[df["dt"].dt.year >= 2024]
        rate_2018  = (base_2018["detected"].sum() / base_2018["registered"].replace(0, 1).sum()) if len(base_2018) else 0
        rate_bns   = (base_bns["detected"].sum()  / base_bns["registered"].replace(0, 1).sum())  if len(base_bns)  else 0
        rate_delta = ((rate_bns - rate_2018) / rate_2018 * 100) if rate_2018 > 0 else 0
        direction  = "improvement" if rate_delta >= 0 else "decline"

        insights = [
            {"title": "Top Crime Contributor",
             "text": f"{top_group} crimes account for the largest registered volume in the dataset.",
             "type": "standard"},
            {"title": "Detection Rate Trend",
             "text": (f"Detection rates show a {abs(rate_delta):.1f}% {direction} in BNS-era reports "
                      f"(2024+) vs 2018 baseline ({rate_bns:.1%} vs {rate_2018:.1%})."),
             "type": "positive" if rate_delta >= 0 else "warning"},
        ]

        latest_month = df["dt"].max()
        if latest_month:
            latest_data = df[df["dt"] == latest_month]["registered"].sum()
            insights.append({
                "title": f"Recent Volume ({latest_month.strftime('%B %Y')})",
                "text": f"Captured {latest_data} total registration events in the latest report.",
                "type": "info",
            })
        return insights

    def get_lineage(self, date_str: str):
        try:
            target_dt = datetime.strptime(date_str, "%Y-%m")
            df = self.df[self.df["dt"] == target_dt]
        except Exception:
            df = self.df[self.df["report_date"] == date_str]
        if df.empty:
            return []
        sources = (
            df.groupby(["filename", "page"])
            .agg(extraction=("extraction", "mean"), semantic=("semantic", "mean"))
            .reset_index()
        )
        return sources.to_dict(orient="records")
