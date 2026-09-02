import os
import logging
import torch
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

# Enforce PyTorch backend for transformers to bypass TensorFlow protobuf conflicts
os.environ["USE_TF"] = "0"
os.environ["USE_TORCH"] = "1"

logger = logging.getLogger(__name__)

# HuggingFace model identifier & local weights path
MODEL_ID = "depth-anything/Depth-Anything-V2-Small-hf"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOCAL_V2_DIR = os.path.join(BASE_DIR, "weights", "depth_anything_v2_small")


class DepthEstimatorV2:
    _instance = None
    _processor = None
    _model = None
    _device = None

    def __new__(cls):
        if cls._instance is None:
            inst = super(DepthEstimatorV2, cls).__new__(cls)
            inst._init_model()
            cls._instance = inst
        return cls._instance

    def _init_model(self):
        self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Initializing DepthEstimatorV2 on device: {self._device}")

        os.makedirs(LOCAL_V2_DIR, exist_ok=True)

        try:
            from transformers import AutoImageProcessor, AutoModelForDepthEstimation

            # Check if model config exists locally in cache directory
            config_file = os.path.join(LOCAL_V2_DIR, "config.json")
            if os.path.exists(config_file):
                logger.info(f"Loading Depth Anything V2 directly from local cache: {LOCAL_V2_DIR}")
                self._processor = AutoImageProcessor.from_pretrained(LOCAL_V2_DIR, local_files_only=True)
                self._model = AutoModelForDepthEstimation.from_pretrained(LOCAL_V2_DIR, local_files_only=True)
            else:
                logger.info(f"Local weights not found at {LOCAL_V2_DIR}. Downloading {MODEL_ID} from HuggingFace...")
                self._processor = AutoImageProcessor.from_pretrained(MODEL_ID)
                self._model = AutoModelForDepthEstimation.from_pretrained(MODEL_ID)
                
                # Save locally for future 100% offline runs
                self._processor.save_pretrained(LOCAL_V2_DIR)
                self._model.save_pretrained(LOCAL_V2_DIR)
                logger.info(f"Saved Depth Anything V2 weights locally to {LOCAL_V2_DIR}")

            self._model.to(self._device)
            self._model.eval()
            logger.info("DepthEstimatorV2 successfully initialized and ready.")
        except Exception as e:
            logger.error(f"Failed to initialize Depth Anything V2 model: {e}", exc_info=True)
            raise RuntimeError(f"Could not load Depth Anything V2 model: {e}")

    def estimate_depth(
        self,
        image: Image.Image,
        detrend_tilt: float = 0.65,
        smooth_sigma: float = 1.2,
    ) -> np.ndarray:
        """
        Estimate dense relative depth/elevation map for a PIL Image using Depth Anything V2.
        Applies perspective tilt detrending and gaussian smoothing.
        Returns: 2D float32 numpy array with normalized relative elevation [0.0, 100.0]
        """
        if image.mode != "RGB":
            image = image.convert("RGB")

        orig_w, orig_h = image.size

        # Preprocess input image tensor
        inputs = self._processor(images=image, return_tensors="pt").to(self._device)

        with torch.no_grad():
            outputs = self._model(**inputs)
            predicted_depth = outputs.predicted_depth

            # Resize predicted depth back to original image dimensions
            prediction = torch.nn.functional.interpolate(
                predicted_depth.unsqueeze(1),
                size=(orig_h, orig_w),
                mode="bicubic",
                align_corners=False,
            ).squeeze()

            depth_map = prediction.cpu().numpy().astype(np.float32)

        # 1. Perspective Tilt Detrending (Remove camera forward tilt ramp)
        if detrend_tilt > 0.0:
            h, w = depth_map.shape
            ds_h = min(128, h)
            ds_w = min(128, w)
            ds_depth = np.array(Image.fromarray(depth_map).resize((ds_w, ds_h), Image.Resampling.BILINEAR))

            y_grid, x_grid = np.mgrid[0:ds_h, 0:ds_w]
            A = np.column_stack([x_grid.ravel() / ds_w, y_grid.ravel() / ds_h, np.ones(ds_h * ds_w)])
            coeffs, _, _, _ = np.linalg.lstsq(A, ds_depth.ravel(), rcond=None)

            y_full, x_full = np.mgrid[0:h, 0:w]
            plane_full = (coeffs[0] * (x_full / w) + coeffs[1] * (y_full / h) + coeffs[2]).astype(np.float32)

            depth_map = depth_map - (detrend_tilt * (plane_full - float(np.mean(plane_full))))

        # 2. Gaussian smoothing to remove discretization artifacts
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
