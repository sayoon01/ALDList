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
    
    # 절대 경로인 경우
    if path.is_absolute():
        # DATA_DIR 내부에 있으면 그대로 사용
        try:
            path.relative_to(DATA_DIR)
            if path.exists():
                return str(path.resolve())
        except ValueError:
            # DATA_DIR 밖에 있는 절대 경로는 filename만 사용
            pass
        
        # DATA_DIR 밖에 있거나 존재하지 않으면 filename만 사용
        filename = path.name
        normalized = DATA_DIR / filename
        if normalized.exists():
            return str(normalized.resolve())
        # 존재하지 않아도 DATA_DIR 기준 경로 반환
        return str(normalized.resolve())
    
    # 상대 경로인 경우
    normalized = DATA_DIR / path
    if normalized.exists():
        return str(normalized.resolve())
    
    # filename만 있는 경우 (메타데이터에 filename만 저장된 경우)
    filename = path.name
    normalized = DATA_DIR / filename
    if normalized.exists():
        return str(normalized.resolve())
    
    # 최종적으로 DATA_DIR/filename 반환
    return str(normalized.resolve())


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





