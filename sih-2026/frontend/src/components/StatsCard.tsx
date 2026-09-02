import { Clock, Globe, BarChart2, Info } from 'lucide-react';
import { ElevationStats } from '../types';

interface StatsCardProps {
  stats: ElevationStats;
  onOpenCalibration: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({ stats, onOpenCalibration }) => {
  const megapixels = ((stats.width * stats.height) / 1_000_000).toFixed(2);

  return (
    <div className="rounded-sm bg-topo-panel border border-topo-border p-4 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-topo-border">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-topo-ochre" />
          <span className="font-bold text-topo-ink uppercase">
            CADASTRAL TELEMETRY // DEM METRICS
          </span>
        </div>
        <button
          onClick={onOpenCalibration}
          className="flex items-center gap-1 text-[10px] text-topo-ochre hover:underline"
        >
          <span>{stats.units === 'meters_msl' ? 'DATUM: CALIBRATED (METERS MSL)' : 'DATUM: PREVIEW [0–100]'}</span>
          <Info className="w-3 h-3" />
        </button>
      </div>

      {/* Metrics Key-Value Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        
        {/* Elevation Range */}
        <div className="p-2.5 rounded-sm bg-topo-canvas border border-topo-border">
          <div className="text-[10px] text-topo-inkDim uppercase">ELEVATION RANGE (Z)</div>
          <div className="mt-1 text-sm font-bold text-topo-ochre">
            {stats.units === 'meters_msl'
              ? `${stats.min_elevation} – ${stats.max_elevation} m MSL`
              : `${stats.min_elevation} – ${stats.max_elevation}`}
          </div>
          <div className="text-[9px] text-topo-inkMuted">
            {stats.units === 'meters_msl'
              ? `Elevation: ${stats.min_elevation}–${stats.max_elevation} m MSL`
              : `Elevation: ${stats.min_elevation}–${stats.max_elevation} (relative units)`}
          </div>
        </div>

        {/* Statistical Mean & Deviation */}
        <div className="p-2.5 rounded-sm bg-topo-canvas border border-topo-border">
          <div className="text-[10px] text-topo-inkDim uppercase">MEAN / SPREAD (&sigma;)</div>
          <div className="mt-1 text-sm font-bold text-topo-ink">
            {stats.mean_elevation} <span className="text-xs font-normal text-topo-inkDim">(&plusmn;{stats.std_elevation})</span>
          </div>
          <div className="text-[9px] text-topo-inkMuted">Topographical Variance</div>
        </div>

        {/* Raster Resolution */}
        <div className="p-2.5 rounded-sm bg-topo-canvas border border-topo-border">
          <div className="text-[10px] text-topo-inkDim uppercase">RASTER MATRIX</div>
          <div className="mt-1 text-sm font-bold text-topo-ink">
            {stats.width} &times; {stats.height} px
          </div>
          <div className="text-[9px] text-topo-inkMuted">{megapixels} MP Total Grid</div>
        </div>

        {/* Latency */}
        <div className="p-2.5 rounded-sm bg-topo-canvas border border-topo-border">
          <div className="text-[10px] text-topo-inkDim uppercase">EXECUTION DURATION</div>
          <div className="mt-1 text-sm font-bold text-topo-sand flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{stats.processing_time_ms} ms</span>
          </div>
          <div className="text-[9px] text-topo-inkMuted">Depth Anything V2 + Rasterio</div>
        </div>

      </div>

      {/* Geodetic Bounds Spec */}
      {stats.bounds && (
        <div className="mt-2.5 p-2 rounded-sm bg-topo-canvas border border-topo-border text-[10px] text-topo-inkMuted space-y-1">
          <div className="flex items-center justify-between text-topo-ink">
            <span className="flex items-center gap-1 font-bold">
              <Globe className="w-3 h-3 text-topo-ochre" />
              CRS: {stats.crs}
            </span>
            <span className="text-topo-ochre">WGS84 DATUM</span>
          </div>
          <div className="text-topo-inkDim">
            BOUNDS: [{stats.bounds.min_lat}&deg;N, {stats.bounds.min_lon}&deg;E] TO [{stats.bounds.max_lat}&deg;N, {stats.bounds.max_lon}&deg;E]
          </div>
        </div>
      )}
    </div>
  );
};
