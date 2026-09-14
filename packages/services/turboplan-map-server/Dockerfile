FROM python:3.12-slim-bookworm AS builder

WORKDIR /build

# Build deps for Fiona/GDAL compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gdal-bin \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim-bookworm

WORKDIR /app

# Runtime GDAL libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgdal32 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY app/ app/

RUN useradd --create-home --shell /bin/bash appuser && \
    mkdir -p /tmp/gis-uploads && chown appuser:appuser /tmp/gis-uploads
USER appuser

ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
