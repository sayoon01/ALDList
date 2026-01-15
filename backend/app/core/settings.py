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



