"""pytest 설정 파일"""
import sys
from pathlib import Path

# backend 디렉토리를 Python 경로에 추가
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
