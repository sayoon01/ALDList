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
