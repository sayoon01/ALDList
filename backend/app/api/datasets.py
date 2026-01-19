"""데이터셋 API"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ..core.registry import load_registry, get_dataset
from ..core.settings import PREVIEW_LIMIT_DEFAULT, PREVIEW_LIMIT_MAX
from ..engine.duckdb_engine import preview_rows
from ..models.schemas import (
    DatasetListResponse,
    DatasetMetaResponse,
    PreviewResponse,
    DatasetColumnsResponse,
    FieldsByTypeResponse,
)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("", response_model=DatasetListResponse)
def list_datasets(
    limit: int = Query(100, ge=1, le=1000, description="반환할 최대 개수"),
    offset: int = Query(0, ge=0, description="시작 위치 (페이지네이션)"),
    filename: Optional[str] = Query(None, description="파일명 필터 (부분 일치)"),
    min_size: Optional[int] = Query(None, ge=0, description="최소 파일 크기 (bytes)"),
    max_size: Optional[int] = Query(None, ge=0, description="최대 파일 크기 (bytes)"),
):
    """데이터셋 목록 조회"""
    all_datasets = load_registry()

    filtered = []
    for m in all_datasets:
        if filename and filename.lower() not in m.filename.lower():
            continue
        if min_size is not None and m.size_bytes < min_size:
            continue
        if max_size is not None and m.size_bytes > max_size:
            continue
        filtered.append(
            {
                "dataset_id": m.dataset_id,
                "filename": m.filename,
                "size_bytes": m.size_bytes,
                "columns": m.columns,
            }
        )

    paginated = filtered[offset : offset + limit]
    return {"datasets": paginated}


@router.get("/{dataset_id}", response_model=DatasetMetaResponse)
def get_dataset_meta(dataset_id: str):
    """데이터셋 메타데이터 조회"""
    meta = get_dataset(dataset_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return {
        "dataset_id": meta.dataset_id,
        "filename": meta.filename,
        "path": meta.path,
        "size_bytes": meta.size_bytes,
        "columns": meta.columns,
    }


@router.get("/{dataset_id}/preview", response_model=PreviewResponse)
def preview(
    dataset_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(PREVIEW_LIMIT_DEFAULT, ge=1, le=PREVIEW_LIMIT_MAX),
):
    """데이터 미리보기"""
    meta = get_dataset(dataset_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Dataset not found")

    rows, columns = preview_rows(
        meta.path,
        offset=offset,
        limit=limit,
        columns=meta.columns,  # registry의 컬럼으로 DESCRIBE 제거
        dataset_id=dataset_id,  # 캐시 활성화
    )

    return {
        "dataset_id": dataset_id,
        "offset": offset,
        "limit": limit,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


@router.get("/{dataset_id}/columns", response_model=DatasetColumnsResponse)
def get_dataset_columns(dataset_id: str):
    """데이터셋 컬럼 메타데이터 조회"""
    from ..core.column_meta import build_meta_map

    ds = get_dataset(dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    columns = ds.columns if not isinstance(ds, dict) else ds.get("columns")
    if not columns:
        raise HTTPException(status_code=500, detail="Dataset columns not found in registry")

    meta = build_meta_map(dataset_id, list(columns))
    return {
        "dataset_id": dataset_id,
        "columns": list(columns),
        "meta": meta,
    }


@router.get("/{dataset_id}/fields", response_model=FieldsByTypeResponse)
def get_fields_by_type(
    dataset_id: str,
    type: str = Query(..., description="필터할 컬럼 type (gas/temperature/pressure/...)"),
):
    """
    타입별 컬럼 필터링
    예: /api/datasets/{dataset_id}/fields?type=gas
    → 가스 관련 필드만 반환 + meta 포함
    """
    from ..core.column_meta import build_meta_map, get_allowed_types

    allowed = set(get_allowed_types())
    if type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid type: {type}. Allowed types: {', '.join(sorted(allowed))}",
        )

    ds = get_dataset(dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    columns = ds.columns if not isinstance(ds, dict) else ds.get("columns")
    if not columns:
        raise HTTPException(status_code=500, detail="Dataset columns not found in registry")

    meta_map = build_meta_map(dataset_id, list(columns))
    filtered_cols = [c for c in columns if meta_map.get(c, {}).get("type") == type]
    filtered_meta = {c: meta_map.get(c, {}) for c in filtered_cols}

    return {
        "dataset_id": dataset_id,
        "type": type,
        "count": len(filtered_cols),
        "columns": filtered_cols,
        "meta": filtered_meta,
    }
