"""데이터셋 API"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any, List

from ..core.registry import load_registry, get_dataset
from ..core.settings import PREVIEW_LIMIT_DEFAULT, PREVIEW_LIMIT_MAX
from ..engine.duckdb_engine import preview_rows
from ..core.meta_provider import get_meta_with_optional_sample

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def load_preview_rows(dataset_path: str, limit: int = 50, dataset_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    DuckDB에서 preview rows를 로드하여 타입 추론에 사용
    
    Args:
        dataset_path: CSV 파일 경로
        limit: 로드할 행 수 (기본값: 50)
        dataset_id: 데이터셋 ID (캐시 사용을 위해)
    
    Returns:
        샘플 데이터 행 리스트
    """
    try:
        rows, _ = preview_rows(dataset_path, offset=0, limit=limit, dataset_id=dataset_id)
        return rows
    except Exception as e:
        print(f"Warning: load_preview_rows failed: {e}")
        return []


@router.get("")
def list_datasets():
    """데이터셋 목록 조회"""
    # ensure_metadata()는 startup 이벤트에서만 실행 (중복 호출 방지)
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
    offset: int = Query(0, ge=0, description="화면표시범위 기능 제거: 호환성을 위해 유지하지만 기본값 0 사용"),
    limit: int = Query(PREVIEW_LIMIT_DEFAULT, ge=1, le=PREVIEW_LIMIT_MAX, description="화면표시범위 기능 제거: 호환성을 위해 유지하지만 기본값으로 전체 데이터 로드"),
):
    """데이터 미리보기 - DuckDB View 캐싱 사용
    
    화면표시범위 기능 제거: offset/limit은 호환성을 위해 유지하지만,
    프론트엔드에서 전달하지 않으므로 기본값으로 전체 데이터를 로드합니다.
    """
    try:
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
    except Exception as e:
        import traceback
        error_detail = str(e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Preview failed: {error_detail}")


@router.get("/{dataset_id}/columns")
def get_dataset_columns(dataset_id: str) -> Dict[str, Any]:
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


@router.get("/{dataset_id}/types")
def get_dataset_types(dataset_id: str):
    """
    데이터셋에 존재하는 타입 목록과 컬럼 개수를 반환
    (타입 버튼/자동 질의용)
    
    sample_rows 기반 타입 보강을 자동으로 적용하여
    완전히 다른 CSV에서도 의미 있는 타입 분류를 제공합니다.
    """
    try:
        ds = get_dataset(dataset_id)
        if ds is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # columns와 path 추출
        if isinstance(ds, dict):
            columns = ds.get("columns")
            path = ds.get("path")
        else:
            columns = getattr(ds, "columns", None)
            path = getattr(ds, "path", None)
        
        if not columns or not path:
            raise HTTPException(status_code=500, detail="Dataset columns not found")
        
        # ✅ preview rows 로드 (자동) - dataset_id 전달하여 캐시 사용
        sample_rows = load_preview_rows(path, limit=50, dataset_id=dataset_id)
        
        # ✅ meta 생성 + 타입 보강
        meta = get_meta_with_optional_sample(
            dataset_id=dataset_id,
            columns=list(columns),
            sample_rows=sample_rows,
        )
        
        # 타입별 count 집계
        type_counts: Dict[str, int] = {}
        for c in columns:
            t = (meta.get(c, {}).get("type") or "unknown")
            type_counts[t] = type_counts.get(t, 0) + 1
        
        types = [{"type": t, "count": cnt} for t, cnt in sorted(type_counts.items())]
        types.sort(key=lambda x: (-x["count"], x["type"]))
        
        return {
            "dataset_id": dataset_id,
            "types": types
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = str(e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Types failed: {error_detail}")


@router.get("/{dataset_id}/fields")
def get_fields_by_type(
    dataset_id: str,
    type: str = Query(..., description="필터할 컬럼 type (gas/temperature/pressure/...)")
):
    """
    타입별 컬럼 필터링
    
    예: /api/datasets/{dataset_id}/fields?type=gas
    → 가스 관련 필드만 반환
    """
    # (선택) type 값 검증
    ALLOWED_TYPES = {"gas", "temperature", "pressure", "apc", "valve", "aux", "heater", "timestamp", "recipe", "index", "unknown", "numeric", "categorical", "text"}
    if type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid type: {type}. Allowed types: {', '.join(sorted(ALLOWED_TYPES))}")
    
    ds = get_dataset(dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # ds가 dict 또는 object 둘 다 대응
    if isinstance(ds, dict):
        columns = ds.get("columns")
        path = ds.get("path")
    else:
        columns = getattr(ds, "columns", None)
        path = getattr(ds, "path", None)
    
    if not columns:
        raise HTTPException(status_code=500, detail="Dataset columns not found in registry")
    
    # ✅ preview rows 로드 (타입 보강을 위해) - dataset_id 전달하여 캐시 사용
    sample_rows = load_preview_rows(path, limit=50, dataset_id=dataset_id) if path else None
    
    # ✅ 공용 메타 생성 함수 사용
    meta = get_meta_with_optional_sample(
        dataset_id=dataset_id,
        columns=list(columns),
        sample_rows=sample_rows,
    )
    
    # ✅ type으로 필터
    filtered = [c for c in columns if meta.get(c, {}).get("type") == type]
    
    return {
        "dataset_id": dataset_id,
        "type": type,
        "count": len(filtered),
        "columns": filtered,
    }
