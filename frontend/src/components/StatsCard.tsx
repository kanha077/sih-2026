import React from 'react';
import { Clock, Globe, BarChart2, Info, AlertTriangle } from 'lucide-react';
import { ElevationStats } from '../types';

interface StatsCardProps {
  stats: ElevationStats;
  onOpenCalibration: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({ stats, onOpenCalibration }) => {
  const megapixels = ((stats.width * stats.height) / 1_000_000).toFixed(2);
  const isCalibrated = stats.elevation_mode === 'calibrated' || stats.calibrated === true;
  const isVerified = stats.is_verified_location !== false;

  return (
    <div className="rounded-sm bg-topo-panel border border-topo-border p-4 font-mono text-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-topo-border">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-topo-ochre" />
          <span className="font-bold text-topo-ink uppercase">
            CADASTRAL TELEMETRY // DEM METRICS
          </span>
        </div>
        <button
          onClick={onOpenCalibration}
          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-sm border transition-colors ${
            isCalibrated
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-topo-ochre/10 border-topo-ochre/30 text-topo-ochre hover:bg-topo-ochre/20'
          }`}
        >
          <span>{isCalibrated ? 'DATUM: CALIBRATED (m)' : 'DATUM: PREVIEW'}</span>
          <Info className="w-3 h-3" />
        </button>
      </div>

      {/* Verification Disclaimer Badge for Demo Samples */}
      {!isVerified && (
        <div className="p-2 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] flex items-start gap-1.5 leading-tight">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-amber-400 uppercase font-bold">Demo Coordinates Disclaimer</strong>
            <span>Demo coordinates for pipeline illustration — not GPS-verified against source photo.</span>
          </div>
        </div>
      )}

      {/* Metrics Key-Value Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        
        {/* Elevation Range */}
        <div className="p-2.5 rounded-sm bg-topo-canvas border border-topo-border">
          <div className="text-[10px] text-topo-inkDim uppercase">ELEVATION RANGE (Z)</div>
          <div className="mt-1 text-sm font-bold text-topo-ochre">
            {stats.min_elevation} – {stats.max_elevation} {isCalibrated ? 'm' : ''}
          </div>
          <div className="text-[9px] text-topo-inkMuted mt-0.5">
            {isCalibrated ? (
              <span className="text-emerald-400 font-bold">
                Orthometric Meters (MSL) {stats.rmse_meters ? `• RMSE: ±${stats.rmse_meters}m` : ''}
              </span>
            ) : (
              '0–100 Relative Units'
            )}
          </div>
        </div>

        {/* Statistical Mean & Deviation */}
        <div className="p-2.5 rounded-sm bg-topo-canvas border border-topo-border">
          <div className="text-[10px] text-topo-inkDim uppercase">MEAN / SPREAD (&sigma;)</div>
          <div className="mt-1 text-sm font-bold text-topo-ink">
            {stats.mean_elevation} {isCalibrated ? 'm' : ''}{' '}
            <span className="text-xs font-normal text-topo-inkDim">(&plusmn;{stats.std_elevation} {isCalibrated ? 'm' : ''})</span>
          </div>
          <div className="text-[9px] text-topo-inkMuted mt-0.5">
            {isCalibrated ? 'Calibrated Surface Variance' : 'Topographical Variance'}
          </div>
        </div>

        {/* Raster Resolution */}
        <div className="p-2.5 rounded-sm bg-topo-canvas border border-topo-border">
          <div className="text-[10px] text-topo-inkDim uppercase">RASTER MATRIX</div>
          <div className="mt-1 text-sm font-bold text-topo-ink">
            {stats.width} &times; {stats.height} px
          </div>
          <div className="text-[9px] text-topo-inkMuted mt-0.5">{megapixels} MP Total Grid</div>
        </div>

        {/* Latency */}
        <div className="p-2.5 rounded-sm bg-topo-canvas border border-topo-border">
          <div className="text-[10px] text-topo-inkDim uppercase">EXECUTION DURATION</div>
          <div className="mt-1 text-sm font-bold text-topo-sand flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{stats.processing_time_ms} ms</span>
          </div>
          <div className="text-[9px] text-topo-inkMuted mt-0.5">
            {isCalibrated ? 'MiDaS + SRTM + GeoTIFF' : 'MiDaS + Rasterio GeoTIFF'}
          </div>
        </div>

      </div>

      {/* Calibration Alpha/Beta Metrics if Calibrated */}
      {isCalibrated && stats.alpha !== undefined && stats.beta !== undefined && (
        <div className="p-2 rounded-sm bg-topo-canvas border border-topo-border text-[10px] text-topo-inkMuted flex items-center justify-between">
          <span className="text-topo-inkDim">REGRESSION FIT:</span>
          <span className="text-emerald-400 font-bold">
            z = {stats.alpha} &bull; z_rel + {stats.beta} m
          </span>
        </div>
      )}

      {/* Geodetic Bounds Spec */}
      {stats.bounds && (
        <div className="p-2 rounded-sm bg-topo-canvas border border-topo-border text-[10px] text-topo-inkMuted space-y-1">
          <div className="flex items-center justify-between text-topo-ink">
            <span className="flex items-center gap-1 font-bold">
              <Globe className="w-3 h-3 text-topo-ochre" />
              CRS: {stats.crs}
            </span>
            <span className={isCalibrated ? 'text-emerald-400 font-bold' : 'text-topo-ochre'}>
              {isCalibrated ? 'SRTM 30m DATUM' : 'WGS84 DATUM'}
            </span>
          </div>
          <div className="text-topo-inkDim">
            BOUNDS: [{stats.bounds.min_lat}&deg;N, {stats.bounds.min_lon}&deg;E] TO [{stats.bounds.max_lat}&deg;N, {stats.bounds.max_lon}&deg;E]
          </div>
        </div>
      )}
    </div>
  );
};
