import React from 'react';
import { X, Compass, Satellite, Cpu, Layers, ArrowRight } from 'lucide-react';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md">
      <div 
        className="relative w-full max-w-4xl bg-topo-panel border border-topo-border p-6 sm:p-8 shadow-2xl reticle-box overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-sm bg-topo-canvas text-topo-inkMuted hover:text-topo-ink transition-colors"
          title="Close Dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-topo-border">
          <div className="p-2 rounded-sm bg-topo-canvas border border-topo-border text-topo-ochre">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-display text-topo-ink">
              Understanding Elevation: Preview vs Calibrated Mode
            </h2>
            <p className="text-xs font-mono text-topo-inkDim mt-0.5">
              Technical distinction between monocular relative depth and geodetic surveying
            </p>
          </div>
        </div>

        {/* 2-State Comparison Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          
          {/* State 1: Preview Mode (Current) */}
          <div className="p-5 rounded-sm bg-topo-canvas border border-topo-ochre/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-sm bg-topo-ochre/15 text-topo-ochre border border-topo-ochre/30 text-xs font-mono font-bold">
                  PREVIEW MODE [CURRENT]
                </span>
                <Cpu className="w-4 h-4 text-topo-ochre" />
              </div>

              <h3 className="text-base font-bold font-display text-topo-ink mb-2">
                Relative Elevation Units (0 to 100)
              </h3>

              <p className="text-sm font-sans text-topo-inkMuted leading-relaxed">
                DepthWizard runs the Depth Anything V2 deep neural network to estimate relative surface depth directly from visual cues (perspective, texture gradients, and occlusion). The output is normalized to an illustrative 0 to 100 relative elevation scale.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-topo-border/60 space-y-1.5 font-mono text-xs text-topo-inkMuted">
              <div className="flex items-center gap-2 text-topo-ink">
                <span className="text-topo-ochre font-bold">&bull;</span>
                <span><strong>File format:</strong> Standard 32-bit Float GeoTIFF (.tif)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-topo-ochre font-bold">&bull;</span>
                <span><strong>Spatial datum:</strong> EPSG:4326 (WGS84)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-topo-ochre font-bold">&bull;</span>
                <span><strong>Speed:</strong> Instant CPU/GPU inference (~300ms)</span>
              </div>
            </div>
          </div>

          {/* State 2: Calibrated Mode (Roadmap) */}
          <div className="p-5 rounded-sm bg-topo-canvas border border-topo-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-sm bg-topo-terra/15 text-topo-terra border border-topo-terra/30 text-xs font-mono font-bold">
                  CALIBRATED MODE [ACTIVE]
                </span>
                <Satellite className="w-4 h-4 text-topo-terra" />
              </div>

              <h3 className="text-base font-bold font-display text-topo-ink mb-2">
                Orthometric Heights (Meters Above Sea Level)
              </h3>

              <p className="text-sm font-sans text-topo-inkMuted leading-relaxed">
                GEOSCALE calibration converts relative depth into true metric heights MSL. By extracting EXIF GPS coordinates (or manual lat/lon anchors) and fetching reference DEM tiles (USGS/Copernicus), robust RANSAC linear regression fits the elevation map directly to real-world meters.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-topo-border/60 space-y-1.5 font-mono text-xs text-topo-inkMuted">
              <div className="flex items-center gap-2 text-topo-ink">
                <span className="text-topo-terra font-bold">&bull;</span>
                <span><strong>File format:</strong> Metric DEM in geodetic meters (m)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-topo-terra font-bold">&bull;</span>
                <span><strong>Method:</strong> EXIF telemetry + Reference DEM fusion</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-topo-terra font-bold">&bull;</span>
                <span><strong>Use cases:</strong> Volumetric surveys &amp; GIS hydrology</span>
              </div>
            </div>
          </div>

        </div>

        {/* Calibration Bridge Workflow Connector */}
        <div className="p-3.5 rounded-sm bg-topo-canvas border border-topo-border mb-6">
          <div className="text-xs font-mono text-topo-ochre uppercase font-bold mb-2">
            HOW CALIBRATION WILL WORK
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs font-mono text-topo-inkMuted">
            <div className="p-2 rounded-sm bg-topo-panel border border-topo-border text-center sm:text-left">
              <span className="text-topo-ochre font-bold block">1. Relative Depth (0–100)</span>
              <span className="text-[11px] text-topo-inkDim font-sans">Monocular AI disparity estimation</span>
            </div>

            <div className="flex items-center justify-center text-topo-inkDim">
              <ArrowRight className="w-4 h-4 hidden sm:block" />
              <span className="sm:hidden">&darr;</span>
            </div>

            <div className="p-2 rounded-sm bg-topo-panel border border-topo-border text-center sm:text-left">
              <span className="text-topo-sand font-bold block">2. EXIF + Reference DEM</span>
              <span className="text-[11px] text-topo-inkDim font-sans">Focal length &amp; SRTM ground-truth</span>
            </div>

            <div className="flex items-center justify-center text-topo-inkDim">
              <ArrowRight className="w-4 h-4 hidden sm:block" />
              <span className="sm:hidden">&darr;</span>
            </div>

            <div className="p-2 rounded-sm bg-topo-panel border border-topo-border text-center sm:text-left">
              <span className="text-topo-terra font-bold block">3. True Meters (DEM)</span>
              <span className="text-[11px] text-topo-inkDim font-sans">Absolute orthometric height</span>
            </div>
          </div>
        </div>

        {/* Surveyor Summary Takeaway */}
        <div className="p-4 rounded-sm bg-topo-canvas border border-topo-border text-sm font-sans text-topo-ink flex items-start gap-3">
          <Layers className="w-5 h-5 text-topo-ochre shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-topo-ochre font-mono text-xs uppercase block mb-1">
              SURVEYOR SUMMARY FOR DEMOS:
            </strong>
            DepthWizard's GeoTIFF file is a genuine 32-bit floating point raster with embedded affine geotransforms. You can drag and drop it directly into GIS software (QGIS, ArcGIS, or GDAL) for immediate 3D visualization and topographical contour analysis.
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-sm bg-topo-ochre text-topo-canvas font-mono font-bold text-xs hover:bg-topo-ochre/90 transition-colors"
          >
            RETURN TO WORKBENCH
          </button>
        </div>

      </div>
    </div>
  );
};
