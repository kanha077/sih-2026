"""
srtm_calibration.py
====================
SIH26175 - DepthWizard | SRTM Calibration module

Responsibilities of this module (your part of the pipeline):
1. Read an SRTM DEM tile covering the area of interest (AOI).
2. Reproject/resample it so it aligns pixel-for-pixel with the input RGB
   image (same width, height, CRS, and geotransform).
3. Produce:
     - a dense "coarse prior elevation" array, used downstream by the
       GeoFusion model as an absolute-scale reference, and
     - a sparse set of Ground Control Points (GCPs) sampled from SRTM,
       useful for quick scale/shift sanity-checks or classical calibration.
4. Provide a simple scale+shift calibration function as a lightweight,
   non-trained baseline (useful for early testing before the trained
   GeoFusion model exists).

------------------------------------------------------------------------------
WHERE THIS FITS IN THE OVERALL PIPELINE
------------------------------------------------------------------------------
RGB Image -> [Sat3DGen backbone] -> Relative Depth Map (0-1, scale-free)
                                              |
SRTM DEM (30m, absolute elevation) -----------+   <-- THIS MODULE produces this input
                                              v
                                   [GeoFusion model - teammate's module]
                                              v
                              Calibrated Absolute DSM (GeoTIFF)

------------------------------------------------------------------------------
GETTING SRTM DATA
------------------------------------------------------------------------------
Download SRTM tiles (free, 30m resolution) for your area of interest from:
  - https://earthexplorer.usgs.gov/  (USGS EarthExplorer, needs free login)
  - https://dwtkns.com/srtm30m/      (simple tile picker, no login)
  - https://opentopography.org/      (alternative, various resolutions)

SRTM tiles are usually named like "N23E077.hgt" (lat/lon of the tile's
lower-left corner) and cover a 1x1 degree area.
"""

import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling


def build_target_profile_from_image(image_path: str) -> dict:
    """
    Reads CRS / transform / width / height from a georeferenced RGB image
    (GeoTIFF). This defines the pixel grid SRTM must be resampled onto so
    it aligns exactly with your image, pixel-for-pixel.
    """
    with rasterio.open(image_path) as src:
        return {
            "crs": src.crs,
            "transform": src.transform,
            "width": src.width,
            "height": src.height,
        }


def load_srtm_as_prior(srtm_path: str, target_profile: dict) -> np.ndarray:
    """
    Reproject/resample an SRTM DEM GeoTIFF (or .hgt) to match the target
    raster's CRS, resolution, and extent.

    Parameters
    ----------
    srtm_path : path to the SRTM file covering your AOI.
    target_profile : dict with keys crs, transform, width, height
                      (from build_target_profile_from_image).

    Returns
    -------
    np.ndarray of shape (H, W), dtype float32 - elevation in meters,
    aligned to the target image grid.
    """
    with rasterio.open(srtm_path) as src:
        dst_array = np.empty((target_profile["height"], target_profile["width"]),
                              dtype=np.float32)
        reproject(
            source=rasterio.band(src, 1),
            destination=dst_array,
            src_transform=src.transform,
            src_crs=src.crs,
            dst_transform=target_profile["transform"],
            dst_crs=target_profile["crs"],
            resampling=Resampling.bilinear,  # smooth interpolation, avoids blocky steps
        )
    return dst_array


def sample_gcps_from_srtm(srtm_prior: np.ndarray, n_points: int = 200,
                           seed: int = 42) -> np.ndarray:
    """
    Randomly sample sparse Ground Control Points (GCPs) from the SRTM
    prior. In a production pipeline you'd bias sampling toward flat,
    stable ground (roads, open fields) rather than pure random - but
    random sampling is a solid baseline to start with.

    Returns
    -------
    np.ndarray of shape (n_points, 3): columns are [row, col, elevation_m]
    """
    rng = np.random.default_rng(seed)
    h, w = srtm_prior.shape
    rows = rng.integers(0, h, size=n_points)
    cols = rng.integers(0, w, size=n_points)
    elevations = srtm_prior[rows, cols]
    return np.stack([rows, cols, elevations], axis=1)


def simple_scale_shift_calibration(relative_depth: np.ndarray,
                                    srtm_prior: np.ndarray) -> np.ndarray:
    """
    Lightweight, NON-trained baseline calibration: fits a single global
    scale + shift (least-squares linear regression) between the relative
    depth map and the SRTM reference elevation, then applies it everywhere.

    This is intentionally simple - useful for a quick sanity check or demo
    before the trained GeoFusion model (teammate's module) is ready. It
    will be less accurate than the trained model because a single global
    scale+shift can't adapt to different terrain types across the scene.

    Parameters
    ----------
    relative_depth : (H, W) array, values roughly 0-1 (scale-free)
    srtm_prior      : (H, W) array, real elevation in meters, same shape

    Returns
    -------
    (H, W) array - calibrated elevation estimate in meters
    """
    x = relative_depth.flatten()
    y = srtm_prior.flatten()

    valid = np.isfinite(x) & np.isfinite(y)
    x_valid, y_valid = x[valid], y[valid]

    # Least-squares fit: y = a*x + b
    A = np.vstack([x_valid, np.ones_like(x_valid)]).T
    a, b = np.linalg.lstsq(A, y_valid, rcond=None)[0]

    calibrated = a * relative_depth + b
    return calibrated.astype(np.float32)


def export_geotiff(array: np.ndarray, reference_profile: dict, out_path: str):
    """
    Writes a (H, W) array to disk as a proper georeferenced GeoTIFF,
    preserving CRS and transform from the reference image - opens
    correctly in QGIS and can be handed off to the GeoTIFF Support /
    3D visualization modules.
    """
    profile = {
        "driver": "GTiff",
        "height": array.shape[0],
        "width": array.shape[1],
        "count": 1,
        "dtype": "float32",
        "crs": reference_profile["crs"],
        "transform": reference_profile["transform"],
        "nodata": -9999,
    }
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(array.astype(np.float32), 1)
    print(f"Saved -> {out_path}")


if __name__ == "__main__":
    # ---- Smoke test with synthetic data (no real SRTM file needed) ----
    print("Running SRTM calibration module smoke test with synthetic data...\n")

    # Fake a "relative depth map" and a "SRTM prior" of the same size
    h, w = 128, 128
    fake_relative_depth = np.random.rand(h, w).astype(np.float32)          # 0-1
    fake_srtm_prior = (fake_relative_depth * 40 + 10 +                     # roughly correlated
                        np.random.normal(0, 2, (h, w))).astype(np.float32)  # + noise

    gcps = sample_gcps_from_srtm(fake_srtm_prior, n_points=50)
    print(f"Sampled {len(gcps)} GCPs. Example row: {gcps[0]}")

    calibrated = simple_scale_shift_calibration(fake_relative_depth, fake_srtm_prior)
    print(f"Calibrated output shape: {calibrated.shape}, "
          f"range: {calibrated.min():.2f} to {calibrated.max():.2f} m")

    print("\nSmoke test complete. To use with real data:")
    print(
        "    target_profile = build_target_profile_from_image('aoi_image.tif')\n"
        "    srtm_prior = load_srtm_as_prior('srtm_tile.tif', target_profile)\n"
        "    calibrated = simple_scale_shift_calibration(relative_depth, srtm_prior)\n"
        "    export_geotiff(calibrated, target_profile, 'srtm_calibrated_output.tif')\n"
    )
