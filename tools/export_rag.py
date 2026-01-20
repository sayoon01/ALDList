#!/usr/bin/env python3
"""
RAG 출력 통합 스크립트

사용법:
  python export_rag.py --format markdown  # 마크다운 문서 생성
  python export_rag.py --format jsonl     # JSONL 파일 생성
  python export_rag.py --format all       # 둘 다 생성
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, Any, List

try:
    from utils import (
        PROJECT_ROOT,
        safe_load_yaml,
        load_type_labels,
        ensure_file_exists,
    )
except ImportError:
    # tools 디렉토리에서 직접 실행할 때
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    from utils import (
        PROJECT_ROOT,
        safe_load_yaml,
        load_type_labels,
        ensure_file_exists,
    )

META_FILE = PROJECT_ROOT / "column_meta" / "global_columns.yaml"
OUT_COLUMNS_DIR = PROJECT_ROOT / "rag_docs" / "columns"
OUT_GROUPS_DIR = PROJECT_ROOT / "rag_docs" / "groups"
OUT_JSONL_DIR = PROJECT_ROOT / "rag_index"
OUT_JSONL_FILE = OUT_JSONL_DIR / "column_meta.jsonl"

# patterns.yaml에서 타입 라벨 로드 (없으면 기본값 사용)
TYPE_KO_BASE = {
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


def get_type_labels():
    """patterns.yaml의 type_labels와 기본값 병합"""
    return {**TYPE_KO_BASE, **load_type_labels()}


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
    type_labels = get_type_labels()
    lines.append(f"- type: {t} ({type_labels.get(t, '기타')})")
    if cat:
        lines.append(f"- category: {cat}")
    if unit:
        lines.append(f"- unit: {unit}")
    lines.append(f"- equipment_field: {equip}")

    return lines


def export_markdown() -> None:
    """마크다운 문서 생성"""
    print("=" * 60)
    print("📋 Format: Markdown 문서 생성")
    print("=" * 60)
    
    # 입력 파일 확인
    ensure_file_exists(META_FILE, "메타데이터 파일")

    # YAML 파일 로드
    print(f"📖 메타데이터 읽는 중: {META_FILE}")
    meta = safe_load_yaml(META_FILE)

    if not meta:
        print(f"⚠️  메타데이터 파일이 비어있거나 로드할 수 없습니다.")
        return

    OUT_COLUMNS_DIR.mkdir(parents=True, exist_ok=True)
    OUT_GROUPS_DIR.mkdir(parents=True, exist_ok=True)

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
    type_labels = get_type_labels()
    for t, cols in by_type.items():
        title = type_labels.get(t, t)
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
    print("=" * 60)


def export_jsonl() -> None:
    """JSONL 파일 생성"""
    print("=" * 60)
    print("📋 Format: JSONL 파일 생성")
    print("=" * 60)
    
    # 입력 파일 확인
    ensure_file_exists(META_FILE, "메타데이터 파일")

    # YAML 파일 로드
    print(f"📖 메타데이터 읽는 중: {META_FILE}")
    meta = safe_load_yaml(META_FILE)

    if not meta:
        print(f"⚠️  메타데이터 파일이 비어있거나 로드할 수 없습니다.")
        return

    OUT_JSONL_DIR.mkdir(parents=True, exist_ok=True)

    # JSONL 파일 생성
    print(f"📝 JSONL 파일 생성 중: {OUT_JSONL_FILE}")
    count = 0
    with OUT_JSONL_FILE.open("w", encoding="utf-8") as f:
        for col, m in meta.items():
            if not isinstance(m, dict):
                continue

            # 문서 구성
            doc = {
                "id": f"column:{col}",
                "column": col,
                "type": m.get("type", "unknown"),
                "category": m.get("category", ""),
                "equipment_field": m.get("equipment_field", col),
                "text": (
                    f"이 컬럼은 반도체 장비 로그 CSV에 포함된 필드이다. "
                    f"{m.get('desc', '')} "
                    f"이 필드는 {m.get('type', 'unknown')} 유형이다."
                ).strip()
            }

            # JSONL 형식으로 쓰기 (한 줄에 JSON 객체 하나)
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
            count += 1

    print(f"✅ RAG JSONL 생성 완료: {OUT_JSONL_FILE}")
    print(f"   - 생성된 문서 수: {count}개")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="RAG 출력 통합 스크립트",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예시:
  python export_rag.py --format markdown  # 마크다운 문서 생성
  python export_rag.py --format jsonl     # JSONL 파일 생성
  python export_rag.py --format all       # 둘 다 생성
        """
    )
    parser.add_argument(
        "--format",
        choices=["markdown", "jsonl", "all"],
        default="markdown",
        help="출력 형식 선택 (기본값: markdown)"
    )
    
    args = parser.parse_args()
    
    if args.format == "markdown":
        export_markdown()
    elif args.format == "jsonl":
        export_jsonl()
    elif args.format == "all":
        export_markdown()
        print("\n")
        export_jsonl()


if __name__ == "__main__":
    main()
