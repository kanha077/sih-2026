import os
import logging
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def generate_obj_mesh(
    elevation_data: np.ndarray,
    output_path: str,
    target_grid_size: int = 150,
    vertical_scale: float = 0.25,
) -> str:
    """
    Generate a 3D Wavefront .OBJ mesh file from the elevation raster with UV coordinates.
    Downsamples to target_grid_size for high-performance rendering.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    orig_h, orig_w = elevation_data.shape

    # Calculate grid dimensions preserving aspect ratio
    aspect = orig_w / orig_h
    if aspect >= 1.0:
        grid_w = target_grid_size
        grid_h = max(2, int(target_grid_size / aspect))
    else:
        grid_h = target_grid_size
        grid_w = max(2, int(target_grid_size * aspect))

    # Resize elevation data to grid dimensions
    elev_pil = Image.fromarray(elevation_data.astype(np.float32), mode="F")
    elev_resized = np.array(elev_pil.resize((grid_w, grid_h), Image.Resampling.BILINEAR))

    # Build 3D coordinates centered at (0, 0, 0)
    x_coords = np.linspace(-10.0 * (aspect if aspect < 1 else 1.0), 10.0 * (aspect if aspect < 1 else 1.0), grid_w)
    z_coords = np.linspace(-10.0 * (1.0 / aspect if aspect >= 1 else 1.0), 10.0 * (1.0 / aspect if aspect >= 1 else 1.0), grid_h)

    xx, zz = np.meshgrid(x_coords, z_coords)
    yy = (elev_resized / 100.0) * (10.0 * vertical_scale)

    vertices = np.column_stack([xx.ravel(), yy.ravel(), zz.ravel()])

    # UV coordinates [0.0, 1.0]
    u_coords = np.linspace(0.0, 1.0, grid_w)
    v_coords = np.linspace(1.0, 0.0, grid_h)  # Flip V for standard OBJ textures
    uu, vv = np.meshgrid(u_coords, v_coords)
    uvs = np.column_stack([uu.ravel(), vv.ravel()])

    # Write OBJ file with geometric vertex definitions and faces
    with open(output_path, "w") as f:
        f.write("# DepthWizard 3D Topographical Surface Mesh\n")
        f.write(f"# Grid Size: {grid_w}x{grid_h}, Total Vertices: {len(vertices)}\n\n")

        # Vertices (v x y z)
        for v in vertices:
            f.write(f"v {v[0]:.4f} {v[1]:.4f} {v[2]:.4f}\n")

        # Texture Coordinates (vt u v)
        for uv in uvs:
            f.write(f"vt {uv[0]:.4f} {uv[1]:.4f}\n")

        # Normals (vn nx ny nz) - Upward base
        f.write("vn 0.0000 1.0000 0.0000\n\n")

        # Faces (f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3)
        for r in range(grid_h - 1):
            for c in range(grid_w - 1):
                # 1-indexed vertex indices
                top_left = r * grid_w + c + 1
                top_right = top_left + 1
                bot_left = (r + 1) * grid_w + c + 1
                bot_right = bot_left + 1

                # Tri 1: top_left -> bot_left -> top_right
                f.write(f"f {top_left}/{top_left}/1 {bot_left}/{bot_left}/1 {top_right}/{top_right}/1\n")
                # Tri 2: top_right -> bot_left -> bot_right
                f.write(f"f {top_right}/{top_right}/1 {bot_left}/{bot_left}/1 {bot_right}/{bot_right}/1\n")

    logger.info(f"Generated 3D OBJ mesh at {output_path} ({grid_w}x{grid_h} vertices)")
    return output_path
