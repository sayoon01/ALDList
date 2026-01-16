/** API 클라이언트 */

// 환경 변수에서 API 베이스 URL 가져오기
// 개발 환경: 비워두면 Vite 프록시 사용 (/api -> http://localhost:8000)
// 프로덕션: VITE_API_BASE 환경 변수 설정 (예: https://aldlist-backend-production.up.railway.app)
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

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

export interface ColumnMeta {
  key: string;
  title?: string;
  desc?: string;
  unit?: string;
  type?: string;
  category?: string;
  equipment_field?: string;
  importance?: "A" | "B" | "C";
  name_ko?: string;
  name_en?: string;
  auto_generated?: boolean;
}

export interface DatasetColumnsResponse {
  dataset_id: string;
  columns: string[];
  meta: Record<string, ColumnMeta>;
}

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }
    return response.json();
  } catch (error: any) {
    if (error instanceof TypeError && error.message === 'Load failed') {
      throw new Error(`네트워크 오류: 백엔드 서버에 연결할 수 없습니다. 백엔드가 http://localhost:8000에서 실행 중인지 확인하세요.`);
    }
    throw error;
  }
}

async function postAPI<T>(endpoint: string, body: any): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
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
  rowEnd?: number,
  computeColumns?: string[]  // 확장 포인트: 선택적으로 일부 컬럼만 계산 (없으면 columns 전체)
): Promise<StatsResponse> {
  return postAPI(`/api/datasets/${datasetId}/stats`, {
    columns,
    row_range: rowStart !== undefined || rowEnd !== undefined
      ? { start: rowStart ?? 0, end: rowEnd ?? null }
      : null,
    compute_columns: computeColumns || undefined,  // 선택적 파라미터 (없으면 전체 columns 사용)
  });
}

export async function fetchDatasetColumns(datasetId: string): Promise<DatasetColumnsResponse> {
  return fetchAPI(`/api/datasets/${datasetId}/columns`);
}

export interface FieldsByTypeResponse {
  dataset_id: string;
  type: string;
  count: number;
  columns: string[];
  meta: Record<string, ColumnMeta>;
}

export async function getFieldsByType(datasetId: string, type: string): Promise<FieldsByTypeResponse> {
  return fetchAPI(`/api/datasets/${datasetId}/fields?type=${encodeURIComponent(type)}`);
}


// Admin API
export interface AdminTextResponse {
  dataset_id: string;
  path: string;
  profile?: string;
  doc?: string;
}

export async function buildProfile(datasetId: string): Promise<any> {
  const url = `${API_BASE}/api/admin/profile/${datasetId}/build`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`API Error (${res.status}): ${errorText}`);
  }
  return res.json();
}

export async function readProfile(datasetId: string): Promise<any> {
  const url = `${API_BASE}/api/admin/profile/${datasetId}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`API Error (${res.status}): ${errorText}`);
  }
  return res.json();
}

export async function buildDoc(
  datasetId: string,
  groupTopN?: number,
  highlightTopN?: number
): Promise<any> {
  const params = new URLSearchParams();
  if (groupTopN !== undefined) params.append("group_top_n", String(groupTopN));
  if (highlightTopN !== undefined) params.append("highlight_top_n", String(highlightTopN));
  
  const url = `${API_BASE}/api/admin/doc/${datasetId}/build${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`API Error (${res.status}): ${errorText}`);
  }
  return res.json();
}

export async function readDoc(datasetId: string): Promise<string> {
  const url = `${API_BASE}/api/admin/doc/${datasetId}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`API Error (${res.status}): ${errorText}`);
  }
  return res.text();
}

// 기존 함수들 (하위 호환성 유지)
export async function getProfileText(datasetId: string): Promise<AdminTextResponse> {
  const profile = await readProfile(datasetId);
  return {
    dataset_id: profile.dataset_id || datasetId,
    path: profile.path || "",
    profile: JSON.stringify(profile),
  };
}

export async function getDocText(datasetId: string): Promise<AdminTextResponse> {
  const doc = await readDoc(datasetId);
  return {
    dataset_id: datasetId,
    path: "",
    doc: doc,
  };
}

