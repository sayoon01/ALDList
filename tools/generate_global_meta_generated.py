#!/usr/bin/env python3
# tools/generate_global_meta_generated.py

from __future__ import annotations

import os
import json
from pathlib import Path
from typing import Dict, Any, List

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
META_DIR = PROJECT_ROOT / "column_meta"
GLOBAL_PATH = META_DIR / "global_columns.yaml"
GENERATED_PATH = META_DIR / "global_columns.generated.yaml"

METADATA_DIR = PROJECT_ROOT / "metadata"
COLUMNS_UNION_PATH = METADATA_DIR / "columns_union.json"

# backend 모듈 import 가능하게
import sys
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.column_meta import generate_meta_for_column  # noqa: E402


def safe_load_yaml(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return data if isinstance(data, dict) else {}


def write_yaml(path: Path, data: Dict[str, Any]) -> None:
    text = yaml.safe_dump(data, allow_unicode=True, sort_keys=True)
    path.write_text(text, encoding="utf-8")


def load_columns_union() -> List[str]:
    if not COLUMNS_UNION_PATH.exists():
        raise SystemExit(f"missing: {COLUMNS_UNION_PATH} (run scan_and_export first)")
    cols = json.loads(COLUMNS_UNION_PATH.read_text(encoding="utf-8"))
    if not isinstance(cols, list):
        raise SystemExit("columns_union.json is not a list")
    return [c for c in cols if isinstance(c, str) and c.strip()]


def enrich_desc_rule_based(col: str, meta: Dict[str, Any]) -> Dict[str, Any]:
    """
    규칙 기반으로 desc를 조금 더 '구체적으로' 만드는 확장 포인트.
    여기서 장비/공정 도메인 지식에 맞춰 계속 늘려가면 됨.
    """
    t = (meta.get("type") or "").strip()

    # 이미 충분히 길면 패스
    desc = meta.get("desc") or ""
    if isinstance(desc, str) and len(desc) >= 25 and "설명 없음" not in desc:
        return meta

    # 예시: MFC류
    if col.startswith(("MFCMon_", "MFCRcpSet_", "MFCRamp_", "MFCInput_")):
        name = col.split("_", 1)[1] if "_" in col else col
        meta["desc"] = f"{col}: MFC(Mass Flow Controller) 관련 유량/설정/입력 값입니다. 대상 라인/가스/채널은 '{name}' 부분을 참고하세요."
        meta.setdefault("unit", "SLM")
        meta.setdefault("type", "gas")
        meta.setdefault("category", "process")

    # 온도류
    elif col.startswith(("TempAct_", "TempSet_", "TempTarg_", "HeaterTC_", "CascadeTC_")) or t == "temperature":
        meta["desc"] = f"{col}: 챔버/히터/센서 온도 관련 측정/설정 값입니다. zone/부품 코드는 컬럼명 토큰을 기준으로 구분합니다."
        meta.setdefault("unit", "℃")
        meta.setdefault("type", "temperature")
        meta.setdefault("category", "monitor")

    # 압력류
    elif col.startswith(("Press", "VG11", "VG12", "VG13")) or t == "pressure":
        meta["desc"] = f"{col}: 챔버 압력 관련 값(측정/설정/게이지)입니다. 공정 안정성과 제어(밸브/APC)에 직접 영향이 있습니다."
        meta.setdefault("unit", "Torr")
        meta.setdefault("type", "pressure")
        meta.setdefault("category", "monitor")

    # AUX류
    elif col.startswith(("AUXMon_", "AuxMon_", "AUX_")) or t == "aux":
        meta["desc"] = f"{col}: 장비 보조 센서/모니터링 값입니다. 상세 의미는 장비 매뉴얼/레시피 정의에 따라 달라질 수 있습니다."
        meta.setdefault("type", "aux")
        meta.setdefault("category", "support")

    # 밸브류
    elif col.startswith(("ValveAct_", "ValveCtrl_", "ValveSet_")) or t == "valve":
        meta["desc"] = f"{col}: 밸브 채널 상태/제어/설정 값입니다. 채널 번호는 컬럼명 suffix를 기준으로 해석합니다."
        meta.setdefault("type", "valve")
        meta.setdefault("category", "control")

    # fallback
    else:
        # patterns fallback 그대로 두되, 너무 빈약하면 개선
        if not isinstance(desc, str) or not desc.strip() or "설명 없음" in desc:
            meta["desc"] = f"{col}: 아직 확정된 설명이 없습니다. 추후 global_columns.yaml에 승격하여 도메인 정의를 고정하세요."
        meta.setdefault("type", t or "unknown")
        meta.setdefault("category", "unknown")

    return meta


def main() -> None:
    cols = load_columns_union()
    global_meta = safe_load_yaml(GLOBAL_PATH)

    # 기존 generated가 있으면 이어서 업데이트 (덮어쓰지 않고 누적)
    generated_old = safe_load_yaml(GENERATED_PATH)

    out: Dict[str, Any] = dict(generated_old)

    created = 0
    updated = 0

    for c in cols:
        # global에 이미 있으면 generated로 만들 필요 없음
        if c in global_meta:
            continue

        base = generate_meta_for_column(c)  # patterns 기반
        base = enrich_desc_rule_based(c, base)

        # generated는 "초안"이라 auto_generated 유지 가능
        # key는 YAML 키 자체가 컬럼명이므로 내부 key는 굳이 안 넣어도 되지만, 호환 위해 넣어둠
        base.pop("key", None)
        base.pop("auto_generated", None)

        if c not in out:
            out[c] = base
            created += 1
        else:
            # 기존 초안이 있으면 업데이트(확장 가능: conflict 정책을 더 정교하게)
            out[c] = {**out[c], **base}
            updated += 1

    write_yaml(GENERATED_PATH, out)

    print("=" * 60)
    print(f"columns_union: {len(cols)}")
    print(f"global_columns: {len(global_meta)}")
    print(f"generated_written: {GENERATED_PATH}")
    print(f"created: {created}, updated: {updated}")
    print("=" * 60)
    print("다음 단계:")
    print("1) column_meta/global_columns.generated.yaml 검수")
    print("2) 확정된 항목만 global_columns.yaml로 옮기기(승격)")
    print("3) 서버는 자동으로 반영(hot reload)")
    print("=" * 60)


if __name__ == "__main__":
    main()
