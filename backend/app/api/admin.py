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

from ..core.metadata_pipeline import refresh_registry_if_needed
from ..core.registry import get_dataset, load_registry
from ..core.profile_v1 import build_profile_v1
from ..core.doc_v1 import build_doc_v1
from ..core.settings import PROFILES_DIR, DOCS_DIR
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

    # dataset_count 계산
    try:
        datasets = load_registry()
        dataset_count = len(datasets)
    except Exception:
        dataset_count = 0

    # ✅ scan 이후 캐시 정리 (메모리/뷰 누적 방지)
    # 다음 preview/stats에서 새 fingerprint로 view 재생성
    get_cache().clear_all()

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
