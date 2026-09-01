# DepthWizard
### Single-View Height Estimation and 3D Flythrough

**Problem Statement ID:** SIH26175
**Organisation:** Indian Space Research Organisation (ISRO)
**Category:** Software — Miscellaneous
**Submission Deadline:** 20 September 2026

---

## 📌 Overview

DepthWizard is a pipeline that turns a **single 2D optical remote-sensing image** into a **metric 3D elevation model (DSM)**, then renders it as a **navigable 3D flythrough**. It replaces costly stereo/LiDAR/InSAR elevation capture methods with **monocular AI depth estimation**, making terrain elevation modeling faster, cheaper, and more accessible.

## 🎯 Problem Statement

Traditional elevation capture (stereo imagery, LiDAR, InSAR) is expensive, hardware-dependent, and time-consuming. DepthWizard aims to estimate accurate elevation data from a **single monocular image**, democratizing access to 3D terrain models for applications in urban planning, disaster management, agriculture, and defense.

## 🧩 Expected Solution

The project consists of two core modules:

1. **Elevation Estimation Module**
   - Input: PNG / JPG / TIFF optical remote-sensing image
   - Output: DSM (Digital Surface Model) in standard geospatial format (GeoTIFF)

2. **Interactive 3D Visualization Platform**
   - Upload imagery
   - Fly through the reconstructed terrain
   - Validate predicted height against reference elevation data

Full source code and technical documentation are required deliverables.

---

## 🛠️ Tech Stack

### Depth Estimation
| Component | Technology |
|---|---|
| Monocular depth backbone | Depth Anything V2 / MiDaS / ZoeDepth |
| Fine-tuning domain | Remote-sensing imagery (satellite/drone) |
| Scale calibration | SRTM DEM (reference elevation) / Ground Control Points (GCPs) |
| Core ML framework | Python, PyTorch |

### Geospatial Processing
| Component | Technology |
|---|---|
| Raster/GeoTIFF handling | GDAL, Rasterio |
| Coordinate reference systems | Standard geospatial projections (via GDAL) |

### 3D Reconstruction & Visualization
| Component | Technology |
|---|---|
| Mesh generation | Open3D / trimesh |
| 3D rendering engine | Unity / Three.js / Babylon.js |
| Interaction | Flythrough camera controls, terrain texture draping |

### Suggested Additional Tools
| Purpose | Tool |
|---|---|
| Model serving/API | FastAPI or Flask |
| Frontend (if web-based) | React + Three.js/Babylon.js |
| Version control | Git / GitHub |
| Experiment tracking | Weights & Biases / TensorBoard |
| Containerization | Docker |

---

## 🏗️ System Architecture

```
                ┌────────────────────────┐
                │  Input Image            │
                │  (PNG / JPG / TIFF)     │
                └───────────┬─────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │  Monocular Depth Model  │
                │  (Depth Anything V2 /   │
                │   MiDaS / ZoeDepth)     │
                └───────────┬─────────────┘
                            │  relative depth map
                            ▼
                ┌────────────────────────┐
                │  Scale Calibration      │
                │  (SRTM DEM / GCPs)      │
                └───────────┬─────────────┘
                            │  metric elevation
                            ▼
                ┌────────────────────────┐
                │  DSM Export             │
                │  (GDAL/Rasterio →       │
                │   GeoTIFF)              │
                └───────────┬─────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │  3D Mesh Generation     │
                │  (Open3D / trimesh)     │
                └───────────┬─────────────┘
                            │
                            ▼
                ┌────────────────────────┐
                │  3D Visualization       │
                │  (Unity / Three.js /    │
                │   Babylon.js)           │
                │  → Interactive          │
                │    Flythrough           │
                └─────────────────────────┘
```

---

## 📂 Project Structure

```
depthwizard/
├── data/
│   ├── raw_images/            # Input satellite/drone imagery
│   ├── srtm_dem/               # Reference DEM data for calibration
│   └── processed/              # Preprocessed training pairs
├── models/
│   ├── depth_backbone/         # Pretrained/fine-tuned depth model weights
│   └── calibration/            # Scale calibration module
├── src/
│   ├── inference.py            # End-to-end pipeline: image → DSM
│   ├── train.py                 # Fine-tuning script
│   ├── calibration.py          # SRTM/GCP-based scale correction
│   ├── geotiff_export.py       # GDAL/Rasterio DSM export
│   ├── mesh_generation.py      # DSM → 3D mesh (Open3D/trimesh)
│   └── utils/
├── visualization/
│   ├── web/                    # Three.js / Babylon.js frontend
│   └── unity/                  # Unity project (optional alt. engine)
├── validation/
│   └── metrics.py               # RMSE / accuracy evaluation against SRTM
├── docs/
│   └── technical_documentation.md
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## ⚙️ Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/depthwizard.git
cd depthwizard

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Key Dependencies (`requirements.txt`)
```
torch
torchvision
transformers
gdal
rasterio
open3d
trimesh
numpy
opencv-python
fastapi
uvicorn
```

---

## 🚀 Usage

### 1. Generate DSM from a single image
```bash
python src/inference.py --input data/raw_images/sample.tif --output outputs/sample_dsm.tif
```

### 2. Generate 3D mesh from DSM
```bash
python src/mesh_generation.py --dsm outputs/sample_dsm.tif --output outputs/sample_mesh.obj
```

### 3. Launch 3D visualization platform
```bash
cd visualization/web
npm install
npm start
# Upload sample_mesh.obj / sample_dsm.tif in the browser UI to fly through the terrain
```

### 4. Validate against reference elevation
```bash
python validation/metrics.py --predicted outputs/sample_dsm.tif --reference data/srtm_dem/reference.tif
```

---

## 📊 Validation & Metrics

Model accuracy is validated by comparing predicted DSM values against reference SRTM/ground-truth elevation using:

- **RMSE (Root Mean Square Error)** — primary accuracy metric
- **MAE (Mean Absolute Error)**
- **Correlation coefficient** between predicted and reference elevation

| Metric | Target |
|---|---|
| RMSE | < 5–10 m (domain dependent) |
| Visual terrain consistency | Qualitative flythrough validation |

---

## 🌍 Applications

- Rapid terrain modeling in **disaster-hit or inaccessible regions**
- **Urban planning** and infrastructure simulation
- **Defense** reconnaissance and terrain analysis
- **Agriculture** — slope and drainage estimation
- Cost-effective alternative to LiDAR/stereo survey for early-stage mapping

---

## 🔮 Future Scope

- Multi-resolution support for very high-resolution satellite imagery
- Real-time inference optimization for edge deployment
- Integration with live satellite feeds (ISRO Bhuvan / Sentinel Hub APIs)
- Support for temporal change detection (elevation drift over time)

---

## 👥 Team

| Role | Name |
|---|---|
| Team Lead | — |
| ML Engineer | — |
| Geospatial Developer | — |
| 3D/Frontend Developer | — |

---

## 📄 License

This project is developed for **Smart India Hackathon (SIH) 2026** under problem statement **SIH26175**, proposed by **ISRO**.

---

## 🙏 Acknowledgements

- ISRO — Problem Statement provider
- SRTM (Shuttle Radar Topography Mission) — reference elevation data
- Depth Anything V2 / MiDaS / ZoeDepth — open-source monocular depth models