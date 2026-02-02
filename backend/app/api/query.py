"""컬럼 검색 쿼리 API"""

from __future__ import annotations

import re
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/query", tags=["query"])

# 프로젝트 루트 추정 (backend/app/api/query.py 기준)
PROJECT_ROOT = Path(__file__).resolve().parents[3]
META_DIR = PROJECT_ROOT / "metadata"
COLMETA_DIR = PROJECT_ROOT / "column_meta"

DATASETS_JSON = META_DIR / "datasets.json"
GLOBAL_YAML = COLMETA_DIR / "global_columns.yaml"
GENERATED_YAML = COLMETA_DIR / "global_columns.generated.yaml"


# -------------------------
# Schemas (최소 계약)
# -------------------------
class QueryRequest(BaseModel):
    query: str = Field(..., description="자연어 질의/키워드")
    dataset_id: Optional[str] = Field(None, description="특정 데이터셋 범위로 제한할지")
    k: int = Field(8, ge=1, le=50, description="반환 개수")
    type: Optional[str] = Field(None, description="type 필터 (gas/temperature/...)")
    include_text: bool = Field(False, description="디버그용 text 포함 여부")


class QueryHit(BaseModel):
    id: str
    column: str
    score: float
    type: str = "unknown"
    category: str = ""
    unit: str = ""
    title: str = ""
    desc: str = ""


class QueryResponse(BaseModel):
    query: str
    dataset_id: Optional[str]
    results: List[QueryHit]


# -------------------------
# Helpers
# -------------------------
def _safe_load_yaml(p: Path) -> Dict[str, Any]:
    if not p.exists():
        return {}
    with p.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data if isinstance(data, dict) else {}


def _safe_load_json(p: Path) -> Any:
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def _load_dataset_columns(dataset_id: str) -> List[str]:
    """metadata/datasets.json에서 dataset_id의 columns 가져오기"""
    reg = _safe_load_json(DATASETS_JSON)
    if not isinstance(reg, list):
        return []
    for ds in reg:
        if isinstance(ds, dict) and ds.get("dataset_id") == dataset_id:
            cols = ds.get("columns") or []
            return [str(c) for c in cols if isinstance(c, (str, int, float))]
    return []


def _merge_column_meta() -> Dict[str, Dict[str, Any]]:
    """
    global_columns.yaml(확정) + global_columns.generated.yaml(초안)을 합침
    - 확정 레이어 우선
    - generated는 빈칸 보강
    """
    g = _safe_load_yaml(GLOBAL_YAML)
    gen = _safe_load_yaml(GENERATED_YAML)

    out: Dict[str, Dict[str, Any]] = {}
    if isinstance(gen, dict):
        for k, v in gen.items():
            if isinstance(k, str) and isinstance(v, dict):
                out[k] = dict(v)

    if isinstance(g, dict):
        for k, v in g.items():
            if isinstance(k, str) and isinstance(v, dict):
                # global이 최우선으로 덮어씀
                base = out.get(k, {})
                merged = dict(base)
                merged.update(v)
                out[k] = merged

    return out


def _tokenize(q: str) -> List[str]:
    q = (q or "").strip().lower()
    if not q:
        return []
    # 한글/영문/숫자 토큰을 대충 분리
    toks = re.split(r"[\s,;:/\(\)\[\]\{\}\-_\.\+]+", q)
    toks = [t for t in toks if t]
    return toks


def _score_text(text: str, toks: List[str]) -> float:
    """
    초간단 스코어:
    - 토큰이 등장하면 +1
    - 더 많이 등장하면 조금 가산
    """
    if not text:
        return 0.0
    t = text.lower()
    s = 0.0
    for tok in toks:
        if not tok:
            continue
        cnt = t.count(tok)
        if cnt > 0:
            s += 1.0 + min(0.5, 0.1 * (cnt - 1))
    return s


@router.post("", response_model=QueryResponse)
def query(req: QueryRequest) -> QueryResponse:
    toks = _tokenize(req.query)
    meta_map = _merge_column_meta()

    # 검색 대상 컬럼 범위 결정
    if req.dataset_id:
        cols = _load_dataset_columns(req.dataset_id)
    else:
        # dataset_id 없으면 메타 전체 키를 대상으로
        cols = sorted(meta_map.keys())

    hits: List[QueryHit] = []

    for col in cols:
        m = meta_map.get(col, {}) if isinstance(meta_map.get(col), dict) else {}
        t = (m.get("type") or "unknown").strip()

        # type 필터
        if req.type and t != req.type:
            continue

        title = (m.get("title") or "").strip()
        desc = (m.get("desc") or "").strip()
        cat = (m.get("category") or "").strip()
        unit = (m.get("unit") or "").strip()

        # 검색용 텍스트(룰 기반)
        text = f"{col} {title} {desc} type:{t} category:{cat} unit:{unit}".strip()

        score = _score_text(text, toks)

        # 컬럼명 exact/부분매칭 보너스
        ql = (req.query or "").strip().lower()
        if ql and col.lower() == ql:
            score += 5.0
        elif ql and ql in col.lower():
            score += 2.0

        if score <= 0:
            continue

        hits.append(
            QueryHit(
                id=f"column:{col}",
                column=col,
                score=float(score),
                type=t or "unknown",
                category=cat,
                unit=unit,
                title=title,
                desc=desc,
            )
        )

    hits.sort(key=lambda x: x.score, reverse=True)
    hits = hits[: req.k]

    return QueryResponse(query=req.query, dataset_id=req.dataset_id, results=hits)
