# 배포 가이드 (Deployment Guide)

이 문서는 ALDList 프로젝트를 Render(백엔드)와 Vercel/Netlify(프론트엔드)에 배포하는 방법을 설명합니다.

---

## 📋 목차

1. [백엔드 배포 (Render)](#1-백엔드-배포-render)
2. [프론트엔드 배포 (Vercel/Netlify)](#2-프론트엔드-배포-vercelnetlify)
3. [데이터 파일 처리 방법](#3-데이터-파일-처리-방법)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [배포 후 확인](#5-배포-후-확인)

---

## 1. 백엔드 배포 (Render)

#### 1.1 Render 계정 생성 및 서비스 생성

1. [Render](https://render.com)에 가입/로그인
2. "New +" → "Web Service" 선택
3. GitHub 저장소 연결 및 선택

#### 1.2 서비스 설정

- **Name**: `aldlist-backend` (원하는 이름)
- **Root Directory**: `backend`
- **Environment**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - 또는 `Procfile` 사용 (자동 감지)

#### 1.3 환경 변수 설정

Render 대시보드 → Environment 탭에서 설정:

```
PORT=10000  # Render가 자동으로 설정 (필요 시 명시)
PYTHONPATH=.
DATA_DIR=/opt/render/project/src/data  # 선택사항
META_DIR=/opt/render/project/src/metadata  # 선택사항
```

#### 1.4 데이터 파일 업로드

Render는 **ephemeral 디스크**를 사용하므로, 런타임에 추가된 파일은 재시작 시 사라집니다.

**권장 방법:**
1. Git에 CSV 파일 포함 (소규모)
2. 외부 스토리지 사용 (대용량)
3. Render Disk 사용 (유료 플랜)

---

## 2. 프론트엔드 배포 (Vercel/Netlify)

### 2.1 Vercel 배포

#### 2.1.1 Vercel 계정 생성 및 프로젝트 생성

1. [Vercel](https://vercel.com)에 가입/로그인
2. "Add New..." → "Project" 선택
3. GitHub 저장소 연결 및 선택

#### 2.1.2 프로젝트 설정

- **Framework Preset**: `Vite`
- **Root Directory**: `frontend`
- **Build Command**: `npm run build` (자동 감지)
- **Output Directory**: `dist` (자동 감지)
- **Install Command**: `npm install` (자동 감지)

#### 2.1.3 환경 변수 설정

Vercel 대시보드 → Settings → Environment Variables:

```
VITE_API_BASE=https://your-backend.onrender.com
```

**참고**: 백엔드 배포 후 실제 URL로 변경

#### 2.1.4 배포

1. "Deploy" 클릭
2. 배포 완료 후 도메인 확인 (예: `https://aldlist.vercel.app`)

---

### 2.2 Netlify 배포

#### 2.2.1 Netlify 계정 생성 및 사이트 생성

1. [Netlify](https://netlify.com)에 가입/로그인
2. "Add new site" → "Import an existing project" 선택
3. GitHub 저장소 연결 및 선택

#### 2.2.2 빌드 설정

- **Base directory**: `frontend`
- **Build command**: `npm run build`
- **Publish directory**: `frontend/dist`

#### 2.2.3 환경 변수 설정

Netlify 대시보드 → Site settings → Environment variables:

```
VITE_API_BASE=https://your-backend.onrender.com
```

#### 2.2.4 배포

1. "Deploy site" 클릭
2. 배포 완료 후 도메인 확인 (예: `https://aldlist.netlify.app`)

---

## 3. 데이터 파일 처리 방법

### 3.1 문제점

클라우드 플랫폼(Render)은 **ephemeral 디스크**를 사용합니다:
- 런타임에 추가/수정된 파일은 재시작 시 사라짐
- Git에 포함되지 않은 파일은 배포 시 포함되지 않음

### 3.2 해결 방법

#### 방법 1: Git에 포함 (소규모 데이터, < 100MB)

```bash
# CSV 파일을 Git에 추가
git add data/*.csv
git commit -m "Add CSV data files"
git push
```

**장점**: 간단, 자동 배포  
**단점**: 저장소 크기 증가, Git 히스토리 비대화

#### 방법 2: 외부 스토리지 (권장, 대용량 데이터)

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

## 4. 환경 변수 설정

### 4.1 백엔드 환경 변수

| 변수명 | 설명 | 기본값 | 필수 |
|--------|------|--------|------|
| `PORT` | 서버 포트 | 플랫폼 자동 설정 | ❌ |
| `PYTHONPATH` | Python 경로 | `.` | ❌ |
| `DATA_DIR` | CSV 파일 디렉토리 | `프로젝트루트/data` | ❌ |
| `META_DIR` | 메타데이터 디렉토리 | `프로젝트루트/metadata` | ❌ |

### 4.2 프론트엔드 환경 변수

| 변수명 | 설명 | 기본값 | 필수 |
|--------|------|--------|------|
| `VITE_API_BASE` | 백엔드 API URL | `''` (프록시 사용) | ❌ |

**개발 환경**: `VITE_API_BASE` 비워두면 Vite 프록시 사용  
**프로덕션**: 백엔드 배포 URL 설정 (예: `https://aldlist-backend.onrender.com`)

---

## 5. 배포 후 확인

### 5.1 백엔드 확인

```bash
# API 정보 확인
curl https://your-backend.onrender.com/

# 데이터셋 목록 확인
curl https://your-backend.onrender.com/api/datasets

# API 문서 확인
# 브라우저에서 https://your-backend.onrender.com/docs 접속
```

### 5.2 프론트엔드 확인

1. 브라우저에서 프론트엔드 URL 접속
2. 데이터셋 목록이 표시되는지 확인
3. 데이터 미리보기 및 통계 계산 기능 테스트

### 5.3 CORS 확인

백엔드 CORS 설정이 `allow_origins=["*"]`로 되어 있으므로, 프론트엔드 도메인에서 API 호출이 가능합니다.

**프로덕션 권장**: 특정 도메인만 허용하도록 수정:

```python
# backend/app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-frontend.vercel.app",
        "https://your-frontend.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 6. 트러블슈팅

### 6.1 백엔드가 시작되지 않음

- **원인**: `PORT` 환경 변수 미설정
- **해결**: 플랫폼이 자동 설정하거나 `Procfile` 확인

### 6.2 데이터셋 목록이 비어있음

- **원인**: CSV 파일이 배포 환경에 없음
- **해결**: 데이터 파일 처리 방법 참고 (3장)

### 6.3 프론트엔드에서 API 호출 실패

- **원인**: `VITE_API_BASE` 환경 변수 미설정 또는 잘못된 URL
- **해결**: 백엔드 URL 확인 및 환경 변수 재설정

### 6.4 CORS 오류

- **원인**: 백엔드 CORS 설정 문제
- **해결**: `allow_origins`에 프론트엔드 도메인 추가

---

## 7. 추가 리소스

- [Render 문서](https://render.com/docs)
- [Vercel 문서](https://vercel.com/docs)
- [Netlify 문서](https://docs.netlify.com)

---

**문의사항이나 문제가 있으면 이슈를 등록해주세요!**

