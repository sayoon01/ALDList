"""데이터셋 레지스트리 관리"""
import json
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass

from .settings import REGISTRY_PATH


@dataclass
class DatasetMeta:
    dataset_id: str
    path: str
    filename: str
    size_bytes: int
    mtime: float
    columns: List[str]


def load_registry() -> List[DatasetMeta]:
    """레지스트리 로드"""
    if not REGISTRY_PATH.exists():
        return []
    
    data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return [DatasetMeta(**item) for item in data]


def get_dataset(dataset_id: str) -> Optional[DatasetMeta]:
    """특정 데이터셋 조회"""
    for meta in load_registry():
        if meta.dataset_id == dataset_id:
            return meta
    return None

