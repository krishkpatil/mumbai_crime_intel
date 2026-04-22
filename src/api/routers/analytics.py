"""
Analytics router — core crime data endpoints.
All business logic lives in CrimeDataStore (services/store.py).
"""

import db
import dependencies
from fastapi import APIRouter

router = APIRouter()


@router.get("/api/trends")
def get_trends(domain: str = None, group: str = None):
    return dependencies.store.get_summary(domain, group)


@router.get("/api/categories")
def get_categories(year: int = None):
    return dependencies.store.get_categories(year)


@router.get("/api/reliability")
def get_reliability():
    return dependencies.store.get_reliability()


@router.get("/api/anomalies")
def get_anomalies():
    return dependencies.store.get_anomalies()


@router.get("/api/insights")
def get_insights():
    return dependencies.store.get_insights()


@router.get("/api/lineage")
def get_lineage(date: str):
    return dependencies.store.get_lineage(date)


@router.get("/api/health")
def health():
    return {
        "status": "ok",
        "records": len(dependencies.store.df),
        "forecast_groups": len(dependencies.forecast_engine.forecasts),
        "db_connected": db.DATABASE_URL is not None,
    }
