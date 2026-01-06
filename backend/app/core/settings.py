"""프로젝트 설정"""
import os
from pathlib import Path

# 환경 변수로 데이터 경로 설정 가능 (배포 시 사용)
# 예: DATA_DIR=/app/data 또는 DATA_DIR=/tmp/data
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path(os.getenv("DATA_DIR", str(PROJECT_ROOT / "data")))
META_DIR = Path(os.getenv("META_DIR", str(PROJECT_ROOT / "metadata")))
REGISTRY_PATH = META_DIR / "datasets.json"

PREVIEW_LIMIT_DEFAULT = 2000
PREVIEW_LIMIT_MAX = 10000



