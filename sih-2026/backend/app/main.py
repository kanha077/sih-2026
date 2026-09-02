import os
import uuid
import time
import shutil
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Dict, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image
import numpy as np

from app.services.depth_estimator import DepthEstimator
from app.services.dem_generator import generate_geotiff
from app.services.colormap_service import generate_colorized_images, COLORMAP_PALETTES
from app.services.mesh_generator import generate_obj_mesh
from app.services.cleanup_service import purge_old_artifacts
from app.services.geoscale import extract_exif_geolocation, calibrate_to_metric
from app.services.sat3dgen import generate_point_cloud_mesh

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("depthwizard")

# Paths Configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
SAMPLES_DIR = os.path.join(BASE_DIR, "app", "samples")

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(OUTPUTS_DIR, exist_ok=True)
os.makedirs(SAMPLES_DIR, exist_ok=True)

# Thread pool for CPU/GPU bounded depth estimation and raster generation
executor = ThreadPoolExecutor(max_workers=2)

# In-memory job state tracker
jobs_db: Dict[str, dict] = {}


# Lifecycle Context Manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing DepthWizard AI & GIS pipeline...")
    # Pre-warm depth estimator on startup
    try:
        DepthEstimator()
        logger.info("DepthEstimator warm-up complete.")
    except Exception as e:
        logger.warning(f"DepthEstimator pre-warm encountered: {e}")

    # Generate preset sample images if not present
    _ensure_sample_images()

    # Schedule background cleanup task
    asyncio.create_task(_background_cleanup_loop())

    yield
    logger.info("Shutting down DepthWizard pipeline.")
    executor.shutdown(wait=False)


async def _background_cleanup_loop():
    while True:
        try:
            await asyncio.sleep(1800)  # Run every 30 minutes
            purge_old_artifacts(UPLOADS_DIR, OUTPUTS_DIR)
        except Exception as e:
            logger.warning(f"Error in background cleanup: {e}")


app = FastAPI(
    title="DepthWizard API",
    description="Monocular 2D Photo to Topographic Elevation GeoTIFF & 3D Interactive Terrain Engine",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file mounts
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")
app.mount("/samples", StaticFiles(directory=SAMPLES_DIR), name="samples")


def _ensure_sample_images():
    """Create sample landscape rasters for instant 1-click verification."""
    samples = [
        ("sample_satellite_mountain.png", (640, 640), "satellite"),
        ("sample_coastal_valley.png", (640, 480), "coastal"),
        ("sample_urban_grid.png", (640, 640), "urban"),
        ("sample_landscape_panorama.jpg", (2048, 1024), "panorama"),
    ]

    for filename, (w, h), mode in samples:
        filepath = os.path.join(SAMPLES_DIR, filename)
        if not os.path.exists(filepath):
            if mode == "satellite":
                x = np.linspace(-3, 3, w)
                y = np.linspace(-3, 3, h)
                xx, yy = np.meshgrid(x, y)
                r = np.sqrt(xx**2 + yy**2)
                z = np.exp(-r**2) * 255
                noise = np.random.normal(0, 15, (h, w))
                arr = np.clip(z + noise, 0, 255).astype(np.uint8)
                img = Image.fromarray(arr, mode="L").convert("RGB")
            elif mode == "coastal":
                x = np.linspace(0, 1, w)
                y = np.linspace(0, 1, h)
                xx, yy = np.meshgrid(x, y)
                gradient = (xx * 0.7 + yy * 0.3) * 255
                noise = np.random.normal(0, 10, (h, w))
                arr = np.clip(gradient + noise, 0, 255).astype(np.uint8)
                img = Image.fromarray(arr, mode="L").convert("RGB")
            elif mode == "urban":
                arr = np.zeros((h, w, 3), dtype=np.uint8)
                for r in range(0, h, 64):
                    for c in range(0, w, 64):
                        elev = int(np.random.uniform(50, 220))
                        arr[r:r+50, c:c+50] = [elev, elev + 10, elev - 10]
                img = Image.fromarray(arr)
            else:
                x = np.linspace(-5, 5, w)
                y = np.linspace(-2, 2, h)
                xx, yy = np.meshgrid(x, y)
                z = (np.sin(xx) * np.cos(yy) + 1.0) * 120
                arr = np.clip(z, 0, 255).astype(np.uint8)
                img = Image.fromarray(arr, mode="L").convert("RGB")

            img.save(filepath)
            logger.info(f"Generated default sample plate at {filepath}")


def _process_pipeline(
    job_id: str,
    image_path: str,
    origin_lat: float,
    origin_lon: float,
    pixel_scale: float,
    precomputed_mesh_url: Optional[str] = None,
):
    try:
        t0 = time.time()
        jobs_db[job_id]["status"] = "processing"
        jobs_db[job_id]["progress"] = 15
        jobs_db[job_id]["message"] = "Reading optical image tensor..."

        pil_image = Image.open(image_path)
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")

        # Dynamic feature flags
        depth_backend = os.getenv("DEPTH_MODEL_BACKEND", "depth_anything_v2")
        enable_sat3dgen = os.getenv("ENABLE_SAT3DGEN", "true").lower() == "true"
        enable_calibration = os.getenv("ENABLE_CALIBRATION", "true").lower() == "true"

        # Extract EXIF GPS coordinates if present
        exif_lat, exif_lon = extract_exif_geolocation(pil_image)
        final_lat = exif_lat if exif_lat is not None else origin_lat
        final_lon = exif_lon if exif_lon is not None else origin_lon

        # 1. Depth Estimation
        jobs_db[job_id]["progress"] = 35
        jobs_db[job_id]["message"] = f"Estimating monocular depth via {depth_backend}..."
        estimator = DepthEstimator()
        elevation_data = estimator.estimate_depth(pil_image)

        # 2. GEOSCALE Metric Calibration (Optional with strict Preview fallback)
        calibrated_elevation = None
        calibration_info = {"mode": "preview", "units": "0-100 relative units"}
        is_calibrated = False

        if enable_calibration:
            jobs_db[job_id]["progress"] = 55
            jobs_db[job_id]["message"] = "Running GEOSCALE metric elevation calibration..."
            try:
                metric_arr, cal_metrics = calibrate_to_metric(elevation_data, final_lat, final_lon)
                if metric_arr is not None and cal_metrics is not None:
                    calibrated_elevation = metric_arr
                    calibration_info = cal_metrics
                    is_calibrated = True
            except Exception as e:
                logger.warning(f"GEOSCALE calibration error ({e}). Falling back strictly to Preview Mode.")

        # Active elevation raster (calibrated meters or relative 0-100)
        active_elevation = calibrated_elevation if is_calibrated and calibrated_elevation is not None else elevation_data

        if is_calibrated:
            logger.info(
                f"Rasterizing GeoTIFF & DEM stats with calibrated metric elevation array: "
                f"range [{float(np.min(active_elevation)):.2f}, {float(np.max(active_elevation)):.2f}] meters MSL"
            )

        # 3. GeoTIFF Generation (Using true EXIF or manual origin coordinates)
        jobs_db[job_id]["progress"] = 65
        jobs_db[job_id]["message"] = "Rasterizing 32-bit single-band GeoTIFF DEM..."
        job_output_dir = os.path.join(OUTPUTS_DIR, job_id)
        os.makedirs(job_output_dir, exist_ok=True)

        geotiff_path = os.path.join(job_output_dir, "elevation_dem.tif")
        dem_stats = generate_geotiff(
            active_elevation,
            geotiff_path,
            origin_lat=final_lat,
            origin_lon=final_lon,
            pixel_scale=pixel_scale,
            is_calibrated=is_calibrated,
            elevation_unit="meters" if is_calibrated else "relative",
        )

        # 4. Colormaps & Relief PNGs
        jobs_db[job_id]["progress"] = 78
        jobs_db[job_id]["message"] = "Rendering hypsometric elevation palettes (Depth Anything V2)..."
        logger.info(
            f"[JOB {job_id}] Synthesizing {len(COLORMAP_PALETTES)} hypsometric heatmaps from Depth Anything V2 elevation map "
            f"(range: [{float(np.min(active_elevation)):.2f}, {float(np.max(active_elevation)):.2f}], calibrated={is_calibrated})"
        )
        colored_files = generate_colorized_images(active_elevation, job_output_dir)
        logger.info(f"[JOB {job_id}] Generated hypsometric heatmaps: {list(colored_files.keys())}")

        # 5. Primary 3D Heightmap Mesh
        jobs_db[job_id]["progress"] = 88
        jobs_db[job_id]["message"] = "Generating primary 3D terrain surface mesh..."
        mesh_path = os.path.join(job_output_dir, "terrain_mesh.obj")
        generate_obj_mesh(active_elevation, mesh_path)

        # 6. SAT3DGEN Point-Cloud Reconstruction Branch (Isolated failure handling)
        sat3dgen_mesh_url = None
        if enable_sat3dgen:
            jobs_db[job_id]["progress"] = 94
            jobs_db[job_id]["message"] = "Running SAT3DGEN point-cloud 3D reconstruction..."
            try:
                sat3dgen_path = os.path.join(job_output_dir, "sat3dgen_mesh.obj")
                generate_point_cloud_mesh(active_elevation, pil_image, sat3dgen_path)
                sat3dgen_mesh_url = f"/outputs/{job_id}/sat3dgen_mesh.obj"
            except Exception as e:
                logger.warning(f"SAT3DGEN mesh generation error: {e}. Omitting sat3dgen_mesh_url.")

        elapsed_ms = int((time.time() - t0) * 1000)
        dem_stats["processing_time_ms"] = elapsed_ms

        # Build absolute/relative URL mappings
        colored_urls = {
            k: f"/outputs/{job_id}/{v}"
            for k, v in colored_files.items()
            if k != "raw_depth"
        }

        jobs_db[job_id].update({
            "status": "completed",
            "progress": 100,
            "message": "Topographic DEM synthesized successfully.",
            "result": {
                "job_id": job_id,
                "original_url": f"/uploads/{job_id}/original.png",
                "geotiff_url": f"/outputs/{job_id}/elevation_dem.tif",
                "depth_png_url": f"/outputs/{job_id}/depth_raw.png",
                "colored_png_urls": colored_urls,
                "mesh_obj_url": f"/outputs/{job_id}/terrain_mesh.obj",
                "sat3dgen_mesh_url": sat3dgen_mesh_url,
                "precomputed_mesh_url": precomputed_mesh_url,
                "stats": dem_stats,
                "calibration_info": calibration_info,
                "available_colormaps": list(colored_urls.keys()),
            },
        })
        logger.info(f"Job {job_id} successfully completed in {elapsed_ms}ms (Calibrated: {is_calibrated})")
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}", exc_info=True)
        jobs_db[job_id].update({
            "status": "error",
            "progress": 0,
            "message": "Processing error",
            "error": str(e),
        })


# API Endpoints
@app.get("/")
def root():
    return {
        "service": "DepthWizard DEM Engine API",
        "version": "1.0.0",
        "status": "online",
        "documentation": "/docs",
        "frontend": "http://localhost:3000",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "DepthWizard DEM Engine",
        "version": "1.0.0",
        "cuda_available": DepthEstimator()._device.type == "cuda" if DepthEstimator._instance else False,
    }


@app.get("/api/samples")
def get_sample_plates():
    _ensure_sample_images()
    return [
        {
            "id": "urban-highway",
            "name": "Urban Highway Interchange",
            "category": "Flagship 3D Demo",
            "description": "Dense urban corridor (I-278) with a high-fidelity 3D survey mesh: terrain, extruded buildings, roads & vegetation.",
            "thumbnail_url": "/samples/sample_urban_highway.png",
            "filename": "sample_urban_highway.png",
            "default_lat": 40.7150,
            "default_lon": -73.9450,
            "precomputed_mesh_url": "/samples/urban_highway_mesh.glb",
        },
        {
            "id": "alpine-ridge",
            "name": "Alpine Mountain Ridge",
            "category": "Satellite High-Relief",
            "description": "Steep topographic peaks with sharp ridges and high variance.",
            "thumbnail_url": "/samples/sample_satellite_mountain.png",
            "filename": "sample_satellite_mountain.png",
            "default_lat": 46.55,
            "default_lon": 8.56,
            "precomputed_mesh_url": None,
        },
        {
            "id": "coastal-valley",
            "name": "Coastal Basin & Estuary",
            "category": "Geomorphology",
            "description": "Gradual slope draining from high inland plateau to sea level.",
            "thumbnail_url": "/samples/sample_coastal_valley.png",
            "filename": "sample_coastal_valley.png",
            "default_lat": 36.60,
            "default_lon": -121.90,
            "precomputed_mesh_url": None,
        },
        {
            "id": "urban-grid",
            "name": "Metropolitan Survey Grid",
            "category": "Urban Survey",
            "description": "Orthogonal city blocks with sharp elevation changes.",
            "thumbnail_url": "/samples/sample_urban_grid.png",
            "filename": "sample_urban_grid.png",
            "default_lat": 37.77,
            "default_lon": -122.42,
            "precomputed_mesh_url": None,
        },
        {
            "id": "landscape-panorama",
            "name": "Panoramic Mountain Horizon",
            "category": "2:1 Widefield",
            "description": "Widefield 2048x1024 landscape panorama with multi-tier mountain ranges.",
            "thumbnail_url": "/samples/sample_landscape_panorama.jpg",
            "filename": "sample_landscape_panorama.jpg",
            "default_lat": 47.57,
            "default_lon": -122.31,
            "precomputed_mesh_url": None,
        },
    ]


@app.post("/api/upload")
async def upload_image(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    origin_lat: Optional[float] = Form(37.7749),
    origin_lon: Optional[float] = Form(-122.4194),
    pixel_scale: Optional[float] = Form(0.0001),
):
    # Server-side validation
    max_bytes = 10 * 1024 * 1024  # 10MB
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum allowable limit of 10MB.",
        )

    # Magic byte and format check using Pillow
    try:
        from io import BytesIO
        img = Image.open(BytesIO(content))
        img.verify()
        # Re-open after verify() closes it
        img = Image.open(BytesIO(content))
        if img.format not in ["JPEG", "PNG", "WEBP", "TIFF"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image format: {img.format}. Expected JPG, PNG, WEBP, or TIFF.",
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Uploaded file is not a valid optical raster image: {e}",
        )

    job_id = str(uuid.uuid4())
    job_upload_dir = os.path.join(UPLOADS_DIR, job_id)
    os.makedirs(job_upload_dir, exist_ok=True)

    original_saved_path = os.path.join(job_upload_dir, "original.png")
    img.convert("RGB").save(original_saved_path, format="PNG")

    jobs_db[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress": 5,
        "message": "Optical raster queued for disparity pipeline.",
        "created_at": time.time(),
    }

    # Execute in executor thread pool
    executor.submit(
        _process_pipeline,
        job_id,
        original_saved_path,
        origin_lat or 37.7749,
        origin_lon or -122.4194,
        pixel_scale or 0.0001,
    )

    return {"job_id": job_id, "status": "queued"}


@app.post("/api/process-sample/{sample_id}")
async def process_sample_plate(sample_id: str):
    sample_map = {
        "urban-highway": ("sample_urban_highway.png", 40.7150, -73.9450, "/samples/urban_highway_mesh.glb"),
        "alpine-ridge": ("sample_satellite_mountain.png", 46.55, 8.56, None),
        "coastal-valley": ("sample_coastal_valley.png", 36.60, -121.90, None),
        "urban-grid": ("sample_urban_grid.png", 37.77, -122.42, None),
        "landscape-panorama": ("sample_landscape_panorama.jpg", 47.57, -122.31, None),
    }

    if sample_id not in sample_map:
        raise HTTPException(status_code=404, detail="Sample plate not found.")

    filename, lat, lon, mesh_url = sample_map[sample_id]
    sample_file_path = os.path.join(SAMPLES_DIR, filename)

    if not os.path.exists(sample_file_path):
        _ensure_sample_images()

    job_id = str(uuid.uuid4())
    job_upload_dir = os.path.join(UPLOADS_DIR, job_id)
    os.makedirs(job_upload_dir, exist_ok=True)

    original_saved_path = os.path.join(job_upload_dir, "original.png")
    shutil.copyfile(sample_file_path, original_saved_path)

    jobs_db[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress": 5,
        "message": f"Processing sample survey plate: {sample_id}...",
        "created_at": time.time(),
    }

    executor.submit(
        _process_pipeline,
        job_id,
        original_saved_path,
        lat,
        lon,
        0.0001,
        mesh_url,
    )

    return {"job_id": job_id, "status": "queued"}


@app.get("/api/status/{job_id}")
def get_job_status(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found.")
    return jobs_db[job_id]


@app.get("/api/result/{job_id}")
def get_job_result(job_id: str):
    if job_id not in jobs_db:
        raise HTTPException(status_code=404, detail="Job not found.")

    job = jobs_db[job_id]
    if job["status"] == "error":
        raise HTTPException(status_code=500, detail=job.get("error", "Job failed."))
    if job["status"] != "completed":
        raise HTTPException(status_code=202, detail="Job still processing.")

    return job["result"]


@app.get("/api/download/{job_id}/{file_type}")
def download_artifact(job_id: str, file_type: str):
    if job_id not in jobs_db or jobs_db[job_id]["status"] != "completed":
        raise HTTPException(status_code=404, detail="Job not found or not completed.")

    output_dir = os.path.join(OUTPUTS_DIR, job_id)

    if file_type == "geotiff":
        target = os.path.join(output_dir, "elevation_dem.tif")
        media_type = "image/tiff"
        filename = f"depthwizard_{job_id}_elevation_dem.tif"
    elif file_type == "mesh":
        target = os.path.join(output_dir, "terrain_mesh.obj")
        media_type = "model/obj"
        filename = f"depthwizard_{job_id}_terrain_mesh.obj"
    elif file_type == "depth":
        target = os.path.join(output_dir, "depth_raw.png")
        media_type = "image/png"
        filename = f"depthwizard_{job_id}_depth_raw.png"
    elif file_type in ["terrain", "viridis", "plasma", "grayscale", "magma", "turbo"]:
        target = os.path.join(output_dir, f"elevation_{file_type}.png")
        media_type = "image/png"
        filename = f"depthwizard_{job_id}_elevation_{file_type}.png"
    else:
        raise HTTPException(status_code=400, detail="Invalid artifact file type.")

    if not os.path.exists(target):
        raise HTTPException(status_code=404, detail="Requested artifact file does not exist.")

    return FileResponse(target, media_type=media_type, filename=filename)
