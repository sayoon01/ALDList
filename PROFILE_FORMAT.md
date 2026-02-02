# Profile JSON 포맷 예시

이 문서는 `metadata/profiles/{dataset_id}.json` 파일의 포맷과 구조를 보여줍니다.

## 📁 파일 위치

```
metadata/profiles/{dataset_id}.json
```

예: `metadata/profiles/ds_6bbc5f246568.json`

## 📋 전체 구조

```json
{
  "version": "profile_v1",
  "dataset_id": "ds_6bbc5f246568",
  "built_at": "2026-01-15T07:50:53Z",
  "source": {
    "path": "/home/keti_spark1/yune/aldList/data/standard_trace_001.csv",
    "filename": "standard_trace_001.csv",
    "size_bytes": 43688716,
    "mtime": 1767662285.9557357
  },
  "row_count_estimate": 42251,
  "sample": {
    "rows": 5000,
    "actual_rows": 5000,
    "top_k": 5,
    "strategy": "duckdb_sample_or_limit"
  },
  "columns": {
    "컬럼명": {
      "sample": { ... },
      "semantic_type": { ... },
      "top_values": [ ... ]
    }
  }
}
```

---

## 🔍 상세 구조

### 최상위 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `version` | string | 프로필 버전 ("profile_v1") |
| `dataset_id` | string | 데이터셋 ID |
| `built_at` | string | 생성 시각 (ISO 8601 형식) |
| `source` | object | 원본 CSV 파일 정보 |
| `row_count_estimate` | number | 행 수 추정값 |
| `sample` | object | 샘플링 정보 |
| `columns` | object | 컬럼별 프로필 정보 |

### source 객체

```json
{
  "path": "/home/keti_spark1/yune/aldList/data/standard_trace_001.csv",
  "filename": "standard_trace_001.csv",
  "size_bytes": 43688716,
  "mtime": 1767662285.9557357
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `path` | string | CSV 파일 경로 (절대 경로) |
| `filename` | string | 파일명 |
| `size_bytes` | number | 파일 크기 (bytes) |
| `mtime` | number | 파일 수정 시간 (Unix timestamp) |

### sample 객체

```json
{
  "rows": 5000,
  "actual_rows": 5000,
  "top_k": 5,
  "strategy": "duckdb_sample_or_limit"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `rows` | number | 샘플링할 행 수 (요청값) |
| `actual_rows` | number | 실제 샘플링된 행 수 |
| `top_k` | number | top-k 값 개수 |
| `strategy` | string | 샘플링 전략 |

---

## 📊 컬럼별 프로필 구조

각 컬럼은 다음 구조를 가집니다:

```json
{
  "컬럼명": {
    "sample": {
      "count": 5000,
      "null_count": 0,
      "non_null_count": 5000,
      "null_ratio": 0.0,
      "approx_distinct": 4111
    },
    "semantic_type": {
      "type": "numeric",
      "confidence": 1.0,
      "evidence": {
        "numeric_like": 5000,
        "datetime_like": 0,
        "bool_like": 0,
        "non_null": 5000
      }
    },
    "top_values": [
      {
        "value": "184",
        "count": 4
      },
      {
        "value": "3447",
        "count": 4
      }
    ]
  }
}
```

### sample 객체 (컬럼별)

```json
{
  "count": 5000,
  "null_count": 0,
  "non_null_count": 5000,
  "null_ratio": 0.0,
  "approx_distinct": 4111
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `count` | number | 샘플 행 수 |
| `null_count` | number | null 값 개수 |
| `non_null_count` | number | null이 아닌 값 개수 |
| `null_ratio` | number | null 비율 (0.0 ~ 1.0) |
| `approx_distinct` | number | 근사 유니크 값 개수 |

### semantic_type 객체

```json
{
  "type": "numeric",
  "confidence": 1.0,
  "evidence": {
    "numeric_like": 5000,
    "datetime_like": 0,
    "bool_like": 0,
    "non_null": 5000
  }
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | string | semantic type ("numeric", "datetime", "boolean", "text", "categorical") |
| `confidence` | number | 신뢰도 (0.0 ~ 1.0) |
| `evidence` | object | 판단 근거 |

**semantic_type.type 가능한 값:**
- `"numeric"`: 숫자형 (95% 이상이 숫자로 변환 가능)
- `"datetime"`: 날짜/시간형 (90% 이상이 timestamp로 변환 가능)
- `"boolean"`: 불린형 (95% 이상이 boolean으로 변환 가능)
- `"text"`: 텍스트형 (기본값)
- `"categorical"`: 범주형 (별도 판단, v1에서는 text로 표시)

**evidence 객체:**
- `numeric_like`: 숫자로 변환 가능한 값 개수
- `datetime_like`: timestamp로 변환 가능한 값 개수
- `bool_like`: boolean으로 변환 가능한 값 개수
- `non_null`: null이 아닌 값 개수

### top_values 배열

```json
[
  {
    "value": "184",
    "count": 4
  },
  {
    "value": "3447",
    "count": 4
  },
  {
    "value": "6770",
    "count": 3
  }
]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `value` | string | 값 (문자열로 저장) |
| `count` | number | 해당 값의 출현 횟수 |

**정렬**: 빈도 내림차순 (가장 많이 나타나는 값이 먼저)

---

## 📝 실제 예시

### 예시 1: Numeric 컬럼 (TempAct_U)

```json
{
  "TempAct_U": {
    "sample": {
      "count": 5000,
      "null_count": 0,
      "non_null_count": 5000,
      "null_ratio": 0.0,
      "approx_distinct": 1253
    },
    "semantic_type": {
      "type": "numeric",
      "confidence": 1.0,
      "evidence": {
        "numeric_like": 5000,
        "datetime_like": 0,
        "bool_like": 0,
        "non_null": 5000
      }
    },
    "top_values": [
      {
        "value": "400.0",
        "count": 1081
      },
      {
        "value": "530.0",
        "count": 807
      },
      {
        "value": "300.0",
        "count": 189
      },
      {
        "value": "400.1",
        "count": 171
      },
      {
        "value": "529.9",
        "count": 138
      }
    ]
  }
}
```

### 예시 2: Text/Categorical 컬럼 (Recipe Name)

```json
{
  "Recipe(Table) Name": {
    "sample": {
      "count": 5000,
      "null_count": 0,
      "non_null_count": 5000,
      "null_ratio": 0.0,
      "approx_distinct": 5
    },
    "semantic_type": {
      "type": "text",
      "confidence": 0.0,
      "evidence": {
        "numeric_like": 0,
        "datetime_like": 0,
        "bool_like": 0,
        "non_null": 5000
      }
    },
    "top_values": [
      {
        "value": "0_P_IH_HD02",
        "count": 3785
      },
      {
        "value": "1CY-DOE2",
        "count": 1039
      },
      {
        "value": "1CY-PG1-post NH3",
        "count": 138
      },
      {
        "value": "6-6CY1",
        "count": 26
      },
      {
        "value": "1CY-PG3-pre_NH3",
        "count": 12
      }
    ]
  }
}
```

### 예시 3: Pressure 컬럼 (PressAct)

```json
{
  "PressAct": {
    "sample": {
      "count": 5000,
      "null_count": 0,
      "non_null_count": 5000,
      "null_ratio": 0.0,
      "approx_distinct": 652
    },
    "semantic_type": {
      "type": "numeric",
      "confidence": 1.0,
      "evidence": {
        "numeric_like": 5000,
        "datetime_like": 0,
        "bool_like": 0,
        "non_null": 5000
      }
    },
    "top_values": [
      {
        "value": "750.6",
        "count": 385
      },
      {
        "value": "750.5",
        "count": 377
      },
      {
        "value": "750.4",
        "count": 356
      },
      {
        "value": "750.8",
        "count": 345
      },
      {
        "value": "0.397",
        "count": 307
      }
    ]
  }
}
```

### 예시 4: Gas 컬럼 (MFCMon_N2-1)

```json
{
  "MFCMon_N2-1": {
    "sample": {
      "count": 5000,
      "null_count": 0,
      "non_null_count": 5000,
      "null_ratio": 0.0,
      "approx_distinct": 175
    },
    "semantic_type": {
      "type": "numeric",
      "confidence": 1.0,
      "evidence": {
        "numeric_like": 5000,
        "datetime_like": 0,
        "bool_like": 0,
        "non_null": 5000
      }
    },
    "top_values": [
      {
        "value": "0.0",
        "count": 3382
      },
      {
        "value": "1.5",
        "count": 588
      },
      {
        "value": "2.001",
        "count": 299
      },
      {
        "value": "0.999",
        "count": 240
      },
      {
        "value": "1.998",
        "count": 166
      }
    ]
  }
}
```

### 예시 5: Index 컬럼 (No.)

```json
{
  "No.": {
    "sample": {
      "count": 5000,
      "null_count": 0,
      "non_null_count": 5000,
      "null_ratio": 0.0,
      "approx_distinct": 4111
    },
    "semantic_type": {
      "type": "numeric",
      "confidence": 1.0,
      "evidence": {
        "numeric_like": 5000,
        "datetime_like": 0,
        "bool_like": 0,
        "non_null": 5000
      }
    },
    "top_values": [
      {
        "value": "184",
        "count": 4
      },
      {
        "value": "3447",
        "count": 4
      },
      {
        "value": "6770",
        "count": 3
      },
      {
        "value": "7156",
        "count": 3
      },
      {
        "value": "3776",
        "count": 3
      }
    ]
  }
}
```

---

## 🔧 생성 로직

**생성 스크립트**: `backend/app/core/profile_v1.py`의 `build_profile_v1()` 함수

**주요 로직:**

1. **샘플링**: DuckDB `USING SAMPLE n ROWS`로 샘플 추출
2. **통계 계산**: 단일 쿼리로 모든 컬럼의 통계 계산
   - null_count, non_null_count
   - numeric_like, datetime_like, bool_like
   - approx_distinct (근사 유니크 개수)
3. **semantic_type 추론**: 비율 기반으로 타입 판단
4. **top-k values**: 빈도 기반 상위 값 추출

**API 엔드포인트:**
- `POST /api/admin/profile/{dataset_id}/build` - 프로필 빌드
- `GET /api/admin/profile/{dataset_id}` - 프로필 읽기

---

## 💡 활용 예시

### enrich_generated_from_profiles.py에서 사용

프로필 데이터를 활용하여 메타데이터를 보강합니다:

```python
# semantic_type 추출
semantic_type = profile["columns"][col]["semantic_type"]["type"]

# 통계 정보 활용
sample = profile["columns"][col]["sample"]
min_v = sample.get("min")
max_v = sample.get("max")
null_ratio = sample.get("null_ratio")

# top_values 활용
top_values = profile["columns"][col]["top_values"]
```

### StatsPanel에서 표시

프론트엔드에서 프로필의 semantic_type을 표시합니다:

```typescript
const semanticType = profile?.columns?.[activeColumn]?.semantic_type?.type;
```

---

## 📚 관련 파일

- **생성 로직**: `backend/app/core/profile_v1.py`
- **보강 스크립트**: `tools/enrich_generated_from_profiles.py`
- **프론트엔드 사용**: `frontend/src/components/StatsPanel.tsx`
