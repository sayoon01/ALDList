# ALDList - CSV 데이터 분석 도구

CSV 파일을 쉽게 탐색하고 분석할 수 있는 웹 애플리케이션입니다.

## ✨ 특징

- **빠른 시작**: CSV 파일만 `data/` 디렉토리에 넣으면 레지스트리 자동 생성
- **실시간 분석**: 대용량 CSV 파일도 빠르게 탐색 및 분석
- **직관적인 UI**: 드래그로 범위 선택, 컬럼 필터링, 통계 계산
- **범위 기반 분포 시각화**: 활성 컬럼 히스토그램으로 구간별 분포 확인
- **완전한 메타데이터**: 선택적으로 전체 메타데이터 파이프라인 실행 가능
- **프로필 기반 보강**: 프로필 데이터를 활용한 자동 desc/title 생성
- **패턴 제안 자동화**: 컬럼명 패턴 분석 및 정규식 제안 리포트 생성

## 🚀 빠른 시작

### 1. CSV 파일 준비

```bash
cp your_file.csv data/
```

### 2. 백엔드 실행

```bash
./start_backend.sh
```

백엔드가 시작되면:
- **레지스트리 자동 생성** (CSV 파일 스캔 → `metadata/datasets.json` 생성)
- API 서버 실행: http://localhost:8000
- API 문서: http://localhost:8000/docs

**참고**: 백엔드 시작 시 레지스트리만 자동 생성됩니다. 컬럼 메타데이터는 patterns.yaml 기반 fallback만 사용됩니다.
완전한 메타데이터가 필요하면 아래 "메타데이터 생성" 단계를 실행하세요.

### 3. (선택) 메타데이터 생성

완전한 컬럼 메타데이터가 필요하면:

```bash
./scan_metadata.sh
```

이 스크립트는 다음을 실행합니다:
1. CSV 스캔 (레지스트리 생성)
2. 메타데이터 생성 (`global_columns.generated.yaml`)
3. 프로필 기반 보강 (프로필이 있는 경우)
4. 패턴 제안 생성

**소요 시간**: CSV 파일 수와 프로필 유무에 따라 10-60초 정도 소요됩니다.

### 4. 프론트엔드 실행

새 터미널에서:

```bash
./start_frontend.sh
```

프론트엔드가 실행되면:
- 웹 애플리케이션: http://localhost:5173

## 📖 사용 방법

1. **데이터셋 선택**: 왼쪽 사이드바에서 분석할 CSV 파일 선택
2. **컬럼 선택**: 원하는 컬럼만 체크하여 표시
3. **데이터 탐색**: 중앙 그리드에서 데이터 스크롤 및 필터링
4. **범위 선택**: 그리드에서 마우스로 드래그하여 행 범위 선택
5. **통계 계산**: "통계 계산" 버튼 클릭하여 선택한 범위의 통계 확인
6. **분포 확인**: Stats 패널의 "분포 시각화 (활성 컬럼)"에서 히스토그램 확인

## 📁 프로젝트 구조

구조와 주요 기능을 역할별로 정리한 프로젝트 가이드를 제공합니다.

- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) - 전체 구조, 주요 기능, 수정 원칙, 온보딩 순서

```text
핵심만 요약:
- 수정 중심: backend/, frontend/, tools/
- 입력 원본: data/
- 생성 산출물: metadata/, column_meta/, rag_docs/, rag_index/
```

## 📊 워크플로우

### 기본 워크플로우 (백엔드 자동 실행)

백엔드 시작 시 자동으로 실행됩니다:

```
1. CSV 스캔 → metadata/datasets.json 생성 (레지스트리)
```

**특징**: 빠름 (1-5초), 필수 정보만 생성, 즉시 사용 가능

### 완전한 메타데이터 워크플로우 (수동 실행)

`./scan_metadata.sh` 실행 시:

```
1. CSV 스캔 → metadata/datasets.json 생성
2. 메타데이터 생성 → column_meta/global_columns.generated.yaml 생성
3. 프로필 기반 보강 → 메타데이터 업데이트 (프로필이 있는 경우)
4. 패턴 제안 생성 → metadata/reports/pattern_suggestions.md 생성
5. (선택) RAG 문서/인덱스 생성 → rag_docs/, rag_index/ 생성
```

**특징**: 완전함, 시간 소요 (10-60초), 완전한 컬럼 메타데이터 제공

**실행 방법:**
```bash
./scan_metadata.sh
```

자세한 워크플로우는 [COLUMN_META_WORKFLOW.md](COLUMN_META_WORKFLOW.md)를 참고하세요.

## 📡 API 엔드포인트

- `GET /api/datasets` - 데이터셋 목록 조회
- `GET /api/datasets/{dataset_id}` - 데이터셋 메타데이터 조회
- `GET /api/datasets/{dataset_id}/preview` - 데이터 미리보기
- `GET /api/datasets/{dataset_id}/columns` - 컬럼 메타데이터 조회
- `GET /api/datasets/{dataset_id}/fields?type={type}` - 타입별 컬럼 필터링
- `POST /api/datasets/{dataset_id}/stats` - 통계 계산
- `POST /api/datasets/{dataset_id}/histogram` - 선택 범위 기반 히스토그램 계산

자세한 API 문서: http://localhost:8000/docs

## 🛠 기술 스택

- **Backend**: FastAPI, DuckDB, Python
- **Frontend**: React, TypeScript, AG Grid, Vite
- **Data**: CSV 파일, JSON 메타데이터, YAML 컬럼 메타

## 📝 CSV 파일 변경 시

### 방법 1: 백엔드 자동 감지 (기본)

백엔드가 실행 중이면 API 호출 시 자동으로 레지스트리 확인 및 생성합니다.
- CSV 파일 변경 감지 시 자동으로 `metadata/datasets.json` 재생성
- 빠르고 자동화되어 있음

### 방법 2: 통합 스크립트 실행 (완전한 메타데이터)

CSV 파일을 추가/변경한 후 완전한 메타데이터를 생성하려면:

```bash
./scan_metadata.sh
```

### 방법 3: 단계별 수동 실행

```bash
# 1. 레지스트리만 생성 (빠름)
python3 tools/scan_and_export.py

# 2. 메타데이터 생성
python3 tools/generate_meta.py --method patterns

# 3. 프로필 기반 보강 (프로필이 있는 경우)
python3 tools/enrich_generated_from_profiles.py

# 4. 패턴 제안 생성
python3 tools/suggest_patterns.py
```

## 📚 상세 문서

- [ARCHITECTURE.md](ARCHITECTURE.md) - 전체 아키텍처 및 구동 원리
- [COLUMN_META_WORKFLOW.md](COLUMN_META_WORKFLOW.md) - 컬럼 메타데이터 워크플로우 상세
- [METADATA_STRATEGIES.md](METADATA_STRATEGIES.md) - 메타데이터 전략 문서
- [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) - Vercel 배포 가이드

## 💡 주요 기능

- ✅ 레지스트리 자동 생성 (백엔드 시작 시)
- ✅ 완전한 메타데이터 생성 (선택적, scan_metadata.sh)
- ✅ 프로필 기반 메타데이터 보강
- ✅ 패턴 제안 자동화
- ✅ 빠른 초기 로딩 (병렬 로딩, 최적화된 페이징)
- ✅ 실시간 미리보기 (최대 10,000행)
- ✅ 컬럼 선택 및 필터링
- ✅ 컬럼 상세 정보 표시
- ✅ 통계 계산 (평균, 최소/최대값, 표준편차)
- ✅ 히스토그램 분포 시각화 (활성 컬럼, 선택 범위 기준)
- ✅ 드래그 범위 선택
- ✅ 타입 필터링

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

## 📄 라이선스

이 프로젝트는 내부 사용을 위한 것입니다.
