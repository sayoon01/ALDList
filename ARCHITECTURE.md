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
│  - ToastBanner  │                                │  - Profile/Doc  │
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
│   │   │   ├── Header.tsx         # 헤더 컴포넌트
│   │   │   ├── Header.css
│   │   │   ├── Sidebar.tsx        # 왼쪽 사이드바 (데이터셋 선택, 컬럼 선택, Profile/Doc 빌드)
│   │   │   ├── Sidebar.css
│   │   │   ├── DataGrid.tsx       # 가운데 그리드 (AG Grid)
│   │   │   ├── DataGrid.css
│   │   │   ├── StatsPanel.tsx     # 오른쪽 통계 패널 (Profile/Doc 빌드 버튼 포함)
│   │   │   ├── StatsPanel.css
│   │   │   ├── ToastBanner.tsx    # 토스트 알림 배너
│   │   │   └── ToastBanner.css
│   │   ├── hooks/         # 커스텀 훅
│   │   │   └── useAldController.ts  # 상태 관리 및 비즈니스 로직 훅
│   │   ├── App.tsx        # 메인 앱 컴포넌트 (얇은 프레젠터)
│   │   ├── App.css        # 전역 스타일 및 CSS 변수
│   │   ├── api.ts         # API 클라이언트
│   │   ├── main.tsx       # React 앱 진입점
│   │   ├── index.css      # 전역 CSS 리셋
│   │   └── vite-env.d.ts  # Vite 타입 정의
│   ├── package.json
│   └── vite.config.ts     # Vite 설정
│
├── backend/               # FastAPI 백엔드
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py        # FastAPI 앱 진입점
│   │   ├── api/           # API 라우터
│   │   │   ├── __init__.py
│   │   │   ├── datasets.py    # 데이터셋 관련 API
│   │   │   ├── stats.py       # 통계 계산 API
│   │   │   └── admin.py       # 관리/자동화 API (refresh, profile/doc 빌드)
│   │   ├── core/          # 핵심 로직
│   │   │   ├── __init__.py
│   │   │   ├── registry.py          # 데이터셋 레지스트리 관리
│   │   │   ├── column_meta.py       # 컬럼 메타데이터 로더
│   │   │   ├── auto_scan.py         # 자동 메타데이터 스캔 (판단 로직)
│   │   │   ├── metadata_pipeline.py # 메타데이터 파이프라인 단일 진입점
│   │   │   ├── profile_v1.py        # 프로파일 빌더 (데이터셋 통계 분석)
│   │   │   ├── doc_v1.py            # 문서 빌더 (간결한 데이터셋 문서)
│   │   │   └── settings.py          # 설정 관리
│   │   ├── engine/        # 데이터 처리 엔진
│   │   │   ├── __init__.py
│   │   │   ├── duckdb_engine.py  # DuckDB 쿼리 실행
│   │   │   └── duckdb_cache.py   # DuckDB 뷰 캐싱
│   │   └── models/        # 데이터 모델
│   │       ├── __init__.py
│   │       └── schemas.py      # Pydantic 스키마 (요청/응답 모델)
│   ├── requirements.txt
│   ├── start.sh           # 백엔드 시작 스크립트
│   └── Procfile           # 배포용 프로세스 파일
│
├── tools/                 # 유틸리티 스크립트
│   ├── scan_and_export.py           # CSV 스캔 및 메타데이터 생성
│   ├── generate_meta.py            # 메타데이터 생성 통합 (patterns/inference/frequency)
│   └── export_rag.py               # RAG 출력 통합 (markdown/jsonl)
│
├── data/                  # CSV 데이터 파일들
│   └── *.csv
│
├── metadata/              # 데이터셋 메타데이터 (레지스트리)
│   ├── datasets.json          # 데이터셋 목록
│   ├── columns_by_file.json   # 파일별 컬럼 목록
│   ├── columns_union.json     # 전체 컬럼 통합 목록
│   ├── columns_union.txt      # 전체 컬럼 목록 (텍스트)
│   ├── profiles/              # 데이터셋 프로파일 (JSON)
│   │   └── ds_*.json          # 각 데이터셋별 프로파일
│   └── docs/                  # 데이터셋 문서 (Markdown)
│       └── ds_*.md            # 각 데이터셋별 문서
│
├── column_meta/           # 컬럼 메타데이터
│   ├── global_columns.yaml        # 전역 컬럼 메타데이터 (공식)
│   ├── global_columns.generated.yaml  # 자동 생성된 메타데이터
│   ├── global_columns.legacy.yaml     # 레거시 메타데이터
│   ├── patterns.yaml                 # 패턴 기반 자동 생성 규칙
│   └── datasets/                    # 데이터셋별 오버라이드
│       ├── .gitkeep
│       └── {dataset_id}.yaml        # 데이터셋별 커스텀 메타데이터
│
├── rag_docs/              # RAG 시스템 문서 (Markdown)
│   ├── columns/            # 컬럼별 문서 (207개)
│   │   └── *.md
│   └── groups/             # 타입별 그룹 문서 (10개)
│       ├── gas.md
│       ├── temperature.md
│       ├── pressure.md
│       ├── valve.md
│       ├── aux.md
│       ├── heater.md
│       ├── recipe.md
│       ├── timestamp.md
│       ├── index.md
│       └── unknown.md
│
├── rag_index/              # RAG 시스템 인덱스 (JSONL)
│   └── column_meta.jsonl   # Vector DB용 인덱스 파일
│
├── start_backend.sh        # 백엔드 시작 스크립트
├── start_frontend.sh       # 프론트엔드 시작 스크립트
├── scan_metadata.sh        # 메타데이터 스캔 스크립트
├── watch_csv.sh            # CSV 변경 감지 및 자동 빌드 스크립트
│
├── README.md               # 프로젝트 README
├── ARCHITECTURE.md         # 아키텍처 문서 (현재 파일)
├── PROJECT_DOCUMENTATION.md # 프로젝트 전체 문서
├── METADATA_STRATEGIES.md  # 메타데이터 전략 문서
├── COLUMN_META_WORKFLOW.md # 컬럼 메타데이터 워크플로우
└── VERCEL_DEPLOY.md       # Vercel 배포 가이드
```

## 🔄 구동 원리

### 1. 백엔드 시작 과정

1. **서버 시작** (`backend/app/main.py`)
   - FastAPI 앱 초기화
   - CORS 미들웨어 설정
   - Startup 이벤트에서 `metadata_pipeline.refresh_registry_if_needed()` 실행

2. **메타데이터 파이프라인** (`backend/app/core/metadata_pipeline.py`)
   - **단일 진입점**: 모든 메타데이터 갱신은 이 모듈을 통해 실행
   - **패시브 자동화**: startup 이벤트에서 자동으로 필요 시 갱신
   - **액티브 자동화**: `/api/admin/refresh` API로 수동 갱신 가능
   - `tools/scan_and_export.py` 실행하여 레지스트리 갱신
   - `RefreshResult`로 실행 결과 반환

3. **메타데이터 자동 스캔 판단** (`backend/app/core/auto_scan.py`)
   - `should_regenerate_metadata()`: CSV 파일 변경 여부 판단
   - 레지스트리 파일 존재 여부 확인
   - CSV 파일 수정 시간과 레지스트리 수정 시간 비교
   - **역할**: 판단 로직만 담당 (실행은 metadata_pipeline에서)

4. **레지스트리 로드** (`backend/app/core/registry.py`)
   - `metadata/` 디렉토리에서 데이터셋 목록 로드
   - 메모리에 캐시하여 빠른 조회 가능

### 2. 프론트엔드 시작 과정

1. **앱 초기화** (`frontend/src/App.tsx`)
   - React 컴포넌트 마운트
   - `useAldController` 훅 호출하여 상태 관리 및 로직 분리
   - 데이터셋 목록 API 호출 (`/api/datasets`)

2. **데이터셋 선택**
   - 사용자가 데이터셋 선택 시 `selectedDatasetId` 상태 변경
   - `useAldController` 내부의 `useEffect`가 감지하여 미리보기 데이터 로드 (`/api/datasets/{id}/preview`)
   - 컬럼 메타데이터 로드 (`/api/datasets/{id}/columns`)
   - Profile/Doc 자동 로드 시도 (있으면 표시)
   - 첫 번째 컬럼 자동 선택

3. **컬럼 선택 및 표시**
   - 사용자가 체크박스로 표시할 컬럼 선택
   - "선택한 컬럼만 보기" 토글 기능으로 필터링
   - 타입 필터로 특정 타입의 컬럼만 선택 가능
   - 검색 기능으로 컬럼명/메타데이터 검색
   - 선택된 컬럼만 AG Grid에 표시

### 3. 데이터 로딩 흐름

```
사용자 액션
    │
    ▼
Frontend: useAldController 훅에서 상태 변경
    │
    ▼
Frontend: API 호출 요청 (api.ts)
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
Frontend: useAldController에서 상태 업데이트
    │
    ▼
UI 리렌더링 (React)
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

### 5. 메타데이터 파이프라인 (`backend/app/core/metadata_pipeline.py`)

**단일 진입점 원칙:**
- 모든 메타데이터 갱신은 `metadata_pipeline.refresh_registry_if_needed()`를 통해 실행
- `auto_scan.py`는 판단 로직만 담당 (실행은 파이프라인에서)

**동작 방식:**
1. **패시브 자동화**: Startup 이벤트에서 자동으로 필요 시 갱신
   - `should_regenerate_metadata()`로 판단
   - CSV 파일 변경 감지 시 자동 갱신
2. **액티브 자동화**: `/api/admin/refresh` API로 수동 갱신
   - `force=false`: 자동 판단에 따라 실행
   - `force=true`: 무조건 갱신 실행
3. **실행 결과**: `RefreshResult`로 성공/실패, 변경 여부, 이유 반환

**원칙:**
- Scan은 '파일 사실 정보'만 생성 (filename/size/mtime/columns/path/dataset_id)
- Column Meta / Profile / Doc 생성은 별도 파이프라인에서 처리

### 6. 프로파일 시스템 (`backend/app/core/profile_v1.py`)

**목적:**
- 데이터셋의 상세 통계 정보 생성
- 컬럼별 null ratio, semantic type, distinct count, top-k values 분석

**주요 기능:**
1. **Row Count 추정**: 파일 기반 빠른 추정
2. **샘플링 기반 분석**: 대용량 CSV도 효율적으로 처리
   - 기본 샘플링: 5,000행 (설정 가능)
   - 최대 샘플링: 50,000행
3. **컬럼별 통계**:
   - null ratio (null 비율)
   - semantic type 추론 (numeric, datetime, boolean, text, categorical)
   - approximate distinct count
   - top-k values (빈도 높은 값)
4. **결과 저장**: `metadata/profiles/{dataset_id}.json`

**API:**
- `POST /api/admin/profile/{dataset_id}/build`: 프로파일 빌드
- `GET /api/admin/profile/{dataset_id}`: 프로파일 읽기 (JSON 객체)

### 7. 문서 생성 시스템 (`backend/app/core/doc_v1.py`)

**목적:**
- 사람이 읽을 수 있는 간결한 데이터셋 문서 생성
- 핵심 정보만 표시 (전체 상세는 UI에서 확인)

**주요 기능:**
1. **데이터셋 요약**: 파일 크기, 컬럼 수, 행 수 등
2. **의미 그룹별 컬럼**: 타입별로 그룹화하여 대표 컬럼 Top N만 표시
   - 기본값: 그룹당 12개
3. **프로파일 하이라이트**: 관찰 기반 핵심 정보만 표시
   - null ratio 높은 컬럼 Top N
   - categorical 후보 Top N
   - datetime 후보 Top N
4. **결과 저장**: `metadata/docs/{dataset_id}.md`

**API:**
- `POST /api/admin/doc/{dataset_id}/build`: 문서 빌드 (파라미터: group_top_n, highlight_top_n)
- `GET /api/admin/doc/{dataset_id}`: 문서 읽기 (PlainTextResponse)

### 8. 컬럼 메타데이터 시스템 (`backend/app/core/column_meta.py`)

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
   - semantic_type 표시 (Profile에서 추출)

### 9. API 응답 스키마 (`backend/app/models/schemas.py`)

**요청 스키마:**
- `StatsRequest`: 통계 계산 요청
- `RowRange`: 행 범위 지정

**응답 스키마:**
- `DatasetListResponse`: 데이터셋 목록
- `DatasetMetaResponse`: 데이터셋 메타데이터
- `PreviewResponse`: 데이터 미리보기
- `DatasetColumnsResponse`: 컬럼 메타데이터
- `FieldsByTypeResponse`: 타입별 필드 목록
- `StatsResponse`: 통계 계산 결과
- `RefreshResponse`: 레지스트리 갱신 결과
- `ProfileBuildResponse`: 프로파일 빌드 결과

**장점:**
- OpenAPI/Swagger 문서에 정확한 응답 구조 표시
- API 계약 명확화
- 타입 안정성 향상

## 🎨 프론트엔드 컴포넌트 구조

### 아키텍처 패턴: Presenter-Controller 분리

프론트엔드는 **Presenter-Controller 패턴**을 사용하여 관심사를 분리합니다:

- **Presenter**: `App.tsx` - UI 렌더링만 담당하는 얇은 컴포넌트
- **Controller**: `useAldController.ts` - 모든 상태 관리와 비즈니스 로직을 담당하는 커스텀 훅

이 패턴의 장점:
- UI와 로직의 명확한 분리
- 테스트 용이성 향상
- 재사용 가능한 로직

### App.tsx (Presenter)
- UI 렌더링만 담당하는 얇은 컴포넌트
- `useAldController` 훅에서 상태와 핸들러를 가져옴
- 하위 컴포넌트에 props로 전달
- ToastBanner를 통한 에러 표시 관리

### useAldController.ts (Controller)
- 모든 상태 관리 (`useState`)
- API 호출 및 데이터 처리 로직 (`useEffect`)
- 이벤트 핸들러 (드래그 선택, 통계 계산 등)
- 상태 변경에 따른 사이드 이펙트 처리
- Profile/Doc 상태 관리 및 빌드 핸들러

### Header 컴포넌트
- 애플리케이션 헤더 표시
- "ALD" 배지, "ALDList" 제목, 부제목 표시
- 라이트 테마 스타일 적용

### Sidebar 컴포넌트
- **Sticky Top Bar**: 현재 선택된 데이터셋 정보 표시
- **프로파일/문서 섹션**: Profile/Doc 빌드 버튼 및 상태 표시
- **아코디언 섹션**: 각 기능 영역을 접을 수 있게 구성
  - 데이터셋 선택
  - 화면 표시 범위 (시작 행, 개수 설정)
  - 통계 계산 범위 (행 범위 선택)
  - 컬럼 선택
- **컬럼 선택 기능**:
  - 타입 필터 (접을 수 있음)
  - 검색 기능
  - "선택한 컬럼만 보기" 토글
  - 전체 선택/해제 버튼
  - 고정 높이 스크롤 리스트
- **UI 개선사항**:
  - 1-based UI, 0-based 내부 처리 (시작 행)
  - 드래그 선택 또는 수동 입력 지원
  - 활성 컬럼 하이라이트

### DataGrid 컴포넌트
- AG Grid를 사용한 데이터 테이블
- **행 드래그 선택**: 마우스로 행 범위 선택
- **컬럼 헤더 클릭**: 클릭 시 해당 컬럼을 활성화하고 Sidebar로 스크롤
- **행 하이라이트**: `rowClassRules`를 사용한 선언적 스타일링
  - 선택된 범위: `row-in-range`
  - 시작/끝 행: `row-in-range-start`, `row-in-range-end`
- 라이트 테마 스타일 적용

### StatsPanel 컴포넌트
- **컬럼 상세**: 선택된 컬럼의 메타데이터 표시
  - 컬럼명, 설명, 타입, 단위 등
  - 중요도 배지
  - semantic_type 표시 (Profile에서 추출)
  - 자동 생성 메타데이터 경고
- **통계 결과**: 선택된 범위의 통계값 표시
  - 요약 카드 (계산된 컬럼 수, 활성 컬럼, 활성 컬럼 count)
  - 각 컬럼별 상세 통계
    - 개수, 비어있지 않음, 최소값, 최대값, 평균, 표준편차
  - 활성 컬럼 하이라이트
- **Profile/Doc 빌드**: 빌드 버튼 및 결과 미리보기
  - Profile 빌드 버튼: 프로파일 생성 및 정보 표시
  - Doc 빌드 버튼: 문서 생성 및 Markdown 미리보기
  - 빌드 상태 표시 (빌드 중/완료)
- 숫자 포맷팅 함수 (`fmtNum`, `fmtFloat`)

### ToastBanner 컴포넌트
- 비차단형 알림 배너
- 화면 상단에 고정 표시
- 에러/정보 타입 지원
- 자동 닫기 기능

## 🎨 스타일링 시스템

### CSS 변수 기반 디자인 시스템 (`App.css`)

```css
:root {
  --bg: #f3f4f6;           /* 전체 배경 */
  --panel: #ffffff;        /* 카드/패널 배경 */
  --border: #e5e7eb;       /* 테두리 */
  --text: #111827;         /* 본문 글씨 */
  --muted: #374151;        /* 섹션 타이틀 */
  --muted2: #6b7280;       /* 힌트/보조 */
  --accent: #2563eb;       /* 포인트 블루 */
  --radius: 16px;          /* 둥근 모서리 */
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  --mono: ui-monospace, ...;
  --sans: ui-sans-serif, ...;
}
```

### 클래스 네이밍 컨벤션

- **Sidebar**: `sb-*` 접두사 (예: `sb-section`, `sb-sticky-top`)
- **StatsPanel**: `sp-*` 접두사 (예: `sp-card`, `sp-title`)
- **공통**: `btn-*`, `column-*` 등

### 반응형 레이아웃

```css
.app-content {
  grid-template-columns: 
    minmax(280px, 340px)    /* Sidebar */
    minmax(680px, 1.9fr)    /* DataGrid */
    minmax(320px, 420px);   /* StatsPanel */
}
```

## 🔌 API 엔드포인트

### 데이터셋 관련
- `GET /api/datasets` - 데이터셋 목록 조회 (`DatasetListResponse`)
  - 쿼리 파라미터: `limit`, `offset`, `filename`, `min_size`, `max_size`
- `GET /api/datasets/{dataset_id}` - 데이터셋 메타데이터 조회 (`DatasetMetaResponse`)
- `GET /api/datasets/{dataset_id}/preview?offset=0&limit=500` - 데이터 미리보기 (`PreviewResponse`)
- `GET /api/datasets/{dataset_id}/columns` - 컬럼 메타데이터 조회 (`DatasetColumnsResponse`)
- `GET /api/datasets/{dataset_id}/fields?type={type}` - 타입별 필드 조회 (`FieldsByTypeResponse`)

### 통계 관련
- `POST /api/datasets/{dataset_id}/stats` - 통계 계산 (`StatsResponse`)
  ```json
  {
    "columns": ["column1", "column2"],
    "row_range": {"start": 0, "end": 100},
    "compute_columns": ["column1"]  // 선택적: 특정 컬럼만 계산
  }
  ```

### 관리/자동화 API (`/api/admin`)
- `POST /api/admin/refresh?force=false` - 레지스트리 갱신 (`RefreshResponse`)
  - `force=false`: 자동 판단에 따라 필요 시에만 갱신
  - `force=true`: 무조건 갱신 실행
- `POST /api/admin/profile/{dataset_id}/build` - 프로파일 빌드 (`ProfileBuildResponse`)
  - 쿼리 파라미터: `force`, `sample_rows`, `top_k`
- `GET /api/admin/profile/{dataset_id}` - 프로파일 읽기 (JSON 객체)
- `POST /api/admin/doc/{dataset_id}/build` - 문서 빌드
  - 쿼리 파라미터: `group_top_n`, `highlight_top_n`
- `GET /api/admin/doc/{dataset_id}` - 문서 읽기 (PlainTextResponse)
- `POST /api/admin/doc/build_all` - 모든 데이터셋의 문서 빌드

## 🚀 성능 최적화

1. **DuckDB View 캐싱**
   - 각 데이터셋마다 View 생성하여 재사용
   - CSV 파일은 한 번만 로드

2. **점진적 로딩**
   - 미리보기 데이터를 먼저 로드 (표 표시)
   - 메타데이터는 나중에 로드 (툴팁/상세 패널)

3. **초기 로딩 크기 제한**
   - 기본 limit: 500행
   - 사용자가 필요시 더 로드 가능

4. **컬럼 선택 최적화**
   - 표시할 컬럼만 AG Grid에 전달
   - 불필요한 렌더링 방지

5. **React 최적화**
   - `useMemo`로 필터링된 컬럼 리스트 메모이제이션
   - 상태 관리 중앙화로 불필요한 리렌더링 방지

6. **프로파일 샘플링**
   - 대용량 CSV도 샘플링으로 효율적 분석
   - 기본 5,000행 샘플링으로 빠른 처리

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
   - 검색 기능
   - "선택한 컬럼만 보기" 토글

4. **통계 계산**
   - 선택한 범위의 통계값 계산
   - 전체 컬럼 또는 활성 컬럼만 선택 가능
   - 요약 카드로 주요 정보 한눈에 확인

5. **프로파일 및 문서 생성**
   - 데이터셋 프로파일 생성 (통계 분석)
   - 간결한 데이터셋 문서 생성
   - UI에서 빌드 버튼으로 생성 가능
   - 자동화 스크립트로 자동 빌드 지원

6. **사용자 경험 개선**
   - 아코디언으로 공간 효율성 향상
   - Sticky top bar로 현재 데이터셋 정보 항상 표시
   - ToastBanner로 비차단형 알림
   - 라이트 테마로 가독성 향상

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
- `DATA_DIR`: CSV 파일 디렉토리 경로 (기본값: `./data`)
- `META_DIR`: 메타데이터 디렉토리 경로 (기본값: `./metadata`)

## 🔄 자동화

### 파일 변경 감지 (`watch_csv.sh`)

**기능:**
- `data/` 디렉토리의 CSV 파일 변경 감지
- 파일 해시 기반 변경 감지 (2초마다 체크)
- macOS/Linux 호환

**동작:**
1. CSV 파일 변경 감지
2. Registry refresh (`POST /api/admin/refresh`)
3. 모든 dataset에 대해 Profile/Doc 빌드

**사용법:**
```bash
chmod +x watch_csv.sh
./watch_csv.sh
```

## 📚 기술 스택

- **Frontend**: 
  - React 18
  - TypeScript
  - AG Grid (데이터 그리드)
  - Vite (빌드 도구)
  - CSS Variables (디자인 시스템)
- **Backend**: 
  - FastAPI
  - Python
  - DuckDB (인메모리 데이터베이스)
- **Metadata**: YAML 파일 기반
- **Data**: CSV 파일
- **Profiling**: DuckDB 기반 샘플링 및 통계 분석

## 🎯 주요 설계 결정

1. **Presenter-Controller 패턴**: UI와 로직 분리로 유지보수성 향상
2. **CSS 변수 기반 디자인 시스템**: 테마 변경 용이성
3. **컴포넌트별 CSS 파일**: 스타일 격리 및 관리 용이성
4. **선언적 스타일링**: `rowClassRules`로 행 스타일 관리
5. **비차단형 알림**: ToastBanner로 사용자 경험 개선
6. **메타데이터 파이프라인 단일 진입점**: `metadata_pipeline.py`로 모든 갱신 경로 통합
   - 패시브 자동화 (startup)와 액티브 자동화 (API) 통합 관리
   - 판단 로직(`auto_scan`)과 실행 로직(`metadata_pipeline`) 분리
7. **API 응답 스키마 명시**: 모든 엔드포인트에 `response_model` 지정
   - OpenAPI 문서 정확성 향상
   - API 계약 명확화 및 타입 안정성 확보
8. **프로파일 및 문서 시스템**: 데이터셋 분석 및 문서화 자동화
   - 샘플링 기반 효율적 분석
   - 간결한 문서 생성 (핵심 정보만)
9. **4단계 파이프라인**: Scan → Column Meta → Profile → Doc
   - 각 단계별 명확한 책임 분리
   - 단계별 독립적 실행 가능

## 📊 4단계 파이프라인

프로젝트는 4단계 파이프라인으로 구성됩니다:

1. **Scan 단계** (`tools/scan_and_export.py`)
   - CSV 파일 스캔 및 기본 메타데이터 생성
   - `metadata/datasets.json` 생성
   - 파일 사실 정보만 추출 (filename, size, mtime, columns, path)

2. **Column Meta 단계** (`backend/app/core/column_meta.py`)
   - 컬럼 메타데이터 로드 및 병합
   - 3단계 우선순위: Dataset Override → Global Meta → Patterns
   - API에서 실시간으로 제공

3. **Profile 단계** (`backend/app/core/profile_v1.py`)
   - 데이터셋 프로파일 생성 (통계 분석)
   - 샘플링 기반 효율적 분석
   - `metadata/profiles/{dataset_id}.json` 저장

4. **Doc 단계** (`backend/app/core/doc_v1.py`)
   - 간결한 데이터셋 문서 생성
   - Profile과 Column Meta를 결합
   - `metadata/docs/{dataset_id}.md` 저장

각 단계는 독립적으로 실행 가능하며, 필요에 따라 선택적으로 실행할 수 있습니다.
