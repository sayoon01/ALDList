"""
DuckDB Relation 캐시 (단일 connection + fingerprint 기반 자동 무효화)

- dataset_id별로 VIEW를 만들고 재사용
- CSV 파일이 변경되면(size/mtime_ns) 자동으로 VIEW 재생성
- 자동화(파일 변경 감지/watch_csv/refresh)와 잘 맞음
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import duckdb


@dataclass
class ViewEntry:
    view_name: str
    fingerprint: str
    csv_path: str


def compute_fingerprint(csv_path: str) -> str:
    """
    빠르고 실용적인 fingerprint: absolute path + size + mtime_ns
    - mtime을 int초로 자르면 같은 초에 여러 번 바뀌는 경우를 못 잡아서 mtime_ns 사용
    """
    p = Path(csv_path).resolve()
    st = p.stat()
    mtime_ns = getattr(st, "st_mtime_ns", int(st.st_mtime * 1_000_000_000))
    return f"{p.as_posix()}|{st.st_size}|{mtime_ns}"


class DuckDBCache:
    """
    - 단일 DuckDB connection 보유
    - dataset_id -> ViewEntry 관리
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._conn: duckdb.DuckDBPyConnection = duckdb.connect()
        self._entries: Dict[str, ViewEntry] = {}

    def connection(self) -> duckdb.DuckDBPyConnection:
        """단일 connection 반환"""
        return self._conn

    def _safe_view_name(self, dataset_id: str) -> str:
        """dataset_id를 안전한 view 이름으로 변환"""
        safe = dataset_id.replace("-", "_").replace(".", "_")
        return f"ds_{safe}"

    def _create_or_replace_view(self, view_name: str, csv_path: str) -> None:
        """VIEW 생성 또는 교체"""
        p = Path(csv_path).resolve()
        sql = f"""
        CREATE OR REPLACE VIEW {view_name} AS
        SELECT * FROM read_csv('{p.as_posix()}', all_varchar=true, header=true);
        """
        self._conn.execute(sql)

    def get_relation(self, dataset_id: str, csv_path: str) -> str:
        """
        Returns: SQL에서 FROM에 넣을 relation 이름 (view_name)
        - CSV가 바뀌면 자동으로 view 재생성
        """
        with self._lock:
            view_name = self._safe_view_name(dataset_id)
            fp = compute_fingerprint(csv_path)

            entry = self._entries.get(dataset_id)
            if entry and entry.view_name == view_name and entry.fingerprint == fp:
                return view_name

            self._create_or_replace_view(view_name, csv_path)
            self._entries[dataset_id] = ViewEntry(
                view_name=view_name, fingerprint=fp, csv_path=str(Path(csv_path).resolve())
            )
            return view_name

    def invalidate(self, dataset_id: str) -> None:
        """특정 dataset_id의 view 무효화"""
        with self._lock:
            entry = self._entries.pop(dataset_id, None)
            if entry:
                try:
                    self._conn.execute(f"DROP VIEW IF EXISTS {entry.view_name};")
                except Exception:
                    pass

    def clear_all(self) -> None:
        """모든 view 제거"""
        with self._lock:
            for ds_id in list(self._entries.keys()):
                self.invalidate(ds_id)

    def close(self) -> None:
        """connection 닫기"""
        with self._lock:
            try:
                self.clear_all()
            finally:
                try:
                    self._conn.close()
                except Exception:
                    pass

    # 하위호환
    def get_view_query(self, dataset_id: str, csv_path: str) -> str:
        """View 이름 반환 (하위호환)"""
        try:
            return self.get_relation(dataset_id, csv_path)
        except Exception:
            csv_path_normalized = str(Path(csv_path).resolve())
            return f"read_csv('{csv_path_normalized}', all_varchar=true, header=true)"


_cache = DuckDBCache()


def get_cache() -> DuckDBCache:
    """RegistryStore 싱글톤 인스턴스 반환"""
    return _cache

