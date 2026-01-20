#!/usr/bin/env python3
"""
메타데이터 생성 통합 스크립트

사용법:
  python generate_meta.py --method patterns    # patterns.yaml 기반 생성
  python generate_meta.py --method inference   # 컬럼명 패턴 추론 기반 생성
  python generate_meta.py --method frequency   # 빈도 기반 seed 생성
  python generate_meta.py --method all         # 모든 방법 순차 실행
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Dict, Any

try:
    from utils import (
        PROJECT_ROOT,
        META_DIR,
        METADATA_DIR,
        safe_load_yaml,
        write_yaml,
        load_columns_union,
    )
except ImportError:
    # tools 디렉토리에서 직접 실행할 때
    sys.path.insert(0, str(Path(__file__).parent))
    from utils import (
        PROJECT_ROOT,
        META_DIR,
        METADATA_DIR,
        safe_load_yaml,
        write_yaml,
        load_columns_union,
    )

GLOBAL_PATH = META_DIR / "global_columns.yaml"
GENERATED_PATH = META_DIR / "global_columns.generated.yaml"

# backend 모듈 import 가능하게
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.column_meta import generate_meta_for_column  # noqa: E402


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


def infer_meta(col: str) -> Dict[str, Any]:
    """
    컬럼명을 기반으로 기본 메타데이터 추론
    
    Args:
        col: 컬럼명 (예: "TempAct_U", "MFCMon_DCS")
    
    Returns:
        메타데이터 딕셔너리
    """
    meta: Dict[str, Any] = {
        "title": col,
        "type": "unknown",
        "category": "unknown",
        "equipment_field": col,
        "unit": "",
        "desc": "자동 생성된 컬럼 설명. 추후 보완 필요."
    }

    # MFC 관련 (가스 유량)
    if col.startswith("MFC"):
        meta["type"] = "gas"
        meta["category"] = "process"
        meta["unit"] = "SLM"
        meta["desc"] = (
            f"{col}은 반도체 장비에서 사용되는 가스 유량 관련 필드입니다. "
            "Mass Flow Controller(MFC)를 통해 제어되며 공정 조건에 영향을 줍니다."
        )
    
    # Temperature 관련
    elif col.startswith("Temp"):
        meta["type"] = "temperature"
        meta["category"] = "process"
        meta["unit"] = "℃"
        if "Act" in col:
            meta["desc"] = "반도체 공정 중 챔버 또는 히터의 온도 실제 측정값입니다."
        elif "Set" in col or "Targ" in col:
            meta["desc"] = "반도체 공정 중 챔버 또는 히터의 온도 설정값(목표값)입니다."
        else:
            meta["desc"] = "반도체 공정 중 챔버 또는 히터의 온도 관련 필드입니다."
    
    # Heater Power 관련
    elif col.startswith("Power"):
        meta["type"] = "heater"
        meta["category"] = "control"
        meta["unit"] = "%"
        meta["desc"] = "히터 파워 출력 값을 나타내는 필드입니다. 공정 온도 제어에 사용됩니다."
    
    # Heater/Cascade TC 관련
    elif col.startswith("HeaterTC") or col.startswith("CascadeTC"):
        meta["type"] = "temperature"
        meta["category"] = "process"
        meta["unit"] = "℃"
        meta["desc"] = "Thermocouple(TC)를 통한 온도 측정값입니다."
    
    # Pressure 관련
    elif col.startswith("Press") or col.startswith("VG") or col.startswith("APC"):
        meta["type"] = "pressure"
        if col.startswith("APC"):
            meta["category"] = "control"
            meta["unit"] = "%"
            meta["desc"] = "APC(Advanced Pressure Control) 밸브 관련 필드입니다. 압력 제어를 위해 사용됩니다."
        else:
            meta["category"] = "process"
            meta["unit"] = "Torr"
            if "Act" in col:
                meta["desc"] = "챔버 내부 압력의 실제 측정값입니다."
            elif "Set" in col:
                meta["desc"] = "챔버 내부 압력의 설정값(목표값)입니다."
            else:
                meta["desc"] = "챔버 내부 압력과 관련된 필드입니다."
    
    # Valve 관련
    elif col.startswith("Valve"):
        meta["type"] = "valve"
        meta["category"] = "control"
        if "Act" in col:
            meta["desc"] = "밸브의 실제 동작 상태 또는 값입니다."
        elif "Ctrl" in col or "Set" in col:
            meta["desc"] = "밸브의 제어 또는 설정 값입니다."
        else:
            meta["desc"] = "밸브 제어 관련 필드입니다."
    
    # AUX (보조 센서) 관련
    elif col.startswith("AUX"):
        meta["type"] = "aux"
        meta["category"] = "support"
        meta["desc"] = "장비 보조 센서 또는 모니터링용 필드입니다."
    
    # OverHeat 관련
    elif col.startswith("OverHeat") or col.startswith("O.HT"):
        meta["type"] = "temperature"
        meta["category"] = "safety"
        meta["unit"] = "℃"
        meta["desc"] = "과열 방지 또는 모니터링 관련 온도 필드입니다."
    
    # Slow Vac Rate 관련
    elif col.startswith("SlowVac") or "SlowVac" in col:
        meta["type"] = "pressure"
        meta["category"] = "control"
        meta["desc"] = "저속 진공 펌핑 속도 관련 필드입니다."
    
    # 시스템 필드 (Date, Time, Recipe, Step 등)
    elif col in ["Date", "Time"]:
        meta["type"] = "timestamp"
        meta["category"] = "system"
        meta["desc"] = "데이터가 기록된 시각 정보입니다."
    elif col == "No.":
        meta["type"] = "index"
        meta["category"] = "system"
        meta["desc"] = "데이터 행 번호입니다."
    elif "Recipe" in col or "Step" in col:
        meta["type"] = "recipe"
        meta["category"] = "system"
        if "Recipe" in col:
            meta["desc"] = "실행 중인 공정 레시피 관련 정보입니다."
        elif "Step" in col:
            meta["desc"] = "현재 실행 중인 레시피 스텝 정보입니다."
    
    return meta


def generate_by_patterns() -> None:
    """patterns.yaml 기반 메타데이터 생성"""
    print("=" * 60)
    print("📋 Method: patterns.yaml 기반 생성")
    print("=" * 60)
    
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
        base.pop("key", None)
        base.pop("auto_generated", None)

        if c not in out:
            out[c] = base
            created += 1
        else:
            # 기존 초안이 있으면 업데이트
            out[c] = {**out[c], **base}
            updated += 1

    write_yaml(GENERATED_PATH, out)

    print(f"columns_union: {len(cols)}")
    print(f"global_columns: {len(global_meta)}")
    print(f"generated_written: {GENERATED_PATH}")
    print(f"created: {created}, updated: {updated}")
    print("=" * 60)


def generate_by_inference() -> None:
    """컬럼명 패턴 추론 기반 메타데이터 생성"""
    print("=" * 60)
    print("📋 Method: 컬럼명 패턴 추론 기반 생성")
    print("=" * 60)
    
    columns = load_columns_union()
    print(f"✅ {len(columns)}개 컬럼 발견")
    
    # 각 컬럼에 대해 메타데이터 생성
    print("🔧 메타데이터 생성 중...")
    out = {}
    for col in columns:
        if not isinstance(col, str):
            continue
        out[col] = infer_meta(col)
    
    # 출력 디렉토리 생성
    GENERATED_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    # YAML 파일로 저장
    print(f"💾 저장 중: {GENERATED_PATH}")
    write_yaml(GENERATED_PATH, out, sort_keys=False)
    
    print(f"✅ 생성 완료: {len(out)}개 컬럼 메타데이터")
    print(f"📁 출력 파일: {GENERATED_PATH}")
    print("=" * 60)


def generate_by_frequency() -> None:
    """빈도 기반 seed 생성"""
    print("=" * 60)
    print("📋 Method: 빈도 기반 seed 생성")
    print("=" * 60)
    
    union_path = METADATA_DIR / "columns_union.json"
    by_file_path = METADATA_DIR / "columns_by_file.json"

    if not union_path.exists() or not by_file_path.exists():
        raise SystemExit(
            "Run tools/scan_and_export.py first (need columns_union.json, columns_by_file.json)"
        )

    union = json.loads(union_path.read_text(encoding="utf-8"))
    by_file = json.loads(by_file_path.read_text(encoding="utf-8"))

    print(f"📊 columns_union.json: {len(union)} 컬럼")
    print(f"📊 columns_by_file.json: {len(by_file)} 파일")

    # 컬럼 출현 빈도(몇 개 파일에 등장하나)
    cnt = Counter()
    for _path, cols in by_file.items():
        if isinstance(cols, list):
            for c in cols:
                cnt[c] += 1

    # 상위 빈도 컬럼부터 seed 생성
    items = []
    for col in union:
        freq = cnt.get(col, 0)
        items.append((freq, col))
    items.sort(reverse=True)

    # 기존 global_columns.yaml이 있으면 제외
    existing_cols = set()
    if GLOBAL_PATH.exists():
        existing_data = safe_load_yaml(GLOBAL_PATH)
        if existing_data:
            existing_cols = set(existing_data.keys())
            print(f"📋 global_columns.yaml: {len(existing_cols)} 컬럼 이미 존재")

    out = {}
    skipped = 0
    for freq, col in items:
        # 이미 존재하는 건 생성하지 않도록
        if col in existing_cols:
            skipped += 1
            continue

        out[col] = {
            "title": col,
            "type": "unknown",
            "category": "auto",
            "unit": "",
            "equipment_field": col,
            "desc": f"[AUTO-SEED] 파일 {freq}개에서 발견됨. 설명을 구체화하세요.",
        }

    print(f"⏭️  기존 컬럼 제외: {skipped}개")
    print(f"✨ 새로 생성: {len(out)}개")

    write_yaml(GENERATED_PATH, out, sort_keys=False)
    print(f"✅ OK -> wrote {GENERATED_PATH} ({len(out)} cols)")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="메타데이터 생성 통합 스크립트",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예시:
  python generate_meta.py --method patterns    # patterns.yaml 기반 생성
  python generate_meta.py --method inference   # 컬럼명 패턴 추론 기반 생성
  python generate_meta.py --method frequency   # 빈도 기반 seed 생성
  python generate_meta.py --method all         # 모든 방법 순차 실행
        """
    )
    parser.add_argument(
        "--method",
        choices=["patterns", "inference", "frequency", "all"],
        default="patterns",
        help="생성 방법 선택 (기본값: patterns)"
    )
    
    args = parser.parse_args()
    
    if args.method == "patterns":
        generate_by_patterns()
    elif args.method == "inference":
        generate_by_inference()
    elif args.method == "frequency":
        generate_by_frequency()
    elif args.method == "all":
        generate_by_patterns()
        print("\n")
        generate_by_inference()
        print("\n")
        generate_by_frequency()
    
    print("\n다음 단계:")
    print("1) column_meta/global_columns.generated.yaml 검수")
    print("2) 확정된 항목만 global_columns.yaml로 옮기기(승격)")
    print("3) 서버는 자동으로 반영(hot reload)")


if __name__ == "__main__":
    main()
