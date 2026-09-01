import React, { useState, useRef } from 'react';
import { Target, Image as ImageIcon, Sliders, AlertCircle, UploadCloud, X, ArrowRight } from 'lucide-react';
import { AdvancedGeoSettings } from '../types';

interface UploadZoneProps {
  onUpload: (file: File, settings?: AdvancedGeoSettings) => void;
  isLoading: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onUpload, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced Geo Settings
  const [geoSettings, setGeoSettings] = useState<AdvancedGeoSettings>({
    originLat: 37.7749,
    originLon: -122.4194,
    pixelScale: 0.0001,
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (file: File) => {
    setErrorMsg(null);
    const maxBytes = 10 * 1024 * 1024; // 10MB
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];

    if (file.size > maxBytes) {
      setErrorMsg('Payload exceeds maximum file limit of 10MB.');
      return;
    }

    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|tif|tiff)$/i)) {
      setErrorMsg('Unsupported raster format. Expected JPG, PNG, WEBP, or GeoTIFF.');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    onUpload(selectedFile, showAdvanced ? geoSettings : undefined);
  };

  return (
    <div id="upload-section" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div className="rounded-sm bg-topo-panel border border-topo-border p-5 sm:p-6 reticle-box">
        
        {/* Header bar */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-topo-border">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-topo-ink uppercase">
            <Target className="w-4 h-4 text-topo-ochre" />
            <span>OPTICAL IMAGERY INGESTION // TARGETING RETICLE</span>
          </div>
          <span className="text-[10px] font-mono text-topo-inkDim">MAX 10 MB &bull; WGS84 CRS</span>
        </div>

        {/* Upload Dropzone */}
        {!selectedFile ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center p-8 sm:p-12 border border-dashed rounded-sm cursor-pointer transition-all ${
              dragActive
                ? 'border-topo-ochre bg-topo-ochre/5'
                : 'border-topo-border hover:border-topo-ochre/60 bg-topo-canvas/70 hover:bg-topo-canvas'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp, image/tiff"
              onChange={handleChange}
              className="hidden"
            />
            
            <div className="p-3 rounded-sm bg-topo-panel border border-topo-border text-topo-ochre mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>

            <p className="text-sm font-bold text-topo-ink text-center">
              Drop target photograph here, or <span className="text-topo-ochre underline underline-offset-4">browse local storage</span>
            </p>
            <p className="text-[11px] font-mono text-topo-inkDim mt-1 text-center">
              Standard 2D Aerial, Satellite, Landscape, or Architectural imagery (JPG / PNG / WEBP)
            </p>
          </div>
        ) : (
          /* Staged File Loaded Plate */
          <div className="rounded-sm bg-topo-canvas border border-topo-border p-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative w-full sm:w-48 h-32 rounded-sm overflow-hidden bg-topo-panel border border-topo-border shrink-0">
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Target Preview"
                    className="w-full h-full object-cover"
                  />
                )}
                <button
                  onClick={handleClear}
                  className="absolute top-1.5 right-1.5 p-1 rounded-sm bg-topo-canvas/90 hover:bg-red-500 text-topo-ink hover:text-white transition-colors"
                  title="Remove Image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 w-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-topo-ochre shrink-0" />
                    <h4 className="text-xs font-mono font-bold text-topo-ink truncate">
                      {selectedFile.name}
                    </h4>
                  </div>
                  <p className="text-[11px] font-mono text-topo-inkMuted mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB &bull; {selectedFile.type || 'image/raw'}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="px-5 py-2 rounded-sm bg-topo-ochre hover:bg-topo-ochre/90 text-topo-canvas font-mono font-bold text-xs transition-colors flex items-center gap-2"
                  >
                    <span>SYNTHESIZE 3D ELEVATION DEM</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-3.5 py-2 rounded-sm bg-topo-panel hover:bg-topo-surface border border-topo-border text-topo-ink font-mono text-xs transition-colors"
                  >
                    Select Different File
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-sm bg-red-950/30 border border-red-800/50 text-red-300 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Collapsible Advanced Cadastral Anchor Controls */}
        <div className="mt-4 pt-3 border-t border-topo-border/60">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-mono text-topo-inkMuted hover:text-topo-ink transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-topo-ochre" />
            <span>GEODETIC ANCHOR &amp; SPATIAL METADATA</span>
            <span className="text-[10px] text-topo-ochre">
              {showAdvanced ? '[- HIDE]' : '[+ CONFIGURE]'}
            </span>
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3.5 rounded-sm bg-topo-canvas border border-topo-border grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-topo-inkMuted mb-1">
                  ORIGIN LATITUDE (&deg;N)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={geoSettings.originLat}
                  onChange={(e) =>
                    setGeoSettings({ ...geoSettings, originLat: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-2.5 py-1 rounded-sm bg-topo-panel border border-topo-border text-xs text-topo-ink font-mono focus:border-topo-ochre focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-topo-inkMuted mb-1">
                  ORIGIN LONGITUDE (&deg;E)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={geoSettings.originLon}
                  onChange={(e) =>
                    setGeoSettings({ ...geoSettings, originLon: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-2.5 py-1 rounded-sm bg-topo-panel border border-topo-border text-xs text-topo-ink font-mono focus:border-topo-ochre focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-topo-inkMuted mb-1">
                  PIXEL RESOLUTION (&deg;/PX)
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={geoSettings.pixelScale}
                  onChange={(e) =>
                    setGeoSettings({ ...geoSettings, pixelScale: parseFloat(e.target.value) || 0.0001 })
                  }
                  className="w-full px-2.5 py-1 rounded-sm bg-topo-panel border border-topo-border text-xs text-topo-ink font-mono focus:border-topo-ochre focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
