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
