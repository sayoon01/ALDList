# 🔍 확장성 분석: 다른 데이터 파일 지원 가능 여부

이 문서는 ALDList가 다른 형식의 데이터 파일에도 작동하는지, 그리고 확장 가능한지 분석합니다.

---

## ✅ 현재 작동하는 경우

### 1. 표준 CSV 파일 (쉼표 구분, 헤더 있음)
- ✅ **완벽하게 작동**
- DuckDB `read_csv`가 자동으로 구분자 감지
- 헤더가 있으면 컬럼명 자동 인식

### 2. 다른 구분자 CSV (탭, 세미콜론 등)
- ⚠️ **부분적으로 작동**
- DuckDB는 자동으로 구분자 감지 가능
- 하지만 `scan_and_export.py`는 Python `csv.reader` 사용 (기본 쉼표)
- **문제**: 메타데이터 생성 시 구분자를 잘못 인식할 수 있음

### 3. 다른 인코딩 (EUC-KR, CP949 등)
- ⚠️ **부분적으로 작동**
- `scan_and_export.py`는 `utf-8-sig`만 사용
- **문제**: 다른 인코딩 파일은 메타데이터 생성 시 오류 가능

---

## ❌ 현재 작동하지 않는 경우

### 1. 헤더 없는 CSV
- ❌ **작동 안 함**
- `header=true` 하드코딩됨
- `scan_and_export.py`도 첫 줄을 헤더로 읽음
- **해결 필요**: `header=false` 옵션 추가

### 2. TSV (탭 구분 파일)
- ⚠️ **부분적으로 작동**
- DuckDB는 자동 감지하지만
- `scan_and_export.py`는 `.csv`만 스캔
- **해결 필요**: `.tsv` 파일도 스캔하도록 확장

### 3. Excel 파일 (.xlsx, .xls)
- ❌ **작동 안 함**
- `.csv`만 지원
- **해결 필요**: DuckDB의 Excel 지원 또는 변환 로직 추가

### 4. 다른 형식 (JSON, Parquet 등)
- ❌ **작동 안 함**
- CSV 전용 구조
- **해결 필요**: 형식별 처리 로직 추가

---

## 🔧 확장성 문제점 상세

### 1. 하드코딩된 가정들

#### `header=true` 하드코딩
```python
# backend/app/engine/duckdb_cache.py
CREATE VIEW ... AS SELECT * FROM read_csv('file.csv', all_varchar=true, header=true)
```
**문제**: 헤더 없는 CSV는 작동 안 함

**해결 방안**:
- 설정 파일에 `has_header` 옵션 추가
- 또는 자동 감지 (첫 줄이 숫자인지 텍스트인지)

#### 파일 확장자 `.csv`만 스캔
```python
# tools/scan_and_export.py
files = sorted(DATA_DIR.glob("*.csv"))
```
**문제**: TSV, Excel 등은 스캔 안 됨

**해결 방안**:
```python
files = sorted(DATA_DIR.glob("*.csv")) + sorted(DATA_DIR.glob("*.tsv"))
```

#### 인코딩 `utf-8-sig`만 사용
```python
# tools/scan_and_export.py
with p.open("r", encoding="utf-8-sig", newline="") as f:
```
**문제**: 다른 인코딩 파일은 오류

**해결 방안**:
- 자동 인코딩 감지 (chardet 라이브러리)
- 또는 설정 파일에 인코딩 지정

### 2. 도메인 특화 부분

#### `patterns.yaml`이 ALD 공정 데이터에 특화
```yaml
patterns:
  - match: '^TempAct_(U|CU|C|CL|L)$'  # ALD 온도 센서 패턴
  - match: '^MFCMon_(.+)$'  # MFC 가스 패턴
```
**문제**: 다른 도메인 데이터는 패턴 매칭 안 됨

**해결 방안**:
- ✅ 이미 fallback 규칙 있음 → 작동은 함 (메타데이터 품질만 낮음)
- 필요시 `patterns.yaml`에 새로운 패턴 추가 가능

---

## ✅ 확장 가능한 구조

### 1. 메타데이터 시스템
- ✅ `global_columns.yaml`: 어떤 컬럼이든 수동 정의 가능
- ✅ `patterns.yaml`: 정규식 기반으로 패턴 추가 가능
- ✅ `datasets/{dataset_id}.yaml`: 데이터셋별 오버라이드 가능

### 2. DuckDB 엔진
- ✅ DuckDB는 다양한 형식 지원 (CSV, Parquet, JSON 등)
- ✅ 구분자 자동 감지
- ✅ 타입 추정 가능 (현재는 `all_varchar` 사용 중)

### 3. 경로 처리
- ✅ `DATA_DIR` 기준 상대 경로 사용
- ✅ 배포 환경 호환성 고려됨

---

## 🎯 다른 데이터 파일 지원을 위한 개선 방안

### Phase 1: CSV 변형 지원 (쉬움)

1. **헤더 옵션 추가**
   ```python
   # settings.py에 추가
   CSV_HAS_HEADER = True  # 기본값
   
   # duckdb_engine.py
   header_opt = "header=true" if CSV_HAS_HEADER else "header=false"
   ```

2. **TSV 파일 지원**
   ```python
   # scan_and_export.py
   csv_files = list(DATA_DIR.glob("*.csv"))
   tsv_files = list(DATA_DIR.glob("*.tsv"))
   files = sorted(csv_files + tsv_files)
   ```

3. **인코딩 자동 감지**
   ```python
   # scan_and_export.py
   import chardet
   
   def detect_encoding(p: Path) -> str:
       with p.open("rb") as f:
           raw = f.read(10000)
           result = chardet.detect(raw)
           return result['encoding'] or 'utf-8'
   ```

### Phase 2: 다른 형식 지원 (중간)

1. **Excel 파일 지원**
   ```python
   # DuckDB는 Excel 직접 지원 안 함
   # pandas로 변환 후 DuckDB로 로드
   import pandas as pd
   df = pd.read_excel('file.xlsx')
   df.to_csv('file.csv', index=False)
   ```

2. **Parquet 파일 지원**
   ```python
   # DuckDB는 Parquet 직접 지원
   SELECT * FROM read_parquet('file.parquet')
   ```

### Phase 3: 완전 확장 가능한 구조 (어려움)

1. **형식별 플러그인 시스템**
   ```python
   class FileHandler:
       def can_handle(self, path: Path) -> bool:
           ...
       def read_columns(self, path: Path) -> List[str]:
           ...
       def get_duckdb_query(self, path: Path) -> str:
           ...
   ```

---

## 📊 현재 상태 요약

| 데이터 형식 | 작동 여부 | 문제점 | 해결 난이도 |
|-----------|---------|--------|-----------|
| 표준 CSV (쉼표, 헤더) | ✅ 완벽 | 없음 | - |
| TSV (탭 구분) | ⚠️ 부분 | 스캔 안 됨 | 쉬움 |
| 세미콜론 구분 CSV | ⚠️ 부분 | 메타데이터 생성 시 문제 | 쉬움 |
| 헤더 없는 CSV | ❌ 안 됨 | `header=true` 하드코딩 | 쉬움 |
| 다른 인코딩 (EUC-KR) | ⚠️ 부분 | 메타데이터 생성 시 오류 | 쉬움 |
| Excel (.xlsx) | ❌ 안 됨 | `.csv`만 지원 | 중간 |
| Parquet | ❌ 안 됨 | CSV 전용 구조 | 중간 |
| JSON | ❌ 안 됨 | CSV 전용 구조 | 중간 |

---

## ✅ 결론

### 현재 상태
- **표준 CSV 파일**: 완벽하게 작동 ✅
- **CSV 변형 (TSV, 다른 구분자)**: 부분적으로 작동 ⚠️
- **다른 형식 (Excel, Parquet)**: 작동 안 함 ❌

### 확장 가능성
- **구조적 확장성**: 높음 ✅
  - 메타데이터 시스템은 확장 가능
  - DuckDB는 다양한 형식 지원
- **코드 확장성**: 중간 ⚠️
  - 하드코딩된 가정들이 있음
  - 하지만 수정하기 쉬운 구조

### 권장 사항
1. **즉시 개선 가능**: 헤더 옵션, TSV 지원, 인코딩 자동 감지
2. **중기 개선**: Excel, Parquet 지원
3. **장기 개선**: 플러그인 시스템으로 완전 확장 가능한 구조

**현재는 표준 CSV 파일에 최적화되어 있지만, 구조적으로 확장하기 쉬운 상태입니다.**

