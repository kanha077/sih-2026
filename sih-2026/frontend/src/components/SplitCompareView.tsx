import React from 'react';
import { ReactCompareSlider, ReactCompareSliderImage, ReactCompareSliderHandle } from 'react-compare-slider';

interface SplitCompareViewProps {
  originalUrl: string;
  elevationUrl: string;
  colormapLabel?: string;
}

export const SplitCompareView: React.FC<SplitCompareViewProps> = ({
  originalUrl,
  elevationUrl,
  colormapLabel = 'Hypsometric Elevation DEM',
}) => {
  return (
    <div className="relative w-full h-[520px] sm:h-[600px] rounded-sm overflow-hidden bg-topo-canvas border border-topo-border shadow-xl flex items-center justify-center reticle-box">
      
      {/* Floating Cadastral Labels */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none">
        <span className="px-2.5 py-1 rounded-sm bg-topo-panel/95 border border-topo-border text-xs font-mono text-topo-ink">
          2D OPTICAL SOURCE
        </span>
      </div>

      <div className="absolute top-3 right-3 z-20 pointer-events-none">
        <span className="px-2.5 py-1 rounded-sm bg-topo-panel/95 border border-topo-ochre/50 text-xs font-mono text-topo-ochre">
          {colormapLabel.toUpperCase()}
        </span>
      </div>

      <div className="w-full h-full flex items-center justify-center p-3">
        <ReactCompareSlider
          itemOne={
            <ReactCompareSliderImage
              src={originalUrl}
              alt="Original 2D Photo"
              className="w-full h-full object-contain rounded-none max-h-[560px]"
            />
          }
          itemTwo={
            <ReactCompareSliderImage
              src={elevationUrl}
              alt="Elevation Model"
              className="w-full h-full object-contain rounded-none max-h-[560px]"
            />
          }
          handle={
            <ReactCompareSliderHandle
              buttonStyle={{
                background: '#E5A93C',
                border: '2px solid #0F1318',
                boxShadow: 'none',
                color: '#0F1318',
                borderRadius: '2px',
                width: 32,
                height: 32,
              }}
              linesStyle={{
                backgroundColor: '#E5A93C',
                width: 1.5,
              }}
            />
          }
          className="w-full h-full max-h-[560px] rounded-none overflow-hidden flex items-center justify-center"
        />
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <span className="px-3 py-1 rounded-sm bg-topo-panel/95 border border-topo-border text-[10px] font-mono text-topo-inkDim">
          SLIDE TO COMPARE OPTICAL VS TOPOGRAPHICAL ELEVATION
        </span>
      </div>
    </div>
  );
};
