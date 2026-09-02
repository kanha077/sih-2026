import React from 'react';
import { Download, Layers, Mountain, Box, FileText } from 'lucide-react';
import { JobResult, ColormapType } from '../types';
import { getDownloadUrl } from '../services/api';

interface DownloadSuiteProps {
  result: JobResult;
  currentColormap: ColormapType;
}

export const DownloadSuite: React.FC<DownloadSuiteProps> = ({ result, currentColormap }) => {
  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `depthwizard_${result.job_id}_cadastral_metadata.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="rounded-sm bg-topo-panel border border-topo-border p-4 font-mono text-xs">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-topo-border">
        <Download className="w-3.5 h-3.5 text-topo-ochre" />
        <h3 className="font-bold text-topo-ink uppercase">
          CARTOGRAPHIC ARTIFACT EXPORT
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        
        {/* GeoTIFF DEM */}
        <a
          href={getDownloadUrl(result.job_id, 'geotiff')}
          download
          className="flex items-center justify-between p-2.5 rounded-sm bg-topo-canvas border border-topo-ochre/40 hover:border-topo-ochre text-topo-ink hover:text-topo-ochre transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <Layers className="w-4 h-4 text-topo-ochre shrink-0" />
            <div className="truncate">
              <div className="font-bold text-xs truncate">GIS GeoTIFF DEM</div>
              <div className="text-[10px] text-topo-inkDim font-sans">32-bit Float Raster</div>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded-sm bg-topo-ochre/20 text-topo-ochre text-[10px] font-bold">
            .TIF
          </span>
        </a>

        {/* 3D Wavefront / SAT3DGEN Mesh OBJ */}
        <a
          href={result.sat3dgen_mesh_url || getDownloadUrl(result.job_id, 'mesh')}
          download
          className="flex items-center justify-between p-2.5 rounded-sm bg-topo-canvas border border-topo-border hover:border-topo-borderFocus text-topo-ink hover:text-topo-sand transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <Box className="w-4 h-4 text-topo-sand shrink-0" />
            <div className="truncate">
              <div className="font-bold text-xs truncate">
                {result.sat3dgen_mesh_url ? 'SAT3DGEN Surface Mesh' : '3D Terrain Mesh'}
              </div>
              <div className="text-[10px] text-topo-inkDim font-sans">
                {result.sat3dgen_mesh_url ? 'Poisson Point Cloud Mesh' : 'Wavefront with UVs'}
              </div>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded-sm bg-topo-panel border border-topo-border text-topo-inkMuted text-[10px] font-bold">
            .OBJ
          </span>
        </a>

        {/* Hypsometric Color PNG */}
        <a
          href={getDownloadUrl(result.job_id, currentColormap)}
          download
          className="flex items-center justify-between p-2.5 rounded-sm bg-topo-canvas border border-topo-border hover:border-topo-borderFocus text-topo-ink hover:text-topo-terra transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <Mountain className="w-4 h-4 text-topo-terra shrink-0" />
            <div className="truncate">
              <div className="font-bold text-xs truncate capitalize">{currentColormap} Map</div>
              <div className="text-[10px] text-topo-inkDim font-sans">Colorized Elevation PNG</div>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded-sm bg-topo-panel border border-topo-border text-topo-inkMuted text-[10px] font-bold">
            .PNG
          </span>
        </a>

        {/* Metadata JSON */}
        <button
          onClick={handleDownloadJson}
          className="flex items-center justify-between p-2.5 rounded-sm bg-topo-canvas border border-topo-border hover:border-topo-borderFocus text-topo-ink hover:text-topo-ochre transition-colors text-left"
        >
          <div className="flex items-center gap-2 truncate">
            <FileText className="w-4 h-4 text-topo-inkMuted shrink-0" />
            <div className="truncate">
              <div className="font-bold text-xs truncate">Survey Metadata</div>
              <div className="text-[10px] text-topo-inkDim font-sans">Cadastral GeoJSON Spec</div>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded-sm bg-topo-panel border border-topo-border text-topo-inkMuted text-[10px] font-bold">
            .JSON
          </span>
        </button>

      </div>
    </div>
  );
};
