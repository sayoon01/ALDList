# 🚀 ALDList 클라우드 배포 가이드

이 문서는 ALDList 프로젝트를 **Render(백엔드)**와 **Vercel(프론트엔드)**에 배포하는 전체 과정을 단계별로 상세히 설명합니다.

---

## 📋 목차

1. [사전 준비사항](#1-사전-준비사항)
2. [1단계: Render 백엔드 배포](#2-1단계-render-백엔드-배포)
3. [2단계: Vercel 프론트엔드 배포](#3-2단계-vercel-프론트엔드-배포)
4. [3단계: 백엔드-프론트엔드 연결](#4-3단계-백엔드-프론트엔드-연결)
5. [데이터 파일 처리 방법](#5-데이터-파일-처리-방법)
6. [트러블슈팅](#6-트러블슈팅)

---

## 1. 사전 준비사항

### ✅ 필수 요구사항

- [ ] GitHub 저장소에 코드가 푸시되어 있음 (`sayoon01/ALDList`)
- [ ] Render 계정 (GitHub 계정으로 가입 가능)
- [ ] Vercel 계정 (GitHub 계정으로 가입 가능)
- [ ] CSV 데이터 파일이 `data/` 디렉토리에 있음

### 📁 프로젝트 구조 확인

```
aldList/
├── backend/          # FastAPI 백엔드
│   ├── app/
│   ├── Procfile     # Render 배포 설정
│   └── requirements.txt
├── frontend/         # React + Vite 프론트엔드
│   ├── src/
│   └── package.json
├── data/            # CSV 파일들
└── metadata/        # 메타데이터 (자동 생성)
```

---

## 2. 1단계: Render 백엔드 배포

### 2.1 Render 계정 생성 및 로그인

1. [https://render.com](https://render.com) 접속
2. **"Get Started for Free"** 또는 **"Sign In"** 클릭
3. **"Sign up with GitHub"** 선택 (권장)
4. GitHub 계정으로 로그인 및 권한 승인

### 2.2 새 Web Service 생성

1. Render 대시보드에서 **"New +"** 버튼 클릭
2. **"Web Service"** 선택
3. GitHub 저장소 연결:
   - **"Connect account"** 또는 **"Configure account"** 클릭
   - GitHub 저장소 목록에서 **`sayoon01/ALDList`** 선택
   - **"Connect"** 클릭

### 2.3 서비스 설정 (중요!)

#### 2.3.1 기본 정보

- **Name**: `aldlist-backend` (원하는 이름으로 변경 가능)
- **Region**: `Singapore` 또는 가장 가까운 지역 선택
- **Branch**: `main` (또는 배포할 브랜치)

#### 2.3.2 빌드 및 실행 설정

**⚠️ 중요: Root Directory 설정**

1. **"Advanced"** 섹션 펼치기
2. **"Root Directory"** 찾기
3. **`backend`** 입력
   - 이유: 프로젝트 루트가 아니라 `backend` 폴더에 백엔드 코드가 있습니다

**Build & Deploy 설정:**

- **Environment**: `Python 3` 선택
- **Build Command**: 
  ```
  pip install -r requirements.txt
  ```
- **Start Command**: 
  ```
  uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
  - 또는 `Procfile`이 있으면 자동으로 감지됨

**Python Version:**
- `Python 3.12.1` 또는 최신 버전 선택
- `runtime.txt` 파일이 있으면 자동으로 감지됨

### 2.4 환경 변수 설정

Render 대시보드에서 **"Environment"** 탭 클릭:

#### 필수 환경 변수

```
PYTHONPATH=.
```

#### 선택적 환경 변수 (기본값 사용 가능)

```
PORT=10000
```
- ⚠️ Render가 자동으로 설정하므로 보통 설정 불필요
- `Procfile`에서 `$PORT` 사용 시 자동으로 주입됨

```
DATA_DIR=/opt/render/project/src/data
META_DIR=/opt/render/project/src/metadata
```
- ⚠️ Git에 `data/`와 `metadata/`가 포함되어 있으면 기본값 사용 가능
- 프로젝트 루트 기준 상대 경로로 자동 설정됨

**환경 변수 추가 방법:**
1. **"Environment"** 탭에서 **"Add Environment Variable"** 클릭
2. **Key**: `PYTHONPATH` 입력
3. **Value**: `.` 입력
4. **"Save Changes"** 클릭

### 2.5 데이터 파일 처리

#### 방법 1: Git에 포함 (권장, 소규모 데이터)

**장점**: 간단, 자동 배포  
**단점**: 저장소 크기 증가

```bash
# 로컬에서 실행
cd /home/keti_spark1/yune/aldList
git add data/*.csv metadata/
git commit -m "Add CSV data files and metadata"
git push origin main
```

**⚠️ 주의**: 
- CSV 파일이 많거나 크면 (> 100MB) Git LFS 사용 고려
- 또는 방법 2 사용

#### 방법 2: 외부 스토리지 (대용량 데이터)

**AWS S3, Google Cloud Storage 등 사용**

1. 외부 스토리지에 CSV 파일 업로드
2. 환경 변수에 스토리지 정보 추가
3. 백엔드 시작 시 다운로드하는 스크립트 추가

(현재는 방법 1 권장)

### 2.6 배포 실행

1. 모든 설정 확인 후 **"Create Web Service"** 클릭
2. 빌드 및 배포 시작 (5-10분 소요)

### 2.7 배포 과정 확인

**빌드 로그에서 확인할 내용:**

1. **Cloning repository**: GitHub에서 코드 다운로드
2. **Installing dependencies**: `pip install -r requirements.txt`
3. **Starting service**: `uvicorn app.main:app` 실행

**예상 시간**: 5-10분

### 2.8 배포 완료 확인

#### 2.8.1 서비스 상태 확인

- Render 대시보드에서 **"Live"** 상태 확인
- 초록색 점이 표시되면 정상 작동

#### 2.8.2 API 테스트

**Render가 제공한 URL 확인** (예: `https://aldlist-backend.onrender.com`)

**1. API 정보 확인:**
```bash
curl https://aldlist-backend.onrender.com/
```

**예상 응답:**
```json
{
  "name": "ALDList API",
  "version": "1.0.0",
  "docs": "/docs",
  "endpoints": {
    "datasets": "/api/datasets",
    "preview": "/api/datasets/{dataset_id}/preview",
    "stats": "/api/datasets/{dataset_id}/stats"
  }
}
```

**2. 데이터셋 목록 확인:**
```bash
curl https://aldlist-backend.onrender.com/api/datasets
```

**예상 응답:**
```json
{
  "datasets": [
    {
      "dataset_id": "standard_trace_001",
      "filename": "standard_trace_001.csv",
      "size_bytes": 1234567,
      "columns": ["No.", "Time", "TempAct_U", ...]
    },
    ...
  ]
}
```

**3. API 문서 확인:**
- 브라우저에서 `https://aldlist-backend.onrender.com/docs` 접속
- Swagger UI가 표시되면 정상

#### 2.8.3 백엔드 URL 저장

**⚠️ 중요**: 다음 단계에서 사용하므로 백엔드 URL을 복사해두세요!

```
예: https://aldlist-backend.onrender.com
```

---

## 3. 2단계: Vercel 프론트엔드 배포

### 3.1 Vercel 계정 생성 및 로그인

1. [https://vercel.com](https://vercel.com) 접속
2. **"Sign Up"** 또는 **"Log In"** 클릭
3. **"Continue with GitHub"** 선택 (권장)
4. GitHub 계정으로 로그인 및 권한 승인

### 3.2 새 프로젝트 생성

1. Vercel 대시보드에서 **"Add New..."** → **"Project"** 클릭
2. GitHub 저장소 목록에서 **`sayoon01/ALDList`** 선택
3. **"Import"** 클릭

### 3.3 프로젝트 설정 (중요!)

#### 3.3.1 Framework Preset

- **선택**: **"Vite"**
- 다른 옵션이 선택되어 있으면 **"Vite"**로 변경

#### 3.3.2 Root Directory 설정 (매우 중요!)

**⚠️ 필수**: Root Directory를 `frontend`로 설정해야 합니다!

1. **"Root Directory"** 옆의 **"Edit"** 클릭
2. `frontend` 입력
3. **"Continue"** 클릭

**이유**: 프로젝트 루트가 아니라 `frontend` 폴더에 프론트엔드 코드가 있습니다.

#### 3.3.3 빌드 설정 (자동 감지됨)

Vercel이 `frontend/package.json`을 읽어서 자동으로 설정합니다:

- **Build Command**: `npm run build` ✅
- **Output Directory**: `dist` ✅
- **Install Command**: `npm install` ✅

**확인 방법**: "Build and Output Settings" 섹션에서 확인

#### 3.3.4 Project Name

- 기본값: `ald-list` (원하는 이름으로 변경 가능)
- 예: `aldlist-frontend`, `aldlist`

#### 3.3.5 Vercel Team

- 개인 계정: "sayoon01's projects"
- 플랜: "Hobby" (무료)

### 3.4 환경 변수 설정

**⚠️ 중요**: 배포 전에 환경 변수를 설정해야 합니다!

#### 3.4.1 백엔드 URL 설정

**2단계에서 저장한 백엔드 URL 사용:**

1. 프로젝트 설정 화면에서 **"Environment Variables"** 섹션 찾기
2. **"Add"** 클릭
3. 다음 입력:
   ```
   Name: VITE_API_BASE
   Value: https://aldlist-backend.onrender.com
   ```
   (실제 백엔드 URL로 변경)
4. **Environment**: 
   - ✅ Production
   - ✅ Preview
   - ✅ Development
   (모두 선택 권장)
5. **"Save"** 클릭

**⚠️ 주의**: 
- URL 끝에 `/` 없어야 함
- `http://` 대신 `https://` 사용

### 3.5 배포 실행

1. 모든 설정 확인 후 **"Deploy"** 버튼 클릭
2. 빌드 로그가 실시간으로 표시됩니다

### 3.6 빌드 과정 확인

빌드 중 다음 단계가 진행됩니다:

1. **Installing dependencies**: `npm install` 실행
2. **Building**: `npm run build` 실행
3. **Deploying**: 정적 파일 업로드

**예상 시간**: 1-3분

### 3.7 배포 완료 확인

배포가 완료되면:

- ✅ **"Congratulations!"** 메시지 표시
- 🌐 배포된 URL 확인 (예: `https://ald-list.vercel.app`)
- 🔗 **"Visit"** 버튼 클릭하여 사이트 확인

### 3.8 사이트 테스트

1. **데이터셋 목록**: 데이터셋이 표시되는지 확인
2. **데이터 미리보기**: 데이터가 로드되는지 확인
3. **통계 계산**: 통계가 정상적으로 계산되는지 확인

**문제가 있는 경우:**
- 브라우저 개발자 도구 (F12) → Console 탭 확인
- Network 탭에서 API 요청 확인

---

## 4. 3단계: 백엔드-프론트엔드 연결

### 4.1 연결 확인

프론트엔드에서 백엔드 API가 정상적으로 호출되는지 확인:

1. 프론트엔드 사이트 접속
2. 브라우저 개발자 도구 (F12) → **Network** 탭 열기
3. 데이터셋 목록이 로드되는지 확인
4. API 요청 URL 확인:
   - ✅ `https://aldlist-backend.onrender.com/api/datasets`
   - ❌ `http://localhost:8000/api/datasets` (잘못된 경우)

### 4.2 환경 변수 업데이트 (필요 시)

백엔드 URL을 변경하거나 업데이트한 경우:

1. Vercel 대시보드 → **Settings** → **Environment Variables**
2. `VITE_API_BASE` 값 수정
3. **"Save"** 클릭
4. 자동 재배포 또는 수동 재배포

### 4.3 CORS 설정 확인

백엔드 CORS 설정이 `allow_origins=["*"]`로 되어 있으므로, 모든 도메인에서 API 호출이 가능합니다.

**프로덕션 권장**: 특정 도메인만 허용하도록 수정:

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ald-list.vercel.app",  # 실제 프론트엔드 URL
        "https://ald-list-*.vercel.app",  # Preview 배포 포함
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 5. 데이터 파일 처리 방법

### 5.1 문제점

Render는 **ephemeral 디스크**를 사용합니다:
- 런타임에 추가/수정된 파일은 재시작 시 사라짐
- Git에 포함되지 않은 파일은 배포 시 포함되지 않음

### 5.2 해결 방법

#### 방법 1: Git에 포함 (권장, 소규모 데이터)

**장점**: 간단, 자동 배포  
**단점**: 저장소 크기 증가

```bash
# CSV 파일과 메타데이터를 Git에 추가
git add data/*.csv metadata/
git commit -m "Add CSV data files and metadata"
git push origin main
```

**⚠️ 주의**: 
- CSV 파일이 많거나 크면 (> 100MB) Git LFS 사용 고려
- 또는 방법 2 사용

#### 방법 2: 외부 스토리지 (대용량 데이터)

**AWS S3 예시:**

1. S3 버킷 생성 및 CSV 파일 업로드
2. 환경 변수 설정:
   ```
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   S3_BUCKET=your-bucket-name
   S3_DATA_PREFIX=data/
   ```
3. 백엔드 시작 시 S3에서 다운로드하는 스크립트 추가

**Google Cloud Storage 예시:**

1. GCS 버킷 생성 및 CSV 파일 업로드
2. 환경 변수 설정:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
   GCS_BUCKET=your-bucket-name
   GCS_DATA_PREFIX=data/
   ```

#### 방법 3: Render Disk (유료)

- Render: Persistent Disk 사용 (유료 플랜)

---

## 6. 트러블슈팅

### 6.1 백엔드가 시작되지 않음

**증상**: Render에서 "Failed" 상태

**해결 방법:**
1. **Logs** 탭에서 오류 메시지 확인
2. `PORT` 환경 변수 확인 (보통 자동 설정됨)
3. `Procfile` 확인:
   ```
   web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Root Directory가 `backend`로 설정되었는지 확인
5. `requirements.txt`에 모든 의존성이 포함되어 있는지 확인

### 6.2 데이터셋 목록이 비어있음

**증상**: API는 작동하지만 데이터셋이 없음

**해결 방법:**
1. CSV 파일이 Git에 포함되어 있는지 확인:
   ```bash
   git ls-files data/
   ```
2. Render 로그에서 메타데이터 생성 오류 확인
3. `data/` 디렉토리 경로 확인:
   - 환경 변수 `DATA_DIR` 설정 확인
   - 또는 기본 경로 사용 (`프로젝트루트/data`)

### 6.3 프론트엔드에서 API 호출 실패

**증상**: "API Error" 또는 데이터가 로드되지 않음

**해결 방법:**
1. **환경 변수 확인**:
   - Vercel → Settings → Environment Variables
   - `VITE_API_BASE`가 올바르게 설정되었는지
   - 백엔드 URL이 올바른지 (끝에 `/` 없어야 함)

2. **백엔드 상태 확인**:
   ```bash
   curl https://aldlist-backend.onrender.com/api/datasets
   ```

3. **CORS 확인**:
   - 브라우저 개발자 도구 → Console 탭
   - CORS 오류 메시지 확인
   - 백엔드 CORS 설정 확인

4. **Network 탭 확인**:
   - 브라우저 개발자 도구 → Network 탭
   - API 요청 URL 확인
   - 응답 상태 코드 확인

### 6.4 빌드 실패

**증상**: "Build Failed" 오류

**해결 방법:**

**백엔드 (Render):**
1. 빌드 로그 확인
2. `requirements.txt`에 모든 의존성 포함 확인
3. Python 버전 확인
4. Root Directory가 `backend`로 설정되었는지 확인

**프론트엔드 (Vercel):**
1. 빌드 로그 확인
2. `frontend/package.json`의 `build` 스크립트 확인
3. TypeScript 오류 확인:
   ```bash
   cd frontend
   npm run build
   ```
4. Root Directory가 `frontend`로 설정되었는지 확인

### 6.5 환경 변수 적용 안 됨

**증상**: 환경 변수를 설정했지만 반영되지 않음

**해결 방법:**
1. 환경 변수 설정 후 **재배포** 필요
2. Settings → Environment Variables에서 값 확인
3. Production, Preview, Development 모두 설정했는지 확인
4. 프론트엔드의 경우 빌드 시점에 환경 변수가 주입되므로 재빌드 필요

### 6.6 Root Directory 오류

**증상**: "Cannot find module" 또는 빌드 경로 오류

**해결 방법:**
1. **백엔드 (Render)**: Root Directory가 `backend`로 설정되었는지 확인
2. **프론트엔드 (Vercel)**: Root Directory가 `frontend`로 설정되었는지 확인
3. Settings → General → Root Directory 확인
4. 올바른 값으로 변경 후 재배포

---

## 7. 배포 후 관리

### 7.1 자동 배포

**Render:**
- `main` 브랜치에 푸시하면 자동 배포
- Settings → Auto-Deploy에서 설정 확인

**Vercel:**
- `main` 브랜치에 푸시하면 자동 배포
- Pull Request 생성 시 Preview 배포

### 7.2 배포 히스토리

**Render:**
- 대시보드 → Deploys 탭에서 모든 배포 기록 확인
- 이전 버전으로 롤백 가능

**Vercel:**
- 대시보드 → Deployments 탭에서 모든 배포 기록 확인
- 이전 버전으로 롤백 가능

### 7.3 로그 확인

**Render:**
- 대시보드 → Logs 탭에서 실시간 로그 확인

**Vercel:**
- 각 배포의 **"View Function Logs"** 클릭
- 실시간 로그 확인 가능

### 7.4 환경 변수 관리

**Render:**
- Settings → Environment에서 환경 변수 추가/수정
- 변경 후 자동 재배포

**Vercel:**
- Settings → Environment Variables에서 환경 변수 추가/수정
- 변경 후 재배포 필요 (자동 또는 수동)

---

## 8. 체크리스트

### 배포 전 확인사항

**백엔드 (Render):**
- [ ] GitHub에 코드가 푸시되어 있음
- [ ] `backend/Procfile`이 있음
- [ ] `backend/requirements.txt`에 모든 의존성이 있음
- [ ] Root Directory가 `backend`로 설정됨
- [ ] `PYTHONPATH=.` 환경 변수 설정
- [ ] CSV 파일이 Git에 포함되어 있음 (또는 외부 스토리지 사용)

**프론트엔드 (Vercel):**
- [ ] GitHub에 코드가 푸시되어 있음
- [ ] `frontend/package.json`에 `build` 스크립트가 있음
- [ ] Root Directory가 `frontend`로 설정됨
- [ ] Framework Preset이 `Vite`로 설정됨
- [ ] `VITE_API_BASE` 환경 변수 설정 (백엔드 URL)
- [ ] 백엔드가 배포되어 있고 접근 가능함

---

## 9. 완료!

배포가 완료되면:

1. ✅ **백엔드**: `https://aldlist-backend.onrender.com`
2. ✅ **프론트엔드**: `https://ald-list.vercel.app`
3. ✅ **자동 배포**: `main` 브랜치 푸시 시 자동 배포

---

## 10. 추가 리소스

- [Render 공식 문서](https://render.com/docs)
- [Vercel 공식 문서](https://vercel.com/docs)
- [FastAPI 배포 가이드](https://fastapi.tiangolo.com/deployment/)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)

---

**문제가 있으면 각 플랫폼의 로그를 확인하거나 이슈를 등록해주세요!**
