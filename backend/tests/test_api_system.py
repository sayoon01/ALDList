from __future__ import annotations

import json
import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.core.registry import RegistryStore
from app.engine.duckdb_cache import get_cache, compute_fingerprint

# TestClient는 각 테스트 함수 내에서 생성하거나 여기서 한 번만 생성
client = TestClient(app, base_url="http://test")


def test_registry_store_cache_reload(tmp_path: Path, monkeypatch):
    """
    기대 결과:
    - 처음 load 후 count=1
    - 파일 수정 후 ensure_loaded() 하면 count=2
    """
    # 임시 registry 파일 생성
    reg = tmp_path / "datasets.json"
    reg.write_text(json.dumps([
        {
            "dataset_id": "ds1",
            "path": str(tmp_path / "a.csv"),
            "filename": "a.csv",
            "size_bytes": 1,
            "mtime": 0.0,
            "columns": ["c1"]
        }
    ]), encoding="utf-8")

    # store를 임시 파일로 새로 만들어 테스트 (기존 싱글톤 영향 방지)
    store = RegistryStore(registry_path=reg)
    store.ensure_loaded()
    assert store.count() == 1
    assert store.get("ds1") is not None

    # 파일 수정(ctime/mtime 변화를 위해 sleep)
    time.sleep(1.1)
    reg.write_text(json.dumps([
        {
            "dataset_id": "ds1",
            "path": str(tmp_path / "a.csv"),
            "filename": "a.csv",
            "size_bytes": 1,
            "mtime": 0.0,
            "columns": ["c1"]
        },
        {
            "dataset_id": "ds2",
            "path": str(tmp_path / "b.csv"),
            "filename": "b.csv",
            "size_bytes": 1,
            "mtime": 0.0,
            "columns": ["x"]
        }
    ]), encoding="utf-8")

    store.ensure_loaded()
    assert store.count() == 2
    assert store.get("ds2") is not None


def test_duckdb_cache_fingerprint_invalidation(tmp_path: Path):
    """
    기대 결과:
    - 같은 파일이면 relation(view)이 동일하고 fingerprint도 동일
    - 파일 내용 변경 후 fingerprint가 달라져서 view가 재생성되어도 relation 이름은 동일(ds_xxx)인데 entry fingerprint는 갱신됨
    """
    csv = tmp_path / "t.csv"
    csv.write_text("a,b\n1,2\n", encoding="utf-8")

    cache = get_cache()
    dataset_id = "test_ds"

    fp1 = compute_fingerprint(str(csv))
    rel1 = cache.get_relation(dataset_id, str(csv))
    entry1 = cache._entries[dataset_id]
    assert entry1.fingerprint == fp1
    assert rel1.startswith("ds_")

    # 파일 변경
    time.sleep(1.1)
    csv.write_text("a,b\n9,8\n", encoding="utf-8")

    fp2 = compute_fingerprint(str(csv))
    rel2 = cache.get_relation(dataset_id, str(csv))
    entry2 = cache._entries[dataset_id]
    assert rel2 == rel1
    assert fp2 != fp1
    assert entry2.fingerprint == fp2


def test_fields_response_contains_meta(monkeypatch, tmp_path: Path):
    """
    /fields 응답에 meta가 포함되는지 검사.
    기대 결과:
    - status_code 200
    - json에 meta 키 존재
    """
    # registry를 강제로 테스트 데이터로 만들기 위해 settings 경로를 바꾸기는 복잡하니
    # 여기선 get_dataset을 monkeypatch해서 빠르게 테스트한다.
    from app.api import datasets as datasets_api
    from app.core import column_meta

    class Dummy:
        columns = ["col1", "col2"]

    monkeypatch.setattr(datasets_api, "get_dataset", lambda dataset_id: Dummy())

    # build_meta_map도 간단히 패치
    monkeypatch.setattr(column_meta, "build_meta_map", lambda dataset_id, cols: {
        "col1": {"type": "gas"},
        "col2": {"type": "pressure"},
    })

    r = client.get("/api/datasets/any/fields?type=gas")
    assert r.status_code == 200
    data = r.json()
    assert "meta" in data
    assert data["columns"] == ["col1"]
    assert "col1" in data["meta"]


def test_meta_types_endpoint():
    """
    /api/meta/types 엔드포인트 테스트
    기대 결과:
    - status_code 200
    - json에 types 키 존재
    - types는 리스트
    """
    r = client.get("/api/meta/types")
    assert r.status_code == 200
    data = r.json()
    assert "types" in data
    assert isinstance(data["types"], list)
    assert len(data["types"]) > 0
    # unknown은 항상 포함되어야 함
    assert "unknown" in data["types"]


def test_fields_invalid_type_returns_400(monkeypatch):
    """
    /fields 엔드포인트에서 존재하지 않는 type 요청 시 400 에러 반환 테스트
    기대 결과:
    - status_code 400
    - detail에 allowed_types 포함
    """
    from app.api import datasets as datasets_api
    from app.core import column_meta

    class Dummy:
        columns = ["col1", "col2"]

    monkeypatch.setattr(datasets_api, "get_dataset", lambda dataset_id: Dummy())

    # get_allowed_types가 실제 타입 목록을 반환하도록 설정
    monkeypatch.setattr(column_meta, "get_allowed_types", lambda: ["gas", "temperature", "pressure", "unknown"])

    r = client.get("/api/datasets/any/fields?type=invalidtype")
    assert r.status_code == 400
    # detail이 문자열인지 dict인지 확인 (현재 구현은 문자열)
    detail = r.json().get("detail", "")
    assert "Invalid type" in str(detail) or "invalidtype" in str(detail)
