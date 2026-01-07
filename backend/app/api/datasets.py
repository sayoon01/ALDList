"""데이터셋 API"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any

from ..core.registry import load_registry, get_dataset
from ..core.auto_scan import ensure_metadata
from ..core.settings import PREVIEW_LIMIT_DEFAULT, PREVIEW_LIMIT_MAX
from ..core.column_meta import load_global_column_meta
from ..engine.duckdb_engine import preview_rows

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("")
def list_datasets():
    """데이터셋 목록 조회"""
    # 메타데이터가 없으면 자동 생성 시도
    ensure_metadata()
    
    return {"datasets": [{
        "dataset_id": m.dataset_id,
        "filename": m.filename,
        "size_bytes": m.size_bytes,
        "columns": m.columns,
    } for m in load_registry()]}


@router.get("/{dataset_id}")
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


@router.get("/{dataset_id}/preview")
def preview(
    dataset_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(PREVIEW_LIMIT_DEFAULT, ge=1, le=PREVIEW_LIMIT_MAX),
):
    """데이터 미리보기"""
    meta = get_dataset(dataset_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    rows, columns = preview_rows(meta.path, offset=offset, limit=limit)
    
    return {
        "dataset_id": dataset_id,
        "offset": offset,
        "limit": limit,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


@router.get("/{dataset_id}/columns")
def get_dataset_columns(dataset_id: str) -> Dict[str, Any]:
    """데이터셋 컬럼 메타데이터 조회"""
    meta = get_dataset(dataset_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # 데이터셋의 컬럼 목록
    columns: list[str] = list(meta.columns)
    
    # 전역 컬럼 메타데이터 로드
    global_meta = load_global_column_meta()
    
    # 이 데이터셋에서 쓰는 컬럼만 골라서 내려줌(가벼움)
    meta_filtered = {c: global_meta[c] for c in columns if c in global_meta}
    
    return {
        "dataset_id": dataset_id,
        "columns": columns,
        "meta": meta_filtered,
    }
