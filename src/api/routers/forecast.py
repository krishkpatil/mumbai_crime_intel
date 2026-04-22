"""
Forecast router — Prophet time-series forecast endpoints.
"""

import dependencies
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/api/forecast")
def get_forecast(group: str = None):
    result = dependencies.forecast_engine.get(group)
    if group and not result:
        raise HTTPException(
            status_code=404,
            detail=f"No forecast for '{group}'. Available: {list(dependencies.forecast_engine.forecasts.keys())}",
        )
    return result


@router.get("/api/forecast/groups")
def get_forecast_groups():
    return {"groups": list(dependencies.forecast_engine.forecasts.keys())}
