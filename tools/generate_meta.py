#!/usr/bin/env python3
"""
메타데이터 생성 통합 스크립트

사용법:
  python generate_meta.py --method patterns    # patterns.yaml 기반 생성
  python generate_meta.py --method inference   # 컬럼명 패턴 추론 기반 생성
  python generate_meta.py --method frequency   # 빈도 기반 seed 생성
  python generate_meta.py --method heuristic   # 휴리스틱 기반 생성 (LLM 전 단계, 리포트 포함)
  python generate_meta.py --method all         # 모든 방법 순차 실행
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Any, Optional

try:
    from utils import (
        PROJECT_ROOT,
        META_DIR,
        METADATA_DIR,
        safe_load_yaml,
        safe_load_json,
        write_yaml,
        load_columns_union,
        normalize_key,
    )
except ImportError:
    # tools 디렉토리에서 직접 실행할 때
    sys.path.insert(0, str(Path(__file__).parent))
    from utils import (
        PROJECT_ROOT,
        META_DIR,
        METADATA_DIR,
        safe_load_yaml,
        safe_load_json,
        write_yaml,
        load_columns_union,
        normalize_key,
    )

GLOBAL_PATH = META_DIR / "global_columns.yaml"
GENERATED_PATH = META_DIR / "global_columns.generated.yaml"
PATTERNS_PATH = META_DIR / "patterns.yaml"
REGISTRY_PATH = METADATA_DIR / "datasets.json"
UNION_PATH = METADATA_DIR / "columns_union.json"

# 리포트 출력 디렉토리
REPORT_DIR = METADATA_DIR / "reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_JSON = REPORT_DIR / "column_meta_suggestions.json"
REPORT_MD = REPORT_DIR / "column_meta_suggestions.md"

# 기본 설명에서 제외할 문구
DEFAULT_DESC_BAD_PHRASES = [
    "설명 없음",
    "자동 생성",
    "global_columns.yaml에 추가 가능",
]

# backend 모듈 import 가능하게
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.core.column_meta import generate_meta_for_column  # noqa: E402


@dataclass
class Suggestion:
    """메타데이터 제안"""
    key: str
    title: str
    type: str
    unit: str = ""
    category: str = ""
    desc: str = ""
    confidence: float = 0.5
    reason: str = ""


def looks_bad_desc(desc: Optional[str]) -> bool:
    """설명이 부실한지 판단"""
    if not desc:
        return True
    d = desc.strip()
    if not d:
        return True
    for phrase in DEFAULT_DESC_BAD_PHRASES:
        if phrase in d:
            return True
    return False


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

        base = generate_meta_for_column(c)  # patterns.yaml 기반 (하드코딩 없음)
        # enrich_desc_rule_based() 제거: 모든 규칙은 patterns.yaml에서 관리

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


def infer_from_name(col: str) -> Suggestion:
    """
    컬럼명 기반 초안 생성(보수적으로).
    - LLM 없이도 그럴듯한 기본 설명을 주는 레이어.
    - patterns.yaml이 못 잡는 컬럼을 최소한으로 커버.
    """
    c = col
    lower = c.lower()

    # 1) timestamp/recipe/index 같은 메타성 키워드
    if any(k in lower for k in ["time", "date", "timestamp"]):
        return Suggestion(
            key=c, title=c, type="timestamp",
            desc="시간/일자 관련 필드입니다(자동 초안).", confidence=0.7,
            reason="name contains time/date/timestamp",
        )
    if "recipe" in lower or "step" in lower:
        return Suggestion(
            key=c, title=c, type="recipe",
            desc="레시피/스텝 관련 필드입니다(자동 초안).", confidence=0.65,
            reason="name contains recipe/step",
        )
    if lower in ["no", "no.", "index", "idx"] or "index" in lower:
        return Suggestion(
            key=c, title=c, type="index",
            desc="행 번호/인덱스 성격의 필드입니다(자동 초안).", confidence=0.7,
            reason="name indicates index/no",
        )

    # 2) 압력/온도/밸브/가스 등 기계적 키워드
    if re.search(r"(press|vg\d+|torr)", lower):
        return Suggestion(
            key=c, title=c, type="pressure", unit="Torr",
            desc="압력 관련 필드입니다(자동 초안).", confidence=0.6,
            reason="name indicates pressure",
        )
    if re.search(r"(temp|tc|heater)", lower):
        return Suggestion(
            key=c, title=c, type="temperature", unit="℃",
            desc="온도/열 관련 필드입니다(자동 초안).", confidence=0.6,
            reason="name indicates temperature/heater",
        )
    if re.search(r"(valve|apc)", lower):
        return Suggestion(
            key=c, title=c, type="valve",
            desc="밸브/제어 관련 필드입니다(자동 초안).", confidence=0.55,
            reason="name indicates valve/apc",
        )
    if re.search(r"(mfc|slm|flow|gas)", lower):
        return Suggestion(
            key=c, title=c, type="gas", unit="SLM",
            desc="가스 유량/가스 관련 필드입니다(자동 초안).", confidence=0.55,
            reason="name indicates gas/mfc/flow",
        )
    if re.search(r"(aux|dcs|fs\d+)", lower):
        return Suggestion(
            key=c, title=c, type="aux",
            desc="보조 센서/모니터링 성격의 필드입니다(자동 초안).", confidence=0.55,
            reason="name indicates aux",
        )

    # default unknown
    return Suggestion(
        key=c, title=c, type="unknown",
        desc="설명이 추가로 필요합니다(자동 초안).", confidence=0.35,
        reason="fallback unknown",
    )


def merge_keep_best(existing: Dict[str, Any], sug: Suggestion) -> Dict[str, Any]:
    """
    generated.yaml에 이미 entry가 있으면:
    - confidence 비교로 더 좋은 쪽 유지
    - 사용자 편집을 고려해서 existing에 custom 필드가 있으면 유지
    """
    if not existing:
        return {
            "title": sug.title,
            "type": sug.type,
            "unit": sug.unit,
            "category": sug.category,
            "desc": sug.desc,
            "confidence": float(sug.confidence),
            "_reason": sug.reason,
            "_source": "batch_v1",
        }

    old_conf = float(existing.get("confidence", 0.0) or 0.0)
    new_conf = float(sug.confidence)

    # 기존이 더 신뢰 높으면 유지
    if old_conf >= new_conf:
        return existing

    # 새 제안으로 갱신 (하지만 기존의 임의 필드는 유지)
    out = dict(existing)
    out.update({
        "title": sug.title,
        "type": sug.type,
        "unit": sug.unit,
        "category": sug.category,
        "desc": sug.desc,
        "confidence": new_conf,
        "_reason": sug.reason,
        "_source": "batch_v1",
    })
    return out


def should_generate_for_column(col: str, global_meta: Dict[str, Any], current_meta: Dict[str, Any]) -> bool:
    """
    generated를 만들 대상 조건:
    - global_columns.yaml에 이미 있으면 스킵(사람이 이미 정의)
    - 현재 meta(type/desc)가 부실하거나 unknown이면 생성
    """
    if col in global_meta:
        return False

    t = current_meta.get("type")
    desc = current_meta.get("desc")

    if (not isinstance(t, str)) or (t.strip() == ""):
        return True

    if t == "unknown":
        return True

    if looks_bad_desc(desc):
        return True

    return False


def generate_by_heuristic() -> None:
    """
    휴리스틱 기반 메타데이터 생성 (LLM 전 단계)
    - patterns.yaml이 못 잡는 컬럼을 최소한으로 커버
    - confidence 기반으로 더 나은 제안 유지
    - 리포트 자동 생성
    """
    print("=" * 60)
    print("📋 Method: 휴리스틱 기반 생성 (LLM 전 단계)")
    print("=" * 60)

    # load base sources
    patterns = safe_load_yaml(PATTERNS_PATH)
    global_meta = safe_load_yaml(GLOBAL_PATH)  # 사람이 만든 것
    generated_meta = safe_load_yaml(GENERATED_PATH)  # 초안 누적

    # columns list: union 우선, 없으면 registry에서 합치기
    cols: List[str] = []
    if UNION_PATH.exists():
        cols_raw = safe_load_json(UNION_PATH)
        if isinstance(cols_raw, list):
            cols = [str(x) for x in cols_raw]
    
    if not cols and REGISTRY_PATH.exists():
        reg = safe_load_json(REGISTRY_PATH)
        if isinstance(reg, list):
            s = set()
            for ds in reg:
                if isinstance(ds, dict):
                    for c in (ds.get("columns") or []):
                        s.add(str(c))
            cols = sorted(s)

    if not cols:
        raise SystemExit("No columns found. Run scan_and_export.py first.")

    # build current meta by patterns+heuristic (LLM 전단계)
    created = 0
    updated = 0
    skipped = 0

    report_items = []

    for col in cols:
        col = normalize_key(col)
        if not col:
            continue

        # base meta: patterns가 있으면 그걸 쓰되, 없으면 heuristic
        # 여기서 "patterns 기반 meta를 직접 실행"하려면 server의 column_meta 로직을 import하는 게 정석이지만
        # tools는 단독 실행이 많아서, 여기서는 heuristic로 최소 초안 생성.
        base_sug = infer_from_name(col)

        # 현재 meta(대상 판단용): 우선 heuristic를 사용
        current_meta = {
            "type": base_sug.type,
            "desc": base_sug.desc,
        }

        if not should_generate_for_column(col, global_meta, current_meta):
            skipped += 1
            continue

        old = generated_meta.get(col) if isinstance(generated_meta.get(col), dict) else {}
        merged = merge_keep_best(old or {}, base_sug)

        if not old:
            created += 1
        else:
            # 바뀌었는지 단순 비교
            if json.dumps(old, sort_keys=True, ensure_ascii=False) != json.dumps(merged, sort_keys=True, ensure_ascii=False):
                updated += 1

        generated_meta[col] = merged
        report_items.append({
            "column": col,
            "suggested": merged,
        })

    # write outputs
    write_yaml(GENERATED_PATH, generated_meta, sort_keys=False)

    # 리포트 JSON 생성
    REPORT_JSON.write_text(
        json.dumps(
            {
                "created": created,
                "updated": updated,
                "skipped": skipped,
                "total_columns": len(cols),
                "generated_path": str(GENERATED_PATH),
                "notes": "This is draft metadata. Promote good entries to global_columns.yaml after review.",
                "items": report_items[:2000],  # 너무 커지는 거 방지
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    # markdown summary (간단 리포트)
    md_lines = []
    md_lines.append("# Column Meta Suggestions (Draft)\n")
    md_lines.append(f"- total_columns: {len(cols)}")
    md_lines.append(f"- created: {created}")
    md_lines.append(f"- updated: {updated}")
    md_lines.append(f"- skipped: {skipped}\n")

    md_lines.append("## Recent suggestions (top 50)\n")
    for it in report_items[:50]:
        col = it["column"]
        s = it["suggested"]
        md_lines.append(f"### {col}")
        md_lines.append(f"- type: `{s.get('type', '')}`  unit: `{s.get('unit', '')}`  conf: `{s.get('confidence', '')}`")
        md_lines.append(f"- desc: {s.get('desc', '')}")
        md_lines.append(f"- reason: {s.get('_reason', '')}\n")

    REPORT_MD.write_text("\n".join(md_lines), encoding="utf-8")

    print(f"total_columns: {len(cols)}")
    print(f"created: {created}")
    print(f"updated: {updated}")
    print(f"skipped: {skipped}")
    print(f"generated: {GENERATED_PATH}")
    print(f"report json: {REPORT_JSON}")
    print(f"report md:   {REPORT_MD}")
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
  python generate_meta.py --method heuristic   # 휴리스틱 기반 생성 (LLM 전 단계, 리포트 포함)
  python generate_meta.py --method all         # 모든 방법 순차 실행
        """
    )
    parser.add_argument(
        "--method",
        choices=["patterns", "inference", "frequency", "heuristic", "all"],
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
    elif args.method == "heuristic":
        generate_by_heuristic()
    elif args.method == "all":
        generate_by_patterns()
        print("\n")
        generate_by_inference()
        print("\n")
        generate_by_frequency()
        print("\n")
        generate_by_heuristic()
    
    print("\n다음 단계:")
    print("1) column_meta/global_columns.generated.yaml 검수")
    print("2) 확정된 항목만 global_columns.yaml로 옮기기(승격)")
    print("3) 서버는 자동으로 반영(hot reload)")


if __name__ == "__main__":
    main()
