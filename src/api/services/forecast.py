"""
ForecastEngine — Prophet-based time-series forecasting for crime groups.
Loads pre-computed forecasts from Postgres on startup; builds fresh if cache is empty.
"""

import pandas as pd
import db


class ForecastEngine:
    FORECASTABLE_GROUPS = ["Women Crimes", "Fatal Crimes", "Kidnapping", "Misc"]
    CHANGEPOINTS = ["2020-03-01", "2024-07-01"]
    HORIZON_MONTHS = 6

    def __init__(self, df: pd.DataFrame):
        self.forecasts: dict[str, list] = {}
        if df.empty or "dt" not in df.columns:
            print("[Forecast] Empty dataframe — skipping")
            return

        # Try loading pre-computed from DB first
        cached = db.get_forecasts()
        if cached:
            self.forecasts = cached
            print(f"[Forecast] Loaded from DB: {list(cached.keys())}")
            return

        # Compute fresh and persist
        self._build(df)
        if self.forecasts and db.DATABASE_URL:
            db.store_forecasts(self.forecasts)

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

            mu, sigma = gdf["y"].mean(), gdf["y"].std()
            gdf["y"] = gdf["y"].clip(upper=mu + 3 * sigma)

            valid_cps = [cp for cp in self.CHANGEPOINTS if pd.Timestamp(cp) < gdf["ds"].max()]

            m = Prophet(
                changepoints=valid_cps,
                changepoint_prior_scale=0.15,
                seasonality_mode="additive",
                yearly_seasonality=True,
                weekly_seasonality=False,
                daily_seasonality=False,
                interval_width=0.80,
            )
            m.fit(gdf)

            future   = m.make_future_dataframe(periods=self.HORIZON_MONTHS, freq="MS")
            forecast = m.predict(future)

            merged = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
            merged["is_forecast"] = merged["ds"] > gdf["ds"].max()
            merged["ds"]          = merged["ds"].dt.strftime("%Y-%m")
            merged["yhat"]        = merged["yhat"].clip(lower=0).round().astype(int)
            merged["yhat_lower"]  = merged["yhat_lower"].clip(lower=0).round().astype(int)
            merged["yhat_upper"]  = merged["yhat_upper"].clip(lower=0).round().astype(int)

            self.forecasts[group] = merged.to_dict(orient="records")

        print(f"[Forecast] Built: {list(self.forecasts.keys())}")

    def get(self, group: str | None = None) -> dict:
        if group:
            return {group: self.forecasts[group]} if group in self.forecasts else {}
        return self.forecasts
