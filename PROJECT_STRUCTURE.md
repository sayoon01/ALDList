# ALDList 프로젝트 구조 & 주요 기능 가이드

이 문서는 ALDList를 **한 번에 파악**하기 위한 문서입니다.

- 어떤 폴더가 실행 코드인지
- 어떤 파일이 자동 생성 산출물인지
- 사용자 관점에서 어떤 기능이 제공되는지
- CSV 추가/변경 시 어떤 순서로 동작하는지

---

## 1) 프로젝트 한눈에 보기

ALDList는 CSV 데이터를 빠르게 탐색/필터링/통계 분석하기 위한 웹 애플리케이션입니다.

- **백엔드**: FastAPI + DuckDB 기반 조회/통계 API
- **프론트엔드**: React + AG Grid 기반 탐색 UI
- **메타데이터 파이프라인**: CSV 스캔 → 컬럼 메타 생성/보강 → 문서/인덱스 생성(선택)

핵심은 `data/`에 CSV를 넣고, 백엔드 실행 시 레지스트리를 자동 갱신해 즉시 조회 가능한 상태를 만드는 것입니다.

---

## 2) 디렉토리 구조 (역할 기준)

### A. 실행 코드 (직접 수정 대상)
- `backend/`: API 서버, 엔진, 모델, 테스트
- `frontend/`: 사용자 화면, 상태 훅, API 클라이언트
- `tools/`: 메타데이터 생성/보강 스크립트

### B. 입력 데이터 (원본)
- `data/`: 분석 대상 CSV

### C. 생성 산출물 (재생성 가능)
- `metadata/`: datasets 레지스트리, 프로필 JSON, 문서(MD), 리포트
- `column_meta/`: 전역 컬럼 메타(YAML)
- `rag_docs/`: 검색용 문서
- `rag_index/`: 검색 인덱스(JSONL)

### D. 실행 보조 스크립트
- `start_backend.sh`, `start_frontend.sh`: 개발 서버 실행
- `scan_metadata.sh`: 메타데이터 전체 재생성
- `watch_csv.sh`: CSV 변경 감시 보조

---

## 3) 백엔드 구조

`backend/app` 기준:

- `main.py`: FastAPI 앱 부팅, CORS, 라우터 등록, 시작 시 레지스트리 자동 점검
- `api/`
  - `datasets.py`: 데이터셋 목록/미리보기/컬럼 메타/타입별 컬럼 API
  - `stats.py`: 선택 범위 통계 API
  - `query.py`: 컬럼 메타 기반 키워드 검색 API
  - `admin.py`, `meta.py`: 관리/메타 관련 API
- `core/`
  - `registry.py`: `metadata/datasets.json` 로드/조회
  - `metadata_pipeline.py`: 레지스트리/메타 자동 갱신 흐름
  - `column_meta.py`: 컬럼 메타 머지/정규화
- `engine/`
  - `duckdb_engine.py`: DuckDB 기반 preview/stats 실행
  - `duckdb_cache.py`: 쿼리/접속 캐시
- `models/schemas.py`: API 응답 스키마

---

## 4) 프론트엔드 구조

`frontend/src` 기준:

- `App.tsx`: 화면 레이아웃(헤더/사이드바/그리드/통계패널)
- `hooks/useAldController.ts`: 앱 상태/비즈니스 로직의 중심
  - 데이터셋 로드, preview 페이징
  - 컬럼 표시/활성 컬럼 관리
  - 드래그 범위 선택 + 수동 범위 입력
  - 통계 계산 모드(all/active)
  - 타입 필터링(fields API 우선, 로컬 fallback)
  - 프로필/문서 빌드 및 로딩
- `components/`
  - `Sidebar.tsx`: 데이터셋/컬럼/범위/필터/통계 트리거
  - `DataGrid.tsx`: AG Grid 테이블 표시
  - `StatsPanel.tsx`: 컬럼 정보/통계/프로필/문서 출력
  - `ToastBanner.tsx`, `Header.tsx`: 공통 UI
- `api.ts`: 백엔드 API 호출 래퍼

---

## 5) 주요 기능 (사용자 관점)

1. **데이터셋 목록 조회 + 선택**
   - CSV 파일을 데이터셋 단위로 탐색

2. **대용량 미리보기 (페이징)**
   - offset/limit 기반 구간 조회

3. **컬럼 선택 및 타입 필터링**
   - 필요한 컬럼만 표시
   - `gas`, `temperature` 등 타입별 컬럼 조회

4. **범위 기반 통계 계산**
   - 드래그 선택 또는 수동 행 범위 입력
   - 전체 선택 컬럼 또는 active 컬럼만 계산

5. **컬럼 메타데이터 확인**
   - title/desc/unit/category/type 정보 확인

6. **프로필/문서 생성(관리 기능)**
   - 선택 데이터셋의 profile/doc 생성 및 즉시 로드

7. **컬럼 검색(Query API)**
   - 컬럼명 + 메타 텍스트 기반 간단 점수 검색

---

## 6) 데이터/메타 파이프라인

### 기본(빠른) 경로
1. `start_backend.sh` 실행
2. 서버 startup 시 레지스트리 자동 점검
3. `metadata/datasets.json` 기준으로 즉시 서비스

### 확장(정밀) 경로
1. `scan_metadata.sh` 실행
2. CSV 스캔 + 컬럼 메타 생성/보강
3. 리포트 및 (선택) RAG 문서/인덱스 갱신

즉, 일상 개발은 기본 경로로 빠르게, 데이터 품질 정비 시 확장 경로로 운영합니다.

---

## 7) 수정 시 실전 규칙

1. 기능 코드 수정은 `backend/`, `frontend/`, `tools/` 중심으로 진행
2. `metadata/`, `column_meta/`, `rag_docs/`, `rag_index/`는 생성 산출물로 간주
3. 기능 변경 커밋과 산출물 갱신 커밋은 분리 권장
4. CSV 스키마가 달라졌다면 `scan_metadata.sh` 재실행 후 검증

---

## 8) 추천 온보딩 순서

1. `README.md`로 실행 방법 확인
2. 이 문서(`PROJECT_STRUCTURE.md`)로 책임 경계 파악
3. 백엔드는 `backend/app/main.py → api/ → core/` 순서로 읽기
4. 프론트엔드는 `App.tsx → hooks/useAldController.ts → components/` 순서로 읽기

이 순서대로 보면 “어디를 고쳐야 하는지”를 가장 빨리 판단할 수 있습니다.
