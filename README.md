# Mumbai Crime Intelligence Platform (MCIP)

A production-grade, multi-domain crime intelligence platform for the Mumbai Police dataset. This platform provides 100% data fidelity ingestion from official PDF sources and serves deep analytical insights via a high-performance API and interactive dashboard.

## 🏛️ Architecture Overview

- **`src/ingestion/`**: Hardened pipeline for PDF extraction, classification, and forensic deduplication.
  - `scraper.py`: Extracts PDFs from official portals.
  - `processor.py`: Orchestrates extraction, date normalization, and domain classification.
  - `parser_modern.py` & `parser_legacy.py`: Domain-aware table extractors for varying PDF schemas.
- **`src/api/`**: Industry-grade FastAPI backend with domain-based filtering.
- **`dashboard/`**: Next.js 14 frontend with premium visualization and anomaly detection.
- **`data/`**: Structured data lake for raw PDFs and processed analytical JSON.

## 🚀 Getting Started

### 1. Environment Setup
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Ingestion Pipeline
To process the latest criminal record disclosures:
```bash
export PYTHONPATH=$PYTHONPATH:$(pwd)/src/ingestion
python3 src/ingestion/processor.py
```

### 3. API Serving
Launch the intelligence layer:
```bash
export PYTHONPATH=$PYTHONPATH:$(pwd)/src/api
uvicorn main:app --reload --port 8000
```

### 4. Interactive Dashboard
```bash
cd dashboard
npm install
npm run dev
```

## 🧠 Intelligence Features

- **Semantic Trust**: Automated scoring of extraction quality and data lineage.
- **Anomaly Detection**: Identifies statistical outliers in crime reporting.
- **Domain-Awareness**: Specialized handling for Cyber, Narcotics, Economic, and General crime.
- **Forensic Deduplication**: Fingerprinting technology to prevent duplicate entries from overlapping reports.

---
© 2026 Mumbai Crime Analysis Group • Data-First Situational Awareness.
