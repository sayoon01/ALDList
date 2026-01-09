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
│   │   ├── api/ (datasets.py, stats.py)
│   │   ├── core/ (auto_scan.py, registry.py, column_meta.py, settings.py)
│   │   └── engine/ (duckdb_engine.py)
│   ├── requirements.txt
│   └── Procfile
├── frontend/
│   └── src/ (App.tsx, api.ts)
├── data/              # CSV 파일들 (배포 시 Git 포함)
├── metadata/          # tools/scan_and_export.py 결과물
└── column_meta/       # global_columns.yaml, patterns.yaml, datasets/*.yaml
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

### 7.1 우선순위(확정)

1. patterns.yaml 기반 자동 생성
2. global_columns.yaml 기반 수동 정의 merge
3. datasets/{dataset_id}.yaml override(최우선, auto_generated=False)

### 7.2 patterns.yaml 규칙(자동 생성)

- TempAct/TempSet/HeaterTC/CascadeTC: zone(U/CU/C/CL/L) 기반 설명 자동 생성
- TempAct_HT.PR 같은 점(.) 포함 컬럼도 지원
- ValveAct/Ctrl/Set: 채널 번호 idx 자동 삽입
- MFCMon/MFCRcpSet/MFCRamp/MFCInput: 가스명 name 자동 삽입 + unit SLM
- AUXMon_*: 보조 모니터 자동 설명
- fallback: unknown + "global에 추가 가능"

### 7.3 global_columns.yaml(도메인 정답 메타)

중요 공정 컬럼에 대해:
- title, name_ko/en, type/category, unit, importance(A/B/C), desc 제공

프론트에서는 툴팁/상세패널에서 이 정보가 그대로 사용자에게 전달됩니다.

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
