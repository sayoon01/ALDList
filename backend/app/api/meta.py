# backend/app/api/meta.py
from __future__ import annotations

from fastapi import APIRouter

from ..core.column_meta import get_type_catalog
from ..models.schemas import MetaTypesResponse

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/types", response_model=MetaTypesResponse)
def meta_types():
    """
    타입 카탈로그 반환 (하드코딩 제거)
    - allowed_types: validation 기준
    - ordered_types: UI 버튼 순서 (patterns.yaml의 type_order 우선)
    - labels: UI 라벨 (patterns.yaml type_labels + 기본값)
    """
    return get_type_catalog()
