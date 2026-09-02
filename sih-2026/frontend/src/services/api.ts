import { JobStatus, JobResult, SampleItem, AdvancedGeoSettings } from '../types';

const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

export function resolveBackendUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return BACKEND_URL ? `${BACKEND_URL}${cleanPath}` : cleanPath;
}

export async function fetchSamples(): Promise<SampleItem[]> {
  const res = await fetch(`${API_BASE}/samples`);
  if (!res.ok) throw new Error('Failed to fetch survey plate catalog');
  const samples: SampleItem[] = await res.json();
  return samples.map((item) => ({
    ...item,
    thumbnail_url: resolveBackendUrl(item.thumbnail_url),
    precomputed_mesh_url: item.precomputed_mesh_url ? resolveBackendUrl(item.precomputed_mesh_url) : null,
  }));
}

export async function uploadImage(
  file: File,
  geoSettings?: AdvancedGeoSettings
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  if (geoSettings) {
    formData.append('origin_lat', geoSettings.originLat.toString());
    formData.append('origin_lon', geoSettings.originLon.toString());
    formData.append('pixel_scale', geoSettings.pixelScale.toString());
  }

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Raster ingestion failed');
  }

  const data = await res.json();
  return data.job_id;
}

export async function processSample(sampleId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/process-sample/${sampleId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to start sample synthesis');
  const data = await res.json();
  return data.job_id;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/status/${jobId}`);
  if (!res.ok) throw new Error('Failed to check pipeline status');
  return res.json();
}

export async function getJobResult(jobId: string): Promise<JobResult> {
  const res = await fetch(`${API_BASE}/result/${jobId}`);
  if (!res.ok) throw new Error('Failed to retrieve synthesized result');
  const data: JobResult = await res.json();

  const colored_png_urls: Record<string, string> = {};
  if (data.colored_png_urls) {
    for (const [k, v] of Object.entries(data.colored_png_urls)) {
      colored_png_urls[k] = resolveBackendUrl(v);
    }
  }

  return {
    ...data,
    original_url: resolveBackendUrl(data.original_url),
    depth_png_url: resolveBackendUrl(data.depth_png_url),
    geotiff_url: resolveBackendUrl(data.geotiff_url),
    mesh_obj_url: resolveBackendUrl(data.mesh_obj_url),
    sat3dgen_mesh_url: data.sat3dgen_mesh_url ? resolveBackendUrl(data.sat3dgen_mesh_url) : null,
    precomputed_mesh_url: data.precomputed_mesh_url ? resolveBackendUrl(data.precomputed_mesh_url) : null,
    colored_png_urls,
  };
}

export async function pollJob(
  jobId: string,
  onProgress?: (status: JobStatus) => void,
  maxAttempts = 60
): Promise<JobResult> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const status = await getJobStatus(jobId);
    if (onProgress) onProgress(status);

    if (status.status === 'completed') {
      return await getJobResult(jobId);
    } else if (status.status === 'error') {
      throw new Error(status.error || 'Pipeline encountered a synthesis error');
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    attempts++;
  }
  throw new Error('Pipeline synthesis timeout exceeded.');
}

export function getDownloadUrl(jobId: string, fileType: string): string {
  return `${API_BASE}/download/${jobId}/${fileType}`;
}
