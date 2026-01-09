# Vercel 배포 가이드 (단계별 상세 설명)

이 문서는 ALDList 프로젝트의 **프론트엔드**를 Vercel에 배포하는 방법을 단계별로 설명합니다.

---

## 📋 사전 준비사항

1. ✅ GitHub 저장소에 코드가 푸시되어 있어야 합니다
2. ✅ Vercel 계정이 있어야 합니다 (GitHub 계정으로 가입 가능)
3. ⚠️ **백엔드는 별도로 배포해야 합니다** (Render 등)

---

## 🚀 1단계: Vercel 프로젝트 생성

### 1.1 Vercel 접속 및 로그인

1. [https://vercel.com](https://vercel.com) 접속
2. "Sign Up" 또는 "Log In" 클릭
3. GitHub 계정으로 로그인 (권장)

### 1.2 새 프로젝트 생성

1. Vercel 대시보드에서 **"Add New..."** → **"Project"** 클릭
2. GitHub 저장소 목록에서 **`sayoon01/ALDList`** 선택
3. **"Import"** 클릭

---

## ⚙️ 2단계: 프로젝트 설정

### 2.1 기본 설정

Vercel이 자동으로 감지하지만, 다음 설정을 확인하세요:

#### **Framework Preset**
- **선택**: **"Vite"** (이미 선택되어 있을 수 있음)
- 다른 옵션을 선택했다면 "Vite"로 변경

#### **Root Directory**
- **중요**: `frontend`로 설정해야 합니다!
- "Root Directory" 옆의 **"Edit"** 클릭
- `frontend` 입력 후 **"Continue"**

#### **Project Name**
- 기본값: `ald-list` (원하는 이름으로 변경 가능)
- 예: `aldlist-frontend`, `aldlist`

#### **Vercel Team**
- 개인 계정: "sayoon01's projects"
- 플랜: "Hobby" (무료)

### 2.2 빌드 설정 (자동 감지됨)

Vercel이 `frontend/package.json`을 읽어서 자동으로 설정합니다:

- **Build Command**: `npm run build` ✅
- **Output Directory**: `dist` ✅
- **Install Command**: `npm install` ✅

**확인 방법**: "Build and Output Settings" 섹션에서 확인

---

## 🔧 3단계: 환경 변수 설정

### 3.1 환경 변수 추가

**⚠️ 중요**: 배포 전에 환경 변수를 설정해야 합니다!

1. 프로젝트 설정 화면에서 **"Environment Variables"** 섹션 찾기
2. 또는 배포 후 **Settings** → **Environment Variables**에서 추가 가능

### 3.2 백엔드 URL 설정

**백엔드를 먼저 배포한 경우:**

```
변수명: VITE_API_BASE
값: https://your-backend.onrender.com
```

**예시:**
```
VITE_API_BASE=https://aldlist-backend.onrender.com
```

**백엔드를 아직 배포하지 않은 경우:**

1. 일단 빈 값으로 두거나 임시 URL 설정
2. 백엔드 배포 후 실제 URL로 업데이트

**환경 변수 추가 방법:**
1. "Environment Variables" 섹션에서 **"Add"** 클릭
2. **Name**: `VITE_API_BASE` 입력
3. **Value**: 백엔드 URL 입력 (예: `https://aldlist-backend.onrender.com`)
4. **Environment**: Production, Preview, Development 모두 선택 (또는 Production만)
5. **"Save"** 클릭

---

## 🚀 4단계: 배포 실행

### 4.1 배포 시작

1. 모든 설정 확인 후 **"Deploy"** 버튼 클릭
2. 빌드 로그가 실시간으로 표시됩니다

### 4.2 빌드 과정 확인

빌드 중 다음 단계가 진행됩니다:

1. **Installing dependencies**: `npm install` 실행
2. **Building**: `npm run build` 실행
3. **Deploying**: 정적 파일 업로드

**예상 시간**: 1-3분

### 4.3 배포 완료

배포가 완료되면:

- ✅ **"Congratulations!"** 메시지 표시
- 🌐 배포된 URL 확인 (예: `https://ald-list.vercel.app`)
- 🔗 **"Visit"** 버튼 클릭하여 사이트 확인

---

## ✅ 5단계: 배포 확인

### 5.1 사이트 접속

1. Vercel이 제공한 URL로 접속 (예: `https://ald-list.vercel.app`)
2. 페이지가 정상적으로 로드되는지 확인

### 5.2 기능 테스트

1. **데이터셋 목록**: 데이터셋이 표시되는지 확인
2. **데이터 미리보기**: 데이터가 로드되는지 확인
3. **통계 계산**: 통계가 정상적으로 계산되는지 확인

### 5.3 API 연결 확인

**문제가 있는 경우:**

1. 브라우저 개발자 도구 (F12) → Console 탭 확인
2. Network 탭에서 API 요청 확인
3. `VITE_API_BASE` 환경 변수가 올바르게 설정되었는지 확인

---

## 🔄 6단계: 자동 배포 설정

### 6.1 Git 연동 확인

Vercel은 GitHub와 자동으로 연동됩니다:

- ✅ `main` 브랜치에 푸시하면 자동 배포
- ✅ Pull Request 생성 시 Preview 배포

### 6.2 배포 브랜치 설정

**Settings** → **Git** → **Production Branch**:
- 기본값: `main` (변경 불필요)

---

## 🛠️ 7단계: 문제 해결

### 문제 1: 빌드 실패

**증상**: "Build Failed" 오류

**해결 방법:**
1. 빌드 로그 확인 (어떤 단계에서 실패했는지)
2. `frontend/package.json`의 `build` 스크립트 확인
3. TypeScript 오류가 있는지 확인 (`tsc` 실행)

**일반적인 원인:**
- TypeScript 타입 오류
- 의존성 설치 실패
- 환경 변수 누락

### 문제 2: API 연결 실패

**증상**: "API Error" 또는 데이터가 로드되지 않음

**해결 방법:**
1. **환경 변수 확인**:
   - `VITE_API_BASE`가 올바르게 설정되었는지
   - 백엔드 URL이 올바른지 (끝에 `/` 없어야 함)

2. **CORS 확인**:
   - 백엔드 CORS 설정이 `allow_origins=["*"]`인지 확인
   - 또는 Vercel 도메인을 명시적으로 허용

3. **백엔드 상태 확인**:
   ```bash
   curl https://your-backend.onrender.com/api/datasets
   ```

### 문제 3: Root Directory 오류

**증상**: "Cannot find module" 또는 빌드 경로 오류

**해결 방법:**
1. **Root Directory**가 `frontend`로 설정되었는지 확인
2. Settings → General → Root Directory 확인
3. `frontend`로 변경 후 재배포

### 문제 4: 환경 변수 적용 안 됨

**증상**: 환경 변수를 설정했지만 반영되지 않음

**해결 방법:**
1. 환경 변수 설정 후 **재배포** 필요
2. Settings → Environment Variables에서 값 확인
3. Production, Preview, Development 모두 설정했는지 확인

---

## 📝 8단계: 커스텀 도메인 설정 (선택사항)

### 8.1 도메인 추가

1. Vercel 대시보드 → **Settings** → **Domains**
2. 원하는 도메인 입력 (예: `aldlist.com`)
3. DNS 설정 안내에 따라 도메인 제공자에서 설정

### 8.2 SSL 인증서

- Vercel이 자동으로 SSL 인증서를 발급합니다 (Let's Encrypt)
- HTTPS가 자동으로 활성화됩니다

---

## 🔗 9단계: 백엔드와 연결

### 9.1 백엔드 배포 (Render 예시)

1. [Render](https://render.com)에서 백엔드 배포
2. 백엔드 URL 확인 (예: `https://aldlist-backend.onrender.com`)

### 9.2 프론트엔드 환경 변수 업데이트

1. Vercel → Settings → Environment Variables
2. `VITE_API_BASE` 값을 백엔드 URL로 업데이트
3. **"Save"** 후 자동 재배포 또는 수동 재배포

### 9.3 연결 확인

1. 프론트엔드 사이트 접속
2. 데이터셋 목록이 표시되는지 확인
3. 브라우저 개발자 도구 → Network 탭에서 API 요청 확인

---

## 📊 10단계: 모니터링 및 관리

### 10.1 배포 히스토리

- Vercel 대시보드 → **Deployments** 탭
- 모든 배포 기록 확인 가능
- 이전 버전으로 롤백 가능

### 10.2 로그 확인

- 각 배포의 **"View Function Logs"** 클릭
- 실시간 로그 확인 가능

### 10.3 성능 모니터링

- Vercel Analytics (유료 플랜)
- Web Vitals 모니터링

---

## ✅ 체크리스트

배포 전 확인사항:

- [ ] GitHub에 코드가 푸시되어 있음
- [ ] `frontend/package.json`에 `build` 스크립트가 있음
- [ ] `frontend/vite.config.ts`가 올바르게 설정됨
- [ ] Root Directory가 `frontend`로 설정됨
- [ ] Framework Preset이 `Vite`로 설정됨
- [ ] `VITE_API_BASE` 환경 변수 설정 (백엔드 URL)
- [ ] 백엔드가 배포되어 있고 접근 가능함 (또는 임시 URL)

---

## 🎉 완료!

배포가 완료되면:

1. ✅ 프론트엔드: `https://your-project.vercel.app`
2. ✅ 백엔드: `https://your-backend.onrender.com` (별도 배포 필요)
3. ✅ 자동 배포: `main` 브랜치 푸시 시 자동 배포

---

## 📚 추가 리소스

- [Vercel 공식 문서](https://vercel.com/docs)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)
- [환경 변수 설정](https://vercel.com/docs/concepts/projects/environment-variables)

---

**문제가 있으면 Vercel 대시보드의 로그를 확인하거나 이슈를 등록해주세요!**




