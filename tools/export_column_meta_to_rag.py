#!/usr/bin/env python3
"""
컬럼 메타데이터를 RAG 문서로 변환하는 스크립트

global_columns.yaml을 읽어서:
1. 컬럼별 개별 문서 생성 (rag_docs/columns/*.md)
2. 타입별 묶음 문서 생성 (rag_docs/groups/*.md)
"""
from __future__ import annotations

from pathlib import Path
from typing import Dict, Any, List

try:
    import yaml
except ImportError:
    print("❌ PyYAML이 설치되지 않았습니다. 설치해주세요: pip install pyyaml")
    exit(1)

ROOT = Path(__file__).resolve().parents[1]
META_FILE = ROOT / "column_meta" / "global_columns.yaml"
OUT_COLUMNS_DIR = ROOT / "rag_docs" / "columns"
OUT_GROUPS_DIR = ROOT / "rag_docs" / "groups"

OUT_COLUMNS_DIR.mkdir(parents=True, exist_ok=True)
OUT_GROUPS_DIR.mkdir(parents=True, exist_ok=True)

TYPE_KO = {
    "gas": "가스",
    "temperature": "온도",
    "pressure": "압력",
    "apc": "압력제어(APC)",
    "valve": "밸브",
    "aux": "보조센서(AUX)",
    "heater": "히터",
    "timestamp": "시간/타임스탬프",
    "recipe": "레시피",
    "index": "인덱스",
    "unknown": "기타",
}


def enrich_lines(col: str, m: Dict[str, Any]) -> List[str]:
    """
    컬럼 메타데이터를 RAG 검색에 유리한 형태로 문서화
    
    Args:
        col: 컬럼명
        m: 메타데이터 딕셔너리
    
    Returns:
        마크다운 라인 리스트
    """
    t = (m.get("type") or "unknown").strip()
    unit = (m.get("unit") or "").strip()
    cat = (m.get("category") or "").strip()
    desc = (m.get("desc") or "").strip()
    equip = (m.get("equipment_field") or col).strip()

    lines = []
    lines.append(f"# {col}\n")

    # ✅ 공통: RAG 검색에 도움되는 문장(일관되게 반복)
    lines.append("이 문서는 CSV 헤더(컬럼)의 의미를 설명하는 데이터 사전이다.")
    lines.append("이 컬럼은 반도체 장비 로그 CSV에 포함된 필드이다.")

    # ✅ 타입별: '가스 관련 필드 보여줘' 같은 질문에서 걸리도록 문장 추가
    if t == "gas":
        lines.append("이 컬럼은 반도체 공정에서 사용되는 가스와 관련된 필드이다.")
        lines.append("MFC(질량유량제어기) 계열의 유량/설정/입력 값일 가능성이 높다.")
    elif t == "temperature":
        lines.append("이 컬럼은 반도체 장비의 온도(측정/설정/목표)와 관련된 필드이다.")
    elif t == "pressure":
        lines.append("이 컬럼은 챔버 압력/진공 게이지 등 압력과 관련된 필드이다.")
    elif t == "timestamp":
        lines.append("이 컬럼은 데이터 기록 시각/시간과 관련된 시스템 필드이다.")
    elif t == "aux":
        lines.append("이 컬럼은 장비 보조 센서(AUX) 또는 모니터링 값이다.")
    elif t == "apc":
        lines.append("이 컬럼은 압력 제어(APC) 밸브/제어와 관련된 필드이다.")
    elif t == "valve":
        lines.append("이 컬럼은 밸브 상태/제어/설정과 관련된 필드이다.")
    else:
        lines.append("이 컬럼은 아직 분류되지 않았거나 일반적인 장비 필드이다.")

    if desc:
        lines.append("\n## 설명")
        lines.append(desc)

    lines.append("\n## 메타데이터")
    lines.append(f"- type: {t} ({TYPE_KO.get(t, '기타')})")
    if cat:
        lines.append(f"- category: {cat}")
    if unit:
        lines.append(f"- unit: {unit}")
    lines.append(f"- equipment_field: {equip}")

    return lines


def main():
    """메인 실행 함수"""
    # 입력 파일 확인
    if not META_FILE.exists():
        print(f"❌ 메타데이터 파일을 찾을 수 없습니다: {META_FILE}")
        exit(1)

    # YAML 파일 로드
    print(f"📖 메타데이터 읽는 중: {META_FILE}")
    with META_FILE.open("r", encoding="utf-8") as f:
        meta = yaml.safe_load(f) or {}

    if not isinstance(meta, dict):
        print(f"❌ YAML 파일 형식이 올바르지 않습니다. 딕셔너리여야 합니다.")
        exit(1)

    # 타입별 그룹 문서 만들기 위해 모으기
    by_type: Dict[str, List[str]] = {}

    count = 0
    for col, m in meta.items():
        if not isinstance(m, dict):
            continue

        # 컬럼 문서 작성
        lines = enrich_lines(col, m)
        (OUT_COLUMNS_DIR / f"{col}.md").write_text("\n".join(lines), encoding="utf-8")

        t = m.get("type", "unknown")
        by_type.setdefault(t, []).append(col)
        count += 1

    # ✅ 타입별 묶음 문서 생성 (검색에서 매우 강함)
    for t, cols in by_type.items():
        title = TYPE_KO.get(t, t)
        doc_lines = []
        doc_lines.append(f"# {title} 관련 컬럼 목록\n")
        doc_lines.append("이 문서는 동일한 타입의 컬럼을 묶은 목록 문서이다.")
        doc_lines.append("사용자는 '가스 관련 필드 보여줘' 같은 질문으로 이 문서를 검색할 수 있다.\n")
        doc_lines.append(f"- type: {t}\n")
        doc_lines.append("## 컬럼 목록")
        for c in sorted(cols):
            doc_lines.append(f"- {c}")
        (OUT_GROUPS_DIR / f"{t}.md").write_text("\n".join(doc_lines), encoding="utf-8")

    print(f"✅ Exported {count} column docs → {OUT_COLUMNS_DIR}")
    print(f"✅ Exported {len(by_type)} group docs → {OUT_GROUPS_DIR}")


if __name__ == "__main__":
    main()

