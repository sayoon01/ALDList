#!/usr/bin/env bash
set -u  # -e는 빼고, 우리가 직접 에러 처리할거라서
set -o pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
SLEEP_SEC="${SLEEP_SEC:-2}"
LOCK_FILE="${LOCK_FILE:-/tmp/aldlist_watch_csv.lock}"

echo "[watch_csv] watching ./data/*.csv"
echo "[watch_csv] API_BASE=$API_BASE"
echo "[watch_csv] SLEEP_SEC=$SLEEP_SEC"

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

curl_json() {
  # usage: curl_json METHOD URL
  local method="$1"
  local url="$2"
  curl -sS -X "$method" "$url"
}

main_loop() {
  while true; do
    current_hash="$(hash_dir | shasum 2>/dev/null | awk '{print $1}' || echo "")"

    if [[ "$current_hash" != "$last_hash" ]] && [[ -n "$current_hash" ]]; then
      echo "[watch_csv] change detected -> refresh"
      last_hash="$current_hash"

      # ---- 1) registry refresh ----
      echo "[watch_csv] calling refresh..."
      refresh_out="$(curl_json POST "$API_BASE/api/admin/refresh?force=false" || echo "")"

      if [[ -z "$refresh_out" ]]; then
        echo "[watch_csv] refresh failed (empty response)"
        sleep "$SLEEP_SEC"
        continue
      fi

      echo "$refresh_out" | cat
      echo ""

      # ---- 1.5) generated column meta 빌드 ----
      echo "[watch_csv] building generated column meta..."
      gen_out="$(curl_json POST "$API_BASE/api/admin/meta/generated/build" || echo "")"
      if [[ -z "$gen_out" ]]; then
        echo "[watch_csv] generated meta build failed (empty response)"
      else
        echo "$gen_out" | cat
      fi
      echo ""

      # ---- 2) refresh 결과에서 changed/created만 뽑기 ----
      # refresh_out 형식이 아래를 포함한다고 가정:
      # { "changed": ["ds_x"], "created": ["ds_y"], ... }
      ids="$(echo "$refresh_out" | python3 - <<'PY'
import sys, json
try:
  d=json.load(sys.stdin)
except Exception:
  print("")
  raise SystemExit(0)
ids=[]
for k in ("created","changed"):
  v=d.get(k,[])
  if isinstance(v,list):
    ids += [x for x in v if isinstance(x,str) and x]
# 중복 제거(순서 유지)
seen=set()
out=[]
for x in ids:
  if x not in seen:
    seen.add(x); out.append(x)
print("\n".join(out))
PY
)"

      # fallback: refresh 결과에 ids가 없으면 전체 datasets를 한 번만 가져오기
      if [[ -z "$ids" ]]; then
        echo "[watch_csv] refresh result has no changed/created -> fallback to list datasets"
        ids="$(curl_json GET "$API_BASE/api/datasets" | python3 - <<'PY'
import sys, json
try:
  d=json.load(sys.stdin)
except Exception:
  print("")
  raise SystemExit(0)
datasets=d.get("datasets",[])
out=[]
if isinstance(datasets,list):
  for x in datasets:
    if isinstance(x,dict) and x.get("dataset_id"):
      out.append(x["dataset_id"])
print("\n".join(out))
PY
)"
      fi

      if [[ -z "$ids" ]]; then
        echo "[watch_csv] no datasets found"
        sleep "$SLEEP_SEC"
        continue
      fi

      # ---- 3) build profile/doc for each id ----
      echo "[watch_csv] building profiles and docs..."
      while IFS= read -r id; do
        [[ -z "$id" ]] && continue

        echo "[watch_csv] build profile for $id"
        if ! curl_json POST "$API_BASE/api/admin/profile/$id/build" | cat; then
          echo "[watch_csv] profile build failed for $id (continue)"
        fi
        echo ""

        echo "[watch_csv] build doc for $id"
        if ! curl_json POST "$API_BASE/api/admin/doc/$id/build" | cat; then
          echo "[watch_csv] doc build failed for $id (continue)"
        fi
        echo ""
      done <<< "$ids"

      echo "[watch_csv] done"
    fi

    sleep "$SLEEP_SEC"
  done
}

# ---- lock: 동시에 2개 실행 방지 ----
if command -v flock >/dev/null 2>&1; then
  # Linux
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    echo "[watch_csv] another instance is running (lock: $LOCK_FILE)"
    exit 0
  fi
  main_loop
else
  # macOS fallback: lock file 방식(완벽하진 않지만 충분)
  if [[ -e "$LOCK_FILE" ]]; then
    echo "[watch_csv] another instance may be running (lock exists: $LOCK_FILE)"
    exit 0
  fi
  trap 'rm -f "$LOCK_FILE"' EXIT
  touch "$LOCK_FILE"
  main_loop
fi
