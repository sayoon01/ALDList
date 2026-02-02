# RAG 문서 및 인덱스 생성 가이드

## 1. RAG 생성 스크립트

**파일명**: `tools/export_rag.py`

이 스크립트는 컬럼 메타데이터를 RAG 검색에 최적화된 형태로 변환합니다.

### 사용법

```bash
# 마크다운 문서만 생성
python tools/export_rag.py --format markdown

# JSONL 인덱스만 생성
python tools/export_rag.py --format jsonl

# 둘 다 생성
python tools/export_rag.py --format all
```

### 출력 위치

- **마크다운 문서**: `rag_docs/columns/{컬럼명}.md`, `rag_docs/groups/{타입}.md`
- **JSONL 인덱스**: `rag_index/column_meta.jsonl`

---

## 2. JSONL 인덱스 생성 구현 코드

### 실제 구현: `export_jsonl()` 함수

```python
def export_jsonl() -> None:
    """JSONL 파일 생성"""
    print("=" * 60)
    print("📋 Format: JSONL 파일 생성")
    print("=" * 60)
    
    # 입력 파일 확인
    ensure_file_exists(META_FILE, "메타데이터 파일")

    # YAML 파일 로드
    print(f"📖 메타데이터 읽는 중: {META_FILE}")
    meta = safe_load_yaml(META_FILE)

    if not meta:
        print(f"⚠️  메타데이터 파일이 비어있거나 로드할 수 없습니다.")
        return

    OUT_JSONL_DIR.mkdir(parents=True, exist_ok=True)

    # JSONL 파일 생성
    print(f"📝 JSONL 파일 생성 중: {OUT_JSONL_FILE}")
    count = 0
    with OUT_JSONL_FILE.open("w", encoding="utf-8") as f:
        for col, m in meta.items():
            if not isinstance(m, dict):
                continue

            # 문서 구성
            doc = {
                "id": f"column:{col}",
                "column": col,
                "type": m.get("type", "unknown"),
                "category": m.get("category", ""),
                "equipment_field": m.get("equipment_field", col),
                "text": (
                    f"이 컬럼은 반도체 장비 로그 CSV에 포함된 필드이다. "
                    f"{m.get('desc', '')} "
                    f"이 필드는 {m.get('type', 'unknown')} 유형이다."
                ).strip()
            }

            # JSONL 형식으로 쓰기 (한 줄에 JSON 객체 하나)
            f.write(json.dumps(doc, ensure_ascii=False) + "\n")
            count += 1

    print(f"✅ RAG JSONL 생성 완료: {OUT_JSONL_FILE}")
    print(f"   - 생성된 문서 수: {count}개")
    print("=" * 60)
```

### JSONL 문서 구조

각 라인은 다음과 같은 JSON 객체입니다:

```json
{
  "id": "column:APCValveMon",
  "column": "APCValveMon",
  "type": "pressure",
  "category": "control",
  "equipment_field": "APCValveMon",
  "text": "이 컬럼은 반도체 장비 로그 CSV에 포함된 필드이다. APC(Advanced Pressure Control) 밸브 관련 필드입니다. 압력 제어를 위해 사용됩니다. 이 필드는 pressure 유형이다."
}
```

### 필드 설명

- **id**: 고유 식별자 (`column:{컬럼명}` 형식)
- **column**: 컬럼명
- **type**: 컬럼 타입 (gas, temperature, pressure 등)
- **category**: 카테고리 (control, support 등)
- **equipment_field**: 장비 필드명
- **text**: 검색 가능한 텍스트 (RAG 검색에 사용)

### 임베딩/색인/검색 방식

**현재 구현 상태**: 
- ✅ JSONL 형식으로 문서 생성 완료
- ❌ 임베딩 생성 로직 없음 (별도 벡터 DB/임베딩 모델 필요)
- ❌ 색인 생성 로직 없음 (별도 벡터 DB 필요)
- ❌ 검색 로직 없음 (별도 RAG 라이브러리 필요)

**권장 통합 방법**:
1. **임베딩 생성**: OpenAI API, Sentence Transformers 등 사용
2. **벡터 DB**: Chroma, Pinecone, Weaviate, Qdrant 등 사용
3. **검색**: LangChain, LlamaIndex 등 RAG 프레임워크 사용

예시 (LangChain + Chroma):
```python
from langchain.document_loaders import JSONLLoader
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma

# JSONL 로드
loader = JSONLLoader("rag_index/column_meta.jsonl")
docs = loader.load()

# 임베딩 및 벡터 DB 생성
embeddings = OpenAIEmbeddings()
vectorstore = Chroma.from_documents(docs, embeddings)

# 검색
results = vectorstore.similarity_search("가스 관련 필드", k=5)
```

---

## 3. 컬럼 메타 → RAG 문서 변환 규칙

### 템플릿 함수: `enrich_lines()`

```python
def enrich_lines(col: str, m: Dict[str, Any]) -> List[str]:
    """
    컬럼 메타데이터를 RAG 검색에 유리한 형태로 문서화
    
    Args:
        col: 컬럼명
        m: 메타데이터 딕셔너리
    
    Returns:
        마크다운 라인 리스트
    """
    t = (m.get("type") or "unknown").strip()
    unit = (m.get("unit") or "").strip()
    cat = (m.get("category") or "").strip()
    desc = (m.get("desc") or "").strip()
    equip = (m.get("equipment_field") or col).strip()

    lines = []
    lines.append(f"# {col}\n")

    # ✅ 공통: RAG 검색에 도움되는 문장(일관되게 반복)
    lines.append("이 문서는 CSV 헤더(컬럼)의 의미를 설명하는 데이터 사전이다.")
    lines.append("이 컬럼은 반도체 장비 로그 CSV에 포함된 필드이다.")

    # ✅ 타입별: '가스 관련 필드 보여줘' 같은 질문에서 걸리도록 문장 추가
    if t == "gas":
        lines.append("이 컬럼은 반도체 공정에서 사용되는 가스와 관련된 필드이다.")
        lines.append("MFC(질량유량제어기) 계열의 유량/설정/입력 값일 가능성이 높다.")
    elif t == "temperature":
        lines.append("이 컬럼은 반도체 장비의 온도(측정/설정/목표)와 관련된 필드이다.")
    elif t == "pressure":
        lines.append("이 컬럼은 챔버 압력/진공 게이지 등 압력과 관련된 필드이다.")
    elif t == "timestamp":
        lines.append("이 컬럼은 데이터 기록 시각/시간과 관련된 시스템 필드이다.")
    elif t == "aux":
        lines.append("이 컬럼은 장비 보조 센서(AUX) 또는 모니터링 값이다.")
    elif t == "apc":
        lines.append("이 컬럼은 압력 제어(APC) 밸브/제어와 관련된 필드이다.")
    elif t == "valve":
        lines.append("이 컬럼은 밸브 상태/제어/설정과 관련된 필드이다.")
    else:
        lines.append("이 컬럼은 아직 분류되지 않았거나 일반적인 장비 필드이다.")

    if desc:
        lines.append("\n## 설명")
        lines.append(desc)

    lines.append("\n## 메타데이터")
    type_labels = get_type_labels()
    lines.append(f"- type: {t} ({type_labels.get(t, '기타')})")
    if cat:
        lines.append(f"- category: {cat}")
    if unit:
        lines.append(f"- unit: {unit}")
    lines.append(f"- equipment_field: {equip}")

    return lines
```

### 마크다운 문서 구조

#### 개별 컬럼 문서 (`rag_docs/columns/{컬럼명}.md`)

```markdown
# APCValveMon

이 문서는 CSV 헤더(컬럼)의 의미를 설명하는 데이터 사전이다.
이 컬럼은 반도체 장비 로그 CSV에 포함된 필드이다.
이 컬럼은 챔버 압력/진공 게이지 등 압력과 관련된 필드이다.

## 설명
APC(Advanced Pressure Control) 밸브 관련 필드입니다. 압력 제어를 위해 사용됩니다.

## 메타데이터
- type: pressure (압력)
- category: control
- unit: %
- equipment_field: APCValveMon
```

#### 타입별 그룹 문서 (`rag_docs/groups/{타입}.md`)

```markdown
# 가스 관련 컬럼 목록

이 문서는 동일한 타입의 컬럼을 묶은 목록 문서이다.
사용자는 '가스 관련 필드 보여줘' 같은 질문으로 이 문서를 검색할 수 있다.

- type: gas

## 컬럼 목록
- MFCInput_DCS
- MFCInput_F.PWR
- MFCInput_F2
...
```

### 변환 규칙 요약

1. **공통 프리픽스**: 모든 문서에 "이 문서는 CSV 헤더(컬럼)의 의미를 설명하는 데이터 사전이다." 문장 포함
2. **타입별 문장**: 타입에 따라 특정 문장 추가 (예: "이 컬럼은 반도체 공정에서 사용되는 가스와 관련된 필드이다.")
3. **메타데이터 구조화**: type, category, unit, equipment_field를 마크다운 리스트로 표시
4. **그룹 문서**: 동일 타입 컬럼들을 묶어서 목록 문서 생성 (검색 성능 향상)

---

## 4. 프로필/패턴 제안 리포트 → RAG 변환

### 현재 상태

**❌ 프로필 리포트 (`metadata/profiles/{ds}.json`) → RAG 변환 없음**

**❌ 패턴 제안 리포트 (`metadata/reports/pattern_suggestions.md`) → RAG 변환 없음**

현재 `export_rag.py`는 **컬럼 메타데이터(`column_meta/global_columns.yaml`)만** RAG 문서로 변환합니다.

### 프로필 리포트 RAG 변환 제안

프로필 리포트를 RAG로 변환하려면 다음과 같은 템플릿을 사용할 수 있습니다:

```python
def enrich_profile_doc(dataset_id: str, profile: Dict[str, Any]) -> List[str]:
    """프로필 리포트를 RAG 문서로 변환"""
    lines = []
    lines.append(f"# 데이터셋 프로필: {dataset_id}\n")
    lines.append("이 문서는 데이터셋의 컬럼별 통계 및 특성을 설명하는 프로필 문서이다.")
    
    # 데이터셋 정보
    lines.append(f"\n## 데이터셋 정보")
    lines.append(f"- dataset_id: {dataset_id}")
    lines.append(f"- 행 수: {profile.get('row_count_estimate', 'N/A')}")
    
    # 컬럼별 프로필
    lines.append(f"\n## 컬럼 프로필")
    for col_name, col_info in profile.get('columns', {}).items():
        semantic_type = col_info.get('semantic_type', {}).get('type', 'unknown')
        lines.append(f"\n### {col_name}")
        lines.append(f"- 의미적 타입: {semantic_type}")
        if 'top_values' in col_info:
            lines.append(f"- 주요 값: {', '.join(col_info['top_values'][:5])}")
    
    return lines
```

### 패턴 제안 리포트 RAG 변환 제안

패턴 제안 리포트를 RAG로 변환하려면:

```python
def enrich_pattern_suggestions_doc(suggestions: Dict[str, Any]) -> List[str]:
    """패턴 제안 리포트를 RAG 문서로 변환"""
    lines = []
    lines.append("# 컬럼명 패턴 제안\n")
    lines.append("이 문서는 컬럼명 패턴 분석 결과 및 patterns.yaml 확장 제안을 포함한다.")
    
    # 제안된 패턴들
    for pattern, info in suggestions.get('patterns', {}).items():
        lines.append(f"\n## 패턴: {pattern}")
        lines.append(f"- 매칭 컬럼 수: {info.get('count', 0)}")
        lines.append(f"- 예시 컬럼: {', '.join(info.get('examples', [])[:5])}")
    
    return lines
```

### 통합 제안

`export_rag.py`에 다음 함수들을 추가하여 프로필/패턴 리포트도 RAG로 변환할 수 있습니다:

```python
def export_all_rag():
    """모든 메타데이터를 RAG 문서로 변환"""
    # 1. 컬럼 메타데이터 (기존)
    export_markdown()
    export_jsonl()
    
    # 2. 프로필 리포트 (새로 추가)
    export_profiles_rag()
    
    # 3. 패턴 제안 리포트 (새로 추가)
    export_pattern_suggestions_rag()
```

---

## 5. 워크플로우 통합

### 현재 워크플로우

```bash
# 1. 메타데이터 생성
./scan_metadata.sh

# 2. RAG 문서 생성 (수동)
python tools/export_rag.py --format all
```

### 권장 워크플로우

`scan_metadata.sh`에 RAG 생성 단계 추가:

```bash
#!/bin/bash
# ... 기존 단계들 ...

# 5. RAG 문서/인덱스 생성
echo "📚 RAG 문서 생성 중..."
python3 tools/export_rag.py --format all
```

또는 별도 스크립트로 분리:

```bash
# 완전한 메타데이터 + RAG 생성
./scan_metadata.sh
./build_all_docs.py  # RAG 문서 생성
```

---

## 요약

1. **RAG 생성 스크립트**: `tools/export_rag.py`
2. **JSONL 인덱스 생성**: `export_jsonl()` 함수 (176-223줄)
3. **변환 규칙**: `enrich_lines()` 함수 (62-118줄)에 정의된 템플릿 사용
4. **현재 지원**: 컬럼 메타데이터만 변환
5. **미지원**: 프로필 리포트, 패턴 제안 리포트는 아직 RAG 변환 없음
