import argparse
import numpy as np
import rasterio

def calculate_metrics(predicted_path, reference_path):
    print(f"Comparing predicted {predicted_path} against reference {reference_path}...")
    with rasterio.open(predicted_path) as pred_src, rasterio.open(reference_path) as ref_src:
        pred = pred_src.read(1)
        ref = ref_src.read(1)

    # Simple metrics
    mask = (~np.isnan(pred)) & (~np.isnan(ref))
    pred_val = pred[mask]
    ref_val = ref[mask]

    rmse = np.sqrt(np.mean((pred_val - ref_val) ** 2))
    mae = np.mean(np.abs(pred_val - ref_val))
    correlation = np.corrcoef(pred_val, ref_val)[0, 1]

    print(f"Validation Metrics:")
    print(f"  RMSE: {rmse:.4f} m")
    print(f"  MAE:  {mae:.4f} m")
    print(f"  Corr: {correlation:.4f}")

def main():
    parser = argparse.ArgumentParser(description="RMSE / accuracy evaluation against SRTM")
    parser.add_argument("--predicted", required=True, help="Path to predicted DSM GeoTIFF")
    parser.add_argument("--reference", required=True, help="Path to reference SRTM DEM GeoTIFF")

    args = parser.parse_args()
    calculate_metrics(args.predicted, args.reference)

if __name__ == "__main__":
    main()
