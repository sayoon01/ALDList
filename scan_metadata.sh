#!/bin/bash
# 메타데이터 생성 스크립트

cd "$(dirname "$0")"

echo "CSV 파일 스캔 및 메타데이터 생성 중..."
python3 tools/scan_and_export.py


