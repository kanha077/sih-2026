# 🏔️ DepthWizard — Complete Technical & Architectural Documentation

> **SIH 2026 Problem Statement ID:** SIH26175  
> **Organisation:** Indian Space Research Organisation (ISRO)  
> **Category:** Software — Miscellaneous / Topographical Photogrammetry & Remote Sensing  
> **Repository Root:** `sih-2026/` (Backend: `sih-2026/backend/app/`, Frontend: `sih-2026/frontend/src/`)

---

## 📖 Table of Contents
1. [Executive Summary & Purpose](#-executive-summary--purpose)
2. [High-Level System Architecture](#-high-level-system-architecture)
3. [Core Processing Pipeline & Machine Learning](#-core-processing-pipeline--machine-learning)
   - [3.1 Optical Ingestion & EXIF Geolocation](#31-optical-ingestion--exif-geolocation)
   - [3.2 Monocular AI Depth Backbone (Depth Anything V2)](#32-monocular-ai-depth-backbone-depth-anything-v2)
   - [3.3 Photogrammetric Plane Detrending & Smoothing](#33-photogrammetric-plane-detrending--smoothing)
   - [3.4 GEOSCALE Metric Elevation Calibration](#34-geoscale-metric-elevation-calibration)
   - [3.5 32-Bit Float GeoTIFF DEM Rasterizer](#35-32-bit-float-geotiff-dem-rasterizer)
   - [3.6 Hypsometric Relief Palettes & Heatmaps](#36-hypsometric-relief-palettes--heatmaps)
   - [3.7 SAT3DGEN Point-Cloud Reconstruction Branch](#37-sat3dgen-point-cloud-reconstruction-branch)
4. [Cartographic Visual Identity & Frontend 3D Workbench](#-cartographic-visual-identity--frontend-3d-workbench)
5. [REST API Specification](#-rest-api-specification)
6. [100% Offline Local Weight Caching & Deployment](#-100-offline-local-weight-caching--deployment)
7. [Automated Verification & Quality Assurance](#-automated-verification--quality-assurance)

---

## 🌍 Executive Summary & Purpose

Traditional topographical elevation capture relies on **LiDAR sensors**, **InSAR radar satellite passes**, or **multi-view stereo photogrammetry (Structure-from-Motion)**. These methods require expensive specialized hardware, overlapping multi-angle flight paths, and hours of computation.

**DepthWizard** is an end-to-end photogrammetric synthesis engine that turns a **single 2D optical photo** (satellite pass, drone snapshot, aerial survey, or landscape photo) into:
1. **A genuine 32-bit single-band float GeoTIFF DEM** (EPSG:4326 CRS with affine spatial geotransforms), directly loadable into **QGIS**, **ArcGIS**, or **GDAL**.
2. **An interactive Three.js 3D Terrain Workbench** featuring real-time solar hillshading, elevation extrusion, perspective tilt leveling, and wireframe mesh inspection.
3. **A SAT3DGEN Point-Cloud Mesh Branch** generating triangulated 3D surface geometry via Open3D Poisson reconstruction.
4. **A GEOSCALE Calibration Engine** mapping relative depth $[0, 100]$ to true orthometric height in meters MSL using reference DEM tiles (SRTM/Copernicus 30m).

---

## 🏗️ High-Level System Architecture

```
                                  ┌──────────────────────────────────────────┐
                                  │   Input Optical Photo (JPG/PNG/WEBP)     │
                                  └────────────────────┬─────────────────────┘
                                                       │
                                                       ▼
                                  ┌──────────────────────────────────────────┐
                                  │  EXIF GPS Extractor / Manual Georef      │
                                  │  (Lat, Lon, Altitude Metadata Parsing)   │
                                  └────────────────────┬─────────────────────┘
                                                       │
                                                       ▼
                                  ┌──────────────────────────────────────────┐
                                  │  Depth Anything V2 Small Backbone (AI)   │
                                  │  (100% Offline Local Cache in /weights)  │
                                  └────────────────────┬─────────────────────┘
                                                       │  relative depth tensor
                                                       ▼
                                  ┌──────────────────────────────────────────┐
                                  │  Perspective Detrending & Smoothing      │
                                  │  (Least-Squares Fit + Gaussian Filter)   │
                                  └────────────────────┬─────────────────────┘
                                                       │  normalized [0, 100] elevation
                                                       ▼
                                  ┌──────────────────────────────────────────┐
                                  │  GEOSCALE Metric Elevation Calibration   │
                                  │  (Reference DEM Fetch + Rasterio Resample│
                                  │   + RANSAC Fit → meters MSL)             │
                                  └────────────────────┬─────────────────────┘
                                                       │
         ┌─────────────────────────────────────────────┼─────────────────────────────────────────────┐
         │                                             │                                             │
         ▼                                             ▼                                             ▼
┌─────────────────────────┐               ┌─────────────────────────┐                   ┌─────────────────────────┐
│ 32-Bit Float GeoTIFF    │               │ Hypsometric Colormaps   │                   │ 3D Surface Meshes       │
│ (Rasterio, EPSG:4326    │               │ (6 Scientific Palettes: │                   │ 1. Heightmap Extrusion  │
│  Affine Geotransform)   │               │  USGS, Viridis, Turbo)  │                   │ 2. SAT3DGEN Point-Cloud │
└────────┬────────────────┘               └────────────┬────────────┘                   └────────────┬────────────┘
         │                                             │                                             │
         └─────────────────────────────────────────────┼─────────────────────────────────────────────┘
                                                       │
                                                       ▼
                                  ┌──────────────────────────────────────────┐
                                  │  Three.js Cartographic 3D Workbench UI   │
                                  │  (Solar Hillshade, Tilt Leveler, Split) │
                                  └──────────────────────────────────────────┘
```

---

## 🔬 Core Processing Pipeline & Machine Learning

### 3.1 Optical Ingestion & EXIF Geolocation
- **Module:** `backend/app/services/geoscale.py` (`extract_exif_geolocation`)
- Extracts EXIF `GPSLatitude`, `GPSLongitude`, and `GPSAltitude` tags using `Pillow` and `exifread`.
- If EXIF GPS data is present, the pipeline automatically georeferences the output rasters to those coordinates on Earth.
- If EXIF metadata is missing, the system gracefully uses user-configured manual coordinates from `UploadZone.tsx`.

### 3.2 Monocular AI Depth Backbone (Depth Anything V2)
- **Module:** `backend/app/services/depth_estimator_v2.py` (`DepthEstimatorV2`)
- Uses **Depth Anything V2 Small** (`depth-anything/Depth-Anything-V2-Small-hf` via `transformers` `AutoModelForDepthEstimation`).
- **100% Offline Local Caching:** On the first execution, model weights (~98MB) are saved to `backend/weights/depth_anything_v2_small/`. All subsequent runs load directly from disk with zero internet dependency.
- **Backend Fallback:** Configurable via `DEPTH_MODEL_BACKEND="depth_anything_v2"` (with `MiDaS_small` fallback support).

### 3.3 Photogrammetric Plane Detrending & Smoothing
- **Perspective Tilt Detrending:** Camera forward-tilt angle creates artificial "perspective elevation ramps". DepthWizard fits a 2D plane to the depth map using linear least-squares ($\mathbf{A} \mathbf{c} = \mathbf{z}$) and subtracts the camera tilt slope:
  $$\text{Depth}_{\text{detrended}} = \text{Depth} - \tau \cdot (\text{Plane} - \bar{\text{Plane}})$$
- **Gaussian Spatial Filtering:** Applies `scipy.ndimage.gaussian_filter` ($\sigma = 1.2$) to eliminate high-frequency neural quantization spikes.
- **Percentile Normalization:** Rescales elevation values between 0.5% and 99.5% percentiles to a normalized $[0.0, 100.0]$ range.

### 3.4 GEOSCALE Metric Elevation Calibration
- **Module:** `backend/app/services/geoscale.py` (`calibrate_to_metric`)
- **Reference DEM Fetching:** Downloads a 30m reference elevation tile (SRTMGL1 / Copernicus) covering the scene's bounding box using OpenTopography API. Enforces a strict 10s timeout and caches tiles locally under `backend/app/cache/reference_dem/`.
- **Rasterio Resampling & Alignment:** Reprojects and resamples reference DEM tiles using `rasterio` bilinear interpolation (`Resampling.bilinear`) to match the exact pixel grid dimensions $[H, W]$ of the predicted depth map.
- **RANSAC Robust Linear Regression:** Fits real-world orthometric height in meters:
  $$H_{\text{metric}} = \alpha \cdot Z_{\text{relative}} + \beta$$
- **Accuracy Telemetry:** Calculates Root Mean Square Error ($\text{RMSE}$) and Mean Absolute Error ($\text{MAE}$) on a 20% held-out test split.
- **Strict Preview Fallback:** If reference DEM data is unavailable or offline, GEOSCALE immediately falls back to relative Preview Mode ($0\text{--}100$) — **never fabricating fake metric numbers**.

### 3.5 32-Bit Float GeoTIFF DEM Rasterizer
- **Module:** `backend/app/services/dem_generator.py` (`generate_geotiff`)
- Generates standard 32-bit single-band float GeoTIFF rasters using `rasterio`.
- Tags GeoTIFF with `EPSG:4326` CRS and affine geotransform:
  $$\text{Transform} = \text{from\_origin}(\text{Lon}_{\text{min}}, \text{Lat}_{\text{max}}, \text{Scale}_{\text{pixel}}, \text{Scale}_{\text{pixel}})$$
- Writes cartographic tags (`ELEVATION_TYPE`, `DATUM`, `CREATOR`).

### 3.6 Hypsometric Relief Palettes & Heatmaps
- **Module:** `backend/app/services/colormap_service.py` (`generate_colorized_images`)
- Renders high-resolution elevation rasters across 6 scientific palettes:
  1. **Topographic Terrain (`terrain`)**: USGS green-to-brown-to-snow hypsometric tint.
  2. **Viridis Scientific (`viridis`)**: Perceptually uniform color scale.
  3. **Plasma Thermal (`plasma`)**: High-contrast thermal gradient.
  4. **Monochrome Disparity (`grayscale`)**: 8-bit grayscale intensity.
  5. **Magma Geological (`magma`)**: Deep purple to yellow spectrum.
  6. **Turbo High-Dynamic (`turbo`)**: Rainbow geological spectrum.

```
  ELEVATION HEATMAP PALETTES VISUALIZATION
  ========================================
  [LOW / VALLEYS] ───────────────────────────────────────────> [HIGH / PEAKS]
  
  USGS TERRAIN : [ Dark Green -> Olive -> Brown -> White ]
  VIRIDIS      : [ Deep Purple -> Teal -> Yellow ]
  PLASMA       : [ Navy Blue -> Magenta -> Bright Yellow ]
  TURBO        : [ Blue -> Cyan -> Green -> Yellow -> Red ]
```

### 3.7 SAT3DGEN Point-Cloud Reconstruction Branch
- **Module:** `backend/app/services/sat3dgen.py` (`generate_point_cloud_mesh`)
- Downsamples elevation grid to a maximum $150 \times 150$ resolution to ensure fast 60 FPS rendering.
- Back-projects pixels into a 3D point cloud using pinhole camera matrix.
- Uses **Open3D Poisson Surface Reconstruction** (`create_from_point_cloud_poisson`) to build a triangulated 3D surface mesh.
- Wrapped in `try/except` inside `main.py` so reconstruction failures gracefully omit `sat3dgen_mesh_url` without crashing the main request pipeline.

---

## 🎨 Cartographic Visual Identity & Frontend 3D Workbench

The UI design is inspired by **precision surveying instruments and cartographic field plates**:

```
+---------------------------------------------------------------------------------------+
|  DEPTHWIZARD  [DEM ENGINE v1.0]        [DATUM: WGS84-PREVIEW]     [Schematic] [Scale] [☀/🌙] |
+---------------------------------------------------------------------------------------+
|  SURVEY PLATE CATALOG // 1-Click Verification                                         |
|  [PLATE #01 Alpine]     [PLATE #02 Coastal]     [PLATE #03 Urban]     [PLATE #04 Panorama] |
+---------------------------------------------------------------------------------------+
|  OPTICAL IMAGERY INGESTION // TARGETING RETICLE                                       |
|  [+] --------------------------------------------------------------------------- [+] |
|  |             Drop target photograph here, or browse local storage              |   |
|  [+] --------------------------------------------------------------------------- [+] |
|  > GEODETIC ANCHOR & SPATIAL METADATA: [Origin Lat]  [Origin Lon]  [Pixel Scale]     |
+---------------------------------------------------------------------------------------+
|  CARTOGRAPHIC WORKBENCH                                                               |
|  +--------------------------------------------------+  +----------------------------+ |
|  | [3D Terrain] [Split Optical] [Ortho] [Single]    |  | CADASTRAL TELEMETRY        | |
|  |                                                  |  | Elevation: 0 - 100 (m MSL) | |
|  |               THREE.JS 3D VIEWPORT               |  | Mean/Spread: 42.1 (±18.4)  | |
|  |             Topographical Mesh Canvas            |  | Raster: 1024 x 1024 px     | |
|  |                                                  |  | Latency: 1235 ms • EPSG:4326| |
|  | [Sun Azimuth: 45°]  [Tilt Leveler: 0%] [Wireframe]|  +----------------------------+ |
|  +--------------------------------------------------+  | HYPSOMETRIC PALETTES       | |
|                                                        | [Terrain] [Viridis] [Turbo]| |
|                                                        | EXPORT ARTIFACTS           | |
|                                                        | [.TIF] [.OBJ] [.PNG] [.JSON] |
+---------------------------------------------------------------------------------------+
```

### Three.js 3D Viewport Controls (`Terrain3DViewer.tsx`)
- **Solar Azimuth Dial ($0^\circ \to 360^\circ$):** Simulates real directional sun lighting across mountain ridges.
- **Elevation Extrusion Multiplier ($0.2\times \to 3.5\times$):** Adjusts vertical terrain exaggeration.
- **Perspective Tilt Leveler ($0\% \to 120\%$):** Real-time vertex leveling slider to adjust for camera perspective angles.
- **Wireframe & Ground Grid Overlay:** Inspect underlying polygon tessellation.
- **Texture Mode Swapper:** Toggle between `Photo Overlay`, `Hypsometric Elevation Relief`, and `Disparity Map`.

---

## 📡 REST API Specification

### 1. Health Check
`GET /api/health`
```json
{
  "status": "healthy",
  "service": "DepthWizard DEM Engine",
  "version": "1.0.0",
  "cuda_available": true
}
```

### 2. Survey Plate Catalog
`GET /api/samples`
Returns default preset plates (Alpine Ridge, Coastal Valley, Urban Grid, Panoramic Horizon).

### 3. Ingest Optical Image
`POST /api/upload` (Multipart Form)
- `file`: Optical image (JPG, PNG, WEBP, TIFF — Max 10MB)
- `origin_lat`: Manual latitude fallback (Default `37.7749`)
- `origin_lon`: Manual longitude fallback (Default `-122.4194`)
- `pixel_scale`: Spatial resolution (Default `0.0001`)

### 4. Synthesize Sample Plate
`POST /api/process-sample/{sample_id}`
Triggers background processing for preset survey plates (`alpine-ridge`, `coastal-valley`, `urban-grid`, `landscape-panorama`).

### 5. Check Synthesis Status
`GET /api/status/{job_id}`
Returns progress percentage ($0\text{--}100\%$) and current pipeline stage.

### 6. Retrieve Synthesis Result
`GET /api/result/{job_id}`
```json
{
  "job_id": "4710fc83-efc6-4708-b9cc-5e3788782a1e",
  "original_url": "/uploads/4710fc83.../original.png",
  "geotiff_url": "/outputs/4710fc83.../elevation_dem.tif",
  "depth_png_url": "/outputs/4710fc83.../depth_raw.png",
  "colored_png_urls": {
    "terrain": "/outputs/4710fc83.../elevation_terrain.png",
    "viridis": "/outputs/4710fc83.../elevation_viridis.png",
    "plasma": "/outputs/4710fc83.../elevation_plasma.png",
    "grayscale": "/outputs/4710fc83.../elevation_grayscale.png",
    "magma": "/outputs/4710fc83.../elevation_magma.png",
    "turbo": "/outputs/4710fc83.../elevation_turbo.png"
  },
  "mesh_obj_url": "/outputs/4710fc83.../terrain_mesh.obj",
  "sat3dgen_mesh_url": "/outputs/4710fc83.../sat3dgen_mesh.obj",
  "stats": {
    "width": 640,
    "height": 640,
    "min_elevation": 0.0,
    "max_elevation": 100.0,
    "mean_elevation": 42.15,
    "std_elevation": 18.42,
    "crs": "EPSG:4326",
    "processing_time_ms": 1235
  },
  "calibration_info": {
    "mode": "calibrated",
    "scale": 14.25,
    "offset": 120.5,
    "mae_meters": 4.12,
    "rmse_meters": 5.84,
    "units": "meters MSL"
  }
}
```

### 7. Download Cartographic Artifact
`GET /api/download/{job_id}/{file_type}`
- `file_type`: `geotiff` | `mesh` | `depth` | `terrain` | `viridis` | `plasma` | `grayscale` | `magma` | `turbo`

---

## 📦 100% Offline Local Weight Caching & Deployment

### 1-Click Startup (Windows)
Run from project root:
```powershell
.\run_dev.ps1
```
*Spawns separate FastAPI Backend (`http://127.0.0.1:8000`) and Vite Frontend (`http://localhost:3000`) consoles.*

### Docker Deployment
```bash
docker-compose up --build
```

### Offline Caching Architecture
```
backend/
├── weights/
│   ├── midas_v21_small-70d6b9c8.pt      # MiDaS offline weight file
│   └── depth_anything_v2_small/          # Depth Anything V2 HuggingFace local cache
│       ├── config.json
│       ├── model.safetensors
│       └── preprocessor_config.json
└── app/cache/reference_dem/              # Local reference DEM tiles (.tif)
```

---

## 🧪 Automated Verification & Quality Assurance

### Pytest Backend Test Suite (`pytest tests/test_pipeline.py -v`)
```
tests/test_pipeline.py::test_health_endpoint PASSED                      [ 14%]
tests/test_pipeline.py::test_samples_endpoint PASSED                     [ 28%]
tests/test_pipeline.py::test_upload_invalid_file_type PASSED             [ 42%]
tests/test_pipeline.py::test_full_pipeline_process_sample PASSED         [ 57%]
tests/test_pipeline.py::test_baseline_flags_off PASSED                   [ 71%]
tests/test_pipeline.py::test_sat3dgen_mesh_generation PASSED             [ 85%]
tests/test_pipeline.py::test_geoscale_calibration_fallback PASSED        [100%]

======================= 7 passed in 21.42s =======================
```

### Frontend Production Build (`npm run build`)
```
✓ 1489 modules transformed.
dist/index.html                   1.19 kB │ gzip:   0.64 kB
dist/assets/index-XJqS4kkU.css   26.98 kB │ gzip:   5.79 kB
dist/assets/index-DqGBfLPO.js   788.67 kB │ gzip: 210.53 kB
✓ built in 5.36s with 0 errors
```
