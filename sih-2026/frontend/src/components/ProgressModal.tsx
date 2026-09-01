import React from 'react';
import { Target, AlertCircle, Check, Activity } from 'lucide-react';
import { JobStatus } from '../types';

interface ProgressModalProps {
  status: JobStatus | null;
  isOpen: boolean;
  onCancel?: () => void;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({ status, isOpen }) => {
  if (!isOpen || !status) return null;

  const progress = status.progress || 0;
  const isError = status.status === 'error';

  const stages = [
    { label: 'OPTICAL INGESTION & TENSOR CONVERSION', minProg: 15 },
    { label: 'MIDAS MONOCULAR DISPARITY ESTIMATION', minProg: 35 },
    { label: 'RASTERIO 32-BIT GEOTIFF DEM SYNTHESIS', minProg: 65 },
    { label: 'HYPSOMETRIC RELIEF & COLORMAP SHADING', minProg: 80 },
    { label: '3D WAVEFRONT TERRAIN MESH GENERATION', minProg: 92 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-topo-panel border border-topo-border p-6 shadow-2xl reticle-box">
        
        {/* Header telemetry */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-topo-border">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-topo-ochre">
            <Target className="w-4 h-4 animate-spin-slow" />
            <span>TOPOGRAPHICAL PROCESSOR ENGINE</span>
          </div>
          <span className="text-[10px] font-mono text-topo-inkMuted">
            {isError ? 'PROCESS TERMINATED' : 'EXECUTING CPU/GPU PIPELINE'}
          </span>
        </div>

        {/* Progress Value Readout */}
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-xs font-mono text-topo-ink truncate">
            {status.message || 'Processing terrain model...'}
          </span>
          <span className="text-base font-mono font-bold text-topo-ochre ml-2">
            {progress}%
          </span>
        </div>

        {/* Technical Progress Track */}
        <div className="w-full h-2 bg-topo-canvas border border-topo-border mb-5 overflow-hidden">
          <div
            className="h-full bg-topo-ochre transition-all duration-300"
            style={{ width: `${Math.max(4, progress)}%` }}
          />
        </div>

        {/* Telemetry Stage Sequence */}
        {!isError ? (
          <div className="space-y-1.5 font-mono text-[11px]">
            {stages.map((stg, idx) => {
              const isDone = progress >= stg.minProg;
              const isCurrent = progress < stg.minProg && (idx === 0 || progress >= stages[idx - 1].minProg);

              return (
                <div
                  key={stg.label}
                  className={`flex items-center justify-between p-2 rounded-sm border ${
                    isDone
                      ? 'bg-topo-surface border-topo-border text-topo-ink'
                      : isCurrent
                      ? 'bg-topo-canvas border-topo-ochre/60 text-topo-ochre'
                      : 'bg-topo-panel border-transparent text-topo-inkDim'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] font-bold text-topo-inkDim">
                      [{String(idx + 1).padStart(2, '0')}]
                    </span>
                    <span className="truncate">{stg.label}</span>
                  </div>

                  <div className="shrink-0 text-[10px]">
                    {isDone ? (
                      <span className="text-topo-ochre flex items-center gap-1 font-bold">
                        <Check className="w-3 h-3" /> OK
                      </span>
                    ) : isCurrent ? (
                      <span className="text-topo-ochre flex items-center gap-1 animate-pulse">
                        <Activity className="w-3 h-3" /> ACTIVE
                      </span>
                    ) : (
                      <span className="text-topo-inkDim">QUEUED</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 font-mono text-xs">
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>DIAGNOSTIC ERROR REPORT:</span>
            </div>
            <p className="text-[11px] text-red-200">{status.error || 'Pipeline encountered an unexpected fault.'}</p>
          </div>
        )}

      </div>
    </div>
  );
};
