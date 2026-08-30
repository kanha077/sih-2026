"""infer_geofusion.py - Inference for GeoFusion Algorithm (DepthWizard SIH26175)."""

import os
import numpy as np
import torch
import rasterio

from geofusion_model import GeoFusionNet
from srtm_utils import load_srtm_as_prior, build_target_profile_from_image


def run_inference(model_weights_path: str, relative_depth: np.ndarray,
                   srtm_prior: np.ndarray, device: str = "cpu") -> np.ndarray:
    if not os.path.exists(model_weights_path):
        raise FileNotFoundError(f"Model weights not found: {model_weights_path}")
    if relative_depth.shape != srtm_prior.shape:
        raise ValueError("relative_depth and srtm_prior must have the same shape.")

    model = GeoFusionNet()
    model.load_state_dict(torch.load(model_weights_path, map_location=device))
    model.to(device)
    model.eval()

    rel_t = torch.from_numpy(relative_depth).float().unsqueeze(0).unsqueeze(0).to(device)
    srtm_t = torch.from_numpy(srtm_prior).float().unsqueeze(0).unsqueeze(0).to(device)

    with torch.no_grad():
        pred = model(rel_t, srtm_t)

    return pred.squeeze().cpu().numpy()


def export_geotiff(dsm_array: np.ndarray, reference_profile: dict, out_path: str):
    profile = {
        "driver": "GTiff",
        "height": dsm_array.shape[0],
        "width": dsm_array.shape[1],
        "count": 1,
        "dtype": "float32",
        "crs": reference_profile["crs"],
        "transform": reference_profile["transform"],
        "nodata": -9999,
    }
    with rasterio.open(out_path, "w", **profile) as dst:
        dst.write(dsm_array.astype(np.float32), 1)
    print(f"Saved calibrated DSM -> {out_path}")
