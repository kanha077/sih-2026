import React, { useState } from 'react';
import { JobResult, ColormapType, ViewMode } from '../types';
import { Terrain3DViewer } from './Terrain3DViewer';
import { SplitCompareView } from './SplitCompareView';
import { ColormapPicker } from './ColormapPicker';
import { StatsCard } from './StatsCard';
import { DownloadSuite } from './DownloadSuite';
import { Mountain, Split, Columns, Eye, Info, Check } from 'lucide-react';

interface ResultsViewerProps {
  result: JobResult;
  onOpenCalibration: () => void;
  onNewScan?: () => void;
  theme?: 'dark' | 'light';
}

export const ResultsViewer: React.FC<ResultsViewerProps> = ({
  result,
  onOpenCalibration,
  theme,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [currentColormap, setCurrentColormap] = useState<ColormapType>('terrain');
  const [singleMapTab, setSingleMapTab] = useState<'original' | 'elevation' | 'depth'>('elevation');

  const currentElevationUrl =
    result.colored_png_urls[currentColormap] ||
    result.colored_png_urls['terrain'] ||
    result.depth_png_url;

  const colormapNames: Record<ColormapType, string> = {
    terrain: 'Topographic Terrain',
    viridis: 'Viridis Scientific',
    plasma: 'Plasma Thermal',
    grayscale: 'Monochrome Disparity',
    magma: 'Magma Geological',
    turbo: 'Turbo High-Dynamic',
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      
      {/* Top Telemetry Strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-sm bg-topo-panel border border-topo-border font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-sm bg-topo-ochre text-topo-canvas">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
          <div>
            <span className="font-bold text-topo-ink">
              DEM SYNTHESIS COMPLETE // {result.stats.width}&times;{result.stats.height} PX
            </span>
            <span className="text-topo-inkDim ml-2 hidden sm:inline">
              LATENCY: {result.stats.processing_time_ms} ms &bull; CRS: {result.stats.crs}
            </span>
          </div>
        </div>

        <button
          onClick={onOpenCalibration}
          className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-topo-canvas border border-topo-border text-[11px] text-topo-inkMuted hover:text-topo-ochre transition-colors"
        >
          <Info className="w-3.5 h-3.5 text-topo-ochre" />
          <span>GEODETIC SCALE EXPLANATION</span>
        </button>
      </div>

      {/* Primary Cartographic Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* Left Column: Dominant Viewport Workbench (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          
          {/* View Mode Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-topo-border">
            <div className="flex items-center gap-1 p-0.5 rounded-sm bg-topo-panel border border-topo-border font-mono text-xs">
              
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-sm transition-colors ${
                  viewMode === '3d'
                    ? 'bg-topo-ochre text-topo-canvas font-bold'
                    : 'text-topo-inkMuted hover:text-topo-ink'
                }`}
              >
                <Mountain className="w-3.5 h-3.5" />
                <span>3D Terrain Canvas</span>
              </button>

              <button
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-sm transition-colors ${
                  viewMode === 'split'
                    ? 'bg-topo-ochre text-topo-canvas font-bold'
                    : 'text-topo-inkMuted hover:text-topo-ink'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span>Split Optical</span>
              </button>

              <button
                onClick={() => setViewMode('side-by-side')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-sm transition-colors ${
                  viewMode === 'side-by-side'
                    ? 'bg-topo-ochre text-topo-canvas font-bold'
                    : 'text-topo-inkMuted hover:text-topo-ink'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Ortho Comparison</span>
              </button>

              <button
                onClick={() => setViewMode('single')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-sm transition-colors ${
                  viewMode === 'single'
                    ? 'bg-topo-ochre text-topo-canvas font-bold'
                    : 'text-topo-inkMuted hover:text-topo-ink'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Single Raster</span>
              </button>

            </div>

            <span className="text-[11px] font-mono text-topo-inkDim hidden sm:block">
              ACTIVE PALETTE: <strong className="text-topo-ochre">{colormapNames[currentColormap].toUpperCase()}</strong>
            </span>
          </div>

          {/* Active Viewport */}
          <div className="w-full">
            {viewMode === '3d' && (
              <Terrain3DViewer
                originalUrl={result.original_url}
                depthUrl={result.depth_png_url}
                elevationUrl={currentElevationUrl}
                colormapLabel={colormapNames[currentColormap]}
                precomputedMeshUrl={result.precomputed_mesh_url}
                theme={theme}
              />
            )}

            {viewMode === 'split' && (
              <SplitCompareView
                originalUrl={result.original_url}
                elevationUrl={currentElevationUrl}
                colormapLabel={colormapNames[currentColormap]}
              />
            )}

            {viewMode === 'side-by-side' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-sm bg-topo-panel border border-topo-border p-3 reticle-box">
                  <span className="block text-[11px] font-mono text-topo-inkDim mb-2">2D OPTICAL SOURCE</span>
                  <div className="h-[400px] flex items-center justify-center bg-topo-canvas overflow-hidden">
                    <img
                      src={result.original_url}
                      alt="Original"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>

                <div className="rounded-sm bg-topo-panel border border-topo-border p-3 reticle-box">
                  <span className="block text-[11px] font-mono text-topo-ochre mb-2">
                    HYPSOMETRIC ELEVATION // {colormapNames[currentColormap].toUpperCase()}
                  </span>
                  <div className="h-[400px] flex items-center justify-center bg-topo-canvas overflow-hidden">
                    <img
                      src={currentElevationUrl}
                      alt="Elevation Map"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'single' && (
              <div className="rounded-sm bg-topo-panel border border-topo-border p-3 reticle-box space-y-2">
                <div className="flex items-center gap-1 font-mono text-xs">
                  <button
                    onClick={() => setSingleMapTab('elevation')}
                    className={`px-2.5 py-1 rounded-sm ${
                      singleMapTab === 'elevation'
                        ? 'bg-topo-ochre text-topo-canvas font-bold'
                        : 'bg-topo-canvas text-topo-inkMuted'
                    }`}
                  >
                    Hypsometric DEM
                  </button>
                  <button
                    onClick={() => setSingleMapTab('original')}
                    className={`px-2.5 py-1 rounded-sm ${
                      singleMapTab === 'original'
                        ? 'bg-topo-ochre text-topo-canvas font-bold'
                        : 'bg-topo-canvas text-topo-inkMuted'
                    }`}
                  >
                    2D Source
                  </button>
                  <button
                    onClick={() => setSingleMapTab('depth')}
                    className={`px-2.5 py-1 rounded-sm ${
                      singleMapTab === 'depth'
                        ? 'bg-topo-ochre text-topo-canvas font-bold'
                        : 'bg-topo-canvas text-topo-inkMuted'
                    }`}
                  >
                    Disparity Map
                  </button>
                </div>

                <div className="h-[520px] flex items-center justify-center bg-topo-canvas overflow-hidden p-2">
                  <img
                    src={
                      singleMapTab === 'elevation'
                        ? currentElevationUrl
                        : singleMapTab === 'original'
                        ? result.original_url
                        : result.depth_png_url
                    }
                    alt="Single View"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cadastral Telemetry & Control Rail (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          
          {/* Cadastral Telemetry */}
          <StatsCard stats={result.stats} onOpenCalibration={onOpenCalibration} />

          {/* Hypsometric Palettes */}
          <ColormapPicker
            currentColormap={currentColormap}
            onChange={(cmap) => setCurrentColormap(cmap)}
          />

          {/* Export Artifacts */}
          <DownloadSuite result={result} currentColormap={currentColormap} />

        </div>

      </div>

    </div>
  );
};
