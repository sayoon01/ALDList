#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[scan_metadata] 1) scan_and_export..."
python3 tools/scan_and_export.py

echo "[scan_metadata] 2) generate global_columns.generated.yaml (patterns)..."
python3 tools/generate_meta.py --method patterns

echo "[scan_metadata] 3) enrich from profiles (if available)..."
python3 tools/enrich_generated_from_profiles.py || echo "⚠️  프로필이 없어서 스킵됨 (정상)"

echo "[scan_metadata] 4) generate pattern suggestions..."
python3 tools/suggest_patterns.py

echo "[scan_metadata] done."








