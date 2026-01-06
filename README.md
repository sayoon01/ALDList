# ALDLIST

CSV 데이터셋 관리 및 조회 시스템

## 프로젝트 구조

```
aldList/
  data/                         # CSV 파일 74개
  metadata/                     # 자동 생성
    datasets.json
    columns_union.json
    columns_intersection.json
    columns_union.txt
    columns_union.py
    registry.json

  tools/
    scan_and_export.py          # CSV 스캔 + 컬럼 저장 + 레지스트리 생성

  backend/
    app/
      main.py
      core/
        settings.py
        registry.py
      engine/
        duckdb_engine.py
      models/
        schemas.py
      api/
        datasets.py
        stats.py

  frontend/
    package.json
    src/
      api.ts
      App.tsx
      components/
        DatasetPicker.tsx
        DataTable.tsx
        StatsPanel.tsx
```

## 시작하기

### 1. 메타데이터 생성

```bash
cd tools
python3 scan_and_export.py
```

이 명령어는:
- `data/` 디렉토리의 모든 CSV 파일을 스캔
- 각 파일의 컬럼 정보 추출
- Union/Intersection 계산
- `metadata/` 디렉토리에 결과 저장

### 2. Backend 실행

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 문서: http://localhost:8000/docs

### 3. Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:3000

## API 엔드포인트

- `GET /api/datasets` - 데이터셋 목록 조회
- `GET /api/datasets/{name}` - 특정 데이터셋 상세 정보
- `GET /api/datasets/{name}/columns` - 데이터셋 컬럼 목록
- `GET /api/stats` - 전체 통계 정보

## 데이터셋 정보

- 총 데이터셋: 74개
- 각 데이터셋 컬럼 수: 207개
- 모든 데이터셋이 동일한 구조를 가지고 있습니다.

