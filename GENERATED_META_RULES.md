# global_columns.generated.yaml 생성 규칙

이 문서는 `column_meta/global_columns.generated.yaml` 파일이 어떻게 생성되는지, 어떤 규칙이 적용되는지 설명합니다.

## 📁 생성 규칙 위치

### 1. 메인 생성 스크립트: `tools/generate_meta.py`

이 파일에 여러 생성 메서드가 있습니다:

- **`generate_by_patterns()`** (라인 278-321) - **가장 많이 사용됨** (scan_metadata.sh에서 호출)
- `generate_by_inference()` (라인 324-350) - 컬럼명 패턴 추론 기반
- `generate_by_frequency()` (라인 615-679) - 빈도 기반 seed 생성
- `generate_by_heuristic()` (라인 486-612) - 휴리스틱 기반 생성

### 2. 패턴 규칙 정의: `column_meta/patterns.yaml`

정규식 패턴과 메타데이터 템플릿이 정의되어 있습니다.

### 3. 패턴 매칭 엔진: `backend/app/core/column_meta.py`

`generate_meta_for_column()` 함수가 실제 패턴 매칭을 수행합니다.

### 4. 보강 스크립트: `tools/enrich_generated_from_profiles.py`

프로필 데이터를 활용하여 메타데이터를 보강합니다.

---

## 🔧 생성 규칙 상세

### 방법 1: patterns.yaml 기반 생성 (권장)

**실행:**
```bash
python3 tools/generate_meta.py --method patterns
```

**규칙 위치:** `tools/generate_meta.py`의 `generate_by_patterns()` 함수

**실제 구현 코드:**

```python
def generate_by_patterns() -> None:
    """patterns.yaml 기반 메타데이터 생성"""
    cols = load_columns_union()
    global_meta = safe_load_yaml(GLOBAL_PATH)

    # 기존 generated가 있으면 이어서 업데이트 (덮어쓰지 않고 누적)
    generated_old = safe_load_yaml(GENERATED_PATH)
    out: Dict[str, Any] = dict(generated_old)

    created = 0
    updated = 0

    for c in cols:
        # global에 이미 있으면 generated로 만들 필요 없음
        if c in global_meta:
            continue

        base = generate_meta_for_column(c)  # patterns.yaml 기반 (하드코딩 없음)
        # enrich_desc_rule_based() 제거: 모든 규칙은 patterns.yaml에서 관리

        # generated는 "초안"이라 auto_generated 유지 가능
        base.pop("key", None)
        base.pop("auto_generated", None)

        if c not in out:
            out[c] = base
            created += 1
        else:
            # 기존 초안이 있으면 업데이트
            out[c] = {**out[c], **base}
            updated += 1

    write_yaml(GENERATED_PATH, out)
```

**핵심 규칙:**

1. **입력**: `metadata/columns_union.json` (모든 컬럼 목록)
2. **제외 조건**: `global_columns.yaml`에 이미 정의된 컬럼은 제외
3. **생성 방법**: `backend/app/core/column_meta.py`의 `generate_meta_for_column()` 호출
4. **패턴 매칭**: `patterns.yaml`의 정규식 패턴과 매칭
5. **템플릿 치환**: `{zone}`, `{idx}`, `{name}`, `{part}` 등의 토큰 치환
6. **Fallback**: 패턴이 매칭되지 않으면 `patterns.yaml`의 `fallback` 메타데이터 사용

---

### 방법 2: 컬럼명 패턴 추론 기반 생성

**실행:**
```bash
python3 tools/generate_meta.py --method inference
```

**규칙 위치:** `tools/generate_meta.py`의 `infer_meta()` 함수 (라인 156-275)

**주요 규칙:**

```python
def infer_meta(col: str) -> Dict[str, Any]:
    """컬럼명을 기반으로 기본 메타데이터 추론"""
    meta: Dict[str, Any] = {
        "title": col,
        "type": "unknown",
        "category": "unknown",
        "equipment_field": col,
        "unit": "",
        "desc": "자동 생성된 컬럼 설명. 추후 보완 필요."
    }

    # MFC 관련 (가스 유량)
    if col.startswith("MFC"):
        meta["type"] = "gas"
        meta["category"] = "process"
        meta["unit"] = "SLM"
        meta["desc"] = f"{col}은 반도체 장비에서 사용되는 가스 유량 관련 필드입니다..."

    # Temperature 관련
    elif col.startswith("Temp"):
        meta["type"] = "temperature"
        meta["category"] = "process"
        meta["unit"] = "℃"
        if "Act" in col:
            meta["desc"] = "반도체 공정 중 챔버 또는 히터의 온도 실제 측정값입니다."
        elif "Set" in col or "Targ" in col:
            meta["desc"] = "반도체 공정 중 챔버 또는 히터의 온도 설정값(목표값)입니다."
        else:
            meta["desc"] = "반도체 공정 중 챔버 또는 히터의 온도 관련 필드입니다."

    # Pressure 관련
    elif col.startswith("Press") or col.startswith("VG") or col.startswith("APC"):
        meta["type"] = "pressure"
        # ... (상세 규칙)

    # Valve 관련
    elif col.startswith("Valve"):
        meta["type"] = "valve"
        # ... (상세 규칙)

    # AUX (보조 센서) 관련
    elif col.startswith("AUX"):
        meta["type"] = "aux"
        # ... (상세 규칙)

    return meta
```

**규칙 요약:**
- `MFC*` → type: gas, unit: SLM
- `Temp*` → type: temperature, unit: ℃
- `Press*`, `VG*`, `APC*` → type: pressure, unit: Torr
- `Valve*` → type: valve
- `AUX*` → type: aux
- `HeaterTC*`, `CascadeTC*` → type: temperature
- `Power*` → type: heater, unit: %
- `Date`, `Time` → type: timestamp
- `Recipe*`, `Step*` → type: recipe
- `No.` → type: index

---

### 방법 3: 빈도 기반 seed 생성

**실행:**
```bash
python3 tools/generate_meta.py --method frequency
```

**규칙 위치:** `tools/generate_meta.py`의 `generate_by_frequency()` 함수 (라인 615-679)

**규칙:**
- `columns_by_file.json`에서 컬럼 출현 빈도 계산
- 빈도가 높은 컬럼부터 seed 생성
- `global_columns.yaml`에 이미 있는 컬럼은 제외
- 기본 메타데이터만 생성 (type: unknown, desc: "[AUTO-SEED] 파일 N개에서 발견됨")

---

### 방법 4: 휴리스틱 기반 생성

**실행:**
```bash
python3 tools/generate_meta.py --method heuristic
```

**규칙 위치:** `tools/generate_meta.py`의 `infer_from_name()` 함수 (라인 353-419)

**규칙:**
- 컬럼명 키워드 기반 추론
- confidence 점수 부여
- 리포트 자동 생성 (`metadata/reports/column_meta_suggestions.json`, `.md`)

---

## 📋 패턴 규칙 정의 (`column_meta/patterns.yaml`)

**파일 위치:** `column_meta/patterns.yaml`

**주요 구조:**

```yaml
zones:
  U: "Upper"
  CU: "Center-Upper"
  C: "Center"
  CL: "Center-Lower"
  L: "Lower"

patterns:
  # Temperature actual/set
  - match: '^TempAct_(U|CU|C|CL|L)$'
    meta:
      type: temperature
      unit: "℃"
      title: "Temp Actual {zone}"
      desc: "챔버 온도 실제값(Actual) - {zone} zone"

  # MFC 관련
  - match: '^MFCMon_(.+)$'
    meta:
      type: gas
      unit: "SLM"
      title: "MFC Monitor {name}"
      desc: "MFC 유량 모니터링 값 - {name}"

fallback:
  type: unknown
  desc: "설명이 추가로 필요합니다. global_columns.yaml에 추가 가능"
```

**템플릿 토큰:**
- `{col}`: 컬럼명 전체
- `{zone}`: zone 코드 (U, CU, C, CL, L)
- `{idx}`: 숫자 그룹
- `{name}`: 텍스트 그룹
- `{part}`: 부품명 (HT, PR 등)

---

## 🔄 생성 프로세스 흐름

### 기본 흐름 (patterns 방법)

```
1. metadata/columns_union.json 읽기
   ↓
2. column_meta/global_columns.yaml 읽기 (제외 대상 확인)
   ↓
3. 각 컬럼에 대해:
   - global_columns.yaml에 있으면 스킵
   - 없으면 generate_meta_for_column() 호출
     ↓
     a) patterns.yaml의 패턴과 매칭 시도
     b) 매칭되면 템플릿 치환 ({zone}, {idx}, {name} 등)
     c) 매칭 안 되면 fallback 메타데이터 사용
   ↓
4. 기존 generated.yaml과 병합 (덮어쓰지 않고 업데이트)
   ↓
5. column_meta/global_columns.generated.yaml 저장
```

### 보강 프로세스 (enrich_generated_from_profiles.py)

```
1. metadata/profiles/*.json 읽기
   ↓
2. global_columns.generated.yaml 읽기
   ↓
3. 각 컬럼에 대해:
   - 프로필에서 semantic_type, 통계 정보 추출
   - desc/title 보강
   - 단위 힌트 자동 추론
   ↓
4. global_columns.generated.yaml 업데이트
```

---

## 📝 생성 규칙 우선순위

`generate_by_patterns()` 메서드에서:

1. **제외 조건**: `global_columns.yaml`에 이미 정의된 컬럼은 생성하지 않음
2. **패턴 매칭**: `patterns.yaml`의 패턴 순서대로 매칭 시도
3. **Fallback**: 패턴이 매칭되지 않으면 `fallback` 메타데이터 사용
4. **기존 데이터 보존**: `generated.yaml`에 이미 있으면 덮어쓰지 않고 업데이트

---

## 🎯 실제 사용 예시

### scan_metadata.sh에서 호출

```bash
# scan_metadata.sh의 2단계
python3 tools/generate_meta.py --method patterns
```

이 명령이 실행되면:
1. `metadata/columns_union.json` 읽기
2. `column_meta/global_columns.yaml` 확인 (제외 대상)
3. `patterns.yaml` 기반으로 메타데이터 생성
4. `column_meta/global_columns.generated.yaml` 저장/업데이트

---

## 📚 관련 파일

- **생성 스크립트**: `tools/generate_meta.py`
- **패턴 정의**: `column_meta/patterns.yaml`
- **패턴 매칭 엔진**: `backend/app/core/column_meta.py`의 `generate_meta_for_column()`
- **보강 스크립트**: `tools/enrich_generated_from_profiles.py`
- **템플릿 치환**: `backend/app/core/column_meta.py`의 `_format_template()`

---

## 💡 주요 설계 원칙

1. **하드코딩 최소화**: 모든 규칙은 `patterns.yaml`에서 관리
2. **Fallback 보장**: 패턴이 없어도 항상 메타데이터 생성
3. **기존 데이터 보존**: generated.yaml을 덮어쓰지 않고 업데이트
4. **확장 가능**: 새로운 패턴은 `patterns.yaml`에 추가만 하면 됨
