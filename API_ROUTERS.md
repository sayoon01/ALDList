# API 라우터 구현 코드

이 문서는 ALDList 백엔드의 모든 API 라우터 파일의 실제 구현 코드를 보여줍니다.

## 📁 파일 구조

```
backend/app/api/
├── __init__.py
├── datasets.py    # 데이터셋 관련 API
├── stats.py       # 통계 계산 API
├── meta.py        # 메타데이터 타입 API
└── admin.py       # 관리 API
```

---

## 1. 데이터셋 API (`backend/app/api/datasets.py`)

```python
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
    from ..models.schemas import InvalidTypeDetail

    ds = get_dataset(dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    columns = ds.columns if not isinstance(ds, dict) else ds.get("columns")
    if not columns:
        raise HTTPException(status_code=500, detail="Dataset columns not found in registry")

    allowed = get_allowed_types()
    if type not in set(allowed):
        detail = InvalidTypeDetail(
            message="Invalid type",
            invalid_type=type,
            allowed_types=allowed,
        )
        raise HTTPException(status_code=400, detail=detail.model_dump())

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
```

---

## 2. 통계 계산 API (`backend/app/api/stats.py`)

```python
"""통계 API"""
from fastapi import APIRouter, HTTPException

from ..core.registry import get_dataset
from ..engine.duckdb_engine import compute_metrics
from ..models.schemas import StatsRequest, StatsResponse, Metric

router = APIRouter(prefix="/api/datasets", tags=["stats"])


@router.post("/{dataset_id}/stats", response_model=StatsResponse)
def stats(dataset_id: str, request: StatsRequest):
    """통계 계산"""
    meta = get_dataset(dataset_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # 유효한 컬럼만 필터링
    valid_columns = [c for c in request.columns if c in meta.columns]
    if not valid_columns:
        raise HTTPException(status_code=400, detail="No valid columns provided")
    
    # 계산할 컬럼 선택 (확장 포인트: compute_columns가 제공되면 그것만, 아니면 전체)
    compute_target_columns = valid_columns
    if request.compute_columns:
        # compute_columns가 제공되면 유효한 것만 필터링
        compute_target_columns = [c for c in request.compute_columns if c in valid_columns]
        if not compute_target_columns:
            raise HTTPException(status_code=400, detail="No valid compute_columns provided")
        print(f"[Stats API] Computing stats for selected columns only: {len(compute_target_columns)}/{len(valid_columns)} columns")
    else:
        print(f"[Stats API] Computing stats for all columns: {len(compute_target_columns)} columns")
    
    # 행 범위 설정
    row_start = 0
    row_end = None
    if request.row_range:
        row_start = request.row_range.start
        row_end = request.row_range.end
    
    # 통계 계산 - dataset_id를 전달하여 DuckDB View 캐싱 사용
    try:
        metrics_dict = compute_metrics(
            meta.path, 
            compute_target_columns,  # 계산 대상 컬럼만 전달
            row_start, 
            row_end,
            dataset_id=dataset_id  # 캐시 활성화
        )
        
        # 응답 형식 변환 (에러가 있는 경우도 처리)
        metrics = {}
        for k, v in metrics_dict.items():
            try:
                metrics[k] = Metric(**v)
            except Exception as e:
                # Metric 변환 실패 시 에러 정보만 포함
                metrics[k] = Metric(
                    count=0,
                    non_null_count=0,
                    error=f"Metric conversion error: {str(e)}"
                )
        
        return StatsResponse(metrics=metrics)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"통계 계산 API 오류: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Statistics calculation failed: {str(e)}")
```

---

## 3. 메타데이터 타입 API (`backend/app/api/meta.py`)

```python
# backend/app/api/meta.py
from __future__ import annotations

from fastapi import APIRouter

from ..core.column_meta import get_store
from ..models.schemas import MetaTypesResponse

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/types", response_model=MetaTypesResponse)
def meta_types():
    """
    UI용 타입 메타:
    - types: allowed types 목록 (order 우선 정렬)
    - labels: type -> label
    - order: type 순서 (없으면 None)
    """
    store = get_store()
    store.ensure_loaded()

    # allowed types
    types: list[str] = store.get_allowed_types()

    # patterns.yaml에서 type_labels/type_order를 같이 내려주기
    labels = store.get_ui_type_labels()  # Dict[str, str]
    order = store.get_ui_type_order()  # Optional[List[str]]

    # order가 있으면 types를 order 우선으로 재정렬
    if order:
        order_set = set(order)
        # order에 있는 것 먼저 + 나머지(새로 등장한 타입) 뒤
        types_sorted: list[str] = [t for t in order if t in types]
        types_sorted += [t for t in types if t not in order_set]
        types = types_sorted

    # labels 없는 타입은 type 그대로 노출(프론트에서도 fallback 가능)
    return {"types": types, "labels": labels, "order": order}
```

---

## 4. 관리 API (`backend/app/api/admin.py`)

```python
# backend/app/api/admin.py
"""
관리/자동화 API

[액티브 자동화 엔드포인트]
- Registry 갱신만 담당 (Scan 단계 실행)
- Column Meta / Profile / Doc 빌드는 포함하지 않음
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse
from typing import Dict, Any
from pathlib import Path
import json

import sys
import subprocess

from ..core.metadata_pipeline import refresh_registry_if_needed
from ..core.registry import get_dataset, load_registry
from ..core.profile_v1 import build_profile_v1
from ..core.doc_v1 import build_doc_v1
from ..core.settings import PROFILES_DIR, DOCS_DIR, PROJECT_ROOT
from ..engine.duckdb_cache import get_cache
from ..models.schemas import AdminRefreshResponse, RefreshResponse, ProfileBuildResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/refresh", response_model=RefreshResponse)
def refresh(force: bool = Query(False, description="true면 무조건 scan 실행")):
    """
    Registry 갱신 API
    
    - force=false: 자동 판단에 따라 필요 시에만 갱신
    - force=true: 무조건 갱신 실행
    
    책임 범위:
    - [1] Scan 단계만 실행 (tools/scan_and_export.py)
    - [2] Registry 갱신만 수행 (metadata/datasets.json)
    - Column Meta / Profile / Doc은 별도 API에서 처리
    """
    r = refresh_registry_if_needed(force=force)
    if not r.ok:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "registry refresh failed",
                "reason": r.reason,
                "stderr": r.stderr[-4000:] if r.stderr else "",
            },
        )

    try:
        datasets = load_registry()
        dataset_count = len(datasets)
    except Exception:
        dataset_count = 0

    # ✅ 변경된 것만 invalidate (clear_all()보다 안전+빠름)
    cache = get_cache()
    for ds_id in (r.created or []):
        cache.invalidate(ds_id)
    for ds_id in (r.changed_ids or []):
        cache.invalidate(ds_id)
    for ds_id in (r.deleted or []):
        cache.invalidate(ds_id)

    return {
        "ran_scan": r.changed,
        "reason": r.reason,
        "registry_path": r.registry_path,
        "dataset_count": dataset_count,
        "created": r.created,
        "changed": r.changed_ids,
        "deleted": r.deleted,
    }


@router.post("/profile/{dataset_id}/build", response_model=ProfileBuildResponse)
def build_profile(
    dataset_id: str,
    force: bool = Query(False, description="true면 무조건 재생성"),
    sample_rows: int = Query(5000, ge=100, le=50000, description="샘플링 행 수(큰 CSV 대비)"),
    top_k: int = Query(5, ge=1, le=20, description="top-k 값 개수"),
):
    """
    Profile v1 빌드 + 파일 저장
    결과: metadata/profiles/{dataset_id}.json 생성
    
    파라미터:
    - force: true면 무조건 재생성 (기본값: false, mtime 비교로 스킵 가능)
    - sample_rows: 샘플링할 행 수 (100~50000)
    - top_k: 각 컬럼의 상위 값 개수 (1~20)
    """
    ds = get_dataset(dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        result = build_profile_v1(
            dataset_id,
            sample_rows=sample_rows,
            top_k=top_k,
            force=force,
        )
        # profile_v1.build_profile_v1은 이미 파일을 저장함
        return {
            "dataset_id": result.dataset_id,
            "profile_path": result.path,
            "generated_at": result.built_at,
            "sample_rows_used": result.sample_rows,
            "column_count": result.columns_profiled,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"profile build failed: {str(e)}")


@router.post("/doc/{dataset_id}/build")
def build_doc(
    dataset_id: str,
    group_top_n: int = Query(12, ge=1, le=50, description="그룹별 표시할 컬럼 개수"),
    highlight_top_n: int = Query(12, ge=1, le=50, description="프로필 하이라이트 표시 개수"),
):
    """
    Doc v1 빌드 + 파일 저장
    결과: metadata/docs/{dataset_id}.md 생성
    
    profile과 column_meta를 결합하여 사람이 읽을 수 있는 문서 생성
    
    파라미터:
    - group_top_n: 그룹별 표시할 컬럼 개수 (1~50)
    - highlight_top_n: 프로필 하이라이트 표시 개수 (1~50)
    """
    ds = get_dataset(dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        path = build_doc_v1(
            dataset_id,
            group_top_n=group_top_n,
            highlight_top_n=highlight_top_n,
        )
        return {
            "dataset_id": dataset_id,
            "doc_path": path,
            "group_top_n": group_top_n,
            "highlight_top_n": highlight_top_n,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"Profile not found. Build profile first: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"doc build failed: {str(e)}")


@router.post("/doc/build_all")
def build_all_docs():
    """
    모든 데이터셋의 Doc v1 빌드
    
    각 데이터셋에 대해 문서를 생성합니다.
    프로파일이 없는 데이터셋은 건너뜁니다.
    """
    results = []
    for m in load_registry():
        try:
            path = build_doc_v1(m.dataset_id)
            results.append({"dataset_id": m.dataset_id, "doc_path": path, "ok": True})
        except FileNotFoundError:
            results.append({"dataset_id": m.dataset_id, "ok": False, "error": "Profile not found"})
        except Exception as e:
            results.append({"dataset_id": m.dataset_id, "ok": False, "error": str(e)})

    success_count = sum(1 for r in results if r.get("ok"))
    return {
        "ok": True,
        "total": len(results),
        "success": success_count,
        "failed": len(results) - success_count,
        "results": results,
    }


@router.get("/profile/{dataset_id}")
def get_profile(dataset_id: str):
    """
    Profile v1 읽기 API
    
    metadata/profiles/{dataset_id}.json 파일을 읽어서 JSON 객체로 반환합니다.
    파일이 없으면 404를 반환합니다.
    """
    p = PROFILES_DIR / f"{dataset_id}.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Profile not built yet")
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse profile JSON: {str(e)}")


@router.get("/doc/{dataset_id}", response_class=PlainTextResponse)
def get_doc(dataset_id: str):
    """
    Doc v1 읽기 API
    
    metadata/docs/{dataset_id}.md 파일을 읽어서 Markdown 텍스트로 반환합니다.
    파일이 없으면 404를 반환합니다.
    """
    p = DOCS_DIR / f"{dataset_id}.md"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Doc not built yet")
    return p.read_text(encoding="utf-8")


@router.post("/meta/generated/build")
def build_generated_meta():
    """
    global_columns.generated.yaml 배치 생성 실행
    - patterns.yaml 기반으로 메타데이터 생성 (가장 정확한 방법)
    - scan_and_export와 분리: generated는 column meta 초안 생성 단계
    - column_meta store는 파일 mtime 기반 핫리로드라 서버 재시작 불필요
    """
    script_path = PROJECT_ROOT / "tools" / "generate_meta.py"

    r = subprocess.run(
        [sys.executable, str(script_path), "--method", "patterns"],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
    )

    if r.returncode != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "message": "generated meta build failed",
                "stderr": (r.stderr or "")[-4000:],
                "stdout": (r.stdout or "")[-4000:],
            },
        )

    # column_meta store는 파일 mtime 기반 핫리로드라 서버 재시작 불필요
    return {
        "ok": True,
        "stdout": (r.stdout or "")[-4000:],
    }
```

---

## 5. 라우터 등록 (`backend/app/main.py`)

```python
"""FastAPI 메인 애플리케이션"""
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.datasets import router as datasets_router
from .api.stats import router as stats_router
from .api.admin import router as admin_router
from .api import meta
from .core.metadata_pipeline import refresh_registry_if_needed

app = FastAPI(
    title="ALDList API",
    description="CSV 데이터 분석 API",
    version="1.0.0"
)


# 한글 유니코드 이스케이프 방지를 위한 커스텀 JSON 인코더
class UnicodeJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")


# 기본 JSONResponse를 커스텀 인코더로 교체
app.default_response_class = UnicodeJSONResponse

# 서버 시작 시 메타데이터 확인 및 자동 생성
@app.on_event("startup")
async def startup_event():
    """서버 시작 시 메타데이터 자동 확인"""
    r = refresh_registry_if_needed(force=False)
    if not r.ok:
        print("❌ Registry refresh failed on startup")
        print(r.stderr)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발용: 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(datasets_router)
app.include_router(stats_router)
app.include_router(admin_router)
app.include_router(meta.router)


@app.get("/")
def root():
    """API 정보"""
    return {
        "name": "ALDList API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "datasets": "/api/datasets",
            "preview": "/api/datasets/{dataset_id}/preview",
            "stats": "/api/datasets/{dataset_id}/stats",
            "columns": "/api/datasets/{dataset_id}/columns"
        }
    }
```

---

## 📊 엔드포인트 요약

| 엔드포인트 | 메서드 | 파일 | 함수 |
|-----------|--------|------|------|
| `/api/datasets` | GET | `datasets.py` | `list_datasets()` |
| `/api/datasets/{id}` | GET | `datasets.py` | `get_dataset_meta()` |
| `/api/datasets/{id}/preview` | GET | `datasets.py` | `preview()` |
| `/api/datasets/{id}/columns` | GET | `datasets.py` | `get_dataset_columns()` |
| `/api/datasets/{id}/fields` | GET | `datasets.py` | `get_fields_by_type()` |
| `/api/datasets/{id}/stats` | POST | `stats.py` | `stats()` |
| `/api/meta/types` | GET | `meta.py` | `meta_types()` |
| `/api/admin/refresh` | POST | `admin.py` | `refresh()` |
| `/api/admin/profile/{id}/build` | POST | `admin.py` | `build_profile()` |
| `/api/admin/profile/{id}` | GET | `admin.py` | `get_profile()` |
| `/api/admin/doc/{id}/build` | POST | `admin.py` | `build_doc()` |
| `/api/admin/doc/{id}` | GET | `admin.py` | `get_doc()` |
| `/api/admin/doc/build_all` | POST | `admin.py` | `build_all_docs()` |
| `/api/admin/meta/generated/build` | POST | `admin.py` | `build_generated_meta()` |
