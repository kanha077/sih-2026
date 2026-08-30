import rasterio
import numpy as np

def export_to_geotiff(elevation_map, output_path, crs, transform):
    """
    Export metric elevation map to a standard GeoTIFF.
    """
    print(f"Exporting GeoTIFF to {output_path}...")
    height, width = elevation_map.shape
    profile = {
        'driver': 'GTiff',
        'dtype': 'float32',
        'nodata': None,
        'width': width,
        'height': height,
        'count': 1,
        'crs': crs,
        'transform': transform,
        'tiled': False,
        'interleave': 'band'
    }

    with rasterio.open(output_path, 'w', **profile) as dst:
        dst.write(elevation_map.astype(np.float32), 1)
    print("Export successful.")
