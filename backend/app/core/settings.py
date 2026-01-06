"""프로젝트 설정"""
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = PROJECT_ROOT / "data"
META_DIR = PROJECT_ROOT / "metadata"
REGISTRY_PATH = META_DIR / "datasets.json"

PREVIEW_LIMIT_DEFAULT = 2000
PREVIEW_LIMIT_MAX = 10000

