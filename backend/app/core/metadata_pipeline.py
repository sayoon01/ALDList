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
from dataclasses import dataclass
from pathlib import Path

from .settings import PROJECT_ROOT, REGISTRY_PATH


@dataclass
class RefreshResult:
    ok: bool
    changed: bool
    reason: str  # "up-to-date" | "auto" | "force"
    registry_path: str
    stdout: str = ""
    stderr: str = ""


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
    """
    from .auto_scan import should_regenerate_metadata

    if force:
        r = _run_scan_and_export()
        ok = r.returncode == 0
        return RefreshResult(
            ok=ok,
            changed=ok,
            reason="force",
            registry_path=str(REGISTRY_PATH),
            stdout=r.stdout or "",
            stderr=r.stderr or "",
        )

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
    return RefreshResult(
        ok=ok,
        changed=ok,
        reason="auto",
        registry_path=str(REGISTRY_PATH),
        stdout=r.stdout or "",
        stderr=r.stderr or "",
    )
