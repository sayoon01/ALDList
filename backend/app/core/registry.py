"""데이터셋 레지스트리 관리"""
import json
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass

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
    """경로를 DATA_DIR 기준으로 정규화 - 항상 filename만 사용"""
    # 메타데이터에 저장된 경로와 무관하게 항상 filename만 사용
    # 이렇게 하면 로컬 절대 경로가 저장되어 있어도 문제없음
    normalized = DATA_DIR / filename
    
    if normalized.exists():
        return str(normalized.resolve())
    
    # 파일이 존재하지 않아도 DATA_DIR/filename 경로 반환
    # (나중에 파일이 추가될 수 있음)
    return str(normalized.resolve())


def load_registry() -> List[DatasetMeta]:
    """레지스트리 로드"""
    if not REGISTRY_PATH.exists():
        return []
    
    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    metas = []
    for item in data:
        # 경로 정규화 - filename을 사용하여 항상 DATA_DIR 기준 경로 생성
        filename = item.get('filename', Path(item.get('path', '')).name)
        item['path'] = _normalize_path(item.get('path', ''), filename)
        metas.append(DatasetMeta(**item))
    
    return metas


def get_dataset(dataset_id: str) -> Optional[DatasetMeta]:
    """특정 데이터셋 조회"""
    for meta in load_registry():
        if meta.dataset_id == dataset_id:
            return meta
    return None





