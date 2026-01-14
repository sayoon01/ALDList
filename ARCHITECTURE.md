# ALDList 프로젝트 구조 및 구동 원리

## 📋 프로젝트 개요

ALDList는 CSV 데이터를 분석하고 시각화하는 웹 애플리케이션입니다. React 기반의 프론트엔드와 FastAPI 기반의 백엔드로 구성되어 있으며, DuckDB를 사용하여 대용량 CSV 파일을 효율적으로 처리합니다.

## 🏗️ 전체 아키텍처

```
┌─────────────────┐         HTTP/REST API         ┌─────────────────┐
│                 │ ◄─────────────────────────────► │                 │
│   Frontend      │                                │    Backend      │
│   (React)       │                                │   (FastAPI)     │
│                 │                                │                 │
│  - Header       │                                │  - API Routes   │
│  - Sidebar      │                                │  - DuckDB Engine│
│  - DataGrid     │                                │  - Metadata     │
│  - StatsPanel   │                                │  - Registry     │
└─────────────────┘                                └─────────────────┘
                                                           │
                                                           ▼
                                                   ┌─────────────────┐
                                                   │     DuckDB      │
                                                   │   (In-Memory)   │
                                                   └─────────────────┘
                                                           │
                                                           ▼
                                                   ┌─────────────────┐
                                                   │   CSV Files     │
                                                   │   (data/)       │
                                                   └─────────────────┘
```

## 📁 프로젝트 구조

```
aldList/
├── frontend/              # React 프론트엔드
│   ├── src/
│   │   ├── components/    # UI 컴포넌트
│   │   │   ├── Header.tsx      # 헤더 컴포넌트
│   │   │   ├── Sidebar.tsx     # 왼쪽 사이드바 (데이터셋 선택, 컬럼 선택)
│   │   │   ├── DataGrid.tsx    # 가운데 그리드 (AG Grid)
│   │   │   └── StatsPanel.tsx  # 오른쪽 통계 패널
│   │   ├── App.tsx        # 메인 앱 컴포넌트 (상태 관리)
│   │   └── api.ts         # API 클라이언트
│   └── package.json
│
├── backend/               # FastAPI 백엔드
│   ├── app/
│   │   ├── main.py        # FastAPI 앱 진입점
│   │   ├── api/           # API 라우터
│   │   │   ├── datasets.py    # 데이터셋 관련 API
│   │   │   └── stats.py       # 통계 계산 API
│   │   ├── core/          # 핵심 로직
│   │   │   ├── registry.py       # 데이터셋 레지스트리 관리
│   │   │   ├── column_meta.py    # 컬럼 메타데이터 로더
│   │   │   ├── auto_scan.py      # 자동 메타데이터 스캔
│   │   │   └── settings.py       # 설정 관리
│   │   ├── engine/        # 데이터 처리 엔진
│   │   │   ├── duckdb_engine.py  # DuckDB 쿼리 실행
│   │   │   └── duckdb_cache.py    # DuckDB 뷰 캐싱
│   │   └── models/        # 데이터 모델
│   │       └── schemas.py      # Pydantic 스키마
│   └── requirements.txt
│
├── data/                  # CSV 데이터 파일들
├── column_meta/           # 컬럼 메타데이터
│   ├── global_columns.yaml    # 전역 컬럼 메타데이터
│   ├── patterns.yaml          # 패턴 기반 자동 생성 규칙
│   └── datasets/              # 데이터셋별 오버라이드
└── metadata/              # 데이터셋 메타데이터 (레지스트리)
```

## 🔄 구동 원리

### 1. 백엔드 시작 과정

1. **서버 시작** (`backend/app/main.py`)
   - FastAPI 앱 초기화
   - CORS 미들웨어 설정
   - Startup 이벤트에서 `ensure_metadata()` 실행

2. **메타데이터 자동 스캔** (`backend/app/core/auto_scan.py`)
   - `data/` 디렉토리의 CSV 파일들을 스캔
   - 각 파일의 메타데이터(파일명, 크기, 컬럼 목록 등) 추출
   - `metadata/` 디렉토리에 JSON 파일로 저장 (레지스트리)

3. **레지스트리 로드** (`backend/app/core/registry.py`)
   - `metadata/` 디렉토리에서 데이터셋 목록 로드
   - 메모리에 캐시하여 빠른 조회 가능

### 2. 프론트엔드 시작 과정

1. **앱 초기화** (`frontend/src/App.tsx`)
   - React 컴포넌트 마운트
   - `useEffect`로 데이터셋 목록 API 호출 (`/api/datasets`)

2. **데이터셋 선택**
   - 사용자가 데이터셋 선택 시 `selectedDatasetId` 상태 변경
   - `useEffect`가 감지하여 미리보기 데이터 로드 (`/api/datasets/{id}/preview`)
   - 컬럼 메타데이터 로드 (`/api/datasets/{id}/columns`)

3. **컬럼 선택 및 표시**
   - 첫 번째 컬럼 자동 선택
   - 사용자가 체크박스로 표시할 컬럼 선택
   - 선택된 컬럼만 AG Grid에 표시

### 3. 데이터 로딩 흐름

```
사용자 액션
    │
    ▼
Frontend: API 호출 요청
    │
    ▼
Backend: API 라우터 수신
    │
    ▼
Backend: DuckDB 엔진 사용
    │
    ├─► CSV 파일 로드 (처음만)
    ├─► DuckDB View 생성 (캐싱)
    └─► SQL 쿼리 실행
    │
    ▼
Backend: 결과 반환 (JSON)
    │
    ▼
Frontend: 상태 업데이트
    │
    ▼
UI 리렌더링
```

### 4. DuckDB 엔진 동작 (`backend/app/engine/duckdb_engine.py`)

1. **CSV 로드 및 캐싱**
   - 각 데이터셋마다 DuckDB View 생성 (`CREATE VIEW IF NOT EXISTS`)
   - View는 메모리에 캐시되어 재사용
   - 같은 데이터셋의 후속 쿼리는 View를 재사용하여 빠른 처리

2. **미리보기 쿼리**
   ```sql
   SELECT * FROM view_name LIMIT {limit} OFFSET {offset}
   ```

3. **통계 계산 쿼리**
   ```sql
   SELECT 
     COUNT(*) as count,
     COUNT({column}) as non_null_count,
     MIN({column}) as min,
     MAX({column}) as max,
     AVG({column}) as avg,
     STDDEV({column}) as stddev
   FROM view_name
   WHERE row_number BETWEEN {start} AND {end}
   ```

### 5. 컬럼 메타데이터 시스템 (`backend/app/core/column_meta.py`)

1. **3단계 우선순위**
   - **1순위**: 데이터셋별 오버라이드 (`column_meta/datasets/{dataset_id}.yaml`)
   - **2순위**: 전역 메타데이터 (`column_meta/global_columns.yaml`)
   - **3순위**: 패턴 기반 자동 생성 (`column_meta/patterns.yaml`)

2. **자동 생성 규칙**
   - 컬럼명 패턴 매칭 (예: `*Temp*` → `type: temperature`)
   - 메타데이터가 없어도 기본 정보 제공

3. **프론트엔드 활용**
   - 컬럼 툴팁에 설명 표시
   - 컬럼 상세 패널에 메타데이터 표시
   - 타입 필터링 기능

## 🎨 프론트엔드 컴포넌트 구조

### App.tsx (상태 관리 중앙화)
- 모든 상태를 관리하는 컨테이너 컴포넌트
- API 호출 및 데이터 처리 로직
- 하위 컴포넌트에 props로 데이터와 콜백 전달

### Header 컴포넌트
- 단순한 헤더 표시
- "ALDList - CSV 데이터 분석" 제목

### Sidebar 컴포넌트
- **데이터셋 선택**: 드롭다운으로 데이터셋 선택
- **화면 표시 범위**: 시작 행, 개수 설정 (1-based UI, 0-based 내부 처리)
- **통계 계산 범위**: 행 범위 선택 (드래그 또는 수동 입력)
- **컬럼 선택**: 체크박스로 표시할 컬럼 선택
  - 타입 필터링 (가스, 온도, 압력 등)
  - 검색 기능
  - 전체 선택/해제

### DataGrid 컴포넌트
- AG Grid를 사용한 데이터 테이블
- 행 드래그 선택 기능
- 컬럼 헤더 클릭 시 상세 패널로 이동
- 선택된 행 범위 하이라이트

### StatsPanel 컴포넌트
- **컬럼 상세**: 선택된 컬럼의 메타데이터 표시
- **통계 결과**: 선택된 범위의 통계값 표시
  - 개수, 최소값, 최대값, 평균, 표준편차

## 🔌 API 엔드포인트

### 데이터셋 관련
- `GET /api/datasets` - 데이터셋 목록 조회
- `GET /api/datasets/{dataset_id}` - 데이터셋 메타데이터 조회
- `GET /api/datasets/{dataset_id}/preview?offset=0&limit=500` - 데이터 미리보기
- `GET /api/datasets/{dataset_id}/columns` - 컬럼 메타데이터 조회
- `GET /api/datasets/{dataset_id}/fields?type={type}` - 타입별 필드 조회

### 통계 관련
- `POST /api/datasets/{dataset_id}/stats` - 통계 계산
  ```json
  {
    "columns": ["column1", "column2"],
    "row_range": {"start": 0, "end": 100},
    "compute_columns": ["column1"]  // 선택적: 특정 컬럼만 계산
  }
  ```

## 🚀 성능 최적화

1. **DuckDB View 캐싱**
   - 각 데이터셋마다 View 생성하여 재사용
   - CSV 파일은 한 번만 로드

2. **점진적 로딩**
   - 미리보기 데이터를 먼저 로드 (표 표시)
   - 메타데이터는 나중에 로드 (툴팁/상세 패널)

3. **초기 로딩 크기 제한**
   - 기본 limit: 500행 (2000에서 감소)
   - 사용자가 필요시 더 로드 가능

4. **컬럼 선택 최적화**
   - 표시할 컬럼만 AG Grid에 전달
   - 불필요한 렌더링 방지

## 📝 주요 기능

1. **데이터셋 관리**
   - `data/` 디렉토리의 CSV 파일 자동 인식
   - 서버 시작 시 자동 스캔

2. **유연한 컬럼 메타데이터**
   - YAML 파일로 관리
   - 패턴 기반 자동 생성
   - 데이터셋별 오버라이드 지원

3. **인터랙티브 데이터 탐색**
   - 행 드래그 선택
   - 컬럼 헤더 클릭으로 상세 정보 확인
   - 타입별 필터링

4. **통계 계산**
   - 선택한 범위의 통계값 계산
   - 전체 컬럼 또는 활성 컬럼만 선택 가능

## 🔧 개발 환경 설정

### 백엔드
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 프론트엔드
```bash
cd frontend
npm install
npm run dev
```

### 환경 변수
- `VITE_API_BASE`: 프론트엔드에서 사용할 백엔드 API 베이스 URL (프로덕션용)

## 📚 기술 스택

- **Frontend**: React, TypeScript, AG Grid, Vite
- **Backend**: FastAPI, Python, DuckDB
- **Metadata**: YAML 파일 기반
- **Data**: CSV 파일
