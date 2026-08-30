# Technical Documentation - DepthWizard

## Pipeline Architecture

DepthWizard converts a single 2D optical remote-sensing image into a metric 3D elevation model (DSM) and provides a navigable 3D flythrough visualization.

### 1. Elevation Estimation Module
- Uses state-of-the-art monocular depth estimation backbones (e.g. Depth Anything V2, ZoeDepth, or MiDaS).
- Outputs a relative depth map.

### 2. Scale Calibration Module
- Applies robust RANSAC-based scale and offset calibration against co-registered SRTM DEM reference data.
- Translates relative depth into metric heights (meters).

### 3. Mesh Generation & 3D Visualization
- Converts the calibrated DSM into a 3D polygonal mesh.
- Provides interactive flythrough controls using web-based 3D libraries (Three.js/Babylon.js) or Unity.
