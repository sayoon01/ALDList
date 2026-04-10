"""프로젝트 설정"""
import os
from pathlib import Path

# 환경 변수로 데이터 경로 설정 가능 (배포 시 사용)
# 예: DATA_DIR=/app/data 또는 DATA_DIR=/tmp/data
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = Path(os.getenv("DATA_DIR", str(PROJECT_ROOT / "data")))
META_DIR = Path(os.getenv("META_DIR", str(PROJECT_ROOT / "metadata")))
REGISTRY_PATH = META_DIR / "datasets.json"

# 화면표시범위 기능 제거: 전체 데이터 로드를 위해 기본값을 크게 설정
# 하지만 메모리 문제를 방지하기 위해 합리적인 값으로 설정
PREVIEW_LIMIT_DEFAULT = 10000  # 기본값: 10,000행 (충분히 큰 값이지만 메모리 안전)
PREVIEW_LIMIT_MAX = 50000  # 최대값: 50,000행



