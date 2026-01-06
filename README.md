# ALDList

CSV 데이터셋 관리 및 조회 시스템

## 프로젝트 구조

```
aldList/
├── data/                         # CSV 파일 74개 (실제 데이터)
├── metadata/                     # 자동 생성 (scan_and_export.py 실행 시)
│   ├── datasets.json            # 레지스트리: 모든 데이터셋 메타데이터
│   ├── columns_by_file.json     # 파일별 컬럼 목록
│   ├── columns_union.json       # 모든 컬럼의 합집합 (207개)
│   ├── columns_intersection.json # 모든 컬럼의 교집합 (207개)
│   ├── columns_union.py         # Python 리스트 형식
│   └── columns_union.txt        # 텍스트 형식
│
├── tools/
│   └── scan_and_export.py       # 1단계: CSV 스캔 + 메타데이터 생성
│
├── backend/                      # 2단계: FastAPI 백엔드 서버
│   ├── app/
│   │   ├── main.py              # FastAPI 애플리케이션 진입점
│   │   ├── core/
│   │   │   ├── settings.py      # 프로젝트 경로 설정
│   │   │   └── registry.py      # 레지스트리 읽기/조회
│   │   ├── engine/
│   │   │   └── duckdb_engine.py # DuckDB를 이용한 CSV 쿼리
│   │   ├── models/
│   │   │   └── schemas.py       # Pydantic 스키마 정의
│   │   └── api/
│   │       ├── datasets.py      # 데이터셋 목록/조회 API
│   │       └── stats.py         # 통계 계산 API
│   └── requirements.txt
│
└── frontend/                     # 3단계: React 프론트엔드
    ├── src/
    │   ├── api.ts               # API 클라이언트
    │   ├── App.tsx              # 메인 컴포넌트
    │   └── components/
    │       ├── DatasetPicker.tsx # 데이터셋 선택 드롭다운
    │       ├── DataTable.tsx     # 데이터셋 정보 표시
    │       └── StatsPanel.tsx    # 통계 패널
    └── package.json
```

## 실행 순서 및 흐름

### 1단계: 메타데이터 생성 (필수)

```bash
cd tools
python3 scan_and_export.py
```

#### 이 단계에서 하는 일:
1. `data/` 디렉토리의 모든 CSV 파일(74개)을 스캔
2. 각 파일의 헤더(컬럼명)를 읽어서 추출
3. 파일 메타데이터 수집 (파일명, 경로, 크기, 수정시간)
4. 각 파일에 고유한 `dataset_id` 생성 (경로 기반 해시)

#### 생성되는 파일들 (`metadata/` 디렉토리):

- **`datasets.json`** (레지스트리)
  - 모든 데이터셋의 메타데이터를 저장한 중앙 인덱스
  - 각 데이터셋의 `dataset_id`, `path`, `filename`, `size_bytes`, `mtime`, `columns` 정보
  - 백엔드가 이 파일을 읽어서 API로 제공

- **`columns_by_file.json`**
  - 파일 경로를 키로, 해당 파일의 컬럼 리스트를 값으로 저장
  - 파일별 컬럼 추적용

- **`columns_union.json`**
  - 모든 데이터셋의 컬럼 합집합 (207개 고유 컬럼)
  - 어떤 컬럼이 존재하는지 전체 목록

- **`columns_intersection.json`**
  - 모든 데이터셋에 공통으로 있는 컬럼 (현재 207개)
  - 모든 파일이 동일한 구조를 가지고 있음을 확인

- **`columns_union.py`** / **`columns_union.txt`**
  - Python 코드나 텍스트로 컬럼 목록을 사용할 수 있도록 제공

#### 출력 예시:
```
OK  : standard_trace_001.csv (207 cols)
OK  : standard_trace_002.csv (207 cols)
...
=== Summary ===
files=74
union_cols=207
intersection_cols=207
saved -> /home/keti_spark1/yune/aldList/metadata
```

---

### 2단계: Backend 서버 실행

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 이 단계에서 하는 일:
1. FastAPI 서버가 시작됨
2. `metadata/datasets.json` (레지스트리)를 읽어서 메모리에 로드
3. API 엔드포인트 제공

#### 제공되는 API:

- **`GET /api/datasets`**
  - 모든 데이터셋 목록 반환
  - 레지스트리에서 읽은 정보를 그대로 제공

- **`GET /api/datasets/{dataset_id}/columns`**
  - 특정 데이터셋의 컬럼 목록 반환
  - 레지스트리에서 해당 `dataset_id`를 찾아서 컬럼 정보 제공

- **`GET /api/datasets/{dataset_id}/preview?offset=0&limit=2000`**
  - CSV 파일의 일부 행을 미리보기
  - DuckDB를 사용해서 CSV를 읽고 지정된 범위의 행 반환

- **`POST /api/datasets/{dataset_id}/stats`**
  - 지정된 컬럼들에 대한 통계 계산 (avg, max, min, count)
  - DuckDB를 사용해서 CSV를 읽고 집계 함수 실행

#### API 문서:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

### 3단계: Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

#### 이 단계에서 하는 일:
1. React 개발 서버 시작 (포트 3000)
2. 백엔드 API(`http://localhost:8000/api`)를 호출
3. 웹 인터페이스로 데이터셋 조회 및 통계 확인

#### 주요 기능:
- **데이터셋 선택**: 드롭다운에서 데이터셋 선택
- **데이터셋 정보 표시**: 선택한 데이터셋의 컬럼 목록 표시
- **통계 패널**: 전체 데이터셋 통계 (총 개수, 총 행 수, 컬럼 수 등)

#### 접속:
- Frontend: http://localhost:3000

---

## 데이터 흐름도

```
┌─────────────────┐
│  data/*.csv     │  (74개 CSV 파일)
│  (실제 데이터)   │
└────────┬────────┘
         │
         │ scan_and_export.py 실행
         ▼
┌─────────────────┐
│ metadata/       │  (메타데이터 생성)
│ datasets.json   │  ← 레지스트리 (중앙 인덱스)
│ columns_*.json  │
└────────┬────────┘
         │
         │ 백엔드가 읽음
         ▼
┌─────────────────┐
│  Backend API    │  (FastAPI 서버)
│  /api/datasets  │  ← 레지스트리 기반으로 API 제공
│  /api/stats     │  ← DuckDB로 CSV 직접 쿼리
└────────┬────────┘
         │
         │ HTTP 요청
         ▼
┌─────────────────┐
│  Frontend       │  (React 웹앱)
│  웹 인터페이스   │  ← 사용자가 데이터 조회
└─────────────────┘
```

## 핵심 개념

### 레지스트리 (Registry)
- **파일**: `metadata/datasets.json`
- **의미**: 모든 CSV 데이터셋의 메타데이터를 저장한 중앙 집중식 인덱스
- **역할**: 
  - 매번 CSV 파일을 스캔하지 않고 빠르게 목록 제공
  - 각 데이터셋의 ID, 경로, 컬럼 정보 등을 미리 저장
  - 백엔드 API의 데이터 소스

### Dataset ID
- 각 데이터셋에 부여되는 고유 식별자
- 형식: `ds_` + 파일 경로의 SHA1 해시 (12자리)
- 예: `ds_843aa97e10bf`
- 파일명이 바뀌어도 경로가 같으면 동일한 ID 유지

## 데이터셋 정보

- **총 데이터셋**: 74개
- **각 데이터셋 컬럼 수**: 207개
- **모든 데이터셋이 동일한 구조**를 가지고 있습니다 (intersection = union)

## 주의사항

- `data/*.csv` 파일들은 `.gitignore`에 포함되어 GitHub에 업로드되지 않습니다
- 데이터가 변경되면 `tools/scan_and_export.py`를 다시 실행하여 레지스트리를 갱신해야 합니다
- 백엔드 서버는 레지스트리를 시작 시 한 번만 읽습니다. 레지스트리가 변경되면 서버를 재시작해야 합니다
