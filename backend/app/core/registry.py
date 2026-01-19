"""
데이터셋 레지스트리 관리 (메모리 캐시 + 자동 reload)
- REGISTRY_PATH 파일을 읽어 DatasetMeta를 만든 뒤 메모리에 캐시
- 파일 mtime이 바뀌면 자동 reload
- dataset_id -> meta dict로 O(1) 조회
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from .settings import REGISTRY_PATH, DATA_DIR


@dataclass
class DatasetMeta:
    dataset_id: str
    path: str
    filename: str
    size_bytes: int
    mtime: float
    columns: List[str]


def _normalize_path(path_str: str, filename: str) -> str:
    """
    경로를 DATA_DIR 기준으로 정규화 - 항상 filename 기반
    (배포/서버 환경에서 절대경로 저장돼도 안전)
    """
    normalized = DATA_DIR / filename
    return str(normalized.resolve())


def _read_registry_file(registry_path: Path) -> List[DatasetMeta]:
    """레지스트리 파일을 읽어 DatasetMeta 리스트 반환"""
    if not registry_path.exists():
        return []

    data = json.loads(registry_path.read_text(encoding="utf-8"))
    metas: List[DatasetMeta] = []
    for item in data:
        filename = item.get("filename", Path(item.get("path", "")).name)
        item["path"] = _normalize_path(item.get("path", ""), filename)
        metas.append(DatasetMeta(**item))
    return metas


class RegistryStore:
    """
    확장 가능한 레지스트리 스토어:
    - mtime 기반 자동 reload
    - 필요하면 TTL, 수동 refresh, 이벤트 훅 등을 추가 가능
    """

    def __init__(self, registry_path: Path = REGISTRY_PATH) -> None:
        self.registry_path = registry_path
        self._lock = threading.RLock()
        self._loaded_mtime: float = -1.0
        self._by_id: Dict[str, DatasetMeta] = {}
        self._list_cache: List[DatasetMeta] = []

    def _current_mtime(self) -> float:
        """현재 레지스트리 파일의 mtime 반환"""
        try:
            return self.registry_path.stat().st_mtime
        except FileNotFoundError:
            return -1.0

    def ensure_loaded(self, force: bool = False) -> None:
        """
        파일이 바뀌었으면 reload
        """
        with self._lock:
            cur_mtime = self._current_mtime()
            if (not force) and (cur_mtime == self._loaded_mtime):
                return

            metas = _read_registry_file(self.registry_path)
            self._by_id = {m.dataset_id: m for m in metas}
            self._list_cache = metas
            self._loaded_mtime = cur_mtime

    def list(self) -> List[DatasetMeta]:
        """전체 데이터셋 목록 반환"""
        self.ensure_loaded()
        with self._lock:
            return list(self._list_cache)

    def get(self, dataset_id: str) -> Optional[DatasetMeta]:
        """특정 데이터셋 조회 (O(1))"""
        self.ensure_loaded()
        with self._lock:
            return self._by_id.get(dataset_id)

    def count(self) -> int:
        """데이터셋 개수 반환"""
        self.ensure_loaded()
        with self._lock:
            return len(self._list_cache)

    def refresh(self) -> None:
        """강제로 레지스트리 다시 로드"""
        self.ensure_loaded(force=True)


# 싱글톤 인스턴스
_store = RegistryStore()


def get_store() -> RegistryStore:
    """RegistryStore 싱글톤 인스턴스 반환"""
    return _store


# 하위호환 함수들 (기존 코드 최소 수정용)
def load_registry() -> List[DatasetMeta]:
    """레지스트리 로드 (하위호환)"""
    return get_store().list()


def get_dataset(dataset_id: str) -> Optional[DatasetMeta]:
    """특정 데이터셋 조회 (하위호환, O(1))"""
    return get_store().get(dataset_id)





