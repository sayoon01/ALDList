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


def _normalize_path(path_str: str) -> str:
    """경로를 DATA_DIR 기준으로 정규화"""
    path = Path(path_str)
    
    # 이미 절대 경로이고 파일이 존재하면 그대로 사용
    if path.is_absolute() and path.exists():
        return str(path)
    
    # 상대 경로이거나 파일이 없으면 DATA_DIR 기준으로 변환
    # filename만 있으면 DATA_DIR/filename
    if not path.is_absolute():
        # 상대 경로인 경우
        normalized = DATA_DIR / path
        if normalized.exists():
            return str(normalized.resolve())
    
    # filename만 있는 경우 (메타데이터에 filename만 저장된 경우)
    filename = path.name
    normalized = DATA_DIR / filename
    if normalized.exists():
        return str(normalized.resolve())
    
    # 기존 경로 반환 (존재하지 않아도)
    return str(path)


def load_registry() -> List[DatasetMeta]:
    """레지스트리 로드"""
    if not REGISTRY_PATH.exists():
        return []
    
    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    metas = []
    for item in data:
        # 경로 정규화
        item['path'] = _normalize_path(item['path'])
        metas.append(DatasetMeta(**item))
    
    return metas


def get_dataset(dataset_id: str) -> Optional[DatasetMeta]:
    """특정 데이터셋 조회"""
    for meta in load_registry():
        if meta.dataset_id == dataset_id:
            return meta
    return None





