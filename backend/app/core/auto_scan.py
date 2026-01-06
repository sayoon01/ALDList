"""CSV 파일 자동 스캔 및 메타데이터 생성"""
import sys
import subprocess
from pathlib import Path

from .settings import REGISTRY_PATH, DATA_DIR, PROJECT_ROOT


def ensure_metadata():
    """메타데이터가 없거나 오래되었으면 자동 생성"""
    # CSV 파일이 있는지 확인
    csv_files = list(DATA_DIR.glob("*.csv"))
    if not csv_files:
        print("⚠️  CSV 파일이 없습니다. data/ 디렉토리에 CSV 파일을 넣어주세요.")
        return False
    
    # 메타데이터가 없으면 자동 생성
    if not REGISTRY_PATH.exists():
        print("📊 메타데이터가 없습니다. 자동으로 생성합니다...")
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
                print("✅ 메타데이터 생성 완료!")
                return True
            else:
                print(f"❌ 메타데이터 생성 실패: {result.stderr}")
                return False
        except Exception as e:
            print(f"❌ 메타데이터 생성 실패: {e}")
            return False
    
    return True


if __name__ == "__main__":
    ensure_metadata()
