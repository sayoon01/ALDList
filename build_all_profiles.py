#!/usr/bin/env python3
"""
모든 데이터셋의 프로파일을 빌드하는 스크립트

사용법:
    python3 build_all_profiles.py                    # 포그라운드 실행
    nohup python3 build_all_profiles.py > build.log 2>&1 &  # 백그라운드 실행
"""
import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

API_BASE = "http://localhost:8000"
SAMPLE_ROWS = 5000
TOP_K = 5
FORCE = False  # True면 무조건 재생성, False면 mtime 비교로 스킵


def log(message: str, end: str = "\n"):
    """타임스탬프와 함께 로그 출력"""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}", end=end, flush=True)


def fetch_datasets():
    """모든 데이터셋 ID 목록 가져오기"""
    try:
        with urllib.request.urlopen(f"{API_BASE}/api/datasets", timeout=30) as response:
            data = json.loads(response.read().decode())
            ids = [d["dataset_id"] for d in data.get("datasets", [])]
            return ids
    except Exception as e:
        log(f"❌ Failed to fetch datasets: {e}")
        sys.exit(1)


def build_profile(dataset_id: str) -> tuple[bool, str]:
    """
    단일 데이터셋의 프로파일 빌드
    
    Returns:
        (success: bool, message: str)
    """
    url = (
        f"{API_BASE}/api/admin/profile/{dataset_id}/build"
        f"?force={str(FORCE).lower()}&sample_rows={SAMPLE_ROWS}&top_k={TOP_K}"
    )
    
    try:
        req = urllib.request.Request(url, method="POST")
        with urllib.request.urlopen(req, timeout=600) as response:
            result = json.loads(response.read().decode())
            if "profile_path" in result or result.get("ok"):
                return True, "Success"
            else:
                return False, "Unexpected response"
    except urllib.error.HTTPError as e:
        if e.code == 200:
            return True, "Success"
        else:
            error_body = e.read().decode() if e.fp else ""
            return False, f"HTTP {e.code}: {error_body[:100]}"
    except Exception as e:
        return False, str(e)[:100]


def main():
    log("=" * 60)
    log("Starting profile build for all datasets")
    log(f"API: {API_BASE}")
    log(f"Sample rows: {SAMPLE_ROWS}, Top-K: {TOP_K}, Force: {FORCE}")
    log("=" * 60)
    
    # 데이터셋 목록 가져오기
    log("Fetching dataset list...")
    dataset_ids = fetch_datasets()
    total = len(dataset_ids)
    log(f"Found {total} datasets")
    
    if total == 0:
        log("No datasets found. Exiting.")
        sys.exit(0)
    
    # 기존 프로파일 파일 확인
    profiles_dir = Path("metadata/profiles")
    existing_profiles = set(
        f.stem for f in profiles_dir.glob("*.json") if f.exists()
    )
    log(f"Existing profiles: {len(existing_profiles)}")
    
    # 프로파일 빌드
    log("\nBuilding profiles...")
    log("-" * 60)
    
    success_count = 0
    skip_count = 0
    fail_count = 0
    failed_ids = []
    
    start_time = time.time()
    
    for i, dataset_id in enumerate(dataset_ids, 1):
        # 진행 상황 표시
        progress = f"[{i}/{total}]"
        log(f"{progress} Building profile for {dataset_id}...", end=" ")
        
        # 이미 존재하는지 확인 (force=False일 때)
        if not FORCE and dataset_id in existing_profiles:
            log("⊘ Skipped (already exists)")
            skip_count += 1
            continue
        
        # 프로파일 빌드
        success, message = build_profile(dataset_id)
        
        if success:
            log("✓ Success")
            success_count += 1
            existing_profiles.add(dataset_id)  # 캐시 업데이트
        else:
            log(f"✗ Failed: {message}")
            fail_count += 1
            failed_ids.append(dataset_id)
        
        # 진행률 표시 (10개마다)
        if i % 10 == 0:
            elapsed = time.time() - start_time
            avg_time = elapsed / i
            remaining = (total - i) * avg_time
            log(f"  Progress: {i}/{total} ({i*100//total}%) | "
                f"Elapsed: {elapsed:.1f}s | "
                f"Est. remaining: {remaining:.1f}s")
    
    # 결과 요약
    elapsed_total = time.time() - start_time
    log("\n" + "=" * 60)
    log("Profile build completed!")
    log("-" * 60)
    log(f"Total datasets: {total}")
    log(f"  ✓ Success: {success_count}")
    log(f"  ⊘ Skipped: {skip_count}")
    log(f"  ✗ Failed: {fail_count}")
    log(f"Total time: {elapsed_total:.1f}s")
    log(f"Average time per dataset: {elapsed_total/total:.1f}s")
    
    if failed_ids:
        log("\nFailed dataset IDs:")
        for did in failed_ids:
            log(f"  - {did}")
    
    log("=" * 60)
    
    # 실패가 있으면 종료 코드 1
    if fail_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
