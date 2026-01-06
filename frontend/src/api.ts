/** API 클라이언트 */

export interface Dataset {
  dataset_id: string;
  filename: string;
  size_bytes: number;
  columns: string[];
}

export interface PreviewResponse {
  dataset_id: string;
  offset: number;
  limit: number;
  columns: string[];
  rows: Record<string, any>[];
  row_count: number;
}

export interface Metric {
  count?: number;
  non_null_count?: number;
  min?: number;
  max?: number;
  avg?: number;
  stddev?: number;
  error?: string;
}

export interface StatsResponse {
  metrics: Record<string, Metric>;
}

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

async function postAPI<T>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

export async function getDatasets(): Promise<{ datasets: Dataset[] }> {
  return fetchAPI('/api/datasets');
}

export async function getPreview(
  datasetId: string,
  offset: number = 0,
  limit: number = 2000
): Promise<PreviewResponse> {
  return fetchAPI(`/api/datasets/${datasetId}/preview?offset=${offset}&limit=${limit}`);
}

export async function getStats(
  datasetId: string,
  columns: string[],
  rowStart?: number,
  rowEnd?: number
): Promise<StatsResponse> {
  return postAPI(`/api/datasets/${datasetId}/stats`, {
    columns,
    row_range: rowStart !== undefined || rowEnd !== undefined
      ? { start: rowStart ?? 0, end: rowEnd ?? null }
      : null,
  });
}


