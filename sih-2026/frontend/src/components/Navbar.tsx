import React from 'react';
import { Compass, Info, Sun, Moon, Layers, RefreshCw } from 'lucide-react';

interface NavbarProps {
  onOpenCalibration: () => void;
  onOpenHowItWorks: () => void;
  onOpenHistory: () => void;
  historyCount: number;
  onNewScan: () => void;
  hasResult: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  calibrationMode?: 'preview' | 'calibrated' | string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCalibration,
  onOpenHowItWorks,
  onOpenHistory,
  historyCount,
  onNewScan,
  hasResult,
  theme,
  onToggleTheme,
  calibrationMode = 'preview',
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-topo-border bg-topo-panel/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Left: Cartographic Branding */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onNewScan}>
          <div className="p-1.5 rounded-sm bg-topo-canvas border border-topo-border text-topo-ochre">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-tight text-topo-ink">
                DEPTHWIZARD
              </span>
              <span className="px-1.5 py-0.2 rounded-none bg-topo-surface border border-topo-border text-[9px] font-mono text-topo-ochre font-bold">
                DEM ENGINE v1.0
              </span>
            </div>
            <p className="text-[10px] font-mono text-topo-inkDim hidden sm:block">
              Monocular Optical Imagery &rarr; 32-bit GeoTIFF &amp; 3D Terrain
            </p>
          </div>
        </div>

        {/* Center: Datum Indicator */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-sm bg-topo-canvas border border-topo-border text-xs font-mono text-topo-inkMuted">
          <span className={`w-1.5 h-1.5 rounded-full ${calibrationMode === 'calibrated' ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
          <span>
            {calibrationMode === 'calibrated'
              ? 'DATUM: WGS84-CALIBRATED'
              : 'DATUM: WGS84-PREVIEW'}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {hasResult && (
            <button
              onClick={onNewScan}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-topo-surface hover:bg-topo-canvas border border-topo-border text-xs font-mono text-topo-ink transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-topo-ochre" />
              <span className="hidden sm:inline">New Survey</span>
            </button>
          )}

          <button
            onClick={onOpenHowItWorks}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-topo-surface hover:bg-topo-canvas border border-topo-border text-xs font-mono text-topo-inkMuted hover:text-topo-ink transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-topo-ochre" />
            <span className="hidden sm:inline">Schematic</span>
          </button>

          <button
            onClick={onOpenCalibration}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-topo-surface hover:bg-topo-canvas border border-topo-border text-xs font-mono text-topo-inkMuted hover:text-topo-ink transition-colors"
          >
            <Compass className="w-3.5 h-3.5 text-topo-ochre" />
            <span className="hidden sm:inline">Datum Scale</span>
          </button>

          <button
            onClick={onOpenHistory}
            className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-topo-surface hover:bg-topo-canvas border border-topo-border text-xs font-mono text-topo-inkMuted hover:text-topo-ink transition-colors"
            title="Survey History"
          >
            <Layers className="w-3.5 h-3.5 text-topo-ochre" />
            <span className="hidden sm:inline">Archive</span>
            {historyCount > 0 && (
              <span className="ml-0.5 px-1 py-0.2 rounded-none bg-topo-ochre text-topo-canvas text-[9px] font-bold">
                {historyCount}
              </span>
            )}
          </button>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-sm bg-topo-surface hover:bg-topo-canvas border border-topo-border text-topo-inkMuted hover:text-topo-ink transition-colors"
            title={theme === 'dark' ? 'Switch to Light Topographic Paper' : 'Switch to Dark Field Slate'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-topo-ochre" />
            ) : (
              <Moon className="w-4 h-4 text-topo-ochre" />
            )}
          </button>
        </div>

      </div>
    </header>
  );
};
