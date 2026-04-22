"""
Export router — dataset downloads, quality report, and PDF serving.
"""

import csv
import io
import json
from pathlib import Path

import dependencies
from config import PROJECT_ROOT
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse

router = APIRouter()


@router.get("/api/export/json")
def export_json():
    path = PROJECT_ROOT / "data/processed/crime.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="crime.json not found")
    return FileResponse(
        path=str(path),
        media_type="application/json",
        filename="mumbai_crime_data.json",
    )


@router.get("/api/export/csv")
def export_csv():
    df = dependencies.store.df[dependencies.store.df["is_total"] == False].copy()
    df = df[["report_date", "crime_type", "canonical_type", "domain", "group",
             "registered", "detected", "registered_ytd", "detected_ytd",
             "filename", "extraction", "semantic"]]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(df.columns.tolist())
    for row in df.itertuples(index=False):
        writer.writerow(row)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mumbai_crime_data.csv"},
    )


@router.get("/api/export/quality")
def export_quality():
    path = PROJECT_ROOT / "data/processed/quality.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="quality.json not found")

    with open(path) as f:
        data = json.load(f)

    output = io.StringIO()
    writer = csv.writer(output)
    if data:
        writer.writerow(data[0].keys())
        for row in data:
            writer.writerow(row.values())

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=mumbai_crime_quality.csv"},
    )


@router.get("/api/quality")
def get_quality():
    path = PROJECT_ROOT / "data/processed/quality.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="quality.json not found")
    with open(path) as f:
        return json.load(f)


@router.get("/api/pdfs/{filename}")
def get_pdf(filename: str):
    pdf_path = PROJECT_ROOT / "data" / "raw" / "pdfs" / Path(filename).name
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF not available in this deployment")
    return FileResponse(str(pdf_path), media_type="application/pdf", filename=filename)


@router.head("/api/pdfs/{filename}")
def head_pdf(filename: str):
    pdf_path = PROJECT_ROOT / "data" / "raw" / "pdfs" / Path(filename).name
    if not pdf_path.exists():
        raise HTTPException(status_code=404)
    return Response(status_code=200)
