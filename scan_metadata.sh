#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[scan_metadata] 1) scan_and_export..."
python3 tools/scan_and_export.py

echo "[scan_metadata] 2) generate global_columns.generated.yaml..."
python3 tools/generate_meta.py --method patterns

echo "[scan_metadata] done."








