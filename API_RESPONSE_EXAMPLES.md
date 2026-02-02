# API 응답 예시

## 1. `/api/datasets`

### 코드 위치
`backend/app/api/datasets.py` - `list_datasets()` 함수 (20-49줄)

### 리턴 부분
```python
return {"datasets": paginated}
```

### 실제 응답 예시
```json
{
  "datasets": [
    {
      "dataset_id": "ds_c2425b27cfc8",
      "filename": "example_data.csv",
      "size_bytes": 1234567,
      "columns": [
        "APCValveMon",
        "APCValveSet",
        "AUXMon_APC_OUT",
        "MFCInput_DCS",
        "MFCMon_N2-1",
        "Temperature_Zone1",
        "Timestamp"
      ]
    },
    {
      "dataset_id": "ds_6ca6cd68acc1",
      "filename": "another_data.csv",
      "size_bytes": 2345678,
      "columns": [
        "Pressure_Chamber",
        "GasFlow_N2",
        "GasFlow_NH3"
      ]
    }
  ]
}
```

### curl 명령어
```bash
curl http://localhost:8000/api/datasets
```

### 쿼리 파라미터 예시
```bash
# 페이지네이션
curl "http://localhost:8000/api/datasets?offset=0&limit=10"

# 파일명 필터
curl "http://localhost:8000/api/datasets?filename=example"

# 파일 크기 필터
curl "http://localhost:8000/api/datasets?min_size=1000000&max_size=5000000"
```

---

## 2. `/api/datasets/{id}/preview?offset=0&limit=5`

### 코드 위치
`backend/app/api/datasets.py` - `preview()` 함수 (68-94줄)

### 리턴 부분
```python
return {
    "dataset_id": dataset_id,
    "offset": offset,
    "limit": limit,
    "columns": columns,
    "rows": rows,
    "row_count": len(rows),
}
```

### 실제 응답 예시
```json
{
  "dataset_id": "ds_c2425b27cfc8",
  "offset": 0,
  "limit": 5,
  "columns": [
    "APCValveMon",
    "APCValveSet",
    "AUXMon_APC_OUT",
    "MFCInput_DCS",
    "MFCMon_N2-1",
    "Temperature_Zone1",
    "Timestamp"
  ],
  "rows": [
    {
      "APCValveMon": 45.2,
      "APCValveSet": 50.0,
      "AUXMon_APC_OUT": 12.5,
      "MFCInput_DCS": 100.0,
      "MFCMon_N2-1": 95.3,
      "Temperature_Zone1": 250.5,
      "Timestamp": "2024-01-01 10:00:00"
    },
    {
      "APCValveMon": 46.1,
      "APCValveSet": 50.0,
      "AUXMon_APC_OUT": 12.8,
      "MFCInput_DCS": 100.0,
      "MFCMon_N2-1": 95.5,
      "Temperature_Zone1": 251.2,
      "Timestamp": "2024-01-01 10:00:01"
    },
    {
      "APCValveMon": 47.0,
      "APCValveSet": 50.0,
      "AUXMon_APC_OUT": 13.0,
      "MFCInput_DCS": 100.0,
      "MFCMon_N2-1": 95.7,
      "Temperature_Zone1": 251.8,
      "Timestamp": "2024-01-01 10:00:02"
    },
    {
      "APCValveMon": 47.5,
      "APCValveSet": 50.0,
      "AUXMon_APC_OUT": 13.2,
      "MFCInput_DCS": 100.0,
      "MFCMon_N2-1": 95.9,
      "Temperature_Zone1": 252.1,
      "Timestamp": "2024-01-01 10:00:03"
    },
    {
      "APCValveMon": 48.0,
      "APCValveSet": 50.0,
      "AUXMon_APC_OUT": 13.5,
      "MFCInput_DCS": 100.0,
      "MFCMon_N2-1": 96.1,
      "Temperature_Zone1": 252.5,
      "Timestamp": "2024-01-01 10:00:04"
    }
  ],
  "row_count": 5
}
```

### curl 명령어
```bash
# 기본 (offset=0, limit=2000)
curl "http://localhost:8000/api/datasets/ds_c2425b27cfc8/preview"

# 커스텀 offset/limit
curl "http://localhost:8000/api/datasets/ds_c2425b27cfc8/preview?offset=0&limit=5"

# 다음 페이지
curl "http://localhost:8000/api/datasets/ds_c2425b27cfc8/preview?offset=5&limit=5"
```

---

## 3. `/api/meta/types`

### 코드 위치
`backend/app/api/meta.py` - `meta_types()` 함수 (12-39줄)

### 리턴 부분
```python
return {"types": types, "labels": labels, "order": order}
```

### 실제 응답 예시
```json
{
  "types": [
    "gas",
    "temperature",
    "pressure",
    "apc",
    "valve",
    "aux",
    "heater",
    "timestamp",
    "recipe",
    "index",
    "unknown"
  ],
  "labels": {
    "gas": "가스",
    "temperature": "온도",
    "pressure": "압력",
    "apc": "압력제어(APC)",
    "valve": "밸브",
    "aux": "보조센서(AUX)",
    "heater": "히터",
    "timestamp": "시간/타임스탬프",
    "recipe": "레시피",
    "index": "인덱스",
    "unknown": "기타"
  },
  "order": [
    "gas",
    "temperature",
    "pressure",
    "apc",
    "valve",
    "aux",
    "heater",
    "timestamp",
    "recipe",
    "index",
    "unknown"
  ]
}
```

### curl 명령어
```bash
curl http://localhost:8000/api/meta/types
```

---

## 코드에서 리턴 부분 확인하는 방법

### 방법 1: grep으로 리턴 문 찾기
```bash
# datasets.py에서 리턴 문 찾기
grep -n "return" backend/app/api/datasets.py

# 특정 함수의 리턴 부분만 보기
grep -A 10 "def list_datasets" backend/app/api/datasets.py | grep -A 5 "return"
```

### 방법 2: Python으로 함수 시그니처 확인
```bash
# 함수 정의만 보기
grep -E "^(def |    return)" backend/app/api/datasets.py
```

### 방법 3: 실제 응답 스키마 확인
```bash
# Pydantic 스키마 파일 확인
cat backend/app/models/schemas.py | grep -A 20 "class DatasetListResponse"
cat backend/app/models/schemas.py | grep -A 20 "class PreviewResponse"
cat backend/app/models/schemas.py | grep -A 20 "class MetaTypesResponse"
```

### 방법 4: FastAPI 자동 문서 확인
백엔드가 실행 중일 때:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

여기서 각 엔드포인트의 응답 스키마를 확인할 수 있습니다.

---

## 실제 curl 테스트 방법

### 백엔드 실행 확인
```bash
# 백엔드가 실행 중인지 확인
curl http://localhost:8000/

# 또는 프로세스 확인
ps aux | grep uvicorn
```

### 백엔드 실행 (필요시)
```bash
cd /home/keti_spark1/yune/aldList
./start_backend.sh
```

### curl로 실제 응답 받기
```bash
# 1. 데이터셋 목록
curl -s http://localhost:8000/api/datasets | jq '.' | head -30

# 2. 첫 번째 데이터셋 ID 추출 후 preview
DATASET_ID=$(curl -s http://localhost:8000/api/datasets | jq -r '.datasets[0].dataset_id')
curl -s "http://localhost:8000/api/datasets/$DATASET_ID/preview?offset=0&limit=5" | jq '.'

# 3. 메타 타입
curl -s http://localhost:8000/api/meta/types | jq '.'
```

### jq 없이 보기 좋게 포맷팅
```bash
# Python으로 JSON 포맷팅
curl -s http://localhost:8000/api/datasets | python3 -m json.tool | head -30
```

---

## 응답 스키마 정의 위치

모든 응답 스키마는 `backend/app/models/schemas.py`에 정의되어 있습니다:

- `DatasetListResponse`: `{"datasets": List[Dataset]}`
- `PreviewResponse`: `{"dataset_id": str, "offset": int, "limit": int, "columns": List[str], "rows": List[Dict], "row_count": int}`
- `MetaTypesResponse`: `{"types": List[str], "labels": Dict[str, str], "order": Optional[List[str]]}`
