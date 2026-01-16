# ALDList 프로젝트 전체 문서

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [전체 아키텍처](#전체-아키텍처)
3. [백엔드 구조](#백엔드-구조)
4. [프론트엔드 구조](#프론트엔드-구조)
5. [데이터 흐름](#데이터-흐름)
6. [파일별 상세 설명](#파일별-상세-설명)
7. [4단계 파이프라인](#4단계-파이프라인)
8. [실행 흐름 상세](#실행-흐름-상세)

---

## 프로젝트 개요

**ALDList**는 CSV 파일을 자동으로 스캔하고 분석할 수 있는 웹 애플리케이션입니다.

### 핵심 기능

1. **자동 메타데이터 생성**: CSV 파일을 스캔하여 기본 정보 추출
2. **데이터 미리보기**: 대용량 CSV도 OFFSET/LIMIT으로 빠르게 탐색
3. **통계 계산**: 선택한 컬럼과 행 범위에 대한 통계 계산
4. **컬럼 메타데이터**: 컬럼의 의미, 타입, 설명 제공
5. **프로파일 생성**: 데이터셋의 상세 통계 정보 생성
6. **문서 생성**: 사람이 읽을 수 있는 데이터 설명서 생성

### 기술 스택

- **Backend**: FastAPI (Python)
- **Frontend**: React + TypeScript + Vite
- **Database**: DuckDB (인메모리 분석 엔진)
- **Data Grid**: AG Grid

---

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  App.tsx → Sidebar, DataGrid, StatsPanel                    │
│  useAldController.ts (상태 관리)                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP API
┌──────────────────────┴──────────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  datasets.py │  │   stats.py   │  │   admin.py   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                  │                  │             │
│  ┌──────┴──────────────────┴──────────────────┴──────┐  │
│  │              Core Modules                           │  │
│  │  registry.py, column_meta.py, profile_v1.py, ...   │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────┴──────────────────────────────┐  │
│  │            DuckDB Engine                            │  │
│  │  duckdb_engine.py, duckdb_cache.py                  │  │
│  └──────────────────────┬──────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────┘
                          │
┌─────────────────────────┴──────────────────────────────────┐
│                    Data Layer                               │
│  data/*.csv  →  metadata/datasets.json                     │
│  metadata/profiles/*.json  →  metadata/docs/*.md           │
└────────────────────────────────────────────────────────────┘
```

---

## 백엔드 구조

### 📁 디렉토리 구조

```
backend/app/
├── main.py                 # FastAPI 앱 진입점
├── api/                    # API 엔드포인트
│   ├── datasets.py        # 데이터셋 조회 API
│   ├── stats.py           # 통계 계산 API
│   └── admin.py           # 관리/자동화 API
├── core/                   # 핵심 비즈니스 로직
│   ├── settings.py        # 설정 및 경로 관리
│   ├── registry.py        # 레지스트리 로드/조회
│   ├── metadata_pipeline.py  # 메타데이터 파이프라인
│   ├── auto_scan.py       # 자동 스캔 판단
│   ├── column_meta.py     # 컬럼 메타데이터 로더
│   ├── profile_v1.py      # 프로파일 빌더
│   └── doc_v1.py          # 문서 빌더
├── engine/                 # DuckDB 엔진
│   ├── duckdb_engine.py   # CSV 쿼리 실행
│   └── duckdb_cache.py    # View 캐싱
└── models/                 # 데이터 모델
    └── schemas.py         # Pydantic 스키마
```

---

## 프론트엔드 구조

### 📁 디렉토리 구조

```
frontend/src/
├── main.tsx               # React 진입점
├── App.tsx                # 메인 앱 컴포넌트
├── App.css                # 전역 스타일
├── components/
│   ├── Header.tsx         # 헤더 컴포넌트
│   ├── Sidebar.tsx        # 사이드바 (데이터셋 선택, 컬럼 필터)
│   ├── DataGrid.tsx       # AG Grid 데이터 그리드
│   ├── StatsPanel.tsx     # 통계 패널
│   └── ToastBanner.tsx    # 토스트 메시지
├── hooks/
│   └── useAldController.ts  # 상태 관리 훅
└── api.ts                 # API 클라이언트
```

---

## 데이터 흐름

### 1. 서버 시작 흐름

```
1. main.py 시작
   ↓
2. startup_event() 실행
   ↓
3. metadata_pipeline.refresh_registry_if_needed(force=False)
   ↓
4. auto_scan.should_regenerate_metadata() 확인
   ↓
5. 필요시 tools/scan_and_export.py 실행
   ↓
6. metadata/datasets.json 생성/업데이트
```

### 2. 데이터셋 목록 조회 흐름

```
Frontend: App.tsx
   ↓
API 호출: GET /api/datasets
   ↓
Backend: datasets.py → list_datasets()
   ↓
registry.py → load_registry()
   ↓
metadata/datasets.json 읽기
   ↓
DatasetMeta 객체 리스트 반환
   ↓
Frontend: 데이터셋 목록 표시
```

### 3. 데이터 미리보기 흐름

```
Frontend: DataGrid.tsx
   ↓
API 호출: GET /api/datasets/{id}/preview?offset=0&limit=2000
   ↓
Backend: datasets.py → preview()
   ↓
duckdb_engine.py → preview_rows()
   ↓
duckdb_cache.py → get_view_query() (View 캐싱)
   ↓
DuckDB 쿼리 실행: SELECT ... FROM view LIMIT 2000 OFFSET 0
   ↓
결과 반환: rows, columns
   ↓
Frontend: AG Grid에 데이터 표시
```

### 4. 통계 계산 흐름

```
Frontend: StatsPanel.tsx
   ↓
API 호출: POST /api/datasets/{id}/stats
   Body: { columns: [...], row_range: { start, end } }
   ↓
Backend: stats.py → stats()
   ↓
duckdb_engine.py → compute_metrics()
   ↓
DuckDB 쿼리 실행: COUNT, AVG, MIN, MAX, STDDEV 등
   ↓
결과 반환: { column_name: Metric }
   ↓
Frontend: 통계 패널에 표시
```

### 5. 프로파일 생성 흐름

```
API 호출: POST /api/admin/profile/{id}/build
   ↓
Backend: admin.py → build_profile()
   ↓
profile_v1.py → build_profile_v1()
   ↓
1. DuckDB로 샘플 데이터 추출
2. 모든 컬럼에 대해 통계 계산 (1쿼리)
3. 각 컬럼별 top-k values 추출
4. semantic_type 추론
   ↓
metadata/profiles/{dataset_id}.json 저장
```

### 6. 문서 생성 흐름

```
API 호출: POST /api/admin/doc/{id}/build
   ↓
Backend: admin.py → build_doc()
   ↓
doc_v1.py → build_doc_v1()
   ↓
1. profile_v1.py에서 프로파일 로드
2. column_meta.py에서 메타데이터 로드
3. Markdown 문서 생성
   - Dataset Summary
   - Column Groups (의미 기준)
   - Column Profiles (관찰 기준)
   ↓
metadata/docs/{dataset_id}.md 저장
```

---

## 파일별 상세 설명

### 🔧 Backend Core Modules

#### `backend/app/core/settings.py`

**역할**: 프로젝트 전역 설정 및 경로 관리

**주요 변수:**
- `PROJECT_ROOT`: 프로젝트 루트 경로
- `DATA_DIR`: CSV 파일 디렉토리 (`data/`)
- `META_DIR`: 메타데이터 디렉토리 (`metadata/`)
- `REGISTRY_PATH`: 레지스트리 파일 경로 (`metadata/datasets.json`)
- `PROFILES_DIR`: 프로파일 디렉토리 (`metadata/profiles/`)
- `DOCS_DIR`: 문서 디렉토리 (`metadata/docs/`)
- `PREVIEW_LIMIT_DEFAULT`, `PREVIEW_LIMIT_MAX`: 미리보기 기본값
- `PROFILE_SAMPLE_ROWS_DEFAULT`, `PROFILE_TOPK_DEFAULT`: 프로파일 기본값

**호출 위치:**
- 모든 core 모듈에서 import하여 경로 사용
- 서버 시작 시 디렉토리 자동 생성

---

#### `backend/app/core/registry.py`

**역할**: 데이터셋 레지스트리 로드 및 조회

**주요 함수:**

1. **`load_registry() -> List[DatasetMeta]`**
   - `metadata/datasets.json` 파일 읽기
   - 각 항목을 `DatasetMeta` 객체로 변환
   - 경로 정규화 (DATA_DIR 기준)
   - **호출 위치**: `datasets.py`, `admin.py`, `stats.py`

2. **`get_dataset(dataset_id: str) -> Optional[DatasetMeta]`**
   - 특정 데이터셋 ID로 메타데이터 조회
   - **호출 위치**: 모든 API 엔드포인트

**데이터 구조:**
```python
@dataclass
class DatasetMeta:
    dataset_id: str      # "ds_6bbc5f246568"
    path: str            # 절대 경로
    filename: str        # "standard_trace_001.csv"
    size_bytes: int      # 파일 크기
    mtime: float         # 수정 시간
    columns: List[str]   # 컬럼 목록
```

**연결 관계:**
- 읽기: `metadata/datasets.json` (scan_and_export.py가 생성)
- 사용: 모든 API 엔드포인트에서 데이터셋 정보 조회

---

#### `backend/app/core/metadata_pipeline.py`

**역할**: 메타데이터 파이프라인 단일 진입점

**주요 함수:**

1. **`refresh_registry_if_needed(force: bool = False) -> RefreshResult`**
   - Registry 갱신 필요 여부 판단 및 실행
   - `force=True`: 무조건 실행
   - `force=False`: `auto_scan.should_regenerate_metadata()` 판단
   - **호출 위치**: 
     - `main.py` (startup 이벤트)
     - `admin.py` (`/api/admin/refresh` 엔드포인트)

2. **`_run_scan_and_export() -> subprocess.CompletedProcess`**
   - `tools/scan_and_export.py`를 서브프로세스로 실행
   - 내부 함수 (직접 호출 안 됨)

**데이터 구조:**
```python
@dataclass
class RefreshResult:
    ok: bool              # 성공 여부
    changed: bool        # 스캔 실행 여부
    reason: str          # "up-to-date" | "auto" | "force"
    registry_path: str   # registry 파일 경로
    stdout: str          # 실행 출력
    stderr: str          # 에러 출력
```

**연결 관계:**
- 호출: `main.py`, `admin.py`
- 호출하는 것: `auto_scan.should_regenerate_metadata()`, `tools/scan_and_export.py`

---

#### `backend/app/core/auto_scan.py`

**역할**: 메타데이터 재생성 필요 여부 자동 판단

**주요 함수:**

1. **`should_regenerate_metadata() -> bool`**
   - CSV 파일 변경 여부 확인
   - 파일 추가/삭제 확인
   - 경로 유효성 확인
   - **호출 위치**: `metadata_pipeline.py`

2. **`ensure_metadata()`** (레거시, 현재 미사용)
   - 이전 버전의 메타데이터 생성 함수
   - 현재는 `metadata_pipeline.py` 사용

**판단 로직:**
1. `metadata/datasets.json`이 없으면 → `True`
2. CSV 파일의 mtime이 registry보다 최신이면 → `True`
3. CSV 파일 목록이 변경되었으면 → `True`
4. 메타데이터의 경로가 유효하지 않으면 → `True`
5. 그 외 → `False`

**연결 관계:**
- 호출: `metadata_pipeline.py`
- 확인: `REGISTRY_PATH`, `DATA_DIR`의 CSV 파일들

---

#### `backend/app/core/column_meta.py`

**역할**: 컬럼 메타데이터 로드 및 병합 (Global + Patterns + Dataset Override)

**주요 함수:**

1. **`load_global_meta() -> Dict[str, Dict[str, Any]]`**
   - `column_meta/global_columns.yaml` 로드
   - 전역 컬럼 메타데이터 반환
   - **호출 위치**: `build_meta_map()`

2. **`load_dataset_override(dataset_id: str) -> Dict[str, Dict[str, Any]]`**
   - `column_meta/datasets/{dataset_id}.yaml` 로드
   - 데이터셋별 오버라이드 메타데이터 반환
   - **호출 위치**: `build_meta_map()`

3. **`load_patterns() -> Tuple[Dict[str, str], List[PatternRule], Dict[str, Any]]`**
   - `column_meta/patterns.yaml` 로드
   - 정규식 패턴 규칙 반환
   - **호출 위치**: `build_meta_map()`

4. **`build_meta_map(dataset_id: str, columns: List[str]) -> Dict[str, Dict[str, Any]]`**
   - 모든 컬럼에 대한 메타데이터 맵 생성
   - 우선순위: Dataset Override > Global Meta > Patterns 자동 생성
   - **호출 위치**: 
     - `datasets.py` (`get_dataset_columns`, `get_fields_by_type`)
     - `doc_v1.py` (문서 생성)

**메타데이터 구조:**
```python
{
  "column_name": {
    "type": "gas",           # 타입 (gas, temperature, pressure, ...)
    "title": "가스 이름",     # 표시명
    "desc": "설명",          # 설명
    "unit": "sccm",          # 단위
    "importance": "A",       # 중요도
    ...
  }
}
```

**우선순위:**
1. Dataset Override (`column_meta/datasets/{id}.yaml`)
2. Global Meta (`column_meta/global_columns.yaml`)
3. Patterns (`column_meta/patterns.yaml`) - 정규식 매칭

**연결 관계:**
- 읽기: `column_meta/*.yaml` 파일들
- 사용: `datasets.py`, `doc_v1.py`

---

#### `backend/app/core/profile_v1.py`

**역할**: 데이터셋 프로파일 생성 (통계 정보)

**주요 함수:**

1. **`build_profile_v1(dataset_id, sample_rows, top_k, force) -> ProfileBuildResult`**
   - 프로파일 생성 및 파일 저장
   - **호출 위치**: `admin.py` (`/api/admin/profile/{id}/build`)

2. **`_file_row_count_estimate(csv_path, sample_bytes) -> int`**
   - 파일 크기 기반 row_count 추정
   - 빠른 추정 (O(sample_bytes))

3. **`_semantic_type_from_ratios(...) -> Tuple[str, float]`**
   - 관찰 기반 semantic_type 추론
   - numeric, datetime, boolean, text, categorical 판단

4. **`_build_sample_from_view(view_query, sample_rows) -> Tuple[str, bool]`**
   - DuckDB 샘플링 서브쿼리 생성
   - USING SAMPLE 또는 LIMIT 사용

**프로파일 구조:**
```json
{
  "version": "profile_v1",
  "dataset_id": "ds_xxx",
  "built_at": "2026-01-15T...",
  "source": { "path", "filename", "size_bytes", "mtime" },
  "row_count_estimate": 42251,
  "sample": { "rows": 5000, "actual_rows": 5000, "top_k": 5 },
  "columns": {
    "column_name": {
      "sample": {
        "count": 5000,
        "null_count": 0,
        "non_null_count": 5000,
        "null_ratio": 0.0,
        "approx_distinct": 4111
      },
      "semantic_type": {
        "type": "numeric",
        "confidence": 1.0,
        "evidence": { ... }
      },
      "top_values": [ { "value": "...", "count": 4 } ]
    }
  }
}
```

**최적화 포인트:**
- 모든 컬럼의 통계를 **1쿼리**로 계산 (대용량에 강함)
- 샘플링 기반으로 빠른 처리
- mtime 비교로 캐싱 (force=False일 때)

**연결 관계:**
- 호출: `admin.py`
- 사용: `duckdb_cache.py` (View 캐싱)
- 읽기: `registry.py` (데이터셋 정보)
- 저장: `metadata/profiles/{dataset_id}.json`

---

#### `backend/app/core/doc_v1.py`

**역할**: 데이터셋 문서 생성 (Markdown)

**주요 함수:**

1. **`build_doc_v1(dataset_id, top_columns_per_group) -> str`**
   - 프로파일과 column_meta를 결합하여 Markdown 문서 생성
   - **호출 위치**: `admin.py` (`/api/admin/doc/{id}/build`)

2. **`_load_profile(dataset_id) -> Dict[str, Any]`**
   - 프로파일 JSON 파일 로드
   - 내부 함수

**문서 구조:**
```markdown
# Dataset: filename.csv

## 1. Dataset Summary
- Dataset ID, File size, Column count, Row count, ...

## 2. Column Groups (by meaning)
### gas
- **column_name**: title
  - description

## 3. Column Profiles (by observation)
### column_name
- semantic_type: numeric (confidence: 1.0)
- null_ratio: 0.0
- distinct_count: 4111
- top values: ...
```

**원칙:**
- Column Groups: column_meta 기반 (의미)
- Column Profiles: profile 기반 (관찰)
- 두 섹션을 명확히 분리

**연결 관계:**
- 호출: `admin.py`
- 읽기: `profile_v1.py` (프로파일), `column_meta.py` (메타데이터)
- 저장: `metadata/docs/{dataset_id}.md`

---

### 🔌 Backend Engine Modules

#### `backend/app/engine/duckdb_engine.py`

**역할**: DuckDB를 사용한 CSV 쿼리 실행

**주요 함수:**

1. **`preview_rows(csv_path, offset, limit, columns, dataset_id) -> Tuple[List[Dict], List[str]]`**
   - CSV 미리보기 데이터 추출
   - OFFSET/LIMIT 지원
   - **호출 위치**: `datasets.py` (`preview` 엔드포인트)

2. **`compute_metrics(csv_path, columns, row_start, row_end, dataset_id) -> Dict[str, Dict]`**
   - 컬럼별 통계 계산 (COUNT, AVG, MIN, MAX, STDDEV)
   - 행 범위 지정 가능
   - **호출 위치**: `stats.py` (`stats` 엔드포인트)

3. **`quote_ident(name: str) -> str`**
   - SQL 식별자 따옴표 처리
   - 특수문자 이스케이프

**쿼리 예시:**
```sql
-- 미리보기
SELECT "column1", "column2" 
FROM ds_view_xxx 
LIMIT 2000 OFFSET 0

-- 통계 계산
SELECT 
  COUNT("column1") as count,
  AVG(CAST("column1" AS DOUBLE)) as avg,
  MIN("column1") as min,
  MAX("column1") as max
FROM ds_view_xxx
WHERE rowid >= 0 AND rowid < 1000
```

**연결 관계:**
- 호출: `datasets.py`, `stats.py`
- 사용: `duckdb_cache.py` (View 캐싱)

---

#### `backend/app/engine/duckdb_cache.py`

**역할**: DuckDB View 캐싱 시스템

**주요 클래스:**

**`DuckDBCache`**
- 데이터셋별 DuckDB Connection 관리
- View 생성 및 재사용
- Thread-safe

**주요 메서드:**

1. **`get_view_query(dataset_id, csv_path) -> str`**
   - View 쿼리 문자열 반환
   - View가 없으면 생성
   - **호출 위치**: `duckdb_engine.py`, `profile_v1.py`

2. **`ensure_view(dataset_id, csv_path) -> str`**
   - View 생성 보장
   - 이미 있으면 재사용

3. **`_get_or_create_connection(dataset_id) -> DuckDBPyConnection`**
   - 데이터셋별 Connection 가져오기 또는 생성

**캐싱 전략:**
- 데이터셋별 독립적인 Connection
- View 이름: `ds_view_{dataset_id}_{counter}`
- View는 Connection 생명주기 동안 유지

**연결 관계:**
- 호출: `duckdb_engine.py`, `profile_v1.py`
- 사용: DuckDB 라이브러리

---

### 🌐 Backend API Modules

#### `backend/app/api/datasets.py`

**역할**: 데이터셋 관련 API 엔드포인트

**주요 엔드포인트:**

1. **`GET /api/datasets`** → `list_datasets()`
   - 데이터셋 목록 조회
   - 페이지네이션, 필터링 지원
   - **파라미터**: `limit`, `offset`, `filename`, `min_size`, `max_size`
   - **응답**: `DatasetListResponse`
   - **호출 흐름**: `registry.load_registry()` → 필터링 → 반환

2. **`GET /api/datasets/{dataset_id}`** → `get_dataset_meta()`
   - 특정 데이터셋 메타데이터 조회
   - **응답**: `DatasetMetaResponse`
   - **호출 흐름**: `registry.get_dataset()` → 반환

3. **`GET /api/datasets/{dataset_id}/preview`** → `preview()`
   - 데이터 미리보기
   - **파라미터**: `offset`, `limit`
   - **응답**: `PreviewResponse`
   - **호출 흐름**: `duckdb_engine.preview_rows()` → 반환

4. **`GET /api/datasets/{dataset_id}/columns`** → `get_dataset_columns()`
   - 컬럼 메타데이터 조회
   - **응답**: `DatasetColumnsResponse`
   - **호출 흐름**: `column_meta.build_meta_map()` → 반환

5. **`GET /api/datasets/{dataset_id}/fields`** → `get_fields_by_type()`
   - 타입별 컬럼 필터링
   - **파라미터**: `type` (gas, temperature, pressure, ...)
   - **응답**: `FieldsByTypeResponse`
   - **호출 흐름**: `column_meta.build_meta_map()` → 타입 필터링 → 반환

**연결 관계:**
- 사용: `registry.py`, `column_meta.py`, `duckdb_engine.py`
- 응답 모델: `schemas.py`

---

#### `backend/app/api/stats.py`

**역할**: 통계 계산 API

**주요 엔드포인트:**

1. **`POST /api/datasets/{dataset_id}/stats`** → `stats()`
   - 컬럼별 통계 계산
   - **요청**: `StatsRequest` (columns, row_range, compute_columns)
   - **응답**: `StatsResponse` (metrics)
   - **호출 흐름**: 
     ```
     registry.get_dataset() 
     → duckdb_engine.compute_metrics() 
     → Metric 객체 변환 
     → 반환
     ```

**연결 관계:**
- 사용: `registry.py`, `duckdb_engine.py`
- 요청/응답 모델: `schemas.py`

---

#### `backend/app/api/admin.py`

**역할**: 관리/자동화 API

**주요 엔드포인트:**

1. **`POST /api/admin/refresh`** → `refresh()`
   - Registry 갱신
   - **파라미터**: `force` (bool)
   - **응답**: `RefreshResponse`
   - **호출 흐름**: `metadata_pipeline.refresh_registry_if_needed()` → 반환

2. **`POST /api/admin/profile/{dataset_id}/build`** → `build_profile()`
   - 프로파일 빌드
   - **파라미터**: `force`, `sample_rows`, `top_k`
   - **응답**: `ProfileBuildResponse`
   - **호출 흐름**: `profile_v1.build_profile_v1()` → 파일 저장 → 반환

3. **`POST /api/admin/doc/{dataset_id}/build`** → `build_doc()`
   - 문서 빌드
   - **응답**: `{ ok, dataset_id, doc_path }`
   - **호출 흐름**: `doc_v1.build_doc_v1()` → 파일 저장 → 반환

4. **`POST /api/admin/doc/build_all`** → `build_all_docs()`
   - 모든 데이터셋 문서 빌드
   - **응답**: `{ ok, total, success, failed, results }`
   - **호출 흐름**: `registry.load_registry()` → 각 데이터셋에 대해 `doc_v1.build_doc_v1()` → 반환

**연결 관계:**
- 사용: `metadata_pipeline.py`, `profile_v1.py`, `doc_v1.py`, `registry.py`
- 응답 모델: `schemas.py`

---

### 📊 Backend Models

#### `backend/app/models/schemas.py`

**역할**: API 요청/응답 스키마 정의 (Pydantic)

**주요 모델:**

**요청 모델:**
- `StatsRequest`: 통계 계산 요청
- `RowRange`: 행 범위 지정

**응답 모델:**
- `DatasetSummary`: 데이터셋 요약 정보
- `DatasetListResponse`: 데이터셋 목록 응답
- `DatasetMetaResponse`: 데이터셋 메타데이터 응답
- `PreviewResponse`: 미리보기 응답
- `DatasetColumnsResponse`: 컬럼 메타데이터 응답
- `FieldsByTypeResponse`: 타입별 필드 응답
- `StatsResponse`: 통계 응답
- `RefreshResponse`: Registry 갱신 응답
- `ProfileBuildResponse`: 프로파일 빌드 응답

**사용 위치:**
- 모든 API 엔드포인트의 `response_model` 파라미터
- FastAPI의 OpenAPI 문서 자동 생성

---

### 🛠️ Tools

#### `tools/scan_and_export.py`

**역할**: CSV 파일 스캔 및 Registry 생성

**주요 함수:**

1. **`main()`**
   - `data/*.csv` 파일 스캔
   - 각 파일의 메타데이터 추출
   - `metadata/datasets.json` 생성

2. **`read_header(p: Path) -> List[str]`**
   - CSV 헤더 읽기

3. **`make_dataset_id(p: Path) -> str`**
   - 파일명 기반 dataset_id 생성 (SHA1 해시)

**생성하는 것:**
- `metadata/datasets.json`: Registry 파일
- `metadata/columns_*.json`: 보조 산출물

**호출 위치:**
- `metadata_pipeline.py`에서 서브프로세스로 실행

**원칙:**
- 파일 단위 사실 정보만 생성
- 컬럼 의미 해석 안 함
- 통계 계산 안 함

---

### 🎨 Frontend Components

#### `frontend/src/api.ts`

**역할**: 백엔드 API 클라이언트

**주요 함수:**

1. **`getDatasets() -> Promise<{ datasets: Dataset[] }>`**
   - 데이터셋 목록 가져오기
   - **호출 위치**: `useAldController.ts`
   - **API**: `GET /api/datasets`

2. **`getPreview(datasetId, offset, limit) -> Promise<PreviewResponse>`**
   - 데이터 미리보기 가져오기
   - **호출 위치**: `useAldController.ts`
   - **API**: `GET /api/datasets/{id}/preview`

3. **`getStats(datasetId, columns, rowStart, rowEnd, computeColumns) -> Promise<StatsResponse>`**
   - 통계 계산 요청
   - **호출 위치**: `useAldController.ts`
   - **API**: `POST /api/datasets/{id}/stats`

4. **`fetchDatasetColumns(datasetId) -> Promise<DatasetColumnsResponse>`**
   - 컬럼 메타데이터 가져오기
   - **호출 위치**: `useAldController.ts`
   - **API**: `GET /api/datasets/{id}/columns`

5. **`getFieldsByType(datasetId, type) -> Promise<FieldsByTypeResponse>`**
   - 타입별 필드 가져오기
   - **호출 위치**: `Sidebar.tsx`
   - **API**: `GET /api/datasets/{id}/fields?type=...`

**연결 관계:**
- 호출: `useAldController.ts`, `Sidebar.tsx`
- 통신: 백엔드 FastAPI 서버

---

#### `frontend/src/App.tsx`

**역할**: 메인 앱 컴포넌트

**주요 상태:**
- `toastMsg`, `toastType`: Toast 메시지
- `showSelectedOnly`: 선택된 컬럼만 표시 여부

**주요 기능:**
- 레이아웃 관리 (Header, Sidebar, DataGrid, StatsPanel)
- Toast 메시지 표시
- 데이터셋 변경 시 `showSelectedOnly` 리셋

**레이아웃 구조:**
```
<div className="app">
  <Header />
  <ToastBanner />
  <div className="app-content">
    <Sidebar />      (왼쪽)
    <DataGrid />    (중앙)
    <StatsPanel />  (오른쪽)
  </div>
</div>
```

**연결 관계:**
- 사용: `useAldController.ts` (상태 관리)
- 자식 컴포넌트: `Header`, `Sidebar`, `DataGrid`, `StatsPanel`, `ToastBanner`

---

#### `frontend/src/hooks/useAldController.ts`

**역할**: 애플리케이션 상태 관리 커스텀 훅

**주요 상태:**
- `datasets`: 데이터셋 목록
- `selectedDatasetId`: 선택된 데이터셋 ID
- `allColumns`, `visibleColumns`: 컬럼 목록
- `columnDefs`, `rowData`: AG Grid 데이터
- `columnMeta`: 컬럼 메타데이터
- `activeColumn`: 활성 컬럼
- `stats`: 통계 결과
- `rowRange`: 선택된 행 범위
- `offset`, `limit`: 미리보기 범위
- `isLoading`, `isLoadingStats`: 로딩 상태
- `columnSearchQuery`, `selectedTypeFilter`: 컬럼 필터
- `showSelectedOnly`: 선택된 컬럼만 표시 여부
- `statsComputeMode`: 통계 계산 모드 ("all" | "active")

**주요 함수:**

1. **`handleDatasetChange(datasetId: string)`**
   - 데이터셋 변경 처리
   - 미리보기 데이터 자동 로드
   - 컬럼 메타데이터 로드
   - **호출 위치**: `App.tsx` (onDatasetChange)

2. **`handleRowRangeChange(start: number, end: number)`**
   - 행 범위 변경 처리
   - 통계 자동 계산 (선택 시)
   - **호출 위치**: `DataGrid.tsx` (셀 드래그)

3. **`handleColumnToggle(column: string, checked: boolean)`**
   - 컬럼 선택/해제 처리
   - **호출 위치**: `Sidebar.tsx`

4. **`fetchPreview()`**
   - 미리보기 데이터 가져오기
   - **내부 호출**: `api.getPreview()`

5. **`fetchStats()`**
   - 통계 데이터 가져오기
   - **내부 호출**: `api.getStats()`

**useEffect 훅:**
- 데이터셋 목록 로드 (마운트 시)
- 데이터셋 변경 시 미리보기/메타데이터 로드
- 행 범위 변경 시 통계 계산 (자동 모드)

**연결 관계:**
- 호출: `App.tsx`
- 사용: `api.ts` (API 호출)

---

#### `frontend/src/components/Sidebar.tsx`

**역할**: 사이드바 (데이터셋 선택, 범위 설정, 컬럼 필터)

**주요 섹션:**

1. **Sticky Top Bar** (`sb-sticky-top`)
   - 현재 선택된 데이터셋 정보 표시
   - 고정 헤더

2. **데이터셋 선택** (`sb-section`)
   - 데이터셋 목록 표시
   - 선택 시 `onDatasetChange` 호출

3. **행 범위 설정** (`sb-section`)
   - OFFSET/LIMIT 설정
   - 수동 행 범위 설정 (시작/끝)
   - 범위 리셋 버튼

4. **컬럼 선택** (`sb-section`)
   - 타입 필터 (접기/펼치기 가능)
   - 컬럼 검색
   - "선택된 컬럼만 표시" 토글
   - 컬럼 체크박스 리스트 (스크롤 가능)

**주요 기능:**
- 데이터셋 목록 표시 및 선택
- 행 범위 설정 (OFFSET/LIMIT 또는 수동)
- 컬럼 타입 필터 (gas, temperature, pressure, ...)
- 컬럼 검색 (부분 일치)
- 컬럼 선택/해제
- "선택된 컬럼만 표시" 토글

**상태 관리:**
- `typeBarCollapsed`: 타입 필터 접기/펼치기 상태

**연결 관계:**
- Props: `datasets`, `selectedDatasetId`, `rowRange`, `visibleColumns`, `columnMeta`, `showSelectedOnly` 등
- 이벤트: `onDatasetChange`, `onRowRangeChange`, `onColumnToggle`, `onShowSelectedOnlyChange`
- API 호출: `getFieldsByType()` (타입별 필드 조회)

---

#### `frontend/src/components/DataGrid.tsx`

**역할**: AG Grid 데이터 그리드

**주요 기능:**
- 데이터 표시 (AG Grid)
- 행 범위 하이라이트 (`rowClassRules`)
- 컬럼 헤더 클릭 이벤트 (`onColumnHeaderClicked`)
- 셀 마우스 다운/오버 이벤트 (`onCellMouseDown`, `onCellMouseOver`)
- 로딩 상태 표시

**AG Grid 설정:**
- 테마: `ag-theme-alpine`
- 기본 컬럼 설정: `flex: 1`, `minWidth: 120`
- 행 스타일: 선택된 범위 하이라이트

**연결 관계:**
- Props: `columnDefs`, `rowData`, `rowRange`, `onColumnHeaderClicked`, `onCellMouseDown`, `onCellMouseOver`
- 이벤트: 컬럼 헤더 클릭, 셀 드래그 (행 범위 선택)

---

#### `frontend/src/components/StatsPanel.tsx`

**역할**: 통계 패널

**주요 섹션:**

1. **컬럼 상세** (`sp-section`)
   - 선택된 컬럼의 메타데이터 표시
   - 타입, 카테고리, 단위, 중요도 등

2. **통계 결과** (`sp-section`)
   - 선택된 컬럼의 통계 표시
   - COUNT, AVG, MIN, MAX, STDDEV
   - 전체 컬럼 통계 요약

**주요 기능:**
- 선택된 컬럼 정보 표시
- 통계 결과 표시 (평균, 최소, 최대, 표준편차 등)
- 컬럼 메타데이터 표시 (타입, 설명, 단위 등)
- 숫자 포맷팅 (`fmtNum`, `fmtFloat`)

**연결 관계:**
- Props: `activeColumn`, `stats`, `columnMeta`
- 데이터 소스: `useAldController.ts`의 `stats`, `columnMeta`

---

#### `frontend/src/components/Header.tsx`

**역할**: 헤더 컴포넌트

**주요 기능:**
- 앱 제목 표시
- 네비게이션 (필요 시)

**연결 관계:**
- 독립적 컴포넌트 (상태 없음)

---

#### `frontend/src/components/ToastBanner.tsx`

**역할**: Toast 메시지 배너

**주요 기능:**
- 에러/정보 메시지 표시
- 자동 닫기 또는 수동 닫기

**연결 관계:**
- Props: `message`, `type`, `onClose`
- 호출: `App.tsx`

---

### 📜 Scripts

#### `build_all_profiles.py`

**역할**: 모든 데이터셋의 프로파일 일괄 빌드

**주요 기능:**
- 모든 데이터셋 ID 가져오기
- 각 데이터셋에 대해 프로파일 빌드 API 호출
- 진행 상황 표시
- 기존 프로파일 스킵

**사용 방법:**
```bash
python3 build_all_profiles.py
nohup python3 build_all_profiles.py > build.log 2>&1 &
```

**연결 관계:**
- API 호출: `POST /api/admin/profile/{id}/build`

---

#### `build_all_docs.py`

**역할**: 모든 데이터셋의 문서 일괄 빌드

**주요 기능:**
- 모든 데이터셋 ID 가져오기
- 각 데이터셋에 대해 문서 빌드 API 호출
- 진행 상황 표시
- 기존 문서 스킵

**사용 방법:**
```bash
python3 build_all_docs.py
nohup python3 build_all_docs.py > build_docs.log 2>&1 &
```

**연결 관계:**
- API 호출: `POST /api/admin/doc/{id}/build`

---

#### `watch_csv.sh`

**역할**: CSV 파일 변경 감지 및 자동 빌드

**주요 기능:**
- `inotifywait`로 CSV 파일 변경 감지
- 변경 시 registry refresh 실행
- 변경된 파일의 프로파일 빌드

**사용 방법:**
```bash
./watch_csv.sh
```

**연결 관계:**
- API 호출: `POST /api/admin/refresh`, `POST /api/admin/profile/{id}/build`

---

## 전체 데이터 흐름 요약

### 초기화 흐름

```
1. 서버 시작 (main.py)
   ↓
2. startup_event() 실행
   ↓
3. metadata_pipeline.refresh_registry_if_needed()
   ↓
4. CSV 파일 스캔 (필요시)
   ↓
5. metadata/datasets.json 생성
   ↓
6. API 서버 준비 완료
```

### 사용자 작업 흐름

```
1. Frontend: 데이터셋 선택
   ↓
2. API: GET /api/datasets/{id}
   ↓
3. 데이터셋 메타데이터 반환
   ↓
4. Frontend: 미리보기 요청
   ↓
5. API: GET /api/datasets/{id}/preview
   ↓
6. DuckDB: 데이터 추출
   ↓
7. Frontend: 데이터 표시
   ↓
8. 사용자: 행 범위 선택
   ↓
9. API: POST /api/datasets/{id}/stats
   ↓
10. DuckDB: 통계 계산
   ↓
11. Frontend: 통계 표시
```

### 프로파일/문서 생성 흐름

```
1. API: POST /api/admin/profile/{id}/build
   ↓
2. profile_v1.build_profile_v1()
   ↓
3. DuckDB: 샘플 데이터 분석
   ↓
4. metadata/profiles/{id}.json 저장
   ↓
5. API: POST /api/admin/doc/{id}/build
   ↓
6. doc_v1.build_doc_v1()
   ↓
7. profile + column_meta 결합
   ↓
8. metadata/docs/{id}.md 저장
```

---

## 주요 설계 원칙

1. **단일 책임 원칙**: 각 모듈은 명확한 역할을 가짐
2. **파이프라인 분리**: Scan → Registry → Column Meta → Profile → Doc
3. **캐싱 최적화**: DuckDB View 캐싱으로 성능 향상
4. **타입 안정성**: Pydantic 모델로 API 계약 명확화
5. **자동화**: 서버 시작 시 자동 메타데이터 생성
6. **확장성**: 컬럼 메타데이터 시스템으로 확장 가능

---

## 파일 의존성 그래프

```
main.py
├── api/
│   ├── datasets.py
│   │   ├── registry.py
│   │   ├── column_meta.py
│   │   └── duckdb_engine.py
│   ├── stats.py
│   │   ├── registry.py
│   │   └── duckdb_engine.py
│   └── admin.py
│       ├── metadata_pipeline.py
│       ├── profile_v1.py
│       │   ├── registry.py
│       │   └── duckdb_cache.py
│       └── doc_v1.py
│           ├── registry.py
│           ├── column_meta.py
│           └── profile_v1.py (로드)
├── core/
│   ├── metadata_pipeline.py
│   │   └── auto_scan.py
│   └── settings.py (모든 모듈에서 사용)
└── engine/
    ├── duckdb_engine.py
    └── duckdb_cache.py
```

---

---

## 4단계 파이프라인

프로젝트는 명확히 분리된 4단계 파이프라인으로 구성됩니다:

### [1] Scan 단계

**파일**: `tools/scan_and_export.py`

**책임:**
- CSV 파일을 관찰하여 '파일 단위 사실 정보'만 생성
- dataset_id, filename, path, size_bytes, mtime, columns 추출

**생성물:**
- `metadata/datasets.json` (Registry)
- `metadata/columns_*.json` (보조 산출물)

**호출:**
- `metadata_pipeline.py` → 서브프로세스로 실행
- 직접 실행: `python3 tools/scan_and_export.py`

**원칙:**
- ❌ 컬럼 의미 해석 안 함
- ❌ 통계 계산 안 함
- ❌ semantic_type 추정 안 함

---

### [2] Registry 단계

**파일**: `backend/app/core/registry.py`, `backend/app/core/metadata_pipeline.py`

**책임:**
- `metadata/datasets.json` 로드 및 조회
- 데이터셋 메타데이터 제공

**데이터 구조:**
- `DatasetMeta` dataclass
- `metadata/datasets.json` JSON 배열

**호출:**
- 모든 API 엔드포인트에서 데이터셋 정보 조회
- `registry.load_registry()`: 전체 목록
- `registry.get_dataset(id)`: 특정 데이터셋

---

### [3] Column Meta 단계

**파일**: `backend/app/core/column_meta.py`

**책임:**
- 컬럼의 의미, 타입, 설명 제공
- Global + Patterns + Dataset Override 병합

**데이터 소스:**
- `column_meta/global_columns.yaml`: 전역 메타데이터
- `column_meta/patterns.yaml`: 정규식 패턴 규칙
- `column_meta/datasets/{id}.yaml`: 데이터셋별 오버라이드

**호출:**
- `datasets.py` (`get_dataset_columns`, `get_fields_by_type`)
- `doc_v1.py` (문서 생성)

**우선순위:**
1. Dataset Override
2. Global Meta
3. Patterns (자동 생성)

---

### [4] Profile/Doc 단계

**Profile 파일**: `backend/app/core/profile_v1.py`

**책임:**
- 데이터셋의 관찰 기반 통계 정보 생성
- 샘플링 기반 분석 (빠른 처리)

**생성물:**
- `metadata/profiles/{dataset_id}.json`

**호출:**
- `admin.py` (`/api/admin/profile/{id}/build`)
- `build_all_profiles.py` (일괄 빌드)

**Doc 파일**: `backend/app/core/doc_v1.py`

**책임:**
- Profile + Column Meta를 결합하여 사람이 읽을 수 있는 문서 생성

**생성물:**
- `metadata/docs/{dataset_id}.md`

**호출:**
- `admin.py` (`/api/admin/doc/{id}/build`)
- `build_all_docs.py` (일괄 빌드)

**원칙:**
- Column Groups (의미): column_meta 사용
- Column Profiles (관찰): profile 사용
- 두 섹션을 명확히 분리

---

## 실행 흐름 상세

### 서버 시작 시 자동 실행

```
1. main.py 시작
   ↓
2. FastAPI 앱 생성
   ↓
3. startup_event() 실행
   ↓
4. metadata_pipeline.refresh_registry_if_needed(force=False)
   ↓
5. auto_scan.should_regenerate_metadata() 확인
   ├─ metadata/datasets.json 없음? → True
   ├─ CSV 파일 변경됨? → True
   ├─ 파일 추가/삭제됨? → True
   └─ 그 외 → False
   ↓
6. True면 tools/scan_and_export.py 실행
   ├─ data/*.csv 스캔
   ├─ 각 파일의 메타데이터 추출
   └─ metadata/datasets.json 생성
   ↓
7. API 서버 준비 완료
```

### 사용자가 데이터셋 선택

```
Frontend: Sidebar.tsx
   ↓ 사용자가 데이터셋 클릭
   ↓
onDatasetChange(datasetId) 호출
   ↓
App.tsx: setShowSelectedOnly(false) + c.handleDatasetChange(id)
   ↓
useAldController.ts: handleDatasetChange()
   ├─ setSelectedDatasetId(datasetId)
   ├─ setOffset(0), setLimit(500)
   └─ fetchPreview() 호출
   ↓
api.ts: getPreview(datasetId, offset=0, limit=500)
   ↓
Backend: GET /api/datasets/{id}/preview?offset=0&limit=500
   ↓
datasets.py: preview()
   ├─ registry.get_dataset(id) → DatasetMeta
   └─ duckdb_engine.preview_rows()
      ├─ duckdb_cache.get_view_query() → View 쿼리
      ├─ DuckDB: SELECT ... FROM view LIMIT 500 OFFSET 0
      └─ 결과: rows, columns
   ↓
Frontend: PreviewResponse 수신
   ↓
useAldController.ts: setRowData(rows), setColumnDefs(...)
   ↓
DataGrid.tsx: AG Grid에 데이터 표시
```

### 사용자가 행 범위 선택 (드래그)

```
Frontend: DataGrid.tsx
   ↓ 사용자가 셀 드래그
   ↓
onCellMouseDown() → 시작 행 저장
onCellMouseOver() → 현재 행 추적
onCellMouseUp() → 끝 행 저장
   ↓
useAldController.ts: handleRowRangeChange(start, end)
   ├─ setRowRange({ start, end })
   └─ fetchStats() 호출 (자동 모드)
   ↓
api.ts: getStats(datasetId, columns, rowStart, rowEnd)
   ↓
Backend: POST /api/datasets/{id}/stats
   Body: { columns: [...], row_range: { start, end } }
   ↓
stats.py: stats()
   ├─ registry.get_dataset(id)
   └─ duckdb_engine.compute_metrics()
      ├─ DuckDB View 캐싱 사용
      └─ DuckDB: COUNT, AVG, MIN, MAX, STDDEV 쿼리
   ↓
Frontend: StatsResponse 수신
   ↓
useAldController.ts: setStats(response)
   ↓
StatsPanel.tsx: 통계 결과 표시
```

### 프로파일 생성 (API 호출)

```
API: POST /api/admin/profile/ds_xxx/build?sample_rows=5000&top_k=5
   ↓
admin.py: build_profile()
   ├─ registry.get_dataset(id) → DatasetMeta
   └─ profile_v1.build_profile_v1()
      ├─ 프로파일 파일 존재 확인 (mtime 비교)
      ├─ DuckDB View 생성/재사용
      ├─ 샘플링 서브쿼리 생성 (USING SAMPLE 또는 LIMIT)
      ├─ 모든 컬럼 통계 계산 (1쿼리)
      │  └─ null_count, non_null_count, numeric_like, 
      │     datetime_like, bool_like, approx_distinct
      ├─ 각 컬럼별 top-k values 추출
      ├─ semantic_type 추론
      └─ metadata/profiles/{id}.json 저장
   ↓
응답: { dataset_id, profile_path, generated_at, ... }
```

### 문서 생성 (API 호출)

```
API: POST /api/admin/doc/ds_xxx/build
   ↓
admin.py: build_doc()
   └─ doc_v1.build_doc_v1()
      ├─ registry.get_dataset(id) → DatasetMeta
      ├─ profile_v1._load_profile(id) → 프로파일 JSON 로드
      ├─ column_meta.build_meta_map(id, columns) → 메타데이터 로드
      ├─ Markdown 생성
      │  ├─ Dataset Summary
      │  ├─ Column Groups (의미 기준) ← column_meta
      │  └─ Column Profiles (관찰 기준) ← profile
      └─ metadata/docs/{id}.md 저장
   ↓
응답: { dataset_id, doc_path }
```

---

## 주요 설계 원칙

1. **단일 책임 원칙**: 각 모듈은 명확한 역할을 가짐
2. **파이프라인 분리**: Scan → Registry → Column Meta → Profile → Doc
3. **캐싱 최적화**: DuckDB View 캐싱으로 성능 향상
4. **타입 안정성**: Pydantic 모델로 API 계약 명확화
5. **자동화**: 서버 시작 시 자동 메타데이터 생성
6. **확장성**: 컬럼 메타데이터 시스템으로 확장 가능
7. **의미와 관찰 분리**: Column Meta (의미)와 Profile (관찰) 명확히 구분

---

## 파일 의존성 그래프

```
main.py
├── api/
│   ├── datasets.py
│   │   ├── registry.py
│   │   ├── column_meta.py
│   │   └── duckdb_engine.py
│   │       └── duckdb_cache.py
│   ├── stats.py
│   │   ├── registry.py
│   │   └── duckdb_engine.py
│   │       └── duckdb_cache.py
│   └── admin.py
│       ├── metadata_pipeline.py
│       │   └── auto_scan.py
│       ├── profile_v1.py
│       │   ├── registry.py
│       │   └── duckdb_cache.py
│       └── doc_v1.py
│           ├── registry.py
│           ├── column_meta.py
│           └── profile_v1.py (로드)
├── core/
│   ├── metadata_pipeline.py
│   │   └── auto_scan.py
│   └── settings.py (모든 모듈에서 사용)
└── engine/
    ├── duckdb_engine.py
    └── duckdb_cache.py

tools/
└── scan_and_export.py (독립 실행)

frontend/src/
├── App.tsx
│   └── useAldController.ts
│       └── api.ts
└── components/
    ├── Sidebar.tsx
    ├── DataGrid.tsx
    └── StatsPanel.tsx
```

---

## 데이터 저장 위치

```
metadata/
├── datasets.json          # Registry (scan_and_export.py 생성)
├── profiles/              # 프로파일 (profile_v1.py 생성)
│   └── {dataset_id}.json
└── docs/                  # 문서 (doc_v1.py 생성)
    └── {dataset_id}.md

column_meta/
├── global_columns.yaml    # 전역 컬럼 메타데이터
├── patterns.yaml          # 패턴 규칙
└── datasets/              # 데이터셋별 오버라이드
    └── {dataset_id}.yaml
```

---

이 문서는 프로젝트의 모든 파일과 그들의 관계를 설명합니다. 각 파일의 역할, 함수, 호출 관계, 데이터 흐름을 이해하는 데 도움이 됩니다.
