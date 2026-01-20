# ALDList - CSV 데이터 분석 도구

CSV 파일을 쉽게 탐색하고 분석할 수 있는 웹 애플리케이션입니다.

---

## 1. 프로젝트 개요

ALDList는 `data/` 폴더에 CSV 파일을 넣으면 서버가 자동으로 CSV들을 스캔해 데이터셋 메타데이터를 생성하고, 웹 UI에서 **미리보기(부분 로딩), 컬럼 의미(메타) 제공, 행 범위 통계 계산**을 수행하는 CSV 분석 웹 애플리케이션입니다.

- 대용량 CSV도 전량 로딩 없이 빠르게 탐색(OFFSET/LIMIT)
- 컬럼명만으로는 해석이 어려운 장비 로그를 메타 시스템으로 "설명 가능한 데이터"로 제공
- 로컬/배포 환경 차이(절대경로 문제 등)에 강한 구조
- Render(백엔드) + Vercel(프론트) 배포까지 바로 가능한 형태

---

## ✨ 특징

- **완전 자동화**: CSV 파일만 `data/` 디렉토리에 넣으면 자동으로 작동
- **실시간 분석**: 대용량 CSV 파일도 빠르게 탐색 및 분석
- **직관적인 UI**: 드래그로 범위 선택, 컬럼 필터링, 통계 계산
- **자동 메타데이터 생성**: 백엔드 시작 시 자동으로 메타데이터 생성

## 📁 프로젝트 구조

```
aldList/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── admin.py          # 관리 API (refresh, profile/doc 빌드)
│   │   │   ├── datasets.py        # 데이터셋 목록/상세 API
│   │   │   └── stats.py           # 통계 계산 API
│   │   ├── core/
│   │   │   ├── auto_scan.py       # 자동 스캔 판단 로직
│   │   │   ├── column_meta.py     # 컬럼 메타데이터 빌드
│   │   │   ├── doc_v1.py          # 문서 생성 (Markdown)
│   │   │   ├── metadata_pipeline.py  # 메타데이터 파이프라인 (refresh)
│   │   │   ├── profile_v1.py      # 프로파일 생성 (JSON)
│   │   │   ├── registry.py        # 데이터셋 레지스트리 관리 (메모리 캐시)
│   │   │   └── settings.py        # 설정 및 경로 관리
│   │   ├── engine/
│   │   │   ├── duckdb_cache.py    # DuckDB 캐시 관리 (단일 connection + fingerprint)
│   │   │   └── duckdb_engine.py   # DuckDB 엔진 래퍼
│   │   └── models/
│   │       └── schemas.py         # Pydantic 스키마 정의
│   ├── tests/
│   │   ├── conftest.py            # pytest 설정
│   │   └── test_api_system.py     # 시스템 테스트
│   ├── requirements.txt
│   ├── pytest.ini                 # pytest 설정 파일
│   ├── run_tests.sh               # 테스트 실행 스크립트
│   ├── start.sh                   # 백엔드 시작 스크립트
│   └── Procfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # 메인 앱 컴포넌트
│   │   ├── api.ts                 # API 클라이언트
│   │   ├── components/
│   │   │   ├── DataGrid.tsx       # 데이터 그리드 컴포넌트
│   │   │   ├── Header.tsx         # 헤더 컴포넌트
│   │   │   ├── Sidebar.tsx        # 사이드바 (데이터셋 목록)
│   │   │   ├── StatsPanel.tsx     # 통계 패널 (컬럼 상세)
│   │   │   └── ToastBanner.tsx    # 토스트 알림
│   │   └── hooks/
│   │       └── useAldController.ts # 중앙 상태 관리 훅
│   └── start.sh                   # 프론트엔드 시작 스크립트
├── tools/
│   ├── scan_and_export.py         # CSV 스캔 및 레지스트리 생성
│   ├── generate_meta.py      # 메타데이터 생성 통합 (patterns/inference/frequency)
│   └── export_rag.py         # RAG 출력 통합 (markdown/jsonl)
├── data/                          # CSV 파일들 (배포 시 Git 포함)
├── metadata/
│   ├── datasets.json              # 데이터셋 레지스트리
│   ├── columns_union.json         # 컬럼 통합 정보
│   ├── profiles/                  # 프로파일 JSON 파일들
│   └── docs/                      # 문서 Markdown 파일들
├── column_meta/
│   ├── global_columns.yaml        # 전역 컬럼 메타데이터
│   ├── global_columns.generated.yaml
│   ├── global_columns.legacy.yaml
│   ├── patterns.yaml              # 패턴 정의
│   └── datasets/                  # 데이터셋별 메타데이터
├── rag_docs/                      # RAG 문서 (컬럼/그룹 설명)
├── rag_index/                     # RAG 인덱스 파일
├── watch_csv.sh                   # CSV 변경 감지 및 자동 빌드 스크립트
├── scan_metadata.sh               # 메타데이터 스캔 스크립트
├── build_all_profiles.py          # 전체 프로파일 빌드 스크립트
├── build_all_docs.py              # 전체 문서 빌드 스크립트
├── start_backend.sh               # 백엔드 시작 스크립트 (프로젝트 루트)
├── start_frontend.sh              # 프론트엔드 시작 스크립트 (프로젝트 루트)
├── ARCHITECTURE.md                # 아키텍처 문서
├── PROJECT_DOCUMENTATION.md       # 프로젝트 문서
├── COLUMN_META_WORKFLOW.md        # 컬럼 메타데이터 워크플로우
├── METADATA_STRATEGIES.md         # 메타데이터 전략 문서
└── VERCEL_DEPLOY.md               # Vercel 배포 가이드
```

## 🚀 빠른 시작

### 1. CSV 파일 준비

```bash
# CSV 파일을 data/ 디렉토리에 복사
cp your_file.csv data/
```

**그게 전부입니다!** 백엔드가 시작될 때 자동으로 메타데이터를 생성합니다.

### 2. 백엔드 실행

**방법 1: 스크립트 사용 (권장)**

```bash
# 프로젝트 루트에서
./start_backend.sh
```

**방법 2: 수동 실행**

```bash
# backend 디렉토리로 이동
cd backend

# 가상환경 활성화 (있는 경우)
source venv/bin/activate

# 서버 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**⚠️ 주의사항:**
- `uvicorn app.main:app` 명령은 반드시 `backend` 디렉토리에서 실행해야 합니다
- 프로젝트 루트에서 실행하면 `ModuleNotFoundError: No module named 'app'` 에러 발생
- `PYTHONPATH`를 설정하거나 `backend` 디렉토리로 이동 후 실행

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

## 🔨 개발 및 빌드

### 프론트엔드 빌드

#### 로컬 개발 환경
로컬에서는 코드를 변경한 후 수동으로 빌드해야 합니다:

```bash
cd frontend
npm run build
```

이 명령을 실행하면 `frontend/dist/` 폴더가 업데이트됩니다.

#### Vercel 배포 환경
Vercel에서는 자동으로 처리됩니다:

1. 코드 변경 후 GitHub에 푸시
2. Vercel이 자동으로 감지
3. 자동으로 다음 명령 실행:
   - `npm install` (의존성 설치)
   - `npm run build` (빌드 실행 → `dist` 폴더 새로 생성)
   - `dist` 폴더의 내용을 배포

**요약:**
- **로컬**: 수동으로 `npm run build` 실행 필요
- **Vercel**: GitHub 푸시 시 자동으로 빌드 및 배포

따라서 Vercel에서는 코드를 푸시하면 `dist`가 자동으로 새로 생성되어 배포됩니다. 로컬의 `dist` 폴더는 무시해도 됩니다. Vercel이 매번 새로 빌드합니다.

## 📖 사용 방법

1. **데이터셋 선택**: 왼쪽 사이드바에서 분석할 CSV 파일 선택
2. **컬럼 선택**: 원하는 컬럼만 체크하여 표시
   - 왼쪽 리스트에서 컬럼을 클릭하면 오른쪽에 상세 정보가 표시됩니다
   - 컬럼 헤더에 마우스를 올리면 메타데이터 설명이 툴팁으로 표시됩니다
3. **데이터 탐색**: 중앙 그리드에서 데이터 스크롤 및 필터링
   - 왼쪽에서 컬럼을 선택하면 그리드가 해당 컬럼으로 자동 스크롤됩니다
4. **범위 선택**: 그리드에서 마우스로 드래그하여 행 범위 선택
5. **통계 계산**: "통계 계산" 버튼 클릭하여 선택한 범위의 통계 확인
6. **데이터 양 조정**: 왼쪽 사이드바의 "개수" 입력에서 표시할 행 수 조정 (기본 500행)

## 🔧 주요 기능

- ✅ **자동 메타데이터 생성**: CSV 파일만 넣으면 자동 처리
- ✅ **빠른 초기 로딩**: 병렬 로딩 및 최적화된 데이터 페이징으로 빠른 초기 로딩
- ✅ **실시간 미리보기**: 최대 10,000행까지 빠른 미리보기
- ✅ **컬럼 선택**: 207개 컬럼 중 원하는 것만 선택하여 표시
- ✅ **컬럼 상세 정보**: 선택한 컬럼의 메타데이터(설명, 단위, 유형 등)를 오른쪽 패널에서 확인
- ✅ **통계 계산**: 선택한 범위의 컬럼별 통계 (평균, 최소/최대값, 표준편차)
- ✅ **필터링 및 정렬**: AG Grid의 강력한 필터링 및 정렬 기능
- ✅ **드래그 범위 선택**: 직관적인 행 범위 선택
- ✅ **자동 컬럼 메타데이터**: 패턴 기반 자동 메타데이터 생성 및 커스텀 오버라이드 지원

## 📡 API 엔드포인트

- `GET /api/datasets` - 데이터셋 목록 조회
- `GET /api/datasets/{dataset_id}` - 데이터셋 메타데이터 조회
- `GET /api/datasets/{dataset_id}/preview` - 데이터 미리보기
- `GET /api/datasets/{dataset_id}/columns` - 컬럼 메타데이터 조회 (전체 컬럼)
- `GET /api/datasets/{dataset_id}/fields?type={type}` - 타입별 컬럼 필터링
- `POST /api/datasets/{dataset_id}/stats` - 통계 계산

자세한 API 문서: http://localhost:8000/docs

## 🛠 기술 스택

- **Backend**: FastAPI, DuckDB, Python
- **Frontend**: React, TypeScript, AG Grid, Vite
- **Data**: CSV 파일, JSON 메타데이터

---

## 2. 기술 스택 및 의존성

### Backend (Python)

`backend/requirements.txt`

- `fastapi==0.104.1` : REST API 서버
- `uvicorn[standard]==0.24.0` : ASGI 서버 실행
- `duckdb>=1.4.0` : CSV SQL 조회/집계 엔진(임베디드)
- `pandas>=2.0.0` : (확장/데이터 처리용, 현재 코드에선 제한적으로 사용 가능)
- `python-multipart==0.0.6` : (폼/업로드 확장 시 사용)
- `pyyaml>=6.0` : column_meta YAML 로딩

### Frontend

- React + TypeScript
- AG Grid(테이블/필터/정렬/툴팁)
- Vite(빌드/환경변수)

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
- 대용량 파일의 경우 미리보기 제한(기본 500행)을 왼쪽 사이드바에서 조정할 수 있습니다
- 컬럼이 많을 경우 왼쪽 사이드바에서 원하는 컬럼만 선택하여 표시하세요
- 왼쪽 컬럼 리스트에서 컬럼을 클릭하면 오른쪽에 상세 정보가 표시되고, 그리드가 해당 컬럼으로 자동 스크롤됩니다
- 컬럼 헤더에 마우스를 올리면 메타데이터 설명을 확인할 수 있습니다

## ⚡ 성능 최적화

- **병렬 로딩**: 메타데이터와 미리보기 데이터를 동시에 로드하여 초기 로딩 시간 단축
- **최적화된 초기 로딩**: 기본 500행만 로드하여 빠른 초기 화면 표시
- **필요 시 확장**: 더 많은 데이터가 필요하면 왼쪽 사이드바에서 "개수"를 조정하여 추가 로드 가능

## 🔄 워크플로우

### 초기 방식 (하드코딩 기반)

**초기 워크플로우 (수동 메타데이터 관리):**

```
1. CSV 파일을 data/ 디렉토리에 넣기
   ↓
2. 백엔드 실행
   → tools/scan_and_export.py 자동 실행
   → metadata/datasets.json 생성 (데이터셋 목록)
   → metadata/columns_union.json 생성 (전체 컬럼 목록)
   ↓
3. 메타데이터 수동 작성
   → column_meta/global_columns.yaml에 주요 컬럼 10~30개만 수동 작성
   → 나머지 컬럼은 patterns.yaml 패턴 매칭으로 자동 생성
   → auto_generated: true로 표시 (프론트에 경고 메시지)
   ↓
4. 프론트엔드 실행
   → GET /api/datasets로 데이터셋 목록 로드
   → GET /api/datasets/{id}/columns로 컬럼 메타데이터 로드
   → build_meta_map()이 global_columns.yaml + patterns.yaml 병합
   → 프론트엔드에서 메타데이터 표시 (일부는 경고 표시)
   ↓
5. 브라우저에서 http://localhost:5173 접속
   → 데이터 분석 시작
   → 대부분의 컬럼에 "⚠️ 자동 생성 메타데이터" 경고 표시
```

**초기 방식의 특징:**
- ✅ 빠른 시작: 주요 컬럼만 정의하면 바로 사용 가능
- ❌ 불완전한 메타데이터: 207개 중 10~30개만 정의
- ❌ RAG 시스템 부재: LLM이 모든 컬럼을 이해하기 어려움
- ❌ 사용자 경험: 대부분의 컬럼에 경고 메시지 표시

---

### 현재 방식 (자동 생성 + RAG 시스템)

**현재 워크플로우 (완전 자동화 + RAG 지원):**

#### Phase 1: 데이터 준비 및 스캔

```
1. CSV 파일을 data/ 디렉토리에 넣기
   ↓
2. 백엔드 실행 (또는 수동 실행)
   → tools/scan_and_export.py 실행
   → metadata/datasets.json 생성
   → metadata/columns_union.json 생성 (207개 컬럼 목록)
```

#### Phase 2: 메타데이터 자동 생성

```
3. 메타데이터 생성 (최초 1회 또는 컬럼 추가 시)

**방법 선택:**

```
3-1. patterns.yaml 기반 생성 (권장)
   → python3 tools/generate_meta.py --method patterns
   → metadata/columns_union.json 읽기
   → global_columns.yaml에 없는 컬럼만 필터링
   → patterns.yaml 기반으로 기본 메타데이터 생성
   → enrich_desc_rule_based()로 desc 보강
   → column_meta/global_columns.generated.yaml 생성

3-2. 컬럼명 패턴 추론 기반 생성
   → python3 tools/generate_meta.py --method inference
   → metadata/columns_union.json 읽기
   → 컬럼명 패턴 분석 (MFC*, Temp*, Press* 등)
   → column_meta/global_columns.generated.yaml 생성

3-3. 빈도 기반 seed 생성
   → python3 tools/generate_meta.py --method frequency
   → columns_by_file.json에서 빈도 계산
   → 빈도 높은 컬럼부터 seed 생성

3-4. 모든 방법 순차 실행
   → python3 tools/generate_meta.py --method all
   → 규칙 기반으로 desc를 더 구체적으로 개선
     - MFC류: MFC 관련 유량/설정/입력 값 설명
     - 온도류: 챔버/히터/센서 온도 관련 설명
     - 압력류: 챔버 압력 관련 설명
     - AUX류: 보조 센서/모니터링 설명
     - 밸브류: 밸브 채널 상태/제어 설명
   → column_meta/global_columns.generated.yaml 생성/업데이트
   → 실행 결과 예시:
     ============================================================
     columns_union: 207
     global_columns: 207
     generated_written: /path/to/global_columns.generated.yaml
     created: 0, updated: 0
     ============================================================
     다음 단계:
     1) column_meta/global_columns.generated.yaml 검수
     2) 확정된 항목만 global_columns.yaml로 옮기기(승격)
     3) 서버는 자동으로 반영(hot reload)
     ============================================================
```

**생성되는 메타데이터 예시:**
```yaml
MFCMon_DCS:
  title: MFCMon_DCS
  type: gas
  category: process
  unit: SLM
  desc: "MFCMon_DCS은 반도체 장비에서 사용되는 가스 유량 관련 필드입니다..."
```

#### Phase 3: RAG 문서 생성

```
4. RAG 문서 생성 (최초 1회 또는 메타데이터 업데이트 시)
   → python3 tools/export_column_meta_to_rag.py 실행
   → column_meta/global_columns.yaml 읽기
   ↓
   a) 컬럼별 문서 생성
      → rag_docs/columns/*.md (207개)
      → 각 컬럼마다 RAG 검색 최적화 문장 포함
      → 예: "이 컬럼은 반도체 공정에서 사용되는 가스와 관련된 필드이다."
   ↓
   b) 타입별 그룹 문서 생성
      → rag_docs/groups/*.md (10개)
      → gas.md, temperature.md, pressure.md 등
      → "가스 관련 필드 보여줘" 같은 범주 질의에 강함
```

**RAG 문서 예시 (rag_docs/columns/MFCMon_DCS.md):**
```markdown
# MFCMon_DCS

이 문서는 CSV 헤더(컬럼)의 의미를 설명하는 데이터 사전이다.
이 컬럼은 반도체 장비 로그 CSV에 포함된 필드이다.
이 컬럼은 반도체 공정에서 사용되는 가스와 관련된 필드이다.
MFC(질량유량제어기) 계열의 유량/설정/입력 값일 가능성이 높다.

## 설명
MFCMon_DCS은 반도체 장비에서 사용되는 가스 유량 관련 필드입니다...

## 메타데이터
- type: gas (가스)
- category: process
- unit: SLM
```

#### Phase 4: RAG 인덱스 생성

```
5. RAG 인덱스 생성 (Vector DB용)
   → python3 tools/export_rag.py --format jsonl 실행
   → column_meta/global_columns.yaml 읽기
   → rag_index/column_meta.jsonl 생성 (207개 문서)
   → 각 줄은 JSON 객체 하나 (JSONL 형식)
   → Vector DB 인덱싱에 최적화
```

**JSONL 예시:**
```json
{"id": "column:MFCMon_DCS", "column": "MFCMon_DCS", "type": "gas", "text": "이 컬럼은 반도체 장비 로그 CSV에 포함된 필드이다. ..."}
```

#### Phase 5: 백엔드 실행 및 API 서비스

```
6. 백엔드 실행
   → FastAPI startup 이벤트
   → ensure_metadata() 실행 (metadata/datasets.json 확인)
   → core/column_meta.py가 global_columns.yaml 로드
   → build_meta_map() 함수 준비
   → API 서비스 시작 (http://localhost:8000)
```

#### Phase 6: 프론트엔드 실행 및 데이터 로드

```
7. 프론트엔드 실행
   → React 앱 시작 (http://localhost:5173)
   ↓
8. 데이터셋 목록 로드
   → GET /api/datasets
   → datasets.json 기반으로 목록 표시
   ↓
9. 데이터셋 선택 시 병렬 로드
   → GET /api/datasets/{id}/columns (컬럼 메타데이터)
   → GET /api/datasets/{id}/preview?offset=0&limit=500 (데이터 미리보기)
   → build_meta_map()이 global_columns.yaml + patterns.yaml 병합
   → 모든 컬럼에 메타데이터 반환 (auto_generated: false)
   ↓
10. 프론트엔드 렌더링
    → AG Grid에 컬럼 표시
    → 툴팁: 컬럼 헤더 hover 시 desc 표시
    → 상세 패널: 컬럼 클릭 시 전체 메타데이터 표시
    → 타입 필터: type 기반 컬럼 필터링 버튼
    → 경고 메시지 없음 (모든 컬럼이 공식 메타데이터)
```

#### Phase 7: 사용자 인터랙션

```
11. 사용자 작업
    → 컬럼 선택/해제
    → 타입 필터 클릭 (예: "가스 (40)" 버튼)
      → GET /api/datasets/{id}/fields?type=gas
      → 해당 타입 컬럼만 자동 선택
    → 행 범위 드래그 선택
    → 통계 계산 버튼 클릭
      → POST /api/datasets/{id}/stats
      → 선택한 범위의 통계 반환
```

#### Phase 8: RAG 시스템 활용 (향후 확장)

```
12. 자연어 질의 (LLM 연동 시)
    → 사용자: "가스 관련 필드 보여줘"
    → LLM이 rag_docs/groups/gas.md 또는 rag_index/column_meta.jsonl 검색
    → Vector DB에서 의미 기반 검색
    → GET /api/datasets/{id}/fields?type=gas 호출
    → 프론트엔드에 가스 관련 컬럼만 표시
```

**현재 방식의 특징:**
- ✅ 완전 자동화: 207개 컬럼 전체 자동 생성
- ✅ 완전한 메타데이터: 모든 컬럼에 기본 메타데이터 보유
- ✅ RAG 시스템 완비: LLM이 모든 컬럼을 이해 가능
- ✅ 사용자 경험: 경고 없이 안정적으로 표시
- ✅ 확장성: 자연어 질의 지원 준비 완료

---

### 워크플로우 비교 요약

| 단계 | 초기 방식 | 현재 방식 |
|------|----------|----------|
| **메타데이터 생성** | 수동 작성 (10~30개) | 자동 생성 (207개 전체) |
| **생성 도구** | 직접 YAML 편집 | `generate_meta.py` |
| **RAG 문서** | 없음 | `rag_docs/columns/*.md` (207개) |
| **RAG 그룹 문서** | 없음 | `rag_docs/groups/*.md` (10개) |
| **RAG 인덱스** | 없음 | `rag_index/column_meta.jsonl` |
| **프론트 표시** | 대부분 경고 표시 | 경고 없음 |
| **LLM 지원** | 불가능 | 완전 지원 |
| **자연어 질의** | 불가능 | 준비 완료 |

---

### 실행 순서 요약

**최초 설정 (1회):**
```bash
# 1. CSV 파일 준비
cp your_file.csv data/

# 2. 메타데이터 스캔
python3 tools/scan_and_export.py

# 3. 메타데이터 생성 (방법 선택)
python3 tools/generate_meta.py --method patterns    # patterns.yaml 기반 (권장)
# 또는
python3 tools/generate_meta.py --method inference   # 컬럼명 패턴 추론
# 또는
python3 tools/generate_meta.py --method frequency   # 빈도 기반 seed
# 또는
python3 tools/generate_meta.py --method all          # 모든 방법 순차 실행
# → 생성된 global_columns.generated.yaml 검수 후
# → 확정된 항목만 global_columns.yaml로 승격

# 4. RAG 문서 생성
python3 tools/export_rag.py --format markdown

# 5. RAG 인덱스 생성
python3 tools/export_rag.py --format jsonl
# 또는 둘 다 생성
python3 tools/export_rag.py --format all
```

**일반 사용:**
```bash
# 백엔드 실행
./start_backend.sh

# 프론트엔드 실행 (새 터미널)
./start_frontend.sh

# 브라우저 접속
# http://localhost:5173
```

**메타데이터 업데이트 시:**
```bash
# 컬럼 추가/변경 후
python3 tools/generate_meta.py --method patterns    # 권장
# 또는
python3 tools/generate_meta.py --method inference
# 또는
python3 tools/generate_meta.py --method frequency

# 생성된 파일 검수 후 승격
# (global_columns.generated.yaml → global_columns.yaml)

python3 tools/export_rag.py --format all
# 백엔드는 hot reload로 자동 반영 (재시작 불필요)
```

---

## 3. 전체 아키텍처

- Backend는 레지스트리/메타/통계 API 제공
- DuckDB는 CSV를 SQL로 읽고 집계 수행
- Frontend는 병렬 로딩으로 "컬럼 메타 + 미리보기"를 동시에 불러와 그리드/툴팁/상세패널 구성

---

## 4. 동작 순서(End-to-End)

### 4.1 서버 시작(Startup)

1. FastAPI startup 이벤트에서 `ensure_metadata()` 실행
2. CSV 변경/추가/삭제/경로 이상 여부 확인
3. 필요하면 `tools/scan_and_export.py` 실행 → `metadata/*.json` 재생성
4. API 서비스 시작

### 4.2 프론트 접속 시

1. `GET /api/datasets`로 목록 로드
2. 첫 데이터셋 자동 선택
3. 선택된 데이터셋에 대해 병렬 호출
   - `GET /api/datasets/{id}/columns`
   - `GET /api/datasets/{id}/preview?offset&limit`

### 4.3 통계 계산

1. 그리드에서 행 범위 드래그 선택 또는 수동 입력
2. `POST /api/datasets/{id}/stats`에 columns + row_range 전송
3. stats.metrics를 우측 카드로 표시

---

## 5. 메타데이터 생성(레지스트리) 설계

### 5.1 생성 도구: tools/scan_and_export.py

입력: `data/*.csv`

출력:
- `metadata/datasets.json`
- `metadata/columns_by_file.json`
- `metadata/columns_union.json`
- `metadata/columns_intersection.json`

**dataset_id 생성 규칙**
- `ds_{sha1(filename)[:12]}`
- 경로가 아니라 **파일명 기반** → 환경이 달라도 ID 안정적

**path 저장 규칙**
- DATA_DIR 기준 상대경로 저장(가능하면)
- 그렇지 않으면 filename만 저장(절대경로 회피)

### 5.2 자동 갱신: core/auto_scan.py

- 레지스트리 없으면 생성
- CSV 수정시간이 레지스트리보다 최신이면 재생성
- 파일 추가/삭제 감지 시 재생성
- 레지스트리의 path가 깨져 있거나 DATA_DIR 밖이면 재생성 시도

---

## 6. 레지스트리 경로 안정화(core/registry.py)

레지스트리 로딩 시 `_normalize_path()`가 핵심입니다.

- 레지스트리에 저장된 path가 무엇이든 무시하고
- **항상 `DATA_DIR / filename` 경로로 재구성**
- 배포 환경에서 "로컬 절대경로 때문에 파일 못 찾는 문제"를 구조적으로 방지

---

## 7. 컬럼 메타 시스템(core/column_meta.py + YAML)

### 7.1 메타데이터 생성 방식의 진화

#### 초기: 하드코딩 방식 (global_columns.yaml)

**초기 접근 방식:**
- `global_columns.yaml`에 중요한 컬럼만 수동으로 정의
- 예: `MFCMon_DCS`, `TempAct_U` 등 10~30개 정도의 주요 컬럼만 명시
- 나머지 컬럼들은 패턴 매칭(`patterns.yaml`)으로 자동 생성

**특징:**
- 핵심 컬럼에 대해서만 정확한 메타데이터 제공
- 대부분의 컬럼은 `auto_generated: true`로 표시
- 프론트엔드에서 "⚠️ 자동 생성 메타데이터" 경고 표시

**한계:**
- 207개 전체 컬럼에 대한 메타데이터가 불완전
- RAG 시스템 구축 시 충분한 시드 문서 부족
- LLM이 모든 컬럼의 의미를 이해하기 어려움

#### 현재: 자동 생성 + RAG 시스템

**현재 접근 방식:**
- `tools/generate_meta.py`로 207개 전체 컬럼의 기본 메타데이터 자동 생성
- `global_columns.generated.yaml` → `global_columns.yaml`로 복사하여 공식 메타데이터로 사용
- 모든 컬럼에 `auto_generated: false` (공식 메타데이터로 취급)

**특징:**
- 207개 컬럼 전체에 기본 메타데이터 보유
- 컬럼명 패턴 기반으로 `type`, `category`, `unit`, `desc` 자동 추론
- 프론트엔드에서 경고 없이 안정적으로 표시
- RAG 시스템 구축을 위한 충분한 시드 문서 확보

**차이점 요약:**

| 구분 | 초기 (하드코딩) | 현재 (자동 생성 + RAG) |
|------|----------------|----------------------|
| **메타데이터 범위** | 주요 컬럼 10~30개만 | 전체 207개 컬럼 |
| **생성 방식** | 수동 작성 | 스크립트 자동 생성 |
| **auto_generated** | 대부분 `true` | 모두 `false` (공식 메타) |
| **프론트 표시** | 경고 메시지 표시 | 경고 없음 |
| **RAG 지원** | 불충분 | 완전 지원 |

### 7.2 메타데이터 우선순위 (merge 순서)

1. **patterns.yaml** 기반 자동 생성 (fallback)
2. **global_columns.yaml** 기반 공식 정의 (현재는 자동 생성된 것을 사용)
3. **datasets/{dataset_id}.yaml** override (최우선, dataset별 커스터마이징)

### 7.3 patterns.yaml 규칙 (자동 생성 fallback)

- TempAct/TempSet/HeaterTC/CascadeTC: zone(U/CU/C/CL/L) 기반 설명 자동 생성
- TempAct_HT.PR 같은 점(.) 포함 컬럼도 지원
- ValveAct/Ctrl/Set: 채널 번호 idx 자동 삽입
- MFCMon/MFCRcpSet/MFCRamp/MFCInput: 가스명 name 자동 삽입 + unit SLM
- AUXMon_*: 보조 모니터 자동 설명
- fallback: unknown + "global에 추가 가능"

### 7.4 global_columns.yaml (공식 메타데이터)

**역할:**
- 프론트엔드 UI에서 사용자에게 표시되는 메타데이터
- 모든 207개 컬럼에 대한 기본 메타데이터 보유
- `type`, `category`, `unit`, `desc` 등 포함

**생성 과정:**
1. `tools/generate_meta.py --method inference` 실행
2. `metadata/columns_union.json` 읽기
3. 컬럼명 패턴 기반으로 메타데이터 추론
4. `column_meta/global_columns.generated.yaml` 생성
5. 공식 메타데이터로 사용 (`global_columns.yaml`)

**프론트엔드 활용:**
- 툴팁: 컬럼 헤더에 마우스 오버 시 `desc` 표시
- 상세 패널: 컬럼 클릭 시 전체 메타데이터 표시
- 타입 필터: `type` 기반 컬럼 필터링

### 7.5 RAG 시스템 (rag_docs/, rag_index/)

**목적:**
- LLM이 컬럼 의미를 이해할 수 있도록 구조화된 문서 제공
- "가스 관련 필드 보여줘" 같은 자연어 질의 지원
- Vector DB 인덱싱을 통한 의미 기반 검색

**구조:**

#### 7.5.1 rag_docs/ (Markdown 문서)

**컬럼별 문서 (`rag_docs/columns/*.md`):**
- 각 컬럼마다 개별 Markdown 파일 (207개)
- RAG 검색에 최적화된 문장 포함
- 예: "이 컬럼은 반도체 공정에서 사용되는 가스와 관련된 필드이다."

**타입별 그룹 문서 (`rag_docs/groups/*.md`):**
- 동일 타입의 컬럼을 묶은 목록 (10개)
- "가스 관련 필드" 같은 범주 질의에 강함
- 예: `gas.md`, `temperature.md`, `pressure.md`

**생성:**
- `tools/export_rag.py --format markdown` 실행
- `global_columns.yaml` → Markdown 변환

#### 7.5.2 rag_index/ (JSONL 인덱스)

**목적:**
- Vector DB 인덱싱에 최적화된 형식
- LLM/RAG 시스템에서 직접 사용 가능
- 텍스트 embedding 검색에 적합

**형식:**
```json
{
  "id": "column:MFCMon_DCS",
  "column": "MFCMon_DCS",
  "type": "gas",
  "category": "process",
  "equipment_field": "MFCMon_DCS",
  "text": "이 컬럼은 반도체 장비 로그 CSV에 포함된 필드이다. ..."
}
```

**생성:**
- `tools/export_rag.py --format jsonl` 실행
- `global_columns.yaml` → JSONL 변환

### 7.6 global_columns.yaml vs RAG 시스템 비교

**global_columns.yaml (프론트엔드용):**
- **목적**: 사용자 UI에서 메타데이터 표시
- **형식**: YAML (구조화된 데이터)
- **사용처**: 백엔드 API → 프론트엔드 렌더링
- **특징**: 빠른 조회, 구조화된 필드 (type, unit, desc 등)

**rag_docs/ (사람용 문서):**
- **목적**: RAG 검색을 위한 사람이 읽기 쉬운 문서
- **형식**: Markdown
- **사용처**: RAG 시스템의 검색 코퍼스
- **특징**: 자연어 문장, 검색 힌트 문장 포함

**rag_index/ (LLM/Vector DB용):**
- **목적**: Vector DB 인덱싱 및 LLM 도구 호출
- **형식**: JSONL (한 줄 = JSON 객체 하나)
- **사용처**: Vector DB embedding, LLM function calling
- **특징**: 구조화된 메타데이터 + 검색용 텍스트

**사용 흐름:**

```
1. 사용자 UI 표시
   → global_columns.yaml (백엔드 API) → 프론트엔드

2. 자연어 질의 ("가스 관련 필드 보여줘")
   → rag_docs/groups/gas.md 또는 rag_index/column_meta.jsonl
   → Vector DB 검색 → LLM 응답
```

### 7.7 메타데이터 생성 워크플로우

```
1. CSV 스캔 (tools/scan_and_export.py)
   → metadata/columns_union.json 생성

2. 메타데이터 시드 생성 (두 가지 방법 중 선택)

   방법 A: 기본 시드 생성 (tools/generate_column_meta_seed.py)
   → column_meta/global_columns.generated.yaml 생성
   → column_meta/global_columns.yaml로 복사 (공식 메타)

   방법 B: 규칙 기반 desc 자동 생성 (tools/generate_global_meta_generated.py) [권장]
   → global_columns.yaml에 없는 컬럼만 필터링
   → patterns.yaml 기반 기본 메타데이터 생성
   → 규칙 기반으로 desc를 더 구체적으로 개선
     - MFC류: "MFC(Mass Flow Controller) 관련 유량/설정/입력 값입니다..."
     - 온도류: "챔버/히터/센서 온도 관련 측정/설정 값입니다..."
     - 압력류: "챔버 압력 관련 값(측정/설정/게이지)입니다..."
     - AUX류: "장비 보조 센서/모니터링 값입니다..."
     - 밸브류: "밸브 채널 상태/제어/설정 값입니다..."
   → column_meta/global_columns.generated.yaml 생성/업데이트
   → 실행 결과:
     ============================================================
     columns_union: 207
     global_columns: 207
     generated_written: /path/to/global_columns.generated.yaml
     created: 0, updated: 0
     ============================================================
     다음 단계:
     1) column_meta/global_columns.generated.yaml 검수
     2) 확정된 항목만 global_columns.yaml로 옮기기(승격)
     3) 서버는 자동으로 반영(hot reload)
     ============================================================
   → 검수 후 확정된 항목만 global_columns.yaml로 승격

3. RAG 문서 생성 (tools/export_column_meta_to_rag.py)
   → rag_docs/columns/*.md (207개)
   → rag_docs/groups/*.md (10개)

4. RAG 인덱스 생성 (tools/export_rag_jsonl.py)
   → rag_index/column_meta.jsonl

5. 백엔드 실행
   → core/column_meta.py가 global_columns.yaml 로드 (hot reload 지원)
   → 파일 변경 시 자동으로 mtime 기반 reload
   → API 엔드포인트에서 메타데이터 반환
   → 프론트엔드에서 UI 표시
```

---

## 8. DuckDB 기반 미리보기/통계(engine/duckdb_engine.py)

### 8.1 preview_rows()

- `read_csv_auto()`로 CSV를 바로 읽음
- 컬럼 목록이 없으면 DESCRIBE 또는 LIMIT 1로 추출
- `LIMIT/OFFSET`로 부분 데이터만 반환

### 8.2 compute_metrics() (1회 쿼리 집계)

- row_range를 LIMIT/OFFSET으로 subquery 처리
- 각 컬럼×메트릭을 한 SELECT에 포함(쿼리 1번)
- avg/stddev는 TRY_CAST AS DOUBLE로 안전 계산
- 결과 reshape + 타입 정리(숫자 가능하면 숫자, 아니면 문자열 유지)

---

## 9. Backend API 계약

- `GET /api/datasets` - datasets.json 기반 목록 반환
- `GET /api/datasets/{id}/preview` - preview_rows 반환
- `GET /api/datasets/{id}/columns` - build_meta_map(meta map) 반환
- `POST /api/datasets/{id}/stats` - compute_metrics 결과(metrics) 반환

---

## 10. Frontend UI 동작(App.tsx)

- datasets 로드 후 선택
- 선택 시 columns + preview 병렬 로딩
- visibleColumns로 columnDefs 생성
- headerTooltip에 desc/unit/[auto] 표시
- rowRange 드래그 선택 및 하이라이트
- 통계 계산 결과를 우측 카드로 렌더

---

## 11. 배포(Deployment)

### 11.1 Backend(Render)

Procfile:
- `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`

핵심 설정:
- Root Directory: `backend`
- ENV: `PYTHONPATH=.`

### 11.2 Frontend(Vercel)

- Root Directory: `frontend`
- ENV: `VITE_API_BASE=<Render backend URL>` (끝에 `/` 붙이면 안 됨)

자세한 배포 가이드는 `DEPLOYMENT.md`를 참고하세요.

---

## 💡 개선점

### (1) 성능 측면

- 현재 preview와 stats 호출 시 `read_csv_auto()`가 반복 실행되면서 CSV 파싱 및 스키마 추정 비용이 누적될 수 있으므로, 데이터셋별 DuckDB View/Table 등록 또는 스키마/헤더 캐싱을 도입해 반복 요청 비용을 낮추는 것이 효과적입니다.
- 또한 통계 계산은 현재 표시 중인 컬럼 전체를 대상으로 수행하므로 컬럼 수가 많아질수록 쿼리가 비대해질 수 있는데, 활성 컬럼/선택 컬럼만 통계를 계산하는 옵션을 제공하면 응답 속도와 사용성이 모두 개선됩니다.

### (2) 메타데이터 측면

- patterns 규칙과 global 정의를 확장하여 자동 생성 품질을 높이고, UI에서 메타 출처(자동 생성/전역 정의/데이터셋 오버라이드)를 시각적으로 구분해 신뢰도를 명확히 전달하는 기능이 유용합니다.

### (3) 운영 측면

- API 오류 발생 시 프론트에서 statusText 대신 서버의 상세 오류(detail)를 노출하도록 개선하면 배포 후 디버깅 효율이 크게 향상되며, 배포 환경에서의 데이터 파일 크기 제약을 고려해 Git LFS 또는 외부 스토리지 연계를 선택적으로 지원하는 방안도 검토할 수 있습니다.

---

## 📄 라이선스

이 프로젝트는 내부 사용을 위한 것입니다.
