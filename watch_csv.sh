#!/bin/bash
# CSV 파일 변경 감지 및 자동 메타데이터 재생성

cd "$(dirname "$0")"

echo "CSV 파일 변경 감지 모드 시작..."
echo "data/ 디렉토리를 감시합니다. (Ctrl+C로 종료)"
echo ""

# inotifywait가 설치되어 있는지 확인
if ! command -v inotifywait &> /dev/null; then
    echo "⚠️  inotifywait가 설치되어 있지 않습니다."
    echo "설치: sudo apt-get install inotify-tools"
    echo ""
    echo "대신 수동으로 메타데이터를 생성하려면:"
    echo "  ./scan_metadata.sh"
    exit 1
fi

# CSV 파일 변경 감지
inotifywait -m -r -e create,delete,moved_to,moved_from --format '%w%f %e' data/ 2>/dev/null | \
while read file event; do
    if [[ "$file" == *.csv ]]; then
        echo ""
        echo "📁 CSV 파일 변경 감지: $file ($event)"
        echo "🔄 메타데이터 재생성 중..."
        python3 tools/scan_and_export.py
        echo "✅ 완료!"
        echo ""
    fi
done







