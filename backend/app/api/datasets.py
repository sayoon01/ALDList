from fastapi import APIRouter, HTTPException, Query
from ..core.registry import load_registry, get_dataset
from ..engine.duckdb_engine import preview_rows
from ..core.settings import PREVIEW_LIMIT_DEFAULT, PREVIEW_LIMIT_MAX

router = APIRouter(prefix="/api", tags=["datasets"])

@router.get("/datasets")
def list_datasets():
    return {"datasets": load_registry()}

@router.get("/datasets/{dataset_id}/columns")
def columns(dataset_id: str):
    try:
        ds = get_dataset(dataset_id)
    except KeyError:
        raise HTTPException(404, "dataset_id not found")
    return {"dataset_id": dataset_id, "columns": ds.columns}

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
    return {"dataset_id": dataset_id, "offset": offset, "limit": limit, "data": data}
