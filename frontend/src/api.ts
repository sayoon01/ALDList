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
  const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  console.log(`API 호출: ${fullUrl} (API_BASE: "${API_BASE}", endpoint: "${endpoint}")`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log(`API 응답 상태: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API 응답 오류: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    console.log(`API 응답 성공: ${endpoint}`, data);
    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`API 호출 타임아웃: ${endpoint} (10초 초과)`);
      throw new Error(`백엔드 서버 응답 시간 초과. 서버가 실행 중인지 확인하세요. (${endpoint})`);
    }
    console.error(`API 호출 실패: ${endpoint}`, error);
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('네트워크 오류: 백엔드 서버가 실행 중인지 확인하세요.');
      throw new Error('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
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
  datasetId: string
): Promise<PreviewResponse> {
  // 화면표시범위 기능 제거: 전체 데이터 로드 (백엔드 기본값 사용)
  return fetchAPI(`/api/datasets/${datasetId}/preview`);
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

export interface DatasetTypesResponse {
  dataset_id: string;
  types: Array<{ type: string; count: number }>;
}

export async function getDatasetTypes(datasetId: string): Promise<DatasetTypesResponse> {
  return fetchAPI(`/api/datasets/${datasetId}/types`);
}



