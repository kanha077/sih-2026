import os
import time
import json
import hashlib
import logging
from typing import Dict, Any, Tuple, Optional, List
import requests
import numpy as np
from PIL import Image
from scipy.ndimage import zoom

logger = logging.getLogger(__name__)

# Configurable default settings via environment variables
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_CACHE_DIR = os.path.join(BASE_DIR, "data", "srtm_cache")

SRTM_GRID_SIZE = int(os.environ.get("SRTM_GRID_SIZE", "24"))  # 24x24 sparse grid = 576 points
SRTM_API_PROVIDER = os.environ.get("SRTM_API_PROVIDER", "open-elevation")  # 'open-elevation' or 'opentopodata'
SRTM_API_URL = os.environ.get("SRTM_API_URL", "https://api.open-elevation.com/api/v1/lookup")
SRTM_API_TIMEOUT_SECONDS = float(os.environ.get("SRTM_API_TIMEOUT_SECONDS", "8.0"))
SRTM_CALIBRATION_MAX_SECONDS = float(os.environ.get("SRTM_CALIBRATION_MAX_SECONDS", "15.0"))
SRTM_CACHE_DIR = os.environ.get("SRTM_CACHE_DIR", DEFAULT_CACHE_DIR)


class SRTMCalibrator:
    """
    SRTM/Copernicus-based geodetic elevation calibration module.
    Converts relative monocular disparity maps (0-100 relative units) into calibrated
    metric elevation arrays (meters above sea level) via least-squares linear regression:
        z_metric = alpha * z_relative + beta
    """

    def __init__(
        self,
        grid_size: int = SRTM_GRID_SIZE,
        api_provider: str = SRTM_API_PROVIDER,
        api_url: str = SRTM_API_URL,
        timeout_seconds: float = SRTM_API_TIMEOUT_SECONDS,
        max_duration_seconds: float = SRTM_CALIBRATION_MAX_SECONDS,
        cache_dir: str = SRTM_CACHE_DIR,
    ):
        self.grid_size = grid_size
        self.api_provider = api_provider.lower()
        self.api_url = api_url
        self.timeout_seconds = timeout_seconds
        self.max_duration_seconds = max_duration_seconds
        self.cache_dir = cache_dir

        os.makedirs(self.cache_dir, exist_ok=True)

    def _generate_cache_key(
        self,
        origin_lat: float,
        origin_lon: float,
        pixel_scale: float,
        width: int,
        height: int,
    ) -> str:
        """
        Generate MD5 hash key uniquely identifying the spatial bounding box, raster resolution,
        grid sampling density, and provider. This prevents cache collisions when processing
        rasters at different scales or resolutions over overlapping regions.
        """
        signature = (
            f"{origin_lat:.6f}_{origin_lon:.6f}_{pixel_scale:.8f}_"
            f"{width}x{height}_grid{self.grid_size}_{self.api_provider}"
        )
        return hashlib.md5(signature.encode("utf-8")).hexdigest()

    def _load_from_cache(self, cache_key: str) -> Optional[np.ndarray]:
        """Load cached reference grid if present."""
        json_path = os.path.join(self.cache_dir, f"srtm_{cache_key}.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                logger.info(f"Loaded cached SRTM reference grid: {json_path}")
                return np.array(data["sparse_grid"], dtype=np.float32)
            except Exception as e:
                logger.warning(f"Failed to read cache file {json_path}: {e}")
        return None

    def _save_to_cache(
        self,
        cache_key: str,
        sparse_grid: np.ndarray,
        origin_lat: float,
        origin_lon: float,
        pixel_scale: float,
        width: int,
        height: int,
    ):
        """Save sparse reference grid to cache."""
        json_path = os.path.join(self.cache_dir, f"srtm_{cache_key}.json")
        try:
            payload = {
                "hash": cache_key,
                "origin_lat": origin_lat,
                "origin_lon": origin_lon,
                "pixel_scale": pixel_scale,
                "width": width,
                "height": height,
                "grid_size": self.grid_size,
                "provider": self.api_provider,
                "sparse_grid": sparse_grid.tolist(),
                "timestamp": time.time(),
            }
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
            logger.info(f"Saved SRTM reference grid to cache: {json_path}")
        except Exception as e:
            logger.warning(f"Failed to write cache file {json_path}: {e}")

    def _fetch_sparse_reference_grid(
        self,
        origin_lat: float,
        origin_lon: float,
        pixel_scale: float,
        width: int,
        height: int,
    ) -> np.ndarray:
        """
        SPARSE GRID FETCHING:
        DO NOT fetch one elevation point per pixel. Full-resolution fetching would require
        tens of thousands of API calls per image, which would time out or get rate-limited
        on free-tier elevation APIs.
        Instead, we sample a coarse grid (e.g. 24x24 = 576 points) spanning the image bounding box,
        batch points into requests of max 100 locations per request, and upsample to dense resolution.
        """
        t_start = time.time()

        # Compute coordinates across bounding box
        max_lat = origin_lat + (height * pixel_scale)
        max_lon = origin_lon + (width * pixel_scale)

        lats = np.linspace(origin_lat, max_lat, self.grid_size)
        lons = np.linspace(origin_lon, max_lon, self.grid_size)

        locations: List[Dict[str, float]] = []
        for lat in lats:
            for lon in lons:
                locations.append({"latitude": float(lat), "longitude": float(lon)})

        elevations: List[float] = []
        batch_size = 100  # Max batch size for public APIs (OpenTopoData / Open-Elevation)

        for i in range(0, len(locations), batch_size):
            elapsed = time.time() - t_start
            if elapsed >= self.max_duration_seconds:
                raise TimeoutError(
                    f"SRTM calibration exceeded wall-clock duration limit ({elapsed:.1f}s >= {self.max_duration_seconds}s)"
                )

            chunk = locations[i : i + batch_size]

            if "opentopodata" in self.api_provider:
                # OpenTopoData pipe-separated locations format
                loc_param = "|".join([f"{loc['latitude']:.6f},{loc['longitude']:.6f}" for loc in chunk])
                url = f"{self.api_url}?locations={loc_param}"
                res = requests.get(url, timeout=self.timeout_seconds)
                res.raise_for_status()
                data = res.json()
                chunk_elevs = [item["elevation"] if item.get("elevation") is not None else 0.0 for item in data["results"]]
            else:
                # Open-Elevation JSON payload format
                payload = {"locations": chunk}
                res = requests.post(self.api_url, json=payload, timeout=self.timeout_seconds)
                res.raise_for_status()
                data = res.json()
                chunk_elevs = [item["elevation"] if item.get("elevation") is not None else 0.0 for item in data["results"]]

            elevations.extend(chunk_elevs)

        if len(elevations) != self.grid_size * self.grid_size:
            raise ValueError(f"Expected {self.grid_size * self.grid_size} elevation points, received {len(elevations)}")

        sparse_grid = np.array(elevations, dtype=np.float32).reshape((self.grid_size, self.grid_size))
        return sparse_grid

    def calibrate(
        self,
        elevation_data: np.ndarray,
        origin_lat: float,
        origin_lon: float,
        pixel_scale: float = 0.0001,
    ) -> Dict[str, Any]:
        """
        Calibrate dense relative elevation map [0, 100] to real-world meters above sea level.

        Returns dict:
        {
            "calibrated_data": np.ndarray (float32 meters),
            "calibrated": bool,
            "alpha": float or None,
            "beta": float or None,
            "rmse": float or None,
            "mae": float or None,
            "provider": str,
            "error": str or None
        }
        """
        h, w = elevation_data.shape

        try:
            # Check cache first using signature hash
            cache_key = self._generate_cache_key(origin_lat, origin_lon, pixel_scale, w, h)
            sparse_grid = self._load_from_cache(cache_key)

            if sparse_grid is None:
                logger.info(
                    f"Fetching SRTM reference DEM for bbox [{origin_lat:.4f}, {origin_lon:.4f}] grid={self.grid_size}x{self.grid_size}..."
                )
                sparse_grid = self._fetch_sparse_reference_grid(origin_lat, origin_lon, pixel_scale, w, h)
                self._save_to_cache(cache_key, sparse_grid, origin_lat, origin_lon, pixel_scale, w, h)

            # Upsample sparse reference grid to match input relative elevation raster dimensions (h, w)
            zoom_factors = (h / float(self.grid_size), w / float(self.grid_size))
            reference_grid = zoom(sparse_grid, zoom_factors, order=1).astype(np.float32)

            # Ensure matching shape
            if reference_grid.shape != elevation_data.shape:
                reference_grid = np.array(
                    Image.fromarray(reference_grid).resize((w, h), Image.Resampling.BILINEAR)
                )

            # Linear regression: z_metric = alpha * z_relative + beta
            rel_flat = elevation_data.ravel().astype(np.float64)
            ref_flat = reference_grid.ravel().astype(np.float64)

            valid_mask = np.isfinite(rel_flat) & np.isfinite(ref_flat)
            if np.sum(valid_mask) < 4:
                raise ValueError("Insufficient valid reference DEM points for least-squares calibration.")

            A = np.column_stack([rel_flat[valid_mask], np.ones(np.sum(valid_mask))])
            coeffs, _, _, _ = np.linalg.lstsq(A, ref_flat[valid_mask], rcond=None)
            alpha, beta = float(coeffs[0]), float(coeffs[1])

            # Apply calibration formula
            calibrated_data = (alpha * elevation_data + beta).astype(np.float32)

            # Compute error statistics against reference DEM
            residuals = calibrated_data.ravel()[valid_mask] - ref_flat[valid_mask]
            rmse = float(np.sqrt(np.mean(residuals ** 2)))
            mae = float(np.mean(np.abs(residuals)))

            logger.info(
                f"SRTM Calibration successful: alpha={alpha:.4f}, beta={beta:.2f}m, RMSE={rmse:.2f}m, MAE={mae:.2f}m"
            )

            return {
                "calibrated_data": calibrated_data,
                "calibrated": True,
                "alpha": round(alpha, 4),
                "beta": round(beta, 2),
                "rmse": round(rmse, 2),
                "mae": round(mae, 2),
                "provider": self.api_provider,
                "error": None,
            }

        except requests.exceptions.Timeout as e:
            logger.warning(
                f"SRTM API request timed out after {self.timeout_seconds}s. Falling back to preview mode: {e}"
            )
            return {
                "calibrated_data": elevation_data,
                "calibrated": False,
                "alpha": None,
                "beta": None,
                "rmse": None,
                "mae": None,
                "provider": self.api_provider,
                "error": f"API request timeout ({self.timeout_seconds}s)",
            }
        except Exception as e:
            logger.warning(f"SRTM Calibration failed ({e}). Falling back to preview mode.", exc_info=True)
            return {
                "calibrated_data": elevation_data,
                "calibrated": False,
                "alpha": None,
                "beta": None,
                "rmse": None,
                "mae": None,
                "provider": self.api_provider,
                "error": str(e),
            }
