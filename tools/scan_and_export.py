#!/usr/bin/env python3
"""
CSV 파일 스캔 및 메타데이터 생성
"""
from __future__ import annotations

import csv
import json
import hashlib
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Set, Dict

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
OUT_DIR = PROJECT_ROOT / "metadata"
OUT_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class DatasetMeta:
    dataset_id: str
    path: str
    filename: str
    size_bytes: int
    mtime: float
    columns: List[str]


def read_header(p: Path) -> List[str]:
    with p.open("r", encoding="utf-8-sig", newline="") as f:
        r = csv.reader(f)
        return next(r)


def make_dataset_id(p: Path) -> str:
    h = hashlib.sha1(str(p.resolve()).encode("utf-8")).hexdigest()[:12]
    return f"ds_{h}"


def main():
    files = sorted(DATA_DIR.glob("*.csv"))
    if not files:
        raise SystemExit(f"No CSV files in {DATA_DIR}")

    metas: List[DatasetMeta] = []
    columns_by_file: Dict[str, List[str]] = {}
    col_sets: List[Set[str]] = []

    for p in files:
        try:
            st = p.stat()
            cols = read_header(p)

            metas.append(
                DatasetMeta(
                    dataset_id=make_dataset_id(p),
                    path=str(p),
                    filename=p.name,
                    size_bytes=st.st_size,
                    mtime=st.st_mtime,
                    columns=cols,
                )
            )

            columns_by_file[str(p)] = cols
            col_sets.append(set(cols))
            print(f"✓ {p.name} ({len(cols)} cols)")
        except Exception as e:
            print(f"✗ {p.name} -> {e}")

    union = sorted(set().union(*col_sets)) if col_sets else []
    inter = sorted(set.intersection(*col_sets)) if col_sets else []

    # 메타데이터 저장
    (OUT_DIR / "datasets.json").write_text(
        json.dumps([asdict(m) for m in metas], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    (OUT_DIR / "columns_by_file.json").write_text(
        json.dumps(columns_by_file, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    (OUT_DIR / "columns_union.json").write_text(
        json.dumps(union, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    
    (OUT_DIR / "columns_intersection.json").write_text(
        json.dumps(inter, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("\n" + "="*50)
    print(f"✓ 처리 완료: {len(metas)}개 파일")
    print(f"✓ 전체 컬럼 수: {len(union)}개")
    print(f"✓ 공통 컬럼 수: {len(inter)}개")
    print(f"✓ 저장 위치: {OUT_DIR}")
    print("="*50)


if __name__ == "__main__":
    main()


