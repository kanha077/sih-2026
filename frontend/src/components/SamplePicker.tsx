import { MapPin, Play } from 'lucide-react';
import { SampleItem } from '../types';

interface SamplePickerProps {
  samples: SampleItem[];
  isLoading: boolean;
  onSelectSample: (sampleId: string) => void;
}

export const SamplePicker: React.FC<SamplePickerProps> = ({
  samples,
  isLoading,
  onSelectSample,
}) => {
  if (!samples || samples.length === 0) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-topo-ochre inline-block" />
          <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-topo-ink">
            Survey Plate Catalog // 1-Click Verification
          </h3>
        </div>
        <span className="text-[11px] font-mono text-topo-inkDim hidden sm:block">
          Select any plate for instantaneous CPU/GPU elevation synthesis
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {samples.map((sample, idx) => (
          <div
            key={sample.id}
            onClick={() => !isLoading && onSelectSample(sample.id)}
            className={`group relative rounded-sm bg-topo-panel border border-topo-border hover:border-topo-ochre transition-all cursor-pointer flex flex-col justify-between overflow-hidden reticle-box ${
              isLoading ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            {/* Thumbnail Viewport */}
            <div className="relative h-28 w-full overflow-hidden bg-topo-canvas">
              <img
                src={sample.thumbnail_url}
                alt={sample.name}
                className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-topo-panel via-transparent to-transparent" />
              
              {/* Plate Tag */}
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-sm bg-topo-canvas/90 border border-topo-border text-[9px] font-mono font-bold text-topo-ochre">
                PLATE #{String(idx + 1).padStart(2, '0')} &bull; {sample.category}
              </div>

              {/* Hover Trigger */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-topo-canvas/60">
                <div className="px-2.5 py-1 rounded-sm bg-topo-ochre text-topo-canvas font-mono font-bold text-xs flex items-center gap-1.5 shadow-lg">
                  <Play className="w-3 h-3 fill-current" />
                  <span>SYNTHESIZE</span>
                </div>
              </div>
            </div>

            {/* Info Cadastral Notation */}
            <div className="p-3">
              <h4 className="text-xs font-bold text-topo-ink group-hover:text-topo-ochre transition-colors truncate">
                {sample.name}
              </h4>
              <p className="text-[11px] text-topo-inkMuted mt-1 line-clamp-2 leading-relaxed">
                {sample.description}
              </p>
              
              <div className="mt-2.5 pt-2 border-t border-topo-border/50 flex items-center justify-between text-[10px] font-mono text-topo-inkDim">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-topo-ochre" />
                  {sample.default_lat.toFixed(2)}&deg;N, {sample.default_lon.toFixed(2)}&deg;E
                </span>
                <span className="text-topo-ochre group-hover:underline">
                  Load &rarr;
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
