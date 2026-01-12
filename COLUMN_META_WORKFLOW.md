# Column Meta 워크플로우 상세 설명

이 문서는 `column_meta/` 디렉토리가 프로젝트에서 어떻게 사용되는지, 전체 워크플로우를 상세히 설명합니다.

---

## 📁 디렉토리 구조

```
column_meta/
├── global_columns.yaml      # 전역 컬럼 메타데이터 (수동 정의)
├── patterns.yaml            # 패턴 기반 자동 생성 규칙
└── datasets/                # 데이터셋별 오버라이드 (선택사항)
    └── {dataset_id}.yaml    # 특정 데이터셋의 컬럼 메타데이터 오버라이드
```

---

## 🔄 전체 워크플로우

### 1단계: 백엔드 시작 시 메타데이터 준비

**시작점**: `backend/app/main.py` - `startup_event()`

```python
@app.on_event("startup")
async def startup_event():
    """서버 시작 시 메타데이터 자동 확인"""
    ensure_metadata()  # metadata/datasets.json 생성/업데이트
```

이 단계에서는:
- CSV 파일을 스캔하여 `metadata/datasets.json` 생성
- **중요**: `column_meta/`는 아직 로드되지 않음 (필요할 때만 로드)

---

### 2단계: 프론트엔드에서 데이터셋 선택

**프론트엔드**: `frontend/src/App.tsx`

사용자가 데이터셋을 선택하면:

```typescript
// 1. 데이터 미리보기 먼저 로드 (빠른 UX)
getPreview(selectedDatasetId, offset, limit)
  .then((previewData) => {
    const keys = data.columns || Object.keys(data.rows[0]);
    setAllColumns(keys);  // 모든 컬럼 목록 저장
    setRowData(data.rows); // 데이터 표시
  });

// 2. 메타데이터는 나중에 로드 (표는 이미 보여줌)
fetchDatasetColumns(selectedDatasetId)
  .then((columnsData) => {
    setColumnMeta(columnsData.meta);  // 메타데이터 저장
  });
```

**API 호출**: `GET /api/datasets/{dataset_id}/columns`

---

### 3단계: 백엔드 API 엔드포인트 처리

**백엔드**: `backend/app/api/datasets.py` - `get_dataset_columns()`

```python
@router.get("/{dataset_id}/columns")
def get_dataset_columns(dataset_id: str) -> Dict[str, Any]:
    from ..core.column_meta import build_meta_map
    
    ds = get_dataset(dataset_id)  # registry에서 데이터셋 정보 가져오기
    columns = ds.columns  # 컬럼 목록 (예: ["TempAct_U", "PressAct", ...])
    
    # ⭐ 핵심: build_meta_map() 호출
    meta = build_meta_map(dataset_id, list(columns))
    
    return {
        "dataset_id": dataset_id,
        "columns": list(columns),
        "meta": meta,  # 모든 컬럼에 대한 메타데이터
    }
```

---

### 4단계: 메타데이터 병합 (우선순위 처리)

**백엔드**: `backend/app/core/column_meta.py` - `build_meta_map()`

이 함수가 **가장 중요한 역할**을 합니다:

```python
def build_meta_map(dataset_id: str, columns: list[str]) -> Dict[str, Dict[str, Any]]:
    """
    우선순위:
    1. Dataset override (최우선) - column_meta/datasets/{dataset_id}.yaml
    2. Global meta - column_meta/global_columns.yaml
    3. Patterns 자동 생성 (fallback 포함) - column_meta/patterns.yaml
    """
    global_meta = load_global_meta()           # 1) Global YAML 로드
    override_meta = load_dataset_override(dataset_id)  # 2) Dataset override 로드
    
    result = {}
    for c in columns:
        # 3) Patterns로 기본 메타데이터 생성
        base = generate_meta_for_column(c)
        
        # 4) Global meta 병합 (Global이 우선)
        if c in global_meta:
            base = {**base, **global_meta[c], "key": c, "auto_generated": False}
        
        # 5) Dataset override 병합 (최우선)
        if c in override_meta:
            base = {**base, **override_meta[c], "key": c, "auto_generated": False}
        
        result[c] = base  # 모든 컬럼에 대해 메타데이터가 항상 존재
    
    return result
```

#### 4-1. Global Meta 로드

**파일**: `column_meta/global_columns.yaml`

```yaml
APCValveMon:
  title: "APC Angle"
  name_ko: "APC 밸브 각도"
  name_en: "APC valve angle"
  type: "apc"
  category: "control"
  unit: "%"
  importance: "A"
  desc: "가스 주입 시 압력 제어를 위해 밸브 각도를 조절..."
```

**함수**: `load_global_meta()`
- YAML 파일을 파싱하여 딕셔너리로 변환
- 키: 컬럼명, 값: 메타데이터 딕셔너리

#### 4-2. Dataset Override 로드

**파일**: `column_meta/datasets/{dataset_id}.yaml` (선택사항)

예시: `column_meta/datasets/ds_6bbc5f246568.yaml`

```yaml
VG11:
  title: "VG2 Pressure"
  desc: "프로세스 외 구간 확인용 압력..."
```

**함수**: `load_dataset_override(dataset_id)`
- 데이터셋별로 특정 컬럼의 메타데이터를 오버라이드할 수 있음
- 파일이 없으면 빈 딕셔너리 반환

#### 4-3. Patterns 자동 생성

**파일**: `column_meta/patterns.yaml`

```yaml
zones:
  U: "Upper"
  CU: "Center-Upper"
  C: "Center"
  CL: "Center-Lower"
  L: "Lower"

patterns:
  - match: '^TempAct_(U|CU|C|CL|L)$'
    meta:
      type: temperature
      unit: "℃"
      title: "Temp Actual {zone}"
      desc: "챔버 온도 실제값(Actual) - {zone} zone"
```

**함수**: `generate_meta_for_column(col)`
- 정규식 패턴과 컬럼명을 매칭
- 매칭되면 템플릿 문자열에서 토큰 치환 (`{zone}`, `{idx}`, `{name}` 등)
- 매칭되지 않으면 `fallback` 메타데이터 사용

**예시**:
- `TempAct_U` → 패턴 `^TempAct_(U|CU|C|CL|L)$` 매칭
- `groups = ("U",)`
- `zones["U"] = "Upper"`
- `title: "Temp Actual Upper"` 생성

---

### 5단계: 프론트엔드에서 메타데이터 사용

**프론트엔드**: `frontend/src/App.tsx`

#### 5-1. 컬럼 헤더 툴팁

```typescript
const m = columnMeta[k];  // 메타데이터 가져오기
const headerTooltip = m?.desc
  ? `${m.desc}${m.unit ? ` (${m.unit})` : ""}${m.auto_generated ? " [auto]" : ""}`
  : k;

// AG Grid 헤더에 툴팁 설정
colDef.headerTooltip = headerTooltip;
```

**사용자 경험**:
- 그리드 헤더에 마우스를 올리면 설명이 툴팁으로 표시
- 예: `APCValveMon` → "가스 주입 시 압력 제어를 위해 밸브 각도를 조절... (%)"

#### 5-2. 컬럼 상세 패널

```typescript
const m = columnMeta[activeColumn];
const title = m?.title ?? activeColumn;

// 오른쪽 패널에 상세 정보 표시
<div>
  <div>{title}</div>  {/* "APC Angle" */}
  <div>{m?.desc}</div>  {/* 설명 */}
  <div>유형: {m?.type}</div>  {/* "apc" */}
  <div>단위: {m?.unit}</div>  {/* "%" */}
  {/* ... */}
</div>
```

**사용자 경험**:
- 그리드 헤더 클릭 또는 왼쪽 컬럼 리스트 클릭 시
- 오른쪽 패널에 컬럼의 상세 메타데이터 표시

#### 5-3. 컬럼 검색 기능

```typescript
// 검색 필터
const filteredColumns = allColumns.filter((col) => {
  const m = columnMeta[col];
  const searchLower = columnSearchQuery.toLowerCase();
  return (
    col.toLowerCase().includes(searchLower) ||
    m?.title?.toLowerCase().includes(searchLower) ||
    m?.desc?.toLowerCase().includes(searchLower) ||
    m?.name_ko?.toLowerCase().includes(searchLower) ||
    m?.name_en?.toLowerCase().includes(searchLower)
  );
});
```

**사용자 경험**:
- 컬럼 검색 시 원본 컬럼명뿐만 아니라 메타데이터(title, desc, name_ko, name_en)에서도 검색

---

## 📊 실제 예시: 컬럼 `APCValveMon`의 메타데이터 생성 과정

### 시나리오 1: Global Meta만 있는 경우

1. **Patterns 매칭**:
   - `APCValveMon` → 패턴 `^(APCValveMon|APCValveSet)$` 매칭
   - 기본 메타데이터 생성: `{title: "APCValveMon", desc: "APC 밸브 값(모니터/설정)", auto_generated: true}`

2. **Global Meta 병합**:
   - `global_columns.yaml`에 `APCValveMon` 정의 존재
   - 병합: `{title: "APC Angle", desc: "가스 주입 시...", unit: "%", importance: "A", auto_generated: false}`

3. **Dataset Override 확인**:
   - `datasets/{dataset_id}.yaml`에 `APCValveMon` 없음
   - 최종 메타데이터는 Global Meta 사용

4. **프론트엔드 표시**:
   - 툴팁: "가스 주입 시 압력 제어를 위해 밸브 각도를 조절... (%)"
   - 상세 패널: "APC Angle" (제목), 설명, 유형, 단위 등 표시

### 시나리오 2: Pattern만 있는 경우 (Global Meta 없음)

1. **Patterns 매칭**:
   - `TempAct_U` → 패턴 `^TempAct_(U|CU|C|CL|L)$` 매칭
   - `groups = ("U",)`, `zones["U"] = "Upper"`
   - 메타데이터 생성: `{title: "Temp Actual Upper", desc: "챔버 온도 실제값(Actual) - Upper zone", auto_generated: true}`

2. **Global Meta 확인**:
   - `global_columns.yaml`에 `TempAct_U` 없음
   - 패턴에서 생성한 메타데이터 그대로 사용

3. **Dataset Override 확인**:
   - 없음

4. **프론트엔드 표시**:
   - 툴팁: "챔버 온도 실제값(Actual) - Upper zone (℃) [auto]"
   - `[auto]` 표시로 자동 생성된 메타데이터임을 알림

### 시나리오 3: Dataset Override가 있는 경우

1. **Patterns 매칭**: 기본 메타데이터 생성
2. **Global Meta 병합**: Global에 정의되어 있으면 병합
3. **Dataset Override 병합**: 
   - `datasets/{dataset_id}.yaml`에 해당 컬럼 정의 존재
   - **최우선으로 적용**: Global과 Pattern을 덮어씀

---

## 🎯 우선순위 요약

```
1. Dataset Override (최우선)
   └─ column_meta/datasets/{dataset_id}.yaml
   
2. Global Meta
   └─ column_meta/global_columns.yaml
   
3. Patterns 자동 생성 (Fallback 포함)
   └─ column_meta/patterns.yaml
```

**중요**: 모든 컬럼에 대해 메타데이터가 **항상 존재**합니다. 
- Global이나 Override에 없어도 Patterns에서 자동 생성
- Patterns에서도 매칭되지 않으면 `fallback` 메타데이터 사용

---

## 🔧 메타데이터 수정 방법

### 방법 1: Global Meta 수정 (전역 적용)

`column_meta/global_columns.yaml` 파일 편집:

```yaml
APCValveMon:
  title: "APC Angle (수정됨)"
  desc: "수정된 설명..."
```

**효과**: 모든 데이터셋에서 해당 컬럼의 메타데이터가 업데이트됨

### 방법 2: Dataset Override 추가 (특정 데이터셋만)

`column_meta/datasets/{dataset_id}.yaml` 파일 생성/편집:

```yaml
APCValveMon:
  title: "특정 데이터셋용 APC Angle"
  desc: "이 데이터셋에서만 다른 설명 사용"
```

**효과**: 해당 데이터셋에서만 다른 메타데이터 사용

### 방법 3: Pattern 추가 (자동 생성 규칙)

`column_meta/patterns.yaml` 파일 편집:

```yaml
patterns:
  - match: '^NewColumn_(.+)$'
    meta:
      type: custom
      title: "New Column {name}"
      desc: "새로운 컬럼 패턴 - {name}"
```

**효과**: 해당 패턴에 매칭되는 모든 컬럼에 자동으로 메타데이터 생성

---

## 📈 성능 최적화

### Lazy Loading (지연 로딩)

- `column_meta/` 파일들은 **API 요청 시에만** 로드됨
- 백엔드 시작 시에는 로드하지 않음
- 필요한 데이터셋의 메타데이터만 로드

### 캐싱

- `build_meta_map()`은 요청마다 실행 (매우 빠름)
- YAML 파일 파싱은 메모리에 캐싱 가능 (현재는 매번 파싱)
- 향후 개선 가능: YAML 파싱 결과 메모리 캐싱

---

## 🔍 디버깅 팁

### 메타데이터가 표시되지 않는 경우

1. **파일 경로 확인**:
   ```bash
   ls -la column_meta/
   ls -la column_meta/datasets/
   ```

2. **YAML 문법 확인**:
   ```bash
   python3 -c "import yaml; yaml.safe_load(open('column_meta/global_columns.yaml'))"
   ```

3. **API 응답 확인**:
   ```bash
   curl http://localhost:8000/api/datasets/{dataset_id}/columns
   ```

4. **백엔드 로그 확인**:
   - YAML 로드 실패 시 경고 메시지 출력
   - 예: `⚠️  YAML 로드 실패 ({path}): {error}`

### 메타데이터 우선순위 확인

1. 브라우저 개발자 도구에서 API 응답 확인
2. `auto_generated: true` → Patterns에서 생성
3. `auto_generated: false` → Global 또는 Override에서 로드

---

## 📝 요약

1. **컬럼 메타데이터는 3단계 우선순위로 병합됨**
   - Dataset Override (최우선) > Global Meta > Patterns 자동 생성

2. **모든 컬럼에 대해 메타데이터가 항상 존재**
   - Global이나 Override에 없어도 Patterns에서 자동 생성

3. **프론트엔드에서 메타데이터 활용**
   - 헤더 툴팁, 컬럼 상세 패널, 검색 기능

4. **수정 방법**
   - Global Meta 수정 → 모든 데이터셋에 적용
   - Dataset Override 추가 → 특정 데이터셋만 다르게 설정
   - Pattern 추가 → 자동 생성 규칙 확장

5. **성능**
   - Lazy Loading으로 필요한 시점에만 로드
   - API 요청 시에만 YAML 파일 파싱

