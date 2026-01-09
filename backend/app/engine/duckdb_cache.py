"""DuckDB View 캐싱 시스템 - CSV 재파싱 비용 최적화"""
from __future__ import annotations
import duckdb
from typing import Dict, Optional
from pathlib import Path
import threading


class DuckDBCache:
    """DuckDB View 캐시 매니저 - 확장 가능한 구조"""
    
    def __init__(self):
        self._connections: Dict[str, duckdb.DuckDBPyConnection] = {}
        self._view_names: Dict[str, str] = {}  # dataset_id -> view_name
        self._lock = threading.Lock()
        self._view_counter = 0  # 고유한 view 이름 생성용
    
    def _get_view_name(self, dataset_id: str) -> str:
        """데이터셋 ID 기반 고유한 view 이름 생성"""
        if dataset_id not in self._view_names:
            self._view_counter += 1
            # SQL 식별자로 안전한 이름 생성 (특수문자 제거)
            safe_id = dataset_id.replace('-', '_').replace('.', '_')
            self._view_names[dataset_id] = f"ds_view_{safe_id}_{self._view_counter}"
        return self._view_names[dataset_id]
    
    def _get_or_create_connection(self, dataset_id: str) -> duckdb.DuckDBPyConnection:
        """데이터셋별 Connection 가져오기 또는 생성"""
        if dataset_id not in self._connections:
            conn = duckdb.connect()
            self._connections[dataset_id] = conn
        return self._connections[dataset_id]
    
    def ensure_view(self, dataset_id: str, csv_path: str) -> str:
        """
        View가 없으면 생성, 있으면 재사용
        Returns: view_name
        """
        with self._lock:
            view_name = self._get_view_name(dataset_id)
            conn = self._get_or_create_connection(dataset_id)
            
            # View가 이미 존재하는지 확인
            try:
                # View 존재 여부 확인 (DuckDB는 정보 스키마를 지원하지 않으므로 간단히 시도)
                test_query = f"SELECT 1 FROM {view_name} LIMIT 1"
                conn.execute(test_query).fetchone()
                # View가 이미 존재하면 재사용
                print(f"[DuckDB Cache] View reused: {view_name} for dataset {dataset_id}")
                return view_name
            except Exception:
                # View가 없으면 생성
                pass
            
            # 경로 정규화
            csv_path_normalized = str(Path(csv_path).resolve())
            safe_view_name = view_name.replace('-', '_').replace('.', '_')
            
            # View 생성 - all_varchar=True로 타입 추정 비용 제거 (성능 개선)
            # preview는 타입 추정이 필요 없고, stats는 TRY_CAST로 처리하므로 문자열로 읽어도 OK
            create_query = f"""
            CREATE VIEW {safe_view_name} AS
            SELECT * FROM read_csv('{csv_path_normalized}', all_varchar=true)
            """
            
            try:
                conn.execute(create_query)
                print(f"[DuckDB Cache] View created: {safe_view_name} for dataset {dataset_id}")
                return safe_view_name
            except Exception as e:
                # View 생성 실패 시 원본 경로 사용 (fallback)
                print(f"Warning: Failed to create view for {dataset_id}: {e}")
                raise
    
    def get_view_query(self, dataset_id: str, csv_path: str) -> str:
        """
        View 이름 반환 (없으면 생성)
        Returns: "view_name" 또는 "read_csv('path', all_varchar=true, header=true)" (fallback)
        """
        try:
            view_name = self.ensure_view(dataset_id, csv_path)
            return view_name
        except Exception:
            # View 생성 실패 시 원본 경로 사용 (fallback) - preview는 all_varchar로 빠르게
            csv_path_normalized = str(Path(csv_path).resolve())
            return f"read_csv('{csv_path_normalized}', all_varchar=true, header=true)"
    
    def clear_view(self, dataset_id: str):
        """특정 데이터셋의 View 제거"""
        with self._lock:
            if dataset_id in self._view_names:
                view_name = self._view_names[dataset_id]
                if dataset_id in self._connections:
                    conn = self._connections[dataset_id]
                    try:
                        conn.execute(f"DROP VIEW IF EXISTS {view_name}")
                    except Exception:
                        pass
                del self._view_names[dataset_id]
            
            if dataset_id in self._connections:
                try:
                    self._connections[dataset_id].close()
                except Exception:
                    pass
                del self._connections[dataset_id]
    
    def clear_all(self):
        """모든 View와 Connection 정리"""
        with self._lock:
            for dataset_id in list(self._view_names.keys()):
                self.clear_view(dataset_id)


# 전역 캐시 인스턴스 (싱글톤 패턴)
_cache = DuckDBCache()


def get_cache() -> DuckDBCache:
    """전역 캐시 인스턴스 반환"""
    return _cache

