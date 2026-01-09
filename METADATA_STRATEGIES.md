# 📋 메타데이터 생성 전략 비교

patterns.yaml을 하드코딩하지 않고 메타데이터를 생성하는 다양한 방법들을 비교합니다.

---

## 현재 방식: patterns.yaml 하드코딩

### 장점
- ✅ 빠름 (파일 읽기만 하면 됨)
- ✅ 안정적 (외부 API 의존 없음)
- ✅ 비용 없음 (LLM API 비용 없음)
- ✅ 오프라인 작동

### 단점
- ❌ 새로운 도메인마다 패턴 추가 필요
- ❌ 유지보수 필요 (패턴 관리)
- ❌ 완벽하지 않음 (모든 컬럼명 패턴 커버 불가)

---

## 대안 1: LLM 기반 자동 생성 (요청 시)

### 개념
사용자가 데이터셋을 업로드하면, 컬럼명 목록을 LLM에 보내서 메타데이터를 생성

### 구현 예시
```python
# backend/app/core/llm_meta.py
import openai  # 또는 다른 LLM API

async def generate_meta_with_llm(columns: List[str]) -> Dict[str, ColumnMeta]:
    prompt = f"""
다음 CSV 컬럼명들의 메타데이터를 생성해주세요:
{', '.join(columns)}

각 컬럼에 대해:
- title: 읽기 쉬운 제목
- desc: 간단한 설명
- type: 데이터 타입 (numeric, text, date, etc.)
- unit: 단위 (있는 경우)

JSON 형식으로 반환해주세요.
"""
    response = await openai.ChatCompletion.create(...)
    return parse_llm_response(response)
```

### 장점
- ✅ 새로운 도메인도 자동 처리
- ✅ 컬럼명만으로도 의미 파악 가능
- ✅ 패턴 추가 불필요

### 단점
- ❌ 느림 (API 호출 시간)
- ❌ 비용 발생 (LLM API 사용료)
- ❌ 외부 의존성 (인터넷 연결 필요)
- ❌ 불안정 (API 다운 시 작동 안 함)
- ❌ 프라이버시 (데이터를 외부로 전송)

---

## 대안 2: 하이브리드 방식 (권장)

### 개념
1. **기본 패턴** (patterns.yaml) - 범용 패턴만 유지
2. **LLM 캐싱** - 한 번 생성한 메타데이터는 저장
3. **사용자 수정** - global_columns.yaml로 수동 보정

### 구현 예시
```python
# 1. 패턴 매칭 시도
meta = generate_meta_for_column(col)  # 기존 방식

# 2. 패턴 매칭 실패 시 LLM 사용 (캐싱)
if meta.get("auto_generated") and meta.get("desc") == "설명 없음":
    cached = get_cached_llm_meta(dataset_id, col)
    if cached:
        meta = cached
    else:
        # LLM 호출 (최초 1회만)
        llm_meta = await generate_meta_with_llm([col])
        cache_llm_meta(dataset_id, col, llm_meta)
        meta = llm_meta

# 3. 사용자가 global_columns.yaml에 추가하면 그것이 최우선
```

### 장점
- ✅ 빠름 (캐싱으로 반복 호출 없음)
- ✅ 비용 절감 (한 번만 생성)
- ✅ 안정적 (패턴 매칭 실패 시에만 LLM 사용)
- ✅ 확장 가능 (새 도메인도 자동 처리)

### 단점
- ⚠️ 초기 비용 (새 데이터셋 첫 로딩 시)
- ⚠️ 외부 의존성 (하지만 선택적)

---

## 대안 3: 사용자 입력 기반

### 개념
UI에서 사용자가 직접 메타데이터 입력/수정

### 구현 예시
```typescript
// 프론트엔드: 컬럼 클릭 시 편집 모달
<ColumnEditModal
  column={activeColumn}
  meta={columnMeta[activeColumn]}
  onSave={(meta) => {
    // global_columns.yaml에 저장
    updateGlobalMeta(activeColumn, meta);
  }}
/>
```

### 장점
- ✅ 정확함 (사용자가 직접 입력)
- ✅ 비용 없음
- ✅ 오프라인 작동

### 단점
- ❌ 수동 작업 필요
- ❌ 시간 소요

---

## 대안 4: 데이터 샘플 기반 추론

### 개념
컬럼명뿐만 아니라 실제 데이터 값도 보고 타입/의미 추론

### 구현 예시
```python
def infer_meta_from_data(col: str, sample_values: List[Any]) -> Dict:
    # 데이터 샘플 분석
    if all(isinstance(v, (int, float)) for v in sample_values):
        if all(0 <= v <= 100 for v in sample_values):
            return {"type": "percent", "unit": "%"}
        elif all(v > 1000 for v in sample_values):
            return {"type": "price", "unit": "원"}
    
    # 날짜 형식 감지
    if all(is_date_like(v) for v in sample_values):
        return {"type": "date"}
    
    # ...
```

### 장점
- ✅ 컬럼명만으로는 알 수 없는 정보도 추론
- ✅ 정확도 향상
- ✅ 외부 의존성 없음

### 단점
- ⚠️ 구현 복잡도 증가
- ⚠️ 샘플 데이터 필요

---

## 🎯 추천 전략

### 단기 (현재)
**patterns.yaml 하드코딩 유지**
- 범용 패턴만 추가 (date, time, id, name, price, count 등)
- fallback 메시지 개선
- 사용자가 필요시 global_columns.yaml에 추가

### 중기 (선택적)
**하이브리드 방식 도입**
- 패턴 매칭 실패 시에만 LLM 사용
- 결과를 캐싱하여 비용 절감
- 사용자가 원할 때만 활성화

### 장기 (확장)
**데이터 샘플 기반 추론 추가**
- 컬럼명 + 데이터 값 분석
- 더 정확한 타입/의미 추론

---

## 💡 결론

**patterns.yaml 하드코딩은 나쁘지 않습니다.**

- ✅ 대부분의 경우 충분함
- ✅ 빠르고 안정적
- ✅ 비용 없음

**LLM은 선택적으로 사용:**
- 새로운 도메인 데이터가 자주 들어올 때
- 패턴으로 커버하기 어려운 복잡한 컬럼명
- 사용자가 원할 때만 활성화

**현재 구조는 이미 확장 가능:**
- `global_columns.yaml`: 수동 정의
- `patterns.yaml`: 패턴 추가
- `datasets/{id}.yaml`: 데이터셋별 오버라이드

필요하면 나중에 LLM 기능을 추가할 수 있지만, 지금은 patterns.yaml로 충분합니다.

