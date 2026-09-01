export type ColormapType = 'terrain' | 'viridis' | 'plasma' | 'grayscale' | 'magma' | 'turbo';

export type ViewMode = '3d' | 'split' | 'side-by-side' | 'single';

export interface SpatialBounds {
  min_lon: number;
  max_lon: number;
  min_lat: number;
  max_lat: number;
}

export interface ElevationStats {
  width: number;
  height: number;
  min_elevation: number;
  max_elevation: number;
  mean_elevation: number;
  std_elevation: number;
  crs: string;
  bounds: SpatialBounds;
  processing_time_ms: number;
  elevation_mode?: 'calibrated' | 'preview';
  calibrated?: boolean;
  unit?: string;
  alpha?: number | null;
  beta?: number | null;
  rmse_meters?: number | null;
  is_verified_location?: boolean;
}

export interface JobResult {
  job_id: string;
  original_url: string;
  geotiff_url: string;
  depth_png_url: string;
  colored_png_urls: Record<string, string>;
  mesh_obj_url: string;
  stats: ElevationStats;
  available_colormaps: string[];
  elevation_mode?: 'calibrated' | 'preview';
  rmse_meters?: number | null;
  alpha?: number | null;
  beta?: number | null;
  is_verified_location?: boolean;
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  error?: string;
  result?: JobResult;
}

export interface SampleItem {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail_url: string;
  filename: string;
  default_lat: number;
  default_lon: number;
  is_verified_location?: boolean;
}

export interface AdvancedGeoSettings {
  originLat: number;
  originLon: number;
  pixelScale: number;
}

export interface HistoryItem {
  job_id: string;
  timestamp: number;
  thumbnail_url: string;
  name: string;
  stats: ElevationStats;
  result: JobResult;
}
