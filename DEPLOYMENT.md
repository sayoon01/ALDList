# ALDList 배포 가이드

이 가이드는 ALDList 프로젝트를 Render (백엔드)와 Vercel (프론트엔드)에 배포하는 방법을 설명합니다.

## 목차

1. [사전 준비](#사전-준비)
2. [Render 백엔드 배포](#render-백엔드-배포)
3. [Vercel 프론트엔드 배포](#vercel-프론트엔드-배포)
4. [백엔드-프론트엔드 연결](#백엔드-프론트엔드-연결)
5. [트러블슈팅](#트러블슈팅)

---

## 사전 준비

### 필수 요구사항

1. **GitHub 저장소**
   - 프로젝트가 GitHub에 푸시되어 있어야 합니다
   - CSV 파일과 metadata가 Git에 포함되어 있어야 합니다

2. **계정 생성**
   - [Render](https://render.com) 계정 (백엔드용)
   - [Vercel](https://vercel.com) 계정 (프론트엔드용)

3. **프로젝트 구조 확인**
   ```
   aldList/
   ├── backend/
   │   ├── app/
   │   ├── Procfile          # Render 배포용
   │   └── requirements.txt
   ├── frontend/
   │   ├── src/
   │   ├── package.json
   │   └── vite.config.ts
   ├── data/                 # CSV 파일들 (Git에 포함)
   └── metadata/             # 메타데이터 (Git에 포함 또는 자동 생성)
   ```

---

## Render 백엔드 배포

### 1단계: Render 계정 생성 및 로그인

1. [Render](https://render.com) 접속
2. "Sign Up" 또는 "Get Started for Free" 클릭
3. GitHub 계정으로 로그인 권장

### 2단계: Web Service 생성

1. Render 대시보드에서 **"New +"** 버튼 클릭
2. **"Web Service"** 선택

### 3단계: GitHub 저장소 연결

1. **"Connect account"** 또는 **"Connect repository"** 클릭
2. GitHub 저장소 권한 승인
3. 저장소 목록에서 `sayoon01/ALDList` 선택

### 4단계: 서비스 설정

다음 정보를 입력/선택하세요:

#### 기본 설정

- **Name**: `aldlist-backend` (또는 원하는 이름)
- **Region**: `Singapore` (한국에서 가장 가까운 지역)
- **Branch**: `main` (또는 `master`)

#### 빌드 및 실행 설정

- **Root Directory**: `backend`
  - **참고**: 화면 중간에 "Root Directory (Optional)" 입력칸이 있습니다. 여기에 `backend`를 입력하세요.

- **Runtime**: `Python 3` (자동 감지)

- **Build Command**: 
  ```
  pip install -r requirements.txt
  ```

- **Start Command**: 
  ```
  uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```
  - **참고**: `Procfile`이 있으면 자동으로 감지되므로, Start Command는 비워둬도 됩니다.

#### 환경 변수 설정

**Environment Variables** 섹션에서 다음 변수를 추가하세요:

| NAME_OF_VARIABLE | value |
|------------------|-------|
| `PYTHONPATH` | `.` |

**추가 방법:**
1. "Add Environment Variable" 버튼 클릭
2. **NAME_OF_VARIABLE** 칸에: `PYTHONPATH` 입력
3. **value** 칸에: `.` 입력
4. "Add" 클릭

**참고:**
- `PORT`는 Render가 자동으로 설정하므로 추가하지 마세요.
- DuckDB는 환경 변수 설정이 필요 없습니다 (임베디드 DB).

#### 고급 설정 (Advanced)

대부분 기본값 그대로 두면 됩니다:

- **Health Check Path**: 기본값 유지 (`/healthz`)
- **Pre-Deploy Command**: 비워두기
- **Auto-Deploy**: "On Commit" 유지 (GitHub 푸시 시 자동 배포)
- **Secrets**: 필요 없음

### 5단계: 배포 시작

1. 맨 아래 **"Create Web Service"** 버튼 클릭
2. 배포가 시작되면 로그가 실시간으로 표시됩니다

### 6단계: 배포 로그 확인

**Render 서비스 페이지**에서 로그를 확인하세요:

1. 서비스 페이지 자동 이동 (또는 대시보드에서 서비스 클릭)
2. **"Logs"** 탭 클릭 (또는 하단 로그 창 확인)

**확인할 내용:**
```
==> Cloning from https://github.com/sayoon01/ALDList.git
==> Installing dependencies
   pip install -r requirements.txt
==> Starting service
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
✅ 메타데이터가 최신 상태입니다.
==> Your service is live 🎉
==> Available at your primary URL https://aldlist-backend.onrender.com
```

### 7단계: 백엔드 URL 확인

배포가 완료되면 다음 중 하나에서 백엔드 URL을 확인할 수 있습니다:

1. **로그에서 확인**:
   ```
   ==> Available at your primary URL https://aldlist-backend.onrender.com
   ```

2. **서비스 페이지에서 확인**:
   - 서비스 페이지 상단에 **"URL"** 섹션이 있습니다
   - 예: `https://aldlist-backend.onrender.com`

3. **Settings 탭에서 확인**:
   - "Settings" → "General" → "Service URL"

**중요**: 이 URL을 복사해 두세요. Vercel 프론트엔드 배포 시 사용합니다.

### 8단계: 백엔드 테스트

브라우저나 터미널에서 테스트하세요:

```bash
# 1. API 정보 확인
curl https://aldlist-backend.onrender.com/

# 2. 데이터셋 목록 확인
curl https://aldlist-backend.onrender.com/api/datasets

# 3. API 문서 확인 (브라우저)
https://aldlist-backend.onrender.com/docs
```

**참고**: 
- 첫 요청은 느릴 수 있습니다 (Free 플랜은 슬립 모드).
- `/docs` 엔드포인트는 정상 작동합니다.

---

## Vercel 프론트엔드 배포

### 1단계: Vercel 계정 생성 및 로그인

1. [Vercel](https://vercel.com) 접속
2. "Sign Up" 클릭
3. GitHub 계정으로 로그인 권장

### 2단계: 프로젝트 생성

1. Vercel 대시보드에서 **"Add New..."** → **"Project"** 클릭
2. GitHub 저장소 목록에서 `sayoon01/ALDList` 선택
3. **"Import"** 클릭

### 3단계: 프로젝트 설정

#### 프레임워크 설정

- **Framework Preset**: `Vite` (자동 감지됨)
- **Root Directory**: `frontend`
  - "Edit" 클릭 후 `frontend` 입력

#### 빌드 설정

- **Build Command**: `npm run build` (자동 감지)
- **Output Directory**: `dist` (자동 감지)
- **Install Command**: `npm install` (자동 감지)

#### 환경 변수 설정

**Environment Variables** 섹션에서 다음 변수를 추가하세요:

| NAME | VALUE |
|------|-------|
| `VITE_API_BASE` | `https://aldlist-backend.onrender.com` |

**추가 방법:**
1. "Environment Variables" 섹션 클릭
2. **Name** 칸에: `VITE_API_BASE` 입력
3. **Value** 칸에: Render 백엔드 URL 입력
   - 예: `https://aldlist-backend.onrender.com`
4. "Save" 클릭

**중요**: 
- 백엔드 URL 끝에 슬래시(`/`)를 붙이지 마세요.
- 예: `https://aldlist-backend.onrender.com` ✅
- 예: `https://aldlist-backend.onrender.com/` ❌

### 4단계: 배포 시작

1. **"Deploy"** 버튼 클릭
2. 배포가 시작되면 진행 상황이 표시됩니다

### 5단계: 배포 완료 확인

배포가 완료되면 다음 정보가 표시됩니다:

- **배포 URL**: 예) `https://aldlist-xxx.vercel.app`
- **Production URL**: 예) `https://aldlist.vercel.app`

### 6단계: 프론트엔드 테스트

1. 배포 URL로 접속
2. 데이터셋 목록이 로드되는지 확인
3. 브라우저 개발자 도구(F12) → Network 탭에서 API 요청 확인

---

## 백엔드-프론트엔드 연결

### 연결 확인 방법

1. **프론트엔드에서 백엔드 API 호출 확인**
   - 브라우저 개발자 도구(F12) → Network 탭
   - 데이터셋 목록 로드 시 `GET https://aldlist-backend.onrender.com/api/datasets` 요청 확인

2. **CORS 설정 확인**
   - 백엔드 코드에서 이미 `allow_origins=["*"]`로 설정되어 있습니다.
   - 별도 설정 불필요합니다.

### 환경 변수 업데이트

프론트엔드의 백엔드 URL을 변경하려면:

1. Vercel 대시보드 → 프로젝트 → Settings
2. Environment Variables 섹션
3. `VITE_API_BASE` 값 수정
4. 새 배포 트리거 (자동 또는 수동)

---

## 트러블슈팅

### 백엔드 배포 문제

#### 1. 빌드 실패

**증상**: `pip install` 실패

**해결 방법**:
- `backend/requirements.txt` 확인
- Render 로그에서 구체적인 오류 메시지 확인
- 필요한 패키지가 `requirements.txt`에 포함되어 있는지 확인

#### 2. 서버 시작 실패

**증상**: "No open ports detected"

**해결 방법**:
- Start Command 확인: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- `Procfile` 내용 확인:
  ```
  web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```

#### 3. API 연결 실패

**증상**: 404 또는 500 오류

**해결 방법**:
- 서비스가 "Live" 상태인지 확인
- Render 로그에서 오류 메시지 확인
- API 엔드포인트 경로 확인 (`/api/datasets`)

#### 3-1. CSV 파일 경로 오류 (500 에러)

**증상**: 
```
_duckdb.IOException: IO Error: No files found that match the pattern "/home/keti_spark1/yune/aldList/data/standard_trace_001.csv"
```

**원인**: 메타데이터에 로컬 절대 경로가 저장되어 Render 서버에서 파일을 찾을 수 없음

**해결 방법**:
1. **로컬에서 메타데이터 재생성** (권장):
   ```bash
   python3 tools/scan_and_export.py
   git add metadata/datasets.json
   git commit -m "Regenerate metadata with relative paths"
   git push origin main
   ```
   - 이렇게 하면 메타데이터가 상대 경로(`standard_trace_001.csv`)로 저장됨
   - Render가 자동으로 재배포하며 새로운 메타데이터 사용

2. **코드 수정 확인**:
   - `backend/app/core/registry.py`가 `filename`만 사용하여 경로를 생성하는지 확인
   - 메타데이터의 경로와 무관하게 항상 `DATA_DIR / filename` 경로 사용

3. **Render 재배포**:
   - 메타데이터 재생성 후 Render가 자동으로 재배포
   - 또는 Manual Deploy → "Clear build cache & deploy"

#### 4. 메타데이터 생성 실패

**증상**: "메타데이터를 찾을 수 없습니다"

**해결 방법**:
- CSV 파일이 Git에 포함되어 있는지 확인
- 서버 시작 시 자동으로 메타데이터가 생성됩니다
- Render 로그에서 메타데이터 생성 메시지 확인

**메타데이터 경로 문제**:
- 메타데이터에 절대 경로가 저장되어 있으면 Render에서 작동하지 않음
- `tools/scan_and_export.py`를 실행하여 상대 경로로 재생성 필요
- 또는 `backend/app/core/registry.py`가 자동으로 경로를 정규화함 (filename 사용)

#### 5. 환경 변수 문제

**증상**: `PYTHONPATH` 오류

**해결 방법**:
- Environment Variables에서 `PYTHONPATH=.` 설정 확인
- 대소문자 구분 확인 (`PYTHONPATH` 정확히 입력)

### 프론트엔드 배포 문제

#### 1. 빌드 실패

**증상**: `npm run build` 실패

**해결 방법**:
- TypeScript 오류 확인: `frontend/src/vite-env.d.ts` 파일 존재 확인
- Vercel 빌드 로그에서 구체적인 오류 메시지 확인
- 로컬에서 `npm run build` 테스트

#### 2. API 연결 실패

**증상**: 프론트엔드에서 백엔드 API를 호출하지 못함

**해결 방법**:
- `VITE_API_BASE` 환경 변수 확인
- 백엔드 URL이 정확한지 확인 (슬래시 없이)
- 브라우저 개발자 도구 → Console 탭에서 CORS 오류 확인

#### 3. Root Directory 오류

**증상**: 빌드 파일을 찾을 수 없음

**해결 방법**:
- Root Directory가 `frontend`로 설정되어 있는지 확인
- Vercel 프로젝트 설정에서 Root Directory 확인/수정

#### 4. 환경 변수 미적용

**증상**: 빌드 후에도 환경 변수가 반영되지 않음

**해결 방법**:
- 환경 변수 추가 후 **새 배포 필요**
- Vercel에서 "Redeploy" 클릭
- 또는 코드를 푸시하면 자동 재배포

### 일반적인 문제

#### 1. Free 플랜 슬립 모드

**증상**: 첫 요청이 매우 느림 (30초 이상)

**원인**: Render Free 플랜은 요청이 없으면 서버가 슬립 모드로 전환됩니다.

**해결 방법**:
- 첫 요청은 느릴 수 있습니다 (정상 동작)
- 자주 사용하는 경우 유료 플랜 고려

#### 2. CORS 오류

**증상**: 브라우저 콘솔에서 CORS 오류
```
Origin https://aldlist-sayoon01s-projects.vercel.app is not allowed by Access-Control-Allow-Origin. Status code: 500
```

**원인**: 
- 백엔드에서 500 에러가 발생하면 CORS 헤더가 제대로 전송되지 않음
- 실제로는 CORS 설정 문제가 아니라 백엔드 에러 문제

**해결 방법**:
1. **백엔드 에러 확인**:
   - Render 로그에서 실제 에러 메시지 확인
   - 대부분 CSV 파일 경로 문제일 가능성이 높음
   - 위의 "CSV 파일 경로 오류" 해결 방법 참고

2. **CORS 설정 확인**:
   - 백엔드 코드에서 이미 `allow_origins=["*"]`로 설정되어 있음
   - 백엔드가 정상 작동하면 CORS 문제는 발생하지 않음

3. **백엔드 상태 확인**:
   - `https://aldlist-backend.onrender.com/api/datasets` 직접 접속하여 테스트
   - 정상 작동하면 JSON 데이터가 표시됨

#### 3. 데이터 파일 크기 문제

**증상**: Git 푸시 실패 또는 배포 시간 초과

**해결 방법**:
- CSV 파일이 크면 Git LFS 사용 고려
- 또는 외부 스토리지(S3 등) 사용

---

## 참고 사항

### Render Free 플랜 제약

- **슬립 모드**: 요청 없으면 서버가 잠들어 첫 요청이 느림
- **리소스 제한**: 512MB RAM / 0.1 CPU
- **영구 디스크 없음**: 런타임에서 생성한 파일은 재시작 시 사라짐
  - **해결**: CSV 파일은 Git에 포함되어 배포됨

### Vercel Free 플랜

- **빌드 시간**: 월 6000분 무료
- **대역폭**: 월 100GB 무료
- **HTTPS**: 자동 제공

### 보안 권장사항

1. **환경 변수**: 민감한 정보는 환경 변수로 관리
2. **CORS**: 프로덕션에서는 특정 도메인만 허용하는 것을 권장
3. **API 키**: 외부 API 사용 시 환경 변수로 관리

---

## 다음 단계

1. **도메인 연결** (선택사항)
   - Render: Custom Domain 설정
   - Vercel: Domain 설정

2. **모니터링 설정**
   - Render: Health Checks 설정
   - Vercel: Analytics 설정

3. **CI/CD 자동화**
   - GitHub Actions 설정 (선택사항)
   - 자동 배포는 이미 설정되어 있음

---

## 요약

### 배포 순서

1. **Render 백엔드 배포**
   - Root Directory: `backend`
   - Environment Variables: `PYTHONPATH=.`
   - 백엔드 URL 저장: `https://aldlist-backend.onrender.com`

2. **메타데이터 준비** (중요!)
   - 로컬에서 메타데이터 재생성: `python3 tools/scan_and_export.py`
   - 상대 경로로 저장되는지 확인
   - GitHub에 푸시: `git add metadata/datasets.json && git commit -m "..." && git push`

3. **Vercel 프론트엔드 배포**
   - Root Directory: `frontend`
   - Framework Preset: `Vite`
   - Environment Variables: `VITE_API_BASE=https://aldlist-backend.onrender.com`
   - 배포 URL: `https://aldlist-sayoon01s-projects.vercel.app` (또는 커스텀 도메인)

4. **연결 확인**
   - 프론트엔드에서 백엔드 API 호출 확인
   - 브라우저 개발자 도구 → Network 탭에서 API 요청 확인

### 필수 설정 요약

**Render (백엔드)**:
- Root Directory: `backend`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment Variables: `PYTHONPATH=.`

**Vercel (프론트엔드)**:
- Root Directory: `frontend`
- Framework Preset: `Vite`
- Environment Variables: `VITE_API_BASE=https://aldlist-backend.onrender.com`

---

---

## ✅ 배포 완료 확인

### 실제 배포된 URL

**백엔드 (Render)**:
- URL: `https://aldlist-backend.onrender.com`
- API 문서: `https://aldlist-backend.onrender.com/docs`
- 상태: ✅ 정상 작동

**프론트엔드 (Vercel)**:
- URL: `https://aldlist-sayoon01s-projects.vercel.app`
- 상태: ✅ 정상 작동
- 백엔드 연결: ✅ 정상

### 최종 확인 사항

- [x] 백엔드가 정상적으로 배포됨
- [x] 프론트엔드가 정상적으로 배포됨
- [x] 환경 변수 `VITE_API_BASE`가 올바르게 설정됨
- [x] 메타데이터가 상대 경로로 저장됨
- [x] CSV 파일 경로 문제 해결됨
- [x] 프론트엔드에서 백엔드 API 호출 성공
- [x] 데이터셋 목록이 정상적으로 표시됨
- [x] 데이터 미리보기가 정상적으로 작동함

---

배포 중 문제가 발생하면 위의 트러블슈팅 섹션을 참고하세요.
