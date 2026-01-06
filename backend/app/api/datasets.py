from fastapi import APIRouter, HTTPException, Query
from ..core.registry import load_registry, get_dataset
from ..engine.duckdb_engine import preview_rows
from ..core.settings import PREVIEW_LIMIT_DEFAULT, PREVIEW_LIMIT_MAX

router = APIRouter(prefix="/api", tags=["datasets"])

@router.get("/datasets")
def list_datasets():
    # 프론트: 왼쪽 dataset picker
    return {"datasets": load_registry()}

@router.get("/datasets/{dataset_id}")
def get_dataset_meta(dataset_id: str):
    # 프론트: dataset 선택 시 columns를 여기서 받게 할 수도 있음
    try:
        ds = get_dataset(dataset_id)
    except KeyError:
        raise HTTPException(404, "dataset_id not found")
    return ds

@router.get("/datasets/{dataset_id}/preview")
def preview(
    dataset_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(PREVIEW_LIMIT_DEFAULT, ge=1, le=PREVIEW_LIMIT_MAX),
):
    try:
        ds = get_dataset(dataset_id)
    except KeyError:
        raise HTTPException(404, "dataset_id not found")

    data = preview_rows(ds.path, offset=offset, limit=limit)

    # 프론트가 grid 만들 때 쓰기 쉽게 columns도 같이 내려줌
    columns = list(data[0].keys()) if data else ds.columns
    return {
        "dataset_id": dataset_id,
        "offset": offset,
        "limit": limit,
        "columns": columns,
        "data": data,
    }
