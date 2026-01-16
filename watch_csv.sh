#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"

echo "[watch_csv] watching ./data/*.csv"
echo "[watch_csv] API_BASE=$API_BASE"

last_hash=""

hash_dir() {
  # 파일 목록 + mtime 기반 해시
  if command -v stat >/dev/null 2>&1; then
    # Linux
    find ./data -maxdepth 1 -name "*.csv" -print0 | sort -z | xargs -0 stat -c "%n %Y" 2>/dev/null || true
  else
    # macOS
    find ./data -maxdepth 1 -name "*.csv" -print0 | sort -z | xargs -0 stat -f "%N %m" 2>/dev/null || true
  fi
}

while true; do
  current_hash="$(hash_dir | shasum 2>/dev/null | awk '{print $1}' || echo "")"

  if [[ "$current_hash" != "$last_hash" ]] && [[ -n "$current_hash" ]]; then
    echo "[watch_csv] change detected -> refresh"
    last_hash="$current_hash"

    # 1) registry refresh
    echo "[watch_csv] calling refresh..."
    curl -s -X POST "$API_BASE/api/admin/refresh?force=false" | cat
    echo ""

    # 2) list datasets
    echo "[watch_csv] fetching datasets..."
    ids=$(curl -s "$API_BASE/api/datasets" | python3 -c "import sys, json; d=json.load(sys.stdin); print('\n'.join([x['dataset_id'] for x in d.get('datasets',[])]))" 2>/dev/null || echo "")

    if [[ -z "$ids" ]]; then
      echo "[watch_csv] no datasets found"
      sleep 2
      continue
    fi

    # 3) build profile/doc for each
    echo "[watch_csv] building profiles and docs..."
    for id in $ids; do
      if [[ -z "$id" ]]; then
        continue
      fi
      echo "[watch_csv] build profile/doc for $id"
      curl -s -X POST "$API_BASE/api/admin/profile/$id/build" | cat
      echo ""
      curl -s -X POST "$API_BASE/api/admin/doc/$id/build" | cat
      echo ""
    done

    echo "[watch_csv] done"
  fi

  sleep 2
done
