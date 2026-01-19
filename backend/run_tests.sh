#!/bin/bash
# 테스트 실행 스크립트

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "가상환경이 없습니다. 먼저 start.sh를 실행하여 가상환경을 생성하세요."
    exit 1
fi

echo "가상환경 활성화 중..."
source venv/bin/activate

echo "테스트 실행 중..."
pytest "$@"
