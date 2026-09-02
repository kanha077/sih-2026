import React from 'react';
import { UploadCloud, Cpu, Layers, Mountain, X } from 'lucide-react';

interface HowItWorksProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorks: React.FC<HowItWorksProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    {
      num: '01',
      icon: <UploadCloud className="w-4 h-4 text-topo-ochre" />,
      title: 'Raster Ingestion & Pre-Processing',
      description: 'The uploaded image undergoes MIME validation, Pillow byte inspection, and RGB normalization to prepare the input tensor for inference.'
    },
    {
      num: '02',
      icon: <Cpu className="w-4 h-4 text-topo-sand" />,
      title: 'Depth Anything V2 Monocular Disparity Estimation',
      description: 'A deep neural network estimates dense relative depth maps in ~300ms, mapping optical cues (texture gradients, occlusion, perspective) to surface distance.'
    },
    {
      num: '03',
      icon: <Layers className="w-4 h-4 text-topo-terra" />,
      title: '32-Bit GeoTIFF DEM Rasterization',
      description: 'Values are normalized to 0–100 relative elevation units and written via Rasterio as single-band float GeoTIFFs with EPSG:4326 CRS and affine geotransforms.'
    },
    {
      num: '04',
      icon: <Mountain className="w-4 h-4 text-topo-pine" />,
      title: 'Three.js Vertex Displacement & Shaders',
      description: 'A triangulated plane mesh displaces vertices in the Z-axis according to the elevation matrix, simulating directional sun hillshade lighting in real time.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md">
      <div 
        className="relative w-full max-w-3xl bg-topo-panel border border-topo-border p-6 sm:p-8 shadow-2xl reticle-box overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-sm bg-topo-canvas text-topo-inkMuted hover:text-topo-ink transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="mb-5 pb-3 border-b border-topo-border">
          <h2 className="text-base font-bold font-display text-topo-ink">
            Survey Instrument Schematic // Processing Architecture
          </h2>
          <p className="text-[11px] font-mono text-topo-inkDim mt-0.5">
            End-to-end computational pipeline from 2D optical pixels to GIS DEM raster &amp; 3D mesh
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {steps.map((step) => (
            <div key={step.num} className="p-3.5 rounded-sm bg-topo-canvas border border-topo-border flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-topo-border/50">
                  <div className="flex items-center gap-2">
                    {step.icon}
                    <span className="text-xs font-mono font-bold text-topo-ink">{step.title}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-topo-inkDim">STAGE {step.num}</span>
                </div>
                <p className="text-xs text-topo-inkMuted leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-sm bg-topo-ochre text-topo-canvas font-mono font-bold text-xs hover:bg-topo-ochre/90 transition-colors"
          >
            CLOSE SCHEMATIC
          </button>
        </div>
      </div>
    </div>
  );
};
