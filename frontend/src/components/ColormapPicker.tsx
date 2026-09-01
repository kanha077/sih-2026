import React from 'react';
import { ColormapType } from '../types';
import { Palette } from 'lucide-react';

interface ColormapPickerProps {
  currentColormap: ColormapType;
  onChange: (colormap: ColormapType) => void;
  availableColormaps?: string[];
}

interface ColormapDef {
  id: ColormapType;
  label: string;
  gradient: string;
}

export const ColormapPicker: React.FC<ColormapPickerProps> = ({
  currentColormap,
  onChange,
}) => {
  const colormaps: ColormapDef[] = [
    {
      id: 'terrain',
      label: 'Topographic Terrain',
      gradient: 'from-[#194d23] via-[#dce775] via-[#6d4c41] to-[#ffffff]',
    },
    {
      id: 'viridis',
      label: 'Viridis Scientific',
      gradient: 'from-[#440154] via-[#21918c] to-[#fde725]',
    },
    {
      id: 'plasma',
      label: 'Plasma Thermal',
      gradient: 'from-[#0d0887] via-[#cc4778] to-[#f0f921]',
    },
    {
      id: 'grayscale',
      label: 'Monochrome Disparity',
      gradient: 'from-black via-gray-500 to-white',
    },
    {
      id: 'magma',
      label: 'Magma Geological',
      gradient: 'from-[#000004] via-[#b73779] to-[#fcfdbf]',
    },
    {
      id: 'turbo',
      label: 'Turbo High-Dynamic',
      gradient: 'from-[#30123b] via-[#28bbec] via-[#a2fc3c] to-[#7a0403]',
    },
  ];

  return (
    <div className="rounded-sm bg-topo-panel border border-topo-border p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-topo-border">
        <Palette className="w-3.5 h-3.5 text-topo-ochre" />
        <h4 className="text-xs font-mono font-bold uppercase text-topo-ink">
          HYPSOMETRIC RELIEF PALETTES
        </h4>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {colormaps.map((cmap) => {
          const isSelected = currentColormap === cmap.id;
          return (
            <button
              key={cmap.id}
              onClick={() => onChange(cmap.id)}
              className={`flex flex-col p-2 rounded-sm border text-left transition-colors ${
                isSelected
                  ? 'bg-topo-surface border-topo-ochre'
                  : 'bg-topo-canvas border-topo-border hover:border-topo-borderFocus'
              }`}
            >
              <div className={`h-2.5 w-full bg-gradient-to-r ${cmap.gradient} mb-1.5 border border-topo-border`} />
              <span className={`text-[11px] font-mono truncate ${isSelected ? 'text-topo-ochre font-bold' : 'text-topo-inkMuted'}`}>
                {cmap.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
