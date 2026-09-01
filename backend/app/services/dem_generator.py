import os
import logging
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.crs import CRS

from typing import Optional

logger = logging.getLogger(__name__)


def generate_geotiff(
    elevation_data: np.ndarray,
    output_path: str,
    origin_lat: float = 37.7749,
    origin_lon: float = -122.4194,
    pixel_scale: float = 0.0001,
    calibrated: bool = False,
    alpha: Optional[float] = None,
    beta: Optional[float] = None,
    rmse: Optional[float] = None,
    is_verified_location: bool = True,
) -> dict:
    """
    Generate a 32-bit single-band float GeoTIFF DEM file.
    elevation_data: 2D numpy array (height, width) with float32 elevation (relative [0, 100] or metric meters).
    """
    height, width = elevation_data.shape
    elevation_f32 = elevation_data.astype(np.float32)

    # Affine geotransform: Top-Left coordinates and pixel resolution
    transform = from_origin(origin_lon, origin_lat + (height * pixel_scale), pixel_scale, pixel_scale)
    crs = CRS.from_epsg(4326)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    elevation_type = "Orthometric Height (Meters MSL)" if calibrated else "Monocular Relative Disparity Surface"
    datum = "WGS84 / SRTM Calibrated (Meters)" if calibrated else "WGS84 Preview (0-100 Relative Units)"

    tags = {
        "CREATOR": "DepthWizard Topographical DEM Engine",
        "ELEVATION_TYPE": elevation_type,
        "DATUM": datum,
        "VERSION": "1.0.0",
        "LOCATION_VERIFIED": "true" if is_verified_location else "false (demo coordinates)",
    }
    if calibrated:
        if alpha is not None:
            tags["CALIBRATION_ALPHA"] = str(alpha)
        if beta is not None:
            tags["CALIBRATION_BETA"] = str(beta)
        if rmse is not None:
            tags["CALIBRATION_RMSE_METERS"] = str(rmse)

    with rasterio.open(
        output_path,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=1,
        dtype=rasterio.float32,
        crs=crs,
        transform=transform,
        nodata=-9999.0,
    ) as dst:
        dst.write(elevation_f32, 1)
        # Write cartographic metadata tags
        dst.update_tags(**tags)

    logger.info(f"GeoTIFF DEM created at {output_path} ({width}x{height}) [calibrated={calibrated}]")

    min_val = float(np.min(elevation_f32))
    max_val = float(np.max(elevation_f32))
    mean_val = float(np.mean(elevation_f32))
    std_val = float(np.std(elevation_f32))

    return {
        "width": width,
        "height": height,
        "min_elevation": round(min_val, 2),
        "max_elevation": round(max_val, 2),
        "mean_elevation": round(mean_val, 2),
        "std_elevation": round(std_val, 2),
        "crs": "EPSG:4326",
        "bounds": {
            "min_lon": round(origin_lon, 6),
            "max_lon": round(origin_lon + (width * pixel_scale), 6),
            "min_lat": round(origin_lat, 6),
            "max_lat": round(origin_lat + (height * pixel_scale), 6),
        },
        "elevation_mode": "calibrated" if calibrated else "preview",
        "calibrated": calibrated,
        "unit": "meters" if calibrated else "relative_units",
        "alpha": round(alpha, 4) if alpha is not None else None,
        "beta": round(beta, 2) if beta is not None else None,
        "rmse_meters": round(rmse, 2) if rmse is not None else None,
        "is_verified_location": is_verified_location,
    }

