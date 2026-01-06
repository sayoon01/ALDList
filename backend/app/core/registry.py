from __future__ import annotations
import json
from dataclasses import dataclass
from typing import List
from .settings import REGISTRY_PATH

@dataclass
class DatasetMeta:
    dataset_id: str
    path: str
    filename: str
    size_bytes: int
    mtime: float
    columns: list[str]

def load_registry() -> List[DatasetMeta]:
    if not REGISTRY_PATH.exists():
        raise FileNotFoundError(f"registry not found: {REGISTRY_PATH} (run tools/scan_and_export.py)")
    raw = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return [DatasetMeta(**x) for x in raw]

def get_dataset(dataset_id: str) -> DatasetMeta:
    for d in load_registry():
        if d.dataset_id == dataset_id:
            return d
    raise KeyError(dataset_id)
