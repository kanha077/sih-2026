import os
import logging
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt
import matplotlib

logger = logging.getLogger(__name__)

COLORMAP_PALETTES = ["terrain", "viridis", "plasma", "grayscale", "magma", "turbo"]


def generate_colorized_images(elevation_data: np.ndarray, output_dir: str) -> dict:
    """
    Generate colored elevation PNG maps for multiple palettes.
    Returns: dict mapping colormap_name -> relative file path
    """
    os.makedirs(output_dir, exist_ok=True)
    height, width = elevation_data.shape

    logger.info(
        f"[DEPTH ANYTHING V2 HEATMAP] Rendering {len(COLORMAP_PALETTES)} hypsometric elevation colormaps "
        f"({', '.join(COLORMAP_PALETTES)}) from {width}x{height} depth matrix into {output_dir}"
    )

    # Normalize elevation to [0.0, 1.0] for colormapping
    elev_norm = np.clip(elevation_data / 100.0, 0.0, 1.0)
    generated_files = {}

    for cmap_name in COLORMAP_PALETTES:
        output_filename = f"elevation_{cmap_name}.png"
        output_filepath = os.path.join(output_dir, output_filename)

        if cmap_name == "grayscale":
            # Direct 8-bit grayscale
            gray_uint8 = (elev_norm * 255).astype(np.uint8)
            img = Image.fromarray(gray_uint8, mode="L")
            img.save(output_filepath, format="PNG", optimize=True)
        else:
            try:
                # Use modern matplotlib.colormaps
                cmap = matplotlib.colormaps[cmap_name]
            except (AttributeError, KeyError):
                cmap = plt.get_cmap(cmap_name)

            rgba = cmap(elev_norm)
            rgba_uint8 = (rgba * 255).astype(np.uint8)
            img = Image.fromarray(rgba_uint8, mode="RGBA")
            img.save(output_filepath, format="PNG", optimize=True)

        generated_files[cmap_name] = output_filename

    # Also save standard raw disparity map
    raw_depth_filename = "depth_raw.png"
    raw_depth_filepath = os.path.join(output_dir, raw_depth_filename)
    raw_uint8 = (elev_norm * 255).astype(np.uint8)
    Image.fromarray(raw_uint8, mode="L").save(raw_depth_filepath, format="PNG")
    generated_files["raw_depth"] = raw_depth_filename

    return generated_files
