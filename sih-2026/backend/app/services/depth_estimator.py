import os
import urllib.request
import logging
import torch
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

logger = logging.getLogger(__name__)

# Weight URL and local path
MIDAS_SMALL_URL = "https://github.com/isl-org/MiDaS/releases/download/v2_1/midas_v21_small-70d6b9c8.pt"
LOCAL_WEIGHTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "weights")
LOCAL_WEIGHTS_PATH = os.path.join(LOCAL_WEIGHTS_DIR, "midas_v21_small-70d6b9c8.pt")


class DepthEstimator:
    _instance = None
    _model = None
    _transform = None
    _device = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DepthEstimator, cls).__new__(cls)
            cls._instance._init_model()
        return cls._instance

    def _init_model(self):
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Initializing DepthEstimator on device: {self._device}")

        # Ensure local weights directory exists
        os.makedirs(LOCAL_WEIGHTS_DIR, exist_ok=True)

        if not os.path.exists(LOCAL_WEIGHTS_PATH):
            logger.info(f"Cached weights not found. Downloading MiDaS_small from {MIDAS_SMALL_URL}...")
            try:
                urllib.request.urlretrieve(MIDAS_SMALL_URL, LOCAL_WEIGHTS_PATH)
                logger.info(f"Weights downloaded to {LOCAL_WEIGHTS_PATH}")
            except Exception as e:
                logger.warning(f"Direct weight download failed ({e}). Falling back to torch.hub...")

        try:
            # Bypass interactive trust prompt in non-interactive environments
            if hasattr(torch.hub, "_check_repo_is_trusted"):
                torch.hub._check_repo_is_trusted = lambda *args, **kwargs: True

            # Load transforms from torch.hub
            midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
            self._transform = midas_transforms.small_transform

            if os.path.exists(LOCAL_WEIGHTS_PATH):
                logger.info(f"Loading MiDaS_small directly from local weights: {LOCAL_WEIGHTS_PATH}")
                self._model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small", pretrained=False, trust_repo=True)
                state_dict = torch.load(LOCAL_WEIGHTS_PATH, map_location=self._device)
                self._model.load_state_dict(state_dict)
            else:
                logger.info("Loading MiDaS_small pretrained weights via torch.hub...")
                self._model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small", pretrained=True, trust_repo=True)

            self._model.to(self._device)
            self._model.eval()
            logger.info("DepthEstimator model successfully loaded and ready.")
        except Exception as e:
            logger.error(f"Failed to initialize MiDaS model: {e}", exc_info=True)
            raise RuntimeError(f"Could not load depth estimation model: {e}")

    def estimate_depth(
        self,
        image: Image.Image,
        detrend_tilt: float = 0.65,
        smooth_sigma: float = 1.2,
    ) -> np.ndarray:
        """
        Estimate dense relative depth map for a PIL Image.
        Applies perspective tilt detrending and smoothing to produce clean, realistic topological DEMs.
        Returns: 2D float32 numpy array with normalized relative elevation [0.0, 100.0]
        """
        # Ensure RGB
        if image.mode != "RGB":
            image = image.convert("RGB")

        orig_w, orig_h = image.size
        img_np = np.array(image)

        # Apply MiDaS input transforms
        input_batch = self._transform(img_np).to(self._device)

        with torch.no_grad():
            prediction = self._model(input_batch)
            # Resize back to original image resolution
            prediction = torch.nn.functional.interpolate(
                prediction.unsqueeze(1),
                size=(orig_h, orig_w),
                mode="bicubic",
                align_corners=False,
            ).squeeze()

            depth_map = prediction.cpu().numpy().astype(np.float32)

        # 1. Perspective Tilt Detrending (Remove camera forward tilt ramp)
        if detrend_tilt > 0.0:
            h, w = depth_map.shape
            # Downsampled grid for fast robust plane fitting
            ds_h = min(128, h)
            ds_w = min(128, w)
            ds_depth = np.array(Image.fromarray(depth_map).resize((ds_w, ds_h), Image.Resampling.BILINEAR))

            y_grid, x_grid = np.mgrid[0:ds_h, 0:ds_w]
            A = np.column_stack([x_grid.ravel() / ds_w, y_grid.ravel() / ds_h, np.ones(ds_h * ds_w)])
            coeffs, _, _, _ = np.linalg.lstsq(A, ds_depth.ravel(), rcond=None)

            # Reconstruct full-res plane
            y_full, x_full = np.mgrid[0:h, 0:w]
            plane_full = (coeffs[0] * (x_full / w) + coeffs[1] * (y_full / h) + coeffs[2]).astype(np.float32)

            # Detrend depth map by removing camera tilt slope
            depth_map = depth_map - (detrend_tilt * (plane_full - float(np.mean(plane_full))))

        # 2. Gaussian smoothing to remove high-frequency neural quantization spikes
        if smooth_sigma > 0.0:
            depth_map = gaussian_filter(depth_map, sigma=smooth_sigma)

        # 3. Robust percentile normalization to 0.0 - 100.0
        p_min = float(np.percentile(depth_map, 0.5))
        p_max = float(np.percentile(depth_map, 99.5))

        if p_max - p_min > 1e-5:
            norm_elevation = np.clip((depth_map - p_min) / (p_max - p_min) * 100.0, 0.0, 100.0)
        else:
            norm_elevation = np.zeros_like(depth_map, dtype=np.float32)

        return norm_elevation.astype(np.float32)
