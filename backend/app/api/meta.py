# backend/app/api/meta.py
from __future__ import annotations

from fastapi import APIRouter
from typing import List

from ..core.column_meta import allowed_types

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/types")
def list_types() -> dict:
    """
    YAML 기반 type 목록 반환 (하드코딩 제거)
    - patterns.yaml / global_columns.yaml / generated.yaml에서 자동 추출
    """
    types: List[str] = allowed_types()
    return {"types": types, "count": len(types)}
