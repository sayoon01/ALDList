# ALDList - CSV 데이터 분석 도구

CSV 파일을 쉽게 탐색하고 분석할 수 있는 웹 애플리케이션입니다.

## ✨ 특징

- **완전 자동화**: CSV 파일만 `data/` 디렉토리에 넣으면 자동으로 작동
- **실시간 분석**: 대용량 CSV 파일도 빠르게 탐색 및 분석
- **직관적인 UI**: 드래그로 범위 선택, 컬럼 필터링, 통계 계산
- **자동 메타데이터 생성**: 백엔드 시작 시 자동으로 메타데이터 생성

## 📁 프로젝트 구조

```
aldList/
├── data/              # CSV 파일 저장소 (여기에 CSV 파일 넣기)
├── metadata/          # 자동 생성된 메타데이터 (자동 생성)
│   ├── datasets.json
│   └── ...
├── tools/             # 유틸리티 스크립트
│   └── scan_and_export.py
├── backend/           # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py
│   │   ├── api/       # API 엔드포인트
│   │   ├── core/      # 핵심 기능 (레지스트리, 자동 스캔)
│   │   ├── engine/    # DuckDB 엔진
│   │   └── models/    # 데이터 모델
│   └── requirements.txt
└── frontend/          # React 프론트엔드
    ├── src/
    │   ├── App.tsx
    │   ├── api.ts
    │   └── ...
    └── package.json
```

## 🚀 빠른 시작

### 1. CSV 파일 준비

```bash
# CSV 파일을 data/ 디렉토리에 복사
cp your_file.csv data/
```

**그게 전부입니다!** 백엔드가 시작될 때 자동으로 메타데이터를 생성합니다.

### 2. 백엔드 실행

```bash
# 프로젝트 루트에서
./start_backend.sh

# 또는 backend 디렉토리에서
cd backend && ./start.sh
```

백엔드가 시작되면:
- 메타데이터 자동 생성 (없는 경우)
- API 서버 실행: http://localhost:8000
- API 문서: http://localhost:8000/docs

### 3. 프론트엔드 실행

새 터미널에서:

```bash
# 프로젝트 루트에서
./start_frontend.sh

# 또는 frontend 디렉토리에서
cd frontend && npm install && npm run dev
```

프론트엔드가 실행되면:
- 웹 애플리케이션: http://localhost:5173

## 📖 사용 방법

1. **데이터셋 선택**: 왼쪽 사이드바에서 분석할 CSV 파일 선택
2. **컬럼 선택**: 원하는 컬럼만 체크하여 표시
3. **데이터 탐색**: 중앙 그리드에서 데이터 스크롤 및 필터링
4. **범위 선택**: 그리드에서 마우스로 드래그하여 행 범위 선택
5. **통계 계산**: "통계 계산" 버튼 클릭하여 선택한 범위의 통계 확인

## 🔧 주요 기능

- ✅ **자동 메타데이터 생성**: CSV 파일만 넣으면 자동 처리
- ✅ **실시간 미리보기**: 최대 10,000행까지 빠른 미리보기
- ✅ **컬럼 선택**: 207개 컬럼 중 원하는 것만 선택하여 표시
- ✅ **통계 계산**: 선택한 범위의 컬럼별 통계 (평균, 최소/최대값, 표준편차)
- ✅ **필터링 및 정렬**: AG Grid의 강력한 필터링 및 정렬 기능
- ✅ **드래그 범위 선택**: 직관적인 행 범위 선택

## 📡 API 엔드포인트

- `GET /api/datasets` - 데이터셋 목록 조회
- `GET /api/datasets/{dataset_id}` - 데이터셋 메타데이터 조회
- `GET /api/datasets/{dataset_id}/preview` - 데이터 미리보기
- `POST /api/datasets/{dataset_id}/stats` - 통계 계산

자세한 API 문서: http://localhost:8000/docs

## 🛠 기술 스택

- **Backend**: FastAPI, DuckDB, Python
- **Frontend**: React, TypeScript, AG Grid, Vite
- **Data**: CSV 파일, JSON 메타데이터

## 📝 CSV 파일 변경 시

### 자동 처리 (권장)

**방법 1: 백엔드 자동 감지**
- 백엔드가 실행 중이면 API 호출 시 자동으로 메타데이터 확인 및 생성

**방법 2: 파일 변경 감지 스크립트**
```bash
./watch_csv.sh
# CSV 파일 추가/삭제/변경 시 자동으로 메타데이터 재생성
```

### 수동 처리

```bash
# 메타데이터 수동 재생성
./scan_metadata.sh

# 또는 직접 실행
python3 tools/scan_and_export.py
```

## 💡 팁

- CSV 파일은 반드시 `data/` 디렉토리에 넣어주세요
- 백엔드와 프론트엔드는 별도의 터미널에서 실행해야 합니다
- 대용량 파일의 경우 미리보기 제한(기본 2,000행)을 조정할 수 있습니다
- 컬럼이 많을 경우 왼쪽 사이드바에서 원하는 컬럼만 선택하여 표시하세요

## 🔄 워크플로우

```
1. CSV 파일을 data/ 디렉토리에 넣기
   ↓
2. 백엔드 실행 (자동으로 메타데이터 생성)
   ↓
3. 프론트엔드 실행
   ↓
4. 브라우저에서 http://localhost:5173 접속
   ↓
5. 데이터 분석 시작!
```

## 📄 라이선스

이 프로젝트는 내부 사용을 위한 것입니다.
