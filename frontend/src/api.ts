/**
 * API 클라이언트
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface DatasetInfo {
  name: string;
  path: string;
  column_count: number;
  row_count: number;
}

export interface DatasetDetail extends DatasetInfo {
  columns: string[];
}

export interface StatsResponse {
  total_datasets: number;
  total_rows: number;
  total_columns: number;
  union_columns: string[];
  intersection_columns: string[];
}

export const datasetsApi = {
  /**
   * 데이터셋 목록 조회
   */
  list: async (): Promise<DatasetInfo[]> => {
    const response = await api.get<DatasetInfo[]>('/datasets');
    return response.data;
  },

  /**
   * 특정 데이터셋 상세 정보 조회
   */
  get: async (name: string): Promise<DatasetDetail> => {
    const response = await api.get<DatasetDetail>(`/datasets/${name}`);
    return response.data;
  },

  /**
   * 데이터셋의 컬럼 목록 조회
   */
  getColumns: async (name: string): Promise<{ name: string; columns: string[]; count: number }> => {
    const response = await api.get(`/datasets/${name}/columns`);
    return response.data;
  },
};

export const statsApi = {
  /**
   * 전체 통계 정보 조회
   */
  get: async (): Promise<StatsResponse> => {
    const response = await api.get<StatsResponse>('/stats');
    return response.data;
  },
};

export default api;


