#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${DATA_DIR:-./data}"
API_BASE="${API_BASE:-http://localhost:8000}"

echo "[watch_csv] watching: $DATA_DIR"
echo "[watch_csv] api: $API_BASE"

# linux: sudo apt-get install inotify-tools
command -v inotifywait >/dev/null 2>&1 || {
  echo "inotifywait not found. install: sudo apt-get install inotify-tools"
  exit 1
}

# (선택) jq 있으면 응답 파싱 편함
HAS_JQ=0
command -v jq >/dev/null 2>&1 && HAS_JQ=1

while true; do
  # create/modify/move/delete 감지
  CHANGED=$(inotifywait -r -e create -e modify -e moved_to -e delete --format '%w%f' "$DATA_DIR" | head -n 1 || true)
  [[ -z "${CHANGED}" ]] && continue

  # csv만 처리
  if [[ "${CHANGED}" != *.csv ]]; then
    echo "[watch_csv] ignore: $CHANGED"
    continue
  fi

  echo "[watch_csv] changed: $CHANGED"

  # 1) registry refresh
  echo "[watch_csv] calling refresh..."
  curl -s -X POST "${API_BASE}/api/admin/refresh?force=false" >/dev/null || true

  # 2) datasets 다시 받아서 dataset_id 찾기 (filename 기반이니까 안정)
  echo "[watch_csv] fetching datasets..."
  DS_JSON=$(curl -s "${API_BASE}/api/datasets")

  if [[ $HAS_JQ -eq 1 ]]; then
    FILENAME=$(basename "$CHANGED")
    DATASET_ID=$(echo "$DS_JSON" | jq -r --arg fn "$FILENAME" '.datasets[] | select(.filename==$fn) | .dataset_id' | head -n 1)
  else
    # jq 없으면: 그냥 전체 build로 우회(운영에선 jq 쓰는 게 좋음)
    DATASET_ID=""
  fi

  if [[ -n "${DATASET_ID}" ]]; then
    echo "[watch_csv] build profile: ${DATASET_ID}"
    curl -s -X POST "${API_BASE}/api/admin/profile/${DATASET_ID}/build?force=true&sample_rows=5000&top_k=5" >/dev/null || true
  else
    echo "[watch_csv] dataset_id not resolved (no jq). building all profiles..."
    # jq 없으면 전체를 돌리는 fallback(비효율이지만 "동작"은 함)
    if [[ $HAS_JQ -eq 1 ]]; then
      echo "$DS_JSON" | jq -r '.datasets[].dataset_id' | while read -r id; do
        curl -s -X POST "${API_BASE}/api/admin/profile/${id}/build?force=false&sample_rows=5000&top_k=5" >/dev/null || true
      done
    else
      # jq 없을 때 python3로 전체 dataset_id 추출
      echo "$DS_JSON" | python3 -c "import json, sys; [print(d['dataset_id']) for d in json.load(sys.stdin).get('datasets', [])]" | while read -r id; do
        curl -s -X POST "${API_BASE}/api/admin/profile/${id}/build?force=false&sample_rows=5000&top_k=5" >/dev/null || true
      done
    fi
  fi
done
