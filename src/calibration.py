import numpy as np
from sklearn.linear_model import RANSACRegressor
import rasterio

def calibrate_depth_to_elevation(relative_depth, reference_dem, sample_mask=None):
    """
    Calibrates a relative depth map to metric elevation using
    a reference DEM (e.g. SRTM) or GCPs.

    Args:
        relative_depth (np.ndarray): raw model output, relative depth values
        reference_dem (np.ndarray): co-registered SRTM/GCP elevation values (meters)
        sample_mask (np.ndarray, optional): boolean mask of valid/reliable
            reference points to fit on (e.g. flat, cloud-free areas)

    Returns:
        elevation_map (np.ndarray): calibrated metric elevation (meters)
        scale (float), offset (float): fitted transform parameters
    """
    if sample_mask is not None:
        x = relative_depth[sample_mask].reshape(-1, 1)
        y = reference_dem[sample_mask]
    else:
        x = relative_depth.flatten().reshape(-1, 1)
        y = reference_dem.flatten()

    # RANSAC used to stay robust to outliers/noisy reference points
    regressor = RANSACRegressor()
    regressor.fit(x, y)

    scale = regressor.estimator_.coef_[0]
    offset = regressor.estimator_.intercept_

    elevation_map = relative_depth * scale + offset
    return elevation_map, scale, offset


def export_calibrated_dsm(elevation_map, reference_profile, output_path):
    """
    Writes the calibrated elevation map to a GeoTIFF using the
    georeferencing profile from the reference DEM.
    """
    profile = reference_profile.copy()
    profile.update(dtype=rasterio.float32, count=1)

    with rasterio.open(output_path, "w", **profile) as dst:
        dst.write(elevation_map.astype(np.float32), 1)
