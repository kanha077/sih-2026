FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for GDAL/Rasterio
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgdal-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download and cache MiDaS small weights during build for offline operation
RUN python -c "import urllib.request, os; os.makedirs('/app/weights', exist_ok=True); urllib.request.urlretrieve('https://github.com/isl-org/MiDaS/releases/download/v2_1/midas_v21_small-70d6b9c8.pt', '/app/weights/midas_v21_small-70d6b9c8.pt')"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
