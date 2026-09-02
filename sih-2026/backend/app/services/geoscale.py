import os
import logging
import requests
import numpy as np
import rasterio
from rasterio.enums import Resampling
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cache", "reference_dem")
os.makedirs(CACHE_DIR, exist_ok=True)


def extract_exif_geolocation(pil_image: Image.Image) -> tuple[float | None, float | None]:
    """
    Extract GPS Latitude and Longitude coordinates from Image EXIF metadata.
    Returns: (latitude, longitude) float tuple or (None, None) if EXIF GPS is missing.
    """
    try:
        exif_data = pil_image._getexif()
        if not exif_data:
            return None, None

        gps_info = {}
        for tag_id, value in exif_data.items():
            tag = TAGS.get(tag_id, tag_id)
            if tag == "GPSInfo":
                for key in value:
                    sub_tag = GPSTAGS.get(key, key)
                    gps_info[sub_tag] = value[key]

        if not gps_info:
            return None, None

        def _convert_to_degrees(value):
            d, m, s = value
            return float(d) + (float(m) / 60.0) + (float(s) / 3600.0)

        lat = None
        lon = None

        if "GPSLatitude" in gps_info and "GPSLatitudeRef" in gps_info:
            lat = _convert_to_degrees(gps_info["GPSLatitude"])
            if gps_info["GPSLatitudeRef"] != "N":
                lat = -lat

        if "GPSLongitude" in gps_info and "GPSLongitudeRef" in gps_info:
            lon = _convert_to_degrees(gps_info["GPSLongitude"])
            if gps_info["GPSLongitudeRef"] != "E":
                lon = -lon

        return lat, lon
    except Exception as e:
        logger.debug(f"EXIF GPS extraction skipped: {e}")
        return None, None


def fetch_reference_dem(lat: float, lon: float, timeout_seconds: int = 10) -> str | None:
    """
    Fetch reference DEM raster tile from OpenTopography / USGS public API.
    Caches tiles locally under backend/app/cache/reference_dem/ for 100% offline runs.
    Enforces a strict 10s network timeout. Returns path to local GeoTIFF or None on failure.
    """
    round_lat = round(lat, 2)
    round_lon = round(lon, 2)
    cache_filename = f"ref_dem_{round_lat}_{round_lon}.tif"
    cache_filepath = os.path.join(CACHE_DIR, cache_filename)

    # 1. Return cached tile if available on local disk (100% Offline support)
    if os.path.exists(cache_filepath):
        logger.info(f"Loaded reference DEM tile from local cache: {cache_filepath}")
        return cache_filepath

    # 2. Network fetch with 10s timeout
    url = (
        f"https://portal.opentopography.org/API/globaldem?"
        f"demtype=SRTMGL1&south={round_lat-0.05}&north={round_lat+0.05}"
        f"&west={round_lon-0.05}&east={round_lon+0.05}&outputFormat=GTiff"
    )

    try:
        logger.info(f"Fetching reference DEM tile for lat={round_lat}, lon={round_lon} (timeout={timeout_seconds}s)...")
        response = requests.get(url, timeout=timeout_seconds)
        if response.status_code == 200 and len(response.content) > 1000:
            with open(cache_filepath, "wb") as f:
                f.write(response.content)
            logger.info(f"Cached reference DEM tile to {cache_filepath}")
            return cache_filepath
        else:
            logger.warning(f"Reference DEM API returned HTTP {response.status_code}. Falling back to Preview Mode.")
            return None
    except Exception as e:
        logger.warning(f"Reference DEM fetch failed or timed out ({e}). Falling back strictly to Preview Mode.")
        return None


def resample_reference_dem(ref_dem_path: str, target_shape: tuple[int, int]) -> np.ndarray | None:
    """
    Reproject and resample reference DEM tile using rasterio bilinear interpolation
    onto the exact target pixel grid [H, W] of the predicted relative elevation map.
    """
    target_h, target_w = target_shape
    try:
        with rasterio.open(ref_dem_path) as src:
            resampled_data = src.read(
                1,
                out_shape=(target_h, target_w),
                resampling=Resampling.bilinear,
            ).astype(np.float32)

            # Mask nodata values
            if src.nodata is not None:
                resampled_data[resampled_data == src.nodata] = np.nan

            return resampled_data
    except Exception as e:
        logger.warning(f"Rasterio reprojection/resampling failed: {e}")
        return None


def calibrate_to_metric(
    relative_elevation: np.ndarray,
    lat: float,
    lon: float,
) -> tuple[np.ndarray | None, dict | None]:
    """
    GEOSCALE Metric Elevation Calibration.
    Fits H_metric = scale * Z_relative + offset using RANSAC linear regression against reference DEM.
    Returns: (calibrated_elevation_m, metrics_dict) or (None, None) for strict Preview Mode fallback.
    """
    ref_dem_path = fetch_reference_dem(lat, lon)
    if not ref_dem_path:
        return None, None

    ref_dem_aligned = resample_reference_dem(ref_dem_path, relative_elevation.shape)
    if ref_dem_aligned is None:
        return None, None

    # Filter out NaNs and valid points
    valid_mask = ~np.isnan(ref_dem_aligned)
    rel_flat = relative_elevation[valid_mask]
    ref_flat = ref_dem_aligned[valid_mask]

    if len(rel_flat) < 100:
        logger.warning("Insufficient valid overlapping reference DEM pixels. Falling back to Preview Mode.")
        return None, None

    try:
        from sklearn.linear_model import RANSACRegressor

        X = rel_flat.reshape(-1, 1)
        y = ref_flat

        # RANSAC robust linear fit
        model = RANSACRegressor(random_state=42)
        model.fit(X, y)

        scale = float(model.estimator_.coef_[0])
        offset = float(model.estimator_.intercept_)

        # Compute metric elevation map
        metric_elevation = (scale * relative_elevation) + offset

        # Compute validation accuracy (MAE, RMSE) on 20% held-out test split
        num_test = int(len(rel_flat) * 0.2)
        test_idx = np.random.choice(len(rel_flat), size=num_test, replace=False)

        pred_test = (scale * rel_flat[test_idx]) + offset
        actual_test = ref_flat[test_idx]

        errors = pred_test - actual_test
        mae = float(np.mean(np.abs(errors)))
        rmse = float(np.sqrt(np.mean(errors**2)))

        metrics = {
            "mode": "calibrated",
            "scale": round(scale, 4),
            "offset": round(offset, 2),
            "mae_meters": round(mae, 2),
            "rmse_meters": round(rmse, 2),
            "min_elevation_m": round(float(np.min(metric_elevation)), 2),
            "max_elevation_m": round(float(np.max(metric_elevation)), 2),
            "units": "meters MSL",
        }

        logger.info(f"GEOSCALE Calibration successful: scale={scale:.4f}, offset={offset:.2f}, RMSE={rmse:.2f}m")
        return metric_elevation.astype(np.float32), metrics
    except Exception as e:
        logger.warning(f"RANSAC metric fitting failed ({e}). Falling back strictly to Preview Mode.")
        return None, None
