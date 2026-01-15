"""데이터셋 API"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any

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
    """
    데이터셋 목록 조회
    
    파라미터:
    - limit: 반환할 최대 개수 (기본값: 100, 최대: 1000)
    - offset: 시작 위치 (기본값: 0)
    - filename: 파일명 필터 (부분 일치, 대소문자 구분 없음)
    - min_size: 최소 파일 크기 (bytes)
    - max_size: 최대 파일 크기 (bytes)
    """
    all_datasets = load_registry()
    
    # 필터링
    filtered = []
    for m in all_datasets:
        # filename 필터
        if filename:
            if filename.lower() not in m.filename.lower():
                continue
        
        # size 필터
        if min_size is not None and m.size_bytes < min_size:
            continue
        if max_size is not None and m.size_bytes > max_size:
            continue
        
        filtered.append({
            "dataset_id": m.dataset_id,
            "filename": m.filename,
            "size_bytes": m.size_bytes,
            "columns": m.columns,
        })
    
    # 페이지네이션
    total = len(filtered)
    paginated = filtered[offset:offset + limit]
    
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
    """데이터 미리보기 - DuckDB View 캐싱 사용"""
    meta = get_dataset(dataset_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # registry의 columns를 전달하여 DESCRIBE 제거 (성능 개선)
    # dataset_id를 전달하여 캐시 사용
    rows, columns = preview_rows(
        meta.path, 
        offset=offset, 
        limit=limit,
        columns=meta.columns,  # DESCRIBE 제거: registry에서 이미 알고 있는 컬럼 사용
        dataset_id=dataset_id  # 캐시 활성화
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
    """
    데이터셋 컬럼 메타데이터 조회
    
    모든 컬럼에 대해 메타데이터를 반환합니다.
    우선순위: Dataset override > Global meta > Patterns 자동 생성
    """
    from ..core.column_meta import build_meta_map
    
    ds = get_dataset(dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # ds가 dict일 수도 있고 object일 수도 있으니 방어적으로 처리
    columns = None
    if isinstance(ds, dict):
        columns = ds.get("columns")
    else:
        columns = getattr(ds, "columns", None)
    
    if not columns:
        raise HTTPException(status_code=500, detail="Dataset columns not found in registry")
    
    meta = build_meta_map(dataset_id, list(columns))
    
    return {
        "dataset_id": dataset_id,
        "columns": list(columns),
        "meta": meta,  # ✅ 이제 전체 컬럼 키가 다 들어감
    }


@router.get("/{dataset_id}/fields", response_model=FieldsByTypeResponse)
def get_fields_by_type(
    dataset_id: str,
    type: str = Query(..., description="필터할 컬럼 type (gas/temperature/pressure/...)")
):
    """
    타입별 컬럼 필터링
    
    예: /api/datasets/{dataset_id}/fields?type=gas
    → 가스 관련 필드만 반환
    """
    from ..core.column_meta import build_meta_map
    
    # (선택) type 값 검증
    ALLOWED_TYPES = {"gas", "temperature", "pressure", "apc", "valve", "aux", "heater", "timestamp", "recipe", "index", "unknown"}
    if type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type: {type}. Allowed types: {', '.join(sorted(ALLOWED_TYPES))}")
    
    ds = get_dataset(dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # ds가 dict 또는 object 둘 다 대응
    if isinstance(ds, dict):
        columns = ds.get("columns")
    else:
        columns = getattr(ds, "columns", None)
    
    if not columns:
        raise HTTPException(status_code=500, detail="Dataset columns not found in registry")
    
    meta = build_meta_map(dataset_id, list(columns))
    
    # ✅ type으로 필터
    filtered = [c for c in columns if meta.get(c, {}).get("type") == type]
    
    return {
        "dataset_id": dataset_id,
        "type": type,
        "count": len(filtered),
        "columns": filtered,
    }
