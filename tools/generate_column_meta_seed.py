#!/usr/bin/env python3
"""
컬럼 메타데이터 시드 생성 스크립트

metadata/columns_union.json을 읽어서
column_meta/global_columns.generated.yaml 파일을 생성합니다.

이 파일은 RAG seed 문서를 만들기 위한 베이스로 사용됩니다.
모든 컬럼에 대해 기본적인 메타데이터를 자동 생성합니다.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, Any

try:
    import yaml
except ImportError:
    print("❌ PyYAML이 설치되지 않았습니다. 설치해주세요: pip install pyyaml")
    exit(1)

ROOT = Path(__file__).resolve().parents[1]
COLUMNS_FILE = ROOT / "metadata" / "columns_union.json"
OUT_FILE = ROOT / "column_meta" / "global_columns.generated.yaml"


def infer_meta(col: str) -> Dict[str, Any]:
    """
    컬럼명을 기반으로 기본 메타데이터 추론
    
    Args:
        col: 컬럼명 (예: "TempAct_U", "MFCMon_DCS")
    
    Returns:
        메타데이터 딕셔너리 (importance 제외)
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


def main():
    """메인 실행 함수"""
    # 입력 파일 확인
    if not COLUMNS_FILE.exists():
        print(f"❌ 입력 파일을 찾을 수 없습니다: {COLUMNS_FILE}")
        exit(1)
    
    # 컬럼 목록 읽기
    print(f"📖 컬럼 목록 읽는 중: {COLUMNS_FILE}")
    with open(COLUMNS_FILE, "r", encoding="utf-8") as f:
        columns = json.load(f)
    
    if not isinstance(columns, list):
        print(f"❌ JSON 파일 형식이 올바르지 않습니다. 리스트여야 합니다.")
        exit(1)
    
    print(f"✅ {len(columns)}개 컬럼 발견")
    
    # 각 컬럼에 대해 메타데이터 생성
    print("🔧 메타데이터 생성 중...")
    out = {}
    for col in columns:
        if not isinstance(col, str):
            continue
        out[col] = infer_meta(col)
    
    # 출력 디렉토리 생성
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # YAML 파일로 저장
    print(f"💾 저장 중: {OUT_FILE}")
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        yaml.dump(
            out,
            f,
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
            indent=2
        )
    
    print(f"✅ 생성 완료: {len(out)}개 컬럼 메타데이터")
    print(f"📁 출력 파일: {OUT_FILE}")
    print(f"\n💡 이 파일은 RAG seed 문서를 만들기 위한 베이스로 사용됩니다.")
    print(f"   필요에 따라 수동으로 수정하거나 global_columns.yaml과 병합할 수 있습니다.")


if __name__ == "__main__":
    main()

