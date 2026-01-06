#!/bin/bash
# 프론트엔드 서버 실행 스크립트 (frontend 디렉토리에서 실행)

cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
    echo "패키지 설치 중..."
    npm install
fi

echo "프론트엔드 서버 시작 중..."
echo "웹 애플리케이션: http://localhost:5173"
npm run dev

