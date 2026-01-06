#!/bin/bash
# 백엔드 서버 실행 스크립트 (backend 디렉토리에서 실행)

cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "가상환경 생성 중..."
    python3 -m venv venv
fi

echo "가상환경 활성화 중..."
source venv/bin/activate

if [ ! -f "venv/bin/uvicorn" ]; then
    echo "패키지 설치 중..."
    pip install -r requirements.txt
fi

echo "백엔드 서버 시작 중..."
echo "API 문서: http://localhost:8000/docs"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

