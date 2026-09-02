import { Target, MapPin } from 'lucide-react';

interface HeroProps {
  onScrollToUpload: () => void;
  onSelectPreset: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onScrollToUpload, onSelectPreset }) => {
  return (
    <div className="relative border-b border-topo-border bg-topo-canvas/60 py-10 sm:py-14 survey-grid-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          
          {/* Cadastral Header Tag */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-topo-panel border border-topo-border text-xs font-mono text-topo-ochre mb-4">
            <span className="w-2 h-2 bg-topo-ochre inline-block" />
            <span>OPTICAL PHOTOGRAMMETRY &bull; GEOSPATIAL TERRAIN SYNTHESIZER</span>
          </div>

          {/* Headline */}
          <h1 className="text-2xl sm:text-4xl font-extrabold font-display tracking-tight text-topo-ink leading-tight">
            Turn Any 2D Photograph into a Georeferenced 3D Elevation Model
          </h1>

          {/* Body */}
          <p className="mt-3 text-sm sm:text-base font-sans text-topo-inkMuted leading-relaxed max-w-2xl">
            Synthesize 32-bit floating point GIS GeoTIFFs (EPSG:4326), interactive 3D Wavefront meshes, and hypsometric terrain contours directly from single satellite, aerial, or landscape photographs.
          </p>

          {/* Technical Telemetry Badges */}
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-mono text-topo-inkMuted">
            <div className="px-2.5 py-1 rounded-sm bg-topo-panel border border-topo-border flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-topo-ochre" />
              <span>Depth Anything V2 Monocular AI</span>
            </div>

            <div className="px-2.5 py-1 rounded-sm bg-topo-panel border border-topo-border flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-topo-terra" />
              <span>Rasterio 32-bit Float GeoTIFF</span>
            </div>

            <div className="px-2.5 py-1 rounded-sm bg-topo-panel border border-topo-border flex items-center gap-1.5">
              <span className="text-topo-pine font-bold">&bull;</span>
              <span>Three.js Real-Time Vertex Shading</span>
            </div>
          </div>

          {/* Call to Actions */}
          <div className="mt-7 flex flex-wrap items-center gap-3 font-mono text-xs">
            <button
              onClick={onScrollToUpload}
              className="px-5 py-2.5 rounded-sm bg-topo-ochre hover:bg-topo-ochre/90 text-topo-canvas font-bold transition-colors flex items-center gap-2 shadow-lg"
            >
              <Target className="w-4 h-4" />
              <span>INGEST CUSTOM 2D IMAGE</span>
            </button>

            <button
              onClick={onSelectPreset}
              className="px-4 py-2.5 rounded-sm bg-topo-panel hover:bg-topo-surface border border-topo-border text-topo-ink transition-colors flex items-center gap-2"
            >
              <span>1-CLICK SAMPLE DEMO</span>
              <span className="text-topo-ochre">&rarr;</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
