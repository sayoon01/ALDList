#!/usr/bin/env python3
"""
공통 유틸리티 함수 모듈
tools 디렉토리의 스크립트들이 공통으로 사용하는 함수들
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, Any, List

try:
    import yaml
except ImportError:
    print("❌ PyYAML이 설치되지 않았습니다. 설치해주세요: pip install pyyaml")
    sys.exit(1)

# 프로젝트 경로 상수
PROJECT_ROOT = Path(__file__).resolve().parents[1]
META_DIR = PROJECT_ROOT / "column_meta"
METADATA_DIR = PROJECT_ROOT / "metadata"
DATA_DIR = PROJECT_ROOT / "data"


def safe_load_yaml(path: Path) -> Dict[str, Any]:
    """
    YAML 파일을 안전하게 로드
    
    Args:
        path: YAML 파일 경로
        
    Returns:
        로드된 딕셔너리 (파일이 없거나 형식이 잘못된 경우 빈 딕셔너리)
    """
    if not path.exists():
        return {}
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"⚠️  YAML 로드 실패 ({path}): {e}")
        return {}


def write_yaml(path: Path, data: Dict[str, Any], **kwargs) -> None:
    """
    YAML 파일로 저장
    
    Args:
        path: 저장할 파일 경로
        data: 저장할 딕셔너리
        **kwargs: yaml.safe_dump에 전달할 추가 옵션
    """
    default_kwargs = {
        "allow_unicode": True,
        "sort_keys": kwargs.get("sort_keys", True),
        "default_flow_style": False,
    }
    default_kwargs.update(kwargs)
    
    text = yaml.safe_dump(data, **default_kwargs)
    path.write_text(text, encoding="utf-8")


def load_columns_union() -> List[str]:
    """
    metadata/columns_union.json 파일을 로드
    
    Returns:
        컬럼명 리스트
        
    Raises:
        SystemExit: 파일이 없거나 형식이 잘못된 경우
    """
    path = METADATA_DIR / "columns_union.json"
    if not path.exists():
        raise SystemExit(f"missing: {path} (run scan_and_export.py first)")
    
    try:
        cols = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(cols, list):
            raise SystemExit("columns_union.json is not a list")
        return [c for c in cols if isinstance(c, str) and c.strip()]
    except json.JSONDecodeError as e:
        raise SystemExit(f"JSON 파싱 실패 ({path}): {e}")


def load_type_labels() -> Dict[str, str]:
    """
    patterns.yaml에서 type_labels를 읽어옴
    
    Returns:
        타입 -> 라벨 매핑 딕셔너리
    """
    patterns_path = META_DIR / "patterns.yaml"
    data = safe_load_yaml(patterns_path)
    type_labels = data.get("type_labels") or {}
    return type_labels if isinstance(type_labels, dict) else {}


def ensure_file_exists(path: Path, description: str = "파일") -> None:
    """
    파일 존재 여부 확인
    
    Args:
        path: 확인할 파일 경로
        description: 파일 설명 (에러 메시지에 사용)
        
    Raises:
        SystemExit: 파일이 없는 경우
    """
    if not path.exists():
        print(f"❌ {description}을(를) 찾을 수 없습니다: {path}")
        sys.exit(1)


def safe_load_json(path: Path) -> Any:
    """
    JSON 파일을 안전하게 로드
    
    Args:
        path: JSON 파일 경로
        
    Returns:
        로드된 데이터 (파일이 없으면 None)
    """
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"⚠️  JSON 로드 실패 ({path}): {e}")
        return None


def normalize_key(s: str) -> str:
    """키 문자열 정규화"""
    return s.strip()
