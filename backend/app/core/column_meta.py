"""컬럼 메타데이터 로더"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

import yaml


# 프로젝트 루트/경로가 애매하면 환경변수로 바꿔도 되는데
# 일단은 backend/app/core 기준으로 상대경로 잡아줌
DEFAULT_META_PATH = (
    Path(__file__).resolve().parents[3] / "column_meta" / "global_columns.yaml"
)
# parents[3] 설명:
# backend/app/core/column_meta.py
# -> core(0) -> app(1) -> backend(2) -> aldList(3)


def load_global_column_meta(path: Optional[Path] = None) -> Dict[str, Dict[str, Any]]:
    """
    전역 컬럼 메타데이터 로드
    
    Args:
        path: YAML 파일 경로 (None이면 기본 경로 사용)
    
    Returns:
        컬럼명을 키로 하는 메타데이터 딕셔너리
    """
    meta_path = path or DEFAULT_META_PATH
    if not meta_path.exists():
        return {}

    try:
        with meta_path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
    except Exception as e:
        print(f"⚠️  컬럼 메타데이터 로드 실패: {e}")
        return {}

    # 반드시 dict 형태로 정리
    if not isinstance(data, dict):
        return {}

    out: Dict[str, Dict[str, Any]] = {}
    for key, val in data.items():
        if isinstance(key, str) and isinstance(val, dict):
            out[key] = {"key": key, **val}
    return out

