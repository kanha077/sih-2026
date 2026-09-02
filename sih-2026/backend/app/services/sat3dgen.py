import os
import logging
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)


def generate_point_cloud_mesh(
    elevation_data: np.ndarray,
    image: Image.Image,
    output_path: str,
    max_grid_size: int = 150,
    vertical_scale: float = 0.25,
) -> str:
    """
    SAT3DGEN 3D Reconstruction Branch.
    Generates a 3D Wavefront .OBJ surface mesh from point cloud back-projection with downsampling
    and surface triangulation to ensure ultra-fast execution during live demos.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    orig_h, orig_w = elevation_data.shape

    # Downsample to cap point cloud count (Review feedback #7)
    aspect = orig_w / orig_h
    if aspect >= 1.0:
        grid_w = max_grid_size
        grid_h = max(2, int(max_grid_size / aspect))
    else:
        grid_h = max_grid_size
        grid_w = max(2, int(max_grid_size * aspect))

    # Resize elevation array
    elev_pil = Image.fromarray(elevation_data.astype(np.float32), mode="F")
    elev_resized = np.array(elev_pil.resize((grid_w, grid_h), Image.Resampling.BILINEAR))

    # Back-project pixels to 3D point cloud centered at (0,0,0)
    x_span = 10.0 * (aspect if aspect < 1 else 1.0)
    z_span = 10.0 * (1.0 / aspect if aspect >= 1 else 1.0)
    x_coords = np.linspace(-x_span, x_span, grid_w)
    z_coords = np.linspace(-z_span, z_span, grid_h)

    xx, zz = np.meshgrid(x_coords, z_coords)
    yy = (elev_resized / 100.0) * (10.0 * vertical_scale)

    vertices = np.column_stack([xx.ravel(), yy.ravel(), zz.ravel()])

    # Generate UV coordinates
    u_coords = np.linspace(0.0, 1.0, grid_w)
    v_coords = np.linspace(1.0, 0.0, grid_h)
    uu, vv = np.meshgrid(u_coords, v_coords)
    uvs = np.column_stack([uu.ravel(), vv.ravel()])

    # Try Open3D Poisson / Ball Pivoting Surface Reconstruction
    faces = []
    use_open3d = False
    try:
        import open3d as o3d

        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(vertices)
        pcd.estimate_normals()
        
        # Poisson surface reconstruction with depth=7
        mesh, _ = o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(pcd, depth=7)
        if len(mesh.triangles) > 0:
            o3d_vertices = np.asarray(mesh.vertices)
            o3d_triangles = np.asarray(mesh.triangles)
            if len(o3d_vertices) > 0 and len(o3d_triangles) > 0:
                vertices = o3d_vertices
                faces = o3d_triangles
                use_open3d = True
                logger.info(f"Open3D Poisson surface reconstruction succeeded ({len(vertices)} vertices, {len(faces)} faces)")
    except Exception as e:
        logger.warning(f"Open3D surface reconstruction fallback to grid triangulation: {e}")

    # Standard grid triangulation fallback if Open3D did not generate mesh
    if not use_open3d or len(faces) == 0:
        faces = []
        for r in range(grid_h - 1):
            for c in range(grid_w - 1):
                top_left = r * grid_w + c + 1
                top_right = top_left + 1
                bot_left = (r + 1) * grid_w + c + 1
                bot_right = bot_left + 1
                faces.append((top_left, bot_left, top_right))
                faces.append((top_right, bot_left, bot_right))

    # Write Wavefront OBJ file
    with open(output_path, "w") as f:
        f.write("# DepthWizard SAT3DGEN Point-Cloud Surface Mesh\n")
        f.write(f"# Grid: {grid_w}x{grid_h}, Vertices: {len(vertices)}\n\n")

        for v in vertices:
            f.write(f"v {v[0]:.4f} {v[1]:.4f} {v[2]:.4f}\n")

        if not use_open3d:
            for uv in uvs:
                f.write(f"vt {uv[0]:.4f} {uv[1]:.4f}\n")
            f.write("vn 0.0000 1.0000 0.0000\n\n")
            for f_indices in faces:
                v1, v2, v3 = f_indices
                f.write(f"f {v1}/{v1}/1 {v2}/{v2}/1 {v3}/{v3}/1\n")
        else:
            f.write("vn 0.0000 1.0000 0.0000\n\n")
            for f_indices in faces:
                v1, v2, v3 = f_indices[0] + 1, f_indices[1] + 1, f_indices[2] + 1
                f.write(f"f {v1}//1 {v2}//1 {v3}//1\n")

    logger.info(f"Generated SAT3DGEN OBJ mesh at {output_path}")
    return output_path
