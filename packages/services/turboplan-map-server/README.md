# GIS Fiona Server

Pure-Python FastAPI service for processing GIS data with [Fiona](https://github.com/Toblerity/Fiona). It is consumed by `@wildfires-org/turboplan-map` (via the `MAP_SERVICE_URL` env var in the main server).

This service provides endpoints for processing GIS data including Shapefiles and File Geodatabases, with automatic CRS transformation to WGS84. It comes with a health check endpoint (`/api/health`) that can be used to verify the service status.

It can be deployed as a Docker container (see `Dockerfile` and `wrangler.jsonc` for Cloudflare Containers) or to [Vercel](https://vercel.com/) serverless functions.

## Prerequisites

Before getting started, make sure you have the following installed:

- [Python Poetry](https://python-poetry.org/) - For dependency management

## Deploying to Vercel

First, make sure you have the [Vercel CLI](https://vercel.com/docs/cli) installed. Then run the following command.

    make deploy

Vercel does not work with [Python Poetry](https://python-poetry.org/) so a requirements file is needed. The `deploy` make target regenerates `requirements.txt` (via `poetry run pip freeze`) prior to deploying. The file is checked into source control because the Docker build also installs from it.

You can also deploy to prod using the `PROD` env var

    PROD=1 make deploy

## Running the app locally

The app can be started from the command line with the following command.

    make run

Once the server is running, you can access the interactive API documentation (Swagger UI) at `http://localhost:9000/docs`.

There is also a [VSCode](https://code.visualstudio.com/) launch configuration that you can use to run using the debugger.

## Running with Docker

    make docker-build
    make docker-run

This builds the image (Python 3.12 + GDAL) and runs it on port 8080 with variables from `.env`.

## Testing

Testing is configured using [Pytest](https://docs.pytest.org/) and can be run with the following command

    make test

You can run coverage and view the report in a browser by setting the `COVERAGE` env var.

    COVERAGE=1 make test

## Formatting

The project is configured to use [black](https://github.com/psf/black), [autoflake](https://github.com/PyCQA/autoflake) and [isort](https://pycqa.github.io/isort/) and can be run using the following

    make fmt

## Features

- **GIS ingestion**: Shapefiles (.shp) and File Geodatabases (.gdb)
- **Fiona & GDAL**: Reliable geospatial IO
- **CRS transform**: Auto-converts to WGS84 (EPSG:4326)
- **ZIP support**: Automatic extraction
- **CORS**: Configurable allowed origins for browser apps
- **URL ingestion**: Download ZIP from URL
- **Web-optimized output**: Rounded coords, simple geometry simplification, trimmed properties
- **API Security**: API key authentication (`X-API-Key`)

## API Endpoints

### GET `/api/health`

Returns server status and metadata. This endpoint is public and does not require authentication.

```bash
curl https://your-domain.example.com/api/health
```

Sample response:

```json
{
    "status": "OK",
    "message": "GIS Fiona Server running",
    "supportedFormats": [".shp", ".gdb"],
    "processor": "Fiona (Python 3.12)",
    "runtime": "Serverless Functions",
    "timestamp": "2024-12-03T08:30:45.123Z",
    "endpoints": {
        "health": "/api/health",
        "upload": "/api/upload"
    }
}
```

### POST `/api/upload`

Ingests a ZIP file containing GIS data by downloading it from a public URL. This endpoint requires API key authentication.

**Headers:**

- `Content-Type: application/json` (required)
- `X-API-Key: your-api-key` (required)

**Request body:**

```json
{ "url": "https://example.com/data.zip" }
```

Example:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"url": "https://example.com/your-gis-data.zip"}' \
  https://your-domain.example.com/api/upload
```

Sample response (array of layer results):

```json
[
    {
        "name": "boundaries_layer1",
        "layer": "layer1",
        "source": "boundaries",
        "type": "shapefile",
        "info": {
            "crs": { "init": "epsg:4326" },
            "driver": "ESRI Shapefile",
            "schema": {
                "geometry": "Polygon",
                "properties": { "NAME": "str" }
            },
            "bounds": [19.0, 49.0, 24.0, 55.0],
            "count": 150
        },
        "data": {
            "type": "FeatureCollection",
            "features": []
        },
        "success": true,
        "error": null
    }
]
```

**Notes:**

- Max download size: 100 MB (checked via HEAD and during streaming)
- Supported containers: `.gdb` directories and `.shp` files found inside the ZIP
- Output GeoJSON is web-optimized: coordinates rounded, light simplification for lines/polygons, and properties cleaned/shortened
- CRS is transformed to WGS84 (EPSG:4326) when possible
- Features with null/invalid geometry are skipped

### Error format

Errors return HTTP code 4xx/5xx with FastAPI's standard error shape:

```json
{ "detail": "Processing error: <message>" }
```

## Environment Configuration

Create a `.env` file with the following variables:

```env
MAP_SERVICE_API_KEY=your-secure-api-key
ALLOWED_ORIGINS=https://your-frontend.com,http://localhost:3000
```

## Usage Examples

### JavaScript

```javascript
async function processZipFromUrl(zipUrl) {
    const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": "your-api-key",
        },
        body: JSON.stringify({ url: zipUrl }),
    });
    return await res.json();
}
```

### Python

```python
import requests

resp = requests.post(
    'https://your-domain.example.com/api/upload',
    headers={'X-API-Key': 'your-api-key'},
    json={'url': 'https://example.com/your-gis-data.zip'}
)
data = resp.json()
```

### cURL

```bash
# Process GIS data
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"url": "https://example.com/your-gis-data.zip"}' \
  https://your-domain.example.com/api/upload | jq '.[0].info.count'

# Check health status
curl https://your-domain.example.com/api/health | jq '.status'
```

## Limitations

- Cold starts can add initial latency
- Very large/complex datasets may exceed time/memory limits
- File download has a 30-second timeout; serverless deployments also cap total execution time
