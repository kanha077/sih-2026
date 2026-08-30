import argparse
import sys
from calibration import calibrate_depth_to_elevation, export_calibrated_dsm

def main():
    parser = argparse.ArgumentParser(description="End-to-end pipeline: image -> DSM")
    parser.add_argument("--input", required=True, help="Path to input optical remote-sensing image (PNG/JPG/TIFF)")
    parser.add_argument("--output", required=True, help="Path to export the output DSM GeoTIFF")
    parser.add_argument("--reference-dem", help="Path to reference DEM for calibration")
    
    args = parser.parse_args()
    print(f"Running inference on {args.input}...")
    # TODO: Implement monocular depth estimation backend (Depth Anything V2 / MiDaS / ZoeDepth)
    # TODO: Implement scale calibration using args.reference_dem
    # TODO: Export final calibrated DSM
    print(f"DSM saved to {args.output}")

if __name__ == "__main__":
    main()
