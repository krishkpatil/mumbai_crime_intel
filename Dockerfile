FROM python:3.11-slim

# System deps: ghostscript (camelot), libGL (opencv), libglib (cv2)
RUN apt-get update && apt-get install -y --no-install-recommends \
        ghostscript \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-build Prophet/Stan model so first request isn't slow
RUN python -c "from prophet import Prophet; import pandas as pd; \
    m = Prophet(); \
    m.fit(pd.DataFrame({'ds': pd.date_range('2020-01-01', periods=24, freq='MS'), 'y': range(24)})); \
    print('Prophet Stan model pre-built.')"

# Copy source
COPY src/      ./src/
COPY data/     ./data/

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
