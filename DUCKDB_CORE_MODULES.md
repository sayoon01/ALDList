# DuckDB/CSV 로더 핵심 모듈 구현 코드

이 문서는 ALDList 백엔드의 DuckDB 및 CSV 로더 관련 핵심 모듈의 실제 구현 코드를 보여줍니다.

## 📁 모듈 구조

```
backend/app/
├── engine/
│   ├── duckdb_engine.py    # DuckDB 쿼리 실행 엔진
│   └── duckdb_cache.py     # DuckDB View 캐싱
├── core/
│   ├── registry.py          # 데이터셋 레지스트리 관리
│   ├── column_meta.py       # 컬럼 메타데이터 로더
│   ├── auto_scan.py         # 자동 스캔 판단 로직
│   ├── metadata_pipeline.py # 메타데이터 파이프라인
│   └── settings.py          # 프로젝트 설정
```

---

## 1. DuckDB 엔진 (`backend/app/engine/duckdb_engine.py`)

```python
"""DuckDB를 사용한 CSV 쿼리 엔진 (정리된 최종본)"""

from __future__ import annotations

import duckdb
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from .duckdb_cache import get_cache


def quote_ident(name: str) -> str:
    """식별자 따옴표 처리"""
    return f'"{name.replace(chr(34), chr(34) + chr(34))}"'


def _get_conn_and_relation(
    csv_path: str, dataset_id: Optional[str]
) -> Tuple[duckdb.DuckDBPyConnection, str, bool]:
    """
    Returns: (conn, relation_sql_or_view, use_cache)
    """
    if dataset_id:
        cache = get_cache()
        conn = cache.connection()
        relation = cache.get_relation(dataset_id, csv_path)
        return conn, relation, True

    conn = duckdb.connect()
    p = Path(csv_path).resolve()
    relation = f"read_csv('{p.as_posix()}', all_varchar=true, header=true)"
    return conn, relation, False


def preview_rows(
    csv_path: str,
    offset: int = 0,
    limit: int = 2000,
    columns: Optional[List[str]] = None,
    dataset_id: Optional[str] = None,
) -> tuple[List[Dict[str, Any]], List[str]]:
    """
    CSV 미리보기
    - dataset_id 제공 시: 캐시 view 사용 (단일 connection)
    - 미제공 시: 임시 connection으로 fallback
    """
    conn, relation, cached = _get_conn_and_relation(csv_path, dataset_id)
    try:
        if columns is None:
            r = conn.execute(f"SELECT * FROM {relation} LIMIT 1")
            columns = [d[0] for d in r.description]

        if columns:
            col_list = ", ".join(quote_ident(c) for c in columns)
            q = f"SELECT {col_list} FROM {relation} LIMIT {limit} OFFSET {offset}"
        else:
            q = f"SELECT * FROM {relation} LIMIT {limit} OFFSET {offset}"

        rows_raw = conn.execute(q).fetchall()
        rows = [
            {col: (row[i] if i < len(row) else None) for i, col in enumerate(columns)}
            for row in rows_raw
        ]
        return rows, columns
    finally:
        if not cached:
            conn.close()


METRICS: Dict[str, Callable[[str], str]] = {
    "count": lambda expr: "COUNT(*)",
    "non_null_count": lambda expr: f"COUNT({expr})",
    "min": lambda expr: f"MIN({expr})",
    "max": lambda expr: f"MAX({expr})",
    "avg": lambda expr: f"AVG(TRY_CAST({expr} AS DOUBLE))",
    "stddev": lambda expr: f"STDDEV(TRY_CAST({expr} AS DOUBLE))",
}


def compute_metrics(
    csv_path: str,
    columns: List[str],
    row_start: int = 0,
    row_end: Optional[int] = None,
    dataset_id: Optional[str] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    통계 계산 (단일 쿼리, 캐시 view 지원)
    """
    conn, relation, cached = _get_conn_and_relation(csv_path, dataset_id)
    try:
        if row_end is not None:
            limit_count = max(0, row_end - row_start)
            base_query = f"SELECT * FROM {relation} LIMIT {limit_count} OFFSET {row_start}"
        else:
            base_query = f"SELECT * FROM {relation} OFFSET {row_start}"

        base_metrics = ["count", "non_null_count", "min", "max"]
        numeric_metrics = ["avg", "stddev"]

        select_parts: List[str] = []
        metric_keys: List[tuple[str, str]] = []

        for col in columns:
            col_q = quote_ident(col)
            for metric_name in base_metrics + numeric_metrics:
                alias = f"{col}__{metric_name}"
                select_parts.append(f"{METRICS[metric_name](col_q)} AS {quote_ident(alias)}")
                metric_keys.append((col, metric_name))

        if not select_parts:
            return {col: {"count": 0, "non_null_count": 0} for col in columns}

        query = f"SELECT {', '.join(select_parts)} FROM ({base_query})"
        result_row = conn.execute(query).fetchone()
        if result_row is None:
            return {col: {"count": 0, "non_null_count": 0} for col in columns}

        out: Dict[str, Dict[str, Any]] = {col: {} for col in columns}

        for (col, metric_name), value in zip(metric_keys, result_row):
            if value is None:
                out[col][metric_name] = None
                continue

            if metric_name in ("count", "non_null_count"):
                out[col][metric_name] = int(value)
            elif metric_name in ("avg", "stddev"):
                try:
                    out[col][metric_name] = float(value)
                except Exception:
                    out[col][metric_name] = None
            else:  # min/max
                try:
                    f = float(value)
                    out[col][metric_name] = int(f) if f.is_integer() else f
                except Exception:
                    out[col][metric_name] = str(value)

        return out
    except Exception as e:
        return {col: {"count": 0, "non_null_count": 0, "error": str(e)} for col in columns}
    finally:
        if not cached:
            conn.close()
```

---

## 2. DuckDB 캐시 (`backend/app/engine/duckdb_cache.py`)

```python
"""
DuckDB Relation 캐시 (단일 connection + fingerprint 기반 자동 무효화)

- dataset_id별로 VIEW를 만들고 재사용
- CSV 파일이 변경되면(size/mtime_ns) 자동으로 VIEW 재생성
- 자동화(파일 변경 감지/watch_csv/refresh)와 잘 맞음
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional

import duckdb


@dataclass
class ViewEntry:
    view_name: str
    fingerprint: str
    csv_path: str


def compute_fingerprint(csv_path: str) -> str:
    """
    빠르고 실용적인 fingerprint: absolute path + size + mtime_ns
    - mtime을 int초로 자르면 같은 초에 여러 번 바뀌는 경우를 못 잡아서 mtime_ns 사용
    """
    p = Path(csv_path).resolve()
    st = p.stat()
    mtime_ns = getattr(st, "st_mtime_ns", int(st.st_mtime * 1_000_000_000))
    return f"{p.as_posix()}|{st.st_size}|{mtime_ns}"


class DuckDBCache:
    """
    - 단일 DuckDB connection 보유
    - dataset_id -> ViewEntry 관리
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._conn: duckdb.DuckDBPyConnection = duckdb.connect()
        self._entries: Dict[str, ViewEntry] = {}

    def connection(self) -> duckdb.DuckDBPyConnection:
        """단일 connection 반환"""
        return self._conn

    def _safe_view_name(self, dataset_id: str) -> str:
        """dataset_id를 안전한 view 이름으로 변환"""
        safe = dataset_id.replace("-", "_").replace(".", "_")
        return f"ds_{safe}"

    def _create_or_replace_view(self, view_name: str, csv_path: str) -> None:
        """VIEW 생성 또는 교체"""
        p = Path(csv_path).resolve()
        sql = f"""
        CREATE OR REPLACE VIEW {view_name} AS
        SELECT * FROM read_csv('{p.as_posix()}', all_varchar=true, header=true);
        """
        self._conn.execute(sql)

    def get_relation(self, dataset_id: str, csv_path: str) -> str:
        """
        Returns: SQL에서 FROM에 넣을 relation 이름 (view_name)
        - CSV가 바뀌면 자동으로 view 재생성
        """
        with self._lock:
            view_name = self._safe_view_name(dataset_id)
            fp = compute_fingerprint(csv_path)

            entry = self._entries.get(dataset_id)
            if entry and entry.view_name == view_name and entry.fingerprint == fp:
                return view_name

            self._create_or_replace_view(view_name, csv_path)
            self._entries[dataset_id] = ViewEntry(
                view_name=view_name, fingerprint=fp, csv_path=str(Path(csv_path).resolve())
            )
            return view_name

    def invalidate(self, dataset_id: str) -> None:
        """특정 dataset_id의 view 무효화"""
        with self._lock:
            entry = self._entries.pop(dataset_id, None)
            if entry:
                try:
                    self._conn.execute(f"DROP VIEW IF EXISTS {entry.view_name};")
                except Exception:
                    pass

    def clear_all(self) -> None:
        """모든 view 제거"""
        with self._lock:
            for ds_id in list(self._entries.keys()):
                self.invalidate(ds_id)

    def close(self) -> None:
        """connection 닫기"""
        with self._lock:
            try:
                self.clear_all()
            finally:
                try:
                    self._conn.close()
                except Exception:
                    pass

    # 하위호환
    def get_view_query(self, dataset_id: str, csv_path: str) -> str:
        """View 이름 반환 (하위호환)"""
        try:
            return self.get_relation(dataset_id, csv_path)
        except Exception:
            csv_path_normalized = str(Path(csv_path).resolve())
            return f"read_csv('{csv_path_normalized}', all_varchar=true, header=true)"


_cache = DuckDBCache()


def get_cache() -> DuckDBCache:
    """RegistryStore 싱글톤 인스턴스 반환"""
    return _cache
```

---

## 3. 레지스트리 관리 (`backend/app/core/registry.py`)

```python
"""
데이터셋 레지스트리 관리 (메모리 캐시 + 자동 reload)
- REGISTRY_PATH 파일을 읽어 DatasetMeta를 만든 뒤 메모리에 캐시
- 파일 mtime이 바뀌면 자동 reload
- dataset_id -> meta dict로 O(1) 조회
"""

from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from .settings import REGISTRY_PATH, DATA_DIR


@dataclass
class DatasetMeta:
    dataset_id: str
    path: str
    filename: str
    size_bytes: int
    mtime: float
    columns: List[str]


def _normalize_path(path_str: str, filename: str) -> str:
    """경로를 DATA_DIR 기준으로 정규화"""
    normalized = DATA_DIR / filename
    return str(normalized.resolve())


def _read_registry_file(registry_path: Path) -> List[DatasetMeta]:
    """레지스트리 파일을 읽어 DatasetMeta 리스트 반환"""
    if not registry_path.exists():
        return []

    data = json.loads(registry_path.read_text(encoding="utf-8"))
    metas: List[DatasetMeta] = []
    for item in data:
        filename = item.get("filename", Path(item.get("path", "")).name)
        item["path"] = _normalize_path(item.get("path", ""), filename)
        metas.append(DatasetMeta(**item))
    return metas


class RegistryStore:
    """레지스트리 스토어 (mtime 기반 자동 reload)"""

    def __init__(self, registry_path: Path = REGISTRY_PATH) -> None:
        self.registry_path = registry_path
        self._lock = threading.RLock()
        self._loaded_mtime: float = -1.0
        self._by_id: Dict[str, DatasetMeta] = {}
        self._list_cache: List[DatasetMeta] = []

    def _current_mtime(self) -> float:
        """현재 레지스트리 파일의 mtime 반환"""
        try:
            return self.registry_path.stat().st_mtime
        except FileNotFoundError:
            return -1.0

    def ensure_loaded(self, force: bool = False) -> None:
        """
        파일이 바뀌었으면 reload
        """
        with self._lock:
            cur_mtime = self._current_mtime()
            if (not force) and (cur_mtime == self._loaded_mtime):
                return

            try:
                metas = _read_registry_file(self.registry_path)
            except Exception as e:
                # 파일 깨짐/읽기 실패해도 서버가 죽으면 안 됨
                print(f"⚠️ registry load failed: {e}")
                metas = []

            self._by_id = {m.dataset_id: m for m in metas}
            self._list_cache = metas
            self._loaded_mtime = cur_mtime

    def list(self) -> List[DatasetMeta]:
        """전체 데이터셋 목록 반환"""
        self.ensure_loaded()
        with self._lock:
            return list(self._list_cache)

    def get(self, dataset_id: str) -> Optional[DatasetMeta]:
        """특정 데이터셋 조회 (O(1))"""
        self.ensure_loaded()
        with self._lock:
            return self._by_id.get(dataset_id)

    def count(self) -> int:
        """데이터셋 개수 반환"""
        self.ensure_loaded()
        with self._lock:
            return len(self._list_cache)

    def refresh(self) -> None:
        """강제로 레지스트리 다시 로드"""
        self.ensure_loaded(force=True)


# 싱글톤 인스턴스
_store = RegistryStore()


def get_store() -> RegistryStore:
    """RegistryStore 싱글톤 인스턴스 반환"""
    return _store


# 하위호환 함수들 (기존 코드 최소 수정용)
def load_registry() -> List[DatasetMeta]:
    """레지스트리 로드 (하위호환)"""
    return get_store().list()


def get_dataset(dataset_id: str) -> Optional[DatasetMeta]:
    """특정 데이터셋 조회 (하위호환, O(1))"""
    return get_store().get(dataset_id)
```

---

## 4. 자동 스캔 판단 (`backend/app/core/auto_scan.py`)

```python
"""CSV 파일 자동 스캔 및 메타데이터 생성"""
import sys
import subprocess
import json
from pathlib import Path

from .settings import REGISTRY_PATH, DATA_DIR, PROJECT_ROOT


def should_regenerate_metadata() -> bool:
    """메타데이터를 재생성해야 하는지 확인"""
    # 메타데이터가 없으면 생성 필요
    if not REGISTRY_PATH.exists():
        return True
    
    # CSV 파일이 있는지 확인
    csv_files = list(DATA_DIR.glob("*.csv"))
    if not csv_files:
        return False
    
    try:
        # 메타데이터 파일의 수정 시간 확인
        metadata_mtime = REGISTRY_PATH.stat().st_mtime
        
        # CSV 파일 중 하나라도 메타데이터보다 최신이면 재생성 필요
        for csv_file in csv_files:
            if csv_file.stat().st_mtime > metadata_mtime:
                print(f"📝 {csv_file.name} 파일이 변경되었습니다. 메타데이터 재생성이 필요합니다.")
                return True
        
        # 메타데이터에 등록된 파일 수와 실제 CSV 파일 수 비교
        with REGISTRY_PATH.open("r", encoding="utf-8") as f:
            metadata = json.load(f)
            registered_files = {meta.get("filename") for meta in metadata}
            current_files = {f.name for f in csv_files}
            
            # 파일이 추가되거나 삭제되었으면 재생성 필요
            if registered_files != current_files:
                print("📝 CSV 파일 목록이 변경되었습니다. 메타데이터 재생성이 필요합니다.")
                return True
            
            # 메타데이터의 경로가 유효한지 확인 (로컬 경로가 아닌지)
            for meta in metadata:
                path_str = meta.get("path", "")
                filename = meta.get("filename", "")
                if path_str:
                    path_obj = Path(path_str)
                    # 절대 경로이고 DATA_DIR 밖에 있으면 재생성 필요
                    if path_obj.is_absolute():
                        try:
                            path_obj.relative_to(DATA_DIR)
                            # DATA_DIR 내부에 있지만 파일이 없으면 재생성
                            if not path_obj.exists():
                                print(f"📝 메타데이터의 파일이 존재하지 않습니다: {path_str}. 재생성합니다.")
                                return True
                        except ValueError:
                            # DATA_DIR 밖에 있는 절대 경로는 무조건 재생성
                            print(f"📝 메타데이터의 경로가 DATA_DIR 밖에 있습니다: {path_str}. 재생성합니다.")
                            return True
                    else:
                        # 상대 경로인 경우 DATA_DIR 기준으로 확인
                        data_dir_path = DATA_DIR / path_obj
                        if not data_dir_path.exists():
                            # filename으로도 확인
                            if filename:
                                filename_path = DATA_DIR / filename
                                if not filename_path.exists():
                                    print(f"📝 메타데이터의 파일을 찾을 수 없습니다: {path_str}. 재생성합니다.")
                                    return True
        
        return False
    except Exception as e:
        print(f"⚠️  메타데이터 확인 중 오류: {e}. 재생성합니다.")
        return True


def ensure_metadata():
    """메타데이터가 없거나 오래되었으면 자동 생성"""
    # CSV 파일이 있는지 확인
    csv_files = list(DATA_DIR.glob("*.csv"))
    if not csv_files:
        print("⚠️  CSV 파일이 없습니다. data/ 디렉토리에 CSV 파일을 넣어주세요.")
        return False
    
    # 메타데이터 재생성 필요 여부 확인
    if should_regenerate_metadata():
        print("📊 메타데이터를 생성/업데이트합니다...")
        try:
            # scan_and_export.py를 서브프로세스로 실행
            script_path = PROJECT_ROOT / "tools" / "scan_and_export.py"
            result = subprocess.run(
                [sys.executable, str(script_path)],
                cwd=str(PROJECT_ROOT),
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                print("✅ 메타데이터 생성/업데이트 완료!")
                if result.stdout:
                    print(result.stdout)
                return True
            else:
                print(f"❌ 메타데이터 생성 실패: {result.stderr}")
                if result.stdout:
                    print(result.stdout)
                return False
        except Exception as e:
            print(f"❌ 메타데이터 생성 실패: {e}")
            return False
    else:
        print("✅ 메타데이터가 최신 상태입니다.")
    
    return True


if __name__ == "__main__":
    ensure_metadata()
```

---

## 5. 메타데이터 파이프라인 (`backend/app/core/metadata_pipeline.py`)

```python
# backend/app/core/metadata_pipeline.py
"""
[Metadata Pipeline 단일 진입점]

- startup(패시브 자동화)에서 호출
- /api/admin/refresh(액티브 자동화)에서 호출

원칙:
- Scan 실행 여부 판단은 core/auto_scan.py
- Scan 실제 수행은 tools/scan_and_export.py(서브프로세스)
- Registry 로딩/사용은 core/registry.py
- Column Meta는 절대 여기서 건드리지 않음
- Profile/Doc 빌드는 별도 단계에서 수행

책임 범위:
- [1] Scan 단계만 담당 (tools/scan_and_export.py 실행)
- [2] Registry 갱신만 담당 (metadata/datasets.json 생성)
- [3] Column Meta / Profile / Doc은 별도 파이프라인에서 처리
"""

from __future__ import annotations

import sys
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

from .settings import PROJECT_ROOT, REGISTRY_PATH


@dataclass
class RefreshResult:
    ok: bool
    changed: bool
    reason: str  # "up-to-date" | "auto" | "force"
    registry_path: str
    stdout: str = ""
    stderr: str = ""
    created: List[str] = field(default_factory=list)  # 새로 생성된 dataset_id 리스트
    changed_ids: List[str] = field(default_factory=list)  # 변경된 dataset_id 리스트
    deleted: List[str] = field(default_factory=list)  # 삭제된 dataset_id 리스트


def _run_scan_and_export() -> subprocess.CompletedProcess:
    script_path = PROJECT_ROOT / "tools" / "scan_and_export.py"
    return subprocess.run(
        [sys.executable, str(script_path)],
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
    )


def refresh_registry_if_needed(*, force: bool = False) -> RefreshResult:
    """
    - force=True : 무조건 scan 실행
    - force=False: auto_scan.should_regenerate_metadata() 판단에 따라 실행
    
    Returns:
        RefreshResult with created/changed_ids/deleted lists
    """
    from .auto_scan import should_regenerate_metadata
    from .registry import load_registry, DatasetMeta, get_store

    # refresh 전 registry 로드 (비교용)
    old_registry: List[DatasetMeta] = []
    if REGISTRY_PATH.exists():
        try:
            old_registry = load_registry()
        except Exception:
            old_registry = []
    
    old_by_id = {ds.dataset_id: ds for ds in old_registry}

    if force:
        r = _run_scan_and_export()
        ok = r.returncode == 0
        if not ok:
            return RefreshResult(
                ok=False,
                changed=False,
                reason="force",
                registry_path=str(REGISTRY_PATH),
                stdout=r.stdout or "",
                stderr=r.stderr or "",
            )
    else:
        # 최신이면 실행 안 함
        if not should_regenerate_metadata():
            return RefreshResult(
                ok=True,
                changed=False,
                reason="up-to-date",
                registry_path=str(REGISTRY_PATH),
            )

        # 필요하면 실행
        r = _run_scan_and_export()
        ok = r.returncode == 0
        if not ok:
            return RefreshResult(
                ok=False,
                changed=False,
                reason="auto",
                registry_path=str(REGISTRY_PATH),
                stdout=r.stdout or "",
                stderr=r.stderr or "",
            )

    # refresh 후 registry 로드 (캐시 강제 갱신)
    new_registry: List[DatasetMeta] = []
    if REGISTRY_PATH.exists():
        try:
            # RegistryStore 캐시 강제 갱신
            get_store().refresh()
            new_registry = load_registry()
        except Exception:
            new_registry = []
    
    new_by_id = {ds.dataset_id: ds for ds in new_registry}

    # 비교: created, changed, deleted
    created = []
    changed_ids = []
    deleted = []

    # 새로 생성된 것
    for ds_id in new_by_id:
        if ds_id not in old_by_id:
            created.append(ds_id)

    # 변경된 것 (mtime 비교)
    for ds_id in new_by_id:
        if ds_id in old_by_id:
            old_ds = old_by_id[ds_id]
            new_ds = new_by_id[ds_id]
            # mtime가 변경되었거나 size_bytes가 변경된 경우
            if old_ds.mtime != new_ds.mtime or old_ds.size_bytes != new_ds.size_bytes:
                changed_ids.append(ds_id)

    # 삭제된 것
    for ds_id in old_by_id:
        if ds_id not in new_by_id:
            deleted.append(ds_id)

    return RefreshResult(
        ok=True,
        changed=ok,
        reason="force" if force else "auto",
        registry_path=str(REGISTRY_PATH),
        stdout=r.stdout or "",
        stderr=r.stderr or "",
        created=created,
        changed_ids=changed_ids,
        deleted=deleted,
    )
```

---

## 6. 컬럼 메타데이터 (`backend/app/core/column_meta.py`)

```python
# backend/app/core/column_meta.py
"""
컬럼 메타데이터 로더 (Global + Patterns + Dataset Override)
- YAML 로딩/정규식 컴파일 비용을 요청마다 내지 않도록 프로세스 캐시
- 파일이 수정되면(mtime 변경) 자동으로 reload (hot reload)
- allowed types도 YAML에서 자동 추출해서 API 하드코딩 제거

우선순위:
1) Dataset override (dataset별 yaml)
2) Global meta (global_columns.yaml + optional generated)
3) Patterns 자동 생성 (patterns.yaml)
"""

from __future__ import annotations

import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Tuple, Optional, List, Set

import yaml

ROOT = Path(__file__).resolve().parents[3]  # aldList/
META_DIR = ROOT / "column_meta"

GLOBAL_META_PATH = META_DIR / "global_columns.yaml"
# 자동 생성 결과(배치툴이 만든 파일). 존재하면 global보다 "낮은 우선순위"로 merge 권장
GLOBAL_GENERATED_PATH = META_DIR / "global_columns.generated.yaml"

PATTERNS_PATH = META_DIR / "patterns.yaml"
DATASET_META_DIR = META_DIR / "datasets"

DEFAULT_TYPE_LABELS: Dict[str, str] = {
    "gas": "가스",
    "temperature": "온도",
    "pressure": "압력",
    "apc": "APC",
    "valve": "밸브",
    "aux": "AUX",
    "heater": "히터",
    "timestamp": "시간",
    "recipe": "레시피",
    "index": "인덱스",
    "unknown": "기타",
}


def _safe_load_yaml(path: Path) -> Dict[str, Any]:
    """YAML 파일을 안전하게 로드"""
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"⚠️  YAML 로드 실패 ({path}): {e}")
        return {}


@dataclass(frozen=True)
class PatternRule:
    """패턴 규칙"""
    regex: re.Pattern
    meta: Dict[str, Any]


def _format_template(
    template: str,
    *,
    col: str,
    groups: Tuple[str, ...],
    zones: Dict[str, str],
) -> str:
    """
    템플릿 문자열에서 토큰 치환
    지원 토큰:
      - {col}: 컬럼명 전체
      - {idx}: 숫자 그룹
      - {name}: 텍스트 그룹
      - {zone}: zone 코드 (U, CU, C, CL, L)
      - {part}: 부품명 (HT, PR 등)
    """
    s = template.replace("{col}", col)

    if groups:
        if groups[0].isdigit():
            s = s.replace("{idx}", groups[0])
        else:
            s = s.replace("{name}", groups[0])
            s = s.replace("{part}", groups[0])

    for g in groups:
        if g in zones:
            s = s.replace("{zone}", zones[g])

    return s


class ColumnMetaStore:
    """
    - patterns.yaml / global_columns.yaml / generated.yaml을 캐시
    - 파일 mtime 변경 시 자동 reload
    - dataset override는 파일이 dataset_id마다 다르므로, override도 캐시(선택) 가능하지만
      여기서는 '요청당 1회 로드 + mtime 캐시'로 충분히 최적화
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()

        # cached mtimes
        self._mt_global: float = -1.0
        self._mt_generated: float = -1.0
        self._mt_patterns: float = -1.0

        # cached data
        self._global_meta: Dict[str, Dict[str, Any]] = {}
        self._generated_meta: Dict[str, Dict[str, Any]] = {}
        self._zones: Dict[str, str] = {}
        self._rules: List[PatternRule] = []
        self._fallback: Dict[str, Any] = {}

        # derived
        self._allowed_types: Set[str] = set()

        # ✅ type catalog (labels/order) - patterns.yaml에서 읽어옴
        self._type_labels: Dict[str, str] = {}
        self._type_order: Optional[List[str]] = None

        # dataset override caches: dataset_id -> (mtime, data)
        self._override_cache: Dict[str, Tuple[float, Dict[str, Dict[str, Any]]]] = {}

    def _mtime(self, p: Path) -> float:
        try:
            return p.stat().st_mtime
        except FileNotFoundError:
            return -1.0

    def _load_global_meta_file(self, path: Path) -> Dict[str, Dict[str, Any]]:
        data = _safe_load_yaml(path)
        out: Dict[str, Dict[str, Any]] = {}
        for k, v in data.items():
            if isinstance(k, str) and isinstance(v, dict):
                out[k] = {"key": k, **v}
        return out

    def _load_patterns_file(self, path: Path) -> Tuple[Dict[str, str], List[PatternRule], Dict[str, Any], Dict[str, str], Optional[List[str]]]:
        data = _safe_load_yaml(path)

        zones = data.get("zones") or {}
        zones = zones if isinstance(zones, dict) else {}

        patterns = data.get("patterns") or []
        fallback = data.get("fallback") or {}
        rules: List[PatternRule] = []

        # ✅ optional UI metadata
        type_labels = data.get("type_labels") or {}
        type_labels = type_labels if isinstance(type_labels, dict) else {}

        type_order = data.get("type_order")
        if not isinstance(type_order, list):
            type_order = None
        else:
            type_order = [x for x in type_order if isinstance(x, str) and x.strip()]

        if isinstance(patterns, list):
            for p in patterns:
                if not isinstance(p, dict):
                    continue
                match = p.get("match")
                meta = p.get("meta")
                if isinstance(match, str) and isinstance(meta, dict):
                    try:
                        rules.append(PatternRule(regex=re.compile(match), meta=meta))
                    except re.error as e:
                        print(f"⚠️  정규식 컴파일 실패 ({match}): {e}")

        return zones, rules, fallback if isinstance(fallback, dict) else {}, type_labels, type_order

    def _rebuild_allowed_types(self) -> None:
        """
        allowed types를 YAML에서 자동 추출:
        - patterns.yaml의 각 meta.type
        - patterns.yaml의 fallback.type
        - global_columns.yaml / generated.yaml의 type
        - dataset override의 type은 런타임에서 dataset별로 달라질 수 있으므로
          "전역 allowed types"에는 포함시키지 않는 게 안정적임(원하면 확장 가능)
        """
        types: Set[str] = set()

        # from patterns
        for r in self._rules:
            t = r.meta.get("type")
            if isinstance(t, str) and t.strip():
                types.add(t.strip())
        ft = self._fallback.get("type")
        if isinstance(ft, str) and ft.strip():
            types.add(ft.strip())

        # from globals
        for m in (self._generated_meta, self._global_meta):
            for _, meta in m.items():
                t = meta.get("type")
                if isinstance(t, str) and t.strip():
                    types.add(t.strip())

        # always ensure "unknown"
        types.add("unknown")

        self._allowed_types = types

    def ensure_loaded(self) -> None:
        """
        patterns/global/generated가 바뀌었으면 자동 reload
        """
        with self._lock:
            mt_p = self._mtime(PATTERNS_PATH)
            mt_g = self._mtime(GLOBAL_META_PATH)
            mt_gg = self._mtime(GLOBAL_GENERATED_PATH)

            patterns_changed = (mt_p != self._mt_patterns)
            global_changed = (mt_g != self._mt_global)
            generated_changed = (mt_gg != self._mt_generated)

            if not (patterns_changed or global_changed or generated_changed):
                return

            if patterns_changed:
                self._zones, self._rules, self._fallback, self._type_labels, self._type_order = self._load_patterns_file(PATTERNS_PATH)
                self._mt_patterns = mt_p

            if generated_changed:
                self._generated_meta = self._load_global_meta_file(GLOBAL_GENERATED_PATH)
                self._mt_generated = mt_gg

            if global_changed:
                self._global_meta = self._load_global_meta_file(GLOBAL_META_PATH)
                self._mt_global = mt_g

            self._rebuild_allowed_types()

    def get_allowed_types(self) -> List[str]:
        self.ensure_loaded()
        with self._lock:
            return sorted(self._allowed_types)

    def get_ui_type_labels(self) -> Dict[str, str]:
        """UI용 타입 라벨 반환"""
        self.ensure_loaded()
        with self._lock:
            return dict(self._type_labels)

    def get_ui_type_order(self) -> Optional[List[str]]:
        """UI용 타입 순서 반환 (없으면 None)"""
        self.ensure_loaded()
        with self._lock:
            return list(self._type_order) if self._type_order else None

    def get_type_catalog(self) -> Dict[str, Any]:
        """
        /api/meta/types 용
        반환: { "types": [...], "labels": {...}, "order": [...] }
        - types: UI에서 버튼으로 쓸 타입 목록 (type_order 우선)
        - labels: type -> label (patterns.yaml type_labels)
        - order: 타입 순서 (없으면 None)
        """
        self.ensure_loaded()
        with self._lock:
            allowed = set(self._allowed_types)

            # labels: patterns.yaml만 쓰되, 없는 건 그대로 type 문자열 노출되게 둠
            labels: Dict[str, str] = {}
            for k, v in (self._type_labels or {}).items():
                if isinstance(k, str) and isinstance(v, str):
                    labels[k] = v

            # types: order 우선 + 나머지 추가, unknown 맨 뒤
            types: List[str] = []
            seen = set()

            order = self._type_order
            if order:
                # order에 있는 것 먼저 + 나머지(새로 등장한 타입) 뒤
                for t in order:
                    if t in allowed and t not in seen:
                        types.append(t)
                        seen.add(t)

            rest = [t for t in sorted(allowed) if t not in seen]
            rest_no_unknown = [t for t in rest if t != "unknown"]
            rest_unknown = ["unknown"] if "unknown" in rest else []
            types.extend(rest_no_unknown + rest_unknown)

            return {"types": types, "labels": labels, "order": order}

    def _load_dataset_override(self, dataset_id: str) -> Dict[str, Dict[str, Any]]:
        """
        dataset override는 dataset별 yaml을 읽는다.
        - (dataset_id.yaml이 없으면 {}) 반환
        - mtime 캐시
        """
        path = DATASET_META_DIR / f"{dataset_id}.yaml"
        mt = self._mtime(path)

        with self._lock:
            cached = self._override_cache.get(dataset_id)
            if cached and cached[0] == mt:
                return cached[1]

        data = _safe_load_yaml(path)
        out: Dict[str, Dict[str, Any]] = {}
        for k, v in data.items():
            if isinstance(k, str) and isinstance(v, dict):
                out[k] = {"key": k, **v}

        with self._lock:
            self._override_cache[dataset_id] = (mt, out)

        return out

    def generate_meta_for_column(self, col: str) -> Dict[str, Any]:
        """
        patterns 규칙으로 자동 생성
        - rules는 이미 컴파일된 정규식 사용
        """
        self.ensure_loaded()

        with self._lock:
            zones = dict(self._zones)
            rules = list(self._rules)
            fallback = dict(self._fallback)

        for rule in rules:
            m = rule.regex.match(col)
            if not m:
                continue

            groups = tuple(m.groups())
            meta = {"key": col, **rule.meta}

            if "title" in meta and isinstance(meta["title"], str):
                meta["title"] = _format_template(meta["title"], col=col, groups=groups, zones=zones)
            if "desc" in meta and isinstance(meta["desc"], str):
                meta["desc"] = _format_template(meta["desc"], col=col, groups=groups, zones=zones)

            meta["auto_generated"] = True
            return meta

        # fallback
        meta = {"key": col, **fallback}
        if "title" in meta and isinstance(meta["title"], str):
            meta["title"] = _format_template(meta["title"], col=col, groups=(), zones=zones)
        if "desc" in meta and isinstance(meta["desc"], str):
            meta["desc"] = _format_template(meta["desc"], col=col, groups=(), zones=zones)

        meta["auto_generated"] = True
        return meta

    def build_meta_map(self, dataset_id: str, columns: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        우선순위:
        1) Dataset override
        2) Global meta (global_columns.yaml) + generated.yaml(낮은 우선순위)
        3) Patterns 자동 생성
        """
        self.ensure_loaded()

        with self._lock:
            global_meta = dict(self._global_meta)
            generated_meta = dict(self._generated_meta)

        override_meta = self._load_dataset_override(dataset_id)

        result: Dict[str, Dict[str, Any]] = {}
        for c in columns:
            # 1) patterns 기본 생성
            base = self.generate_meta_for_column(c)

            # 2) generated meta merge (auto_generated False로 바꾸지 않음: "초안"이니까)
            if c in generated_meta:
                # generated는 draft 성격이므로 auto_generated는 그대로 두거나 별도 flag를 둬도 됨
                base = {**base, **generated_meta[c], "key": c}

            # 3) global meta merge (명시된 컬럼은 auto_generated False)
            if c in global_meta:
                base = {**base, **global_meta[c], "key": c, "auto_generated": False}

            # 4) dataset override merge (최우선)
            if c in override_meta:
                base = {**base, **override_meta[c], "key": c, "auto_generated": False}

            result[c] = base

        return result


# singleton
_store = ColumnMetaStore()


def get_store() -> ColumnMetaStore:
    return _store


# ---- 하위호환 함수들 (기존 import 최소 변경) ----
def build_meta_map(dataset_id: str, columns: List[str]) -> Dict[str, Dict[str, Any]]:
    return get_store().build_meta_map(dataset_id, columns)


def generate_meta_for_column(col: str) -> Dict[str, Any]:
    return get_store().generate_meta_for_column(col)


def allowed_types() -> List[str]:
    return get_store().get_allowed_types()


# 별칭 (하위호환성)
def get_allowed_types() -> List[str]:
    """allowed_types()의 별칭"""
    return allowed_types()


def get_type_catalog() -> Dict[str, Any]:
    """타입 카탈로그 반환 (allowed_types, ordered_types, labels)"""
    return get_store().get_type_catalog()
```

---

## 7. 프로젝트 설정 (`backend/app/core/settings.py`)

```python
"""프로젝트 설정"""
import os
from pathlib import Path

# 환경 변수로 데이터 경로 설정 가능 (배포 시 사용)
# 예: DATA_DIR=/app/data 또는 DATA_DIR=/tmp/data
PROJECT_ROOT = Path(__file__).resolve().parents[3]

DATA_DIR = Path(os.getenv("DATA_DIR", str(PROJECT_ROOT / "data")))
META_DIR = Path(os.getenv("META_DIR", str(PROJECT_ROOT / "metadata")))

REGISTRY_PATH = META_DIR / "datasets.json"

PROFILES_DIR = META_DIR / "profiles"
DOCS_DIR = META_DIR / "docs"

# 디렉토리 보장
META_DIR.mkdir(parents=True, exist_ok=True)
PROFILES_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)

PREVIEW_LIMIT_DEFAULT = 2000
PREVIEW_LIMIT_MAX = 10000

# Profile v1 기본 파라미터
PROFILE_SAMPLE_ROWS_DEFAULT = int(os.getenv("PROFILE_SAMPLE_ROWS", "5000"))
PROFILE_SAMPLE_ROWS_MAX = int(os.getenv("PROFILE_SAMPLE_ROWS_MAX", "50000"))
PROFILE_TOPK_DEFAULT = int(os.getenv("PROFILE_TOPK", "5"))
PROFILE_TOPK_MAX = int(os.getenv("PROFILE_TOPK_MAX", "20"))
```

---

## 📊 모듈 간 관계도

```
┌─────────────────────────────────────────────────────────┐
│                    FastAPI App                          │
│                  (backend/app/main.py)                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    API 라우터                           │
│  (datasets.py, stats.py, meta.py, admin.py)             │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Registry   │  │ Column Meta  │  │ DuckDB Engine│
│  (registry)  │  │ (column_meta)│  │ (duckdb_*)   │
└──────────────┘  └──────────────┘  └──────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
              ┌───────────────────────┐
              │   Metadata Pipeline   │
              │ (metadata_pipeline)   │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │    Auto Scan          │
              │   (auto_scan)         │
              └───────────────────────┘
```

---

## 🔑 핵심 설계 원칙

### 1. 캐싱 전략

- **RegistryStore**: mtime 기반 자동 reload
- **ColumnMetaStore**: mtime 기반 hot reload
- **DuckDBCache**: fingerprint 기반 View 캐싱 (단일 connection)

### 2. 경로 정규화

- `registry.py`의 `_normalize_path()`: 항상 `DATA_DIR / filename`로 재구성
- 배포 환경에서 절대경로 문제 방지

### 3. 단일 진입점

- `metadata_pipeline.py`: 모든 메타데이터 갱신의 단일 진입점
- 판단 로직(`auto_scan`)과 실행 로직(`metadata_pipeline`) 분리

### 4. 우선순위 시스템

- **Column Meta**: Dataset Override > Global Meta > Patterns
- **Registry**: 항상 `DATA_DIR / filename` 기준으로 정규화

### 5. 에러 처리

- 파일 읽기 실패 시 빈 딕셔너리/리스트 반환
- 서버가 죽지 않도록 안전한 fallback 제공
