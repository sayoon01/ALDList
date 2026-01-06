from fastapi import APIRouter, HTTPException
from ..core.registry import get_dataset
from ..models.schemas import StatsRequest, StatsResponse
from ..engine.duckdb_engine import compute_metrics

router = APIRouter(prefix="/api", tags=["stats"])

@router.post("/datasets/{dataset_id}/stats", response_model=StatsResponse)
def stats(dataset_id: str, req: StatsRequest):
    try:
        ds = get_dataset(dataset_id)
    except KeyError:
        raise HTTPException(404, "dataset_id not found")

    start = req.row_range.start
    end = req.row_range.end
    if end < start:
        raise HTTPException(400, "row_range.end must be >= start")

    offset = start
    limit = end - start
    if limit <= 0:
        return StatsResponse(dataset_id=dataset_id, row_range=req.row_range, results={})

    # 없는 컬럼은 스킵 (데이터 바뀌어도 서버 안 죽게)
    valid_cols = [c for c in req.columns if c in ds.columns]
    if not valid_cols:
        return StatsResponse(dataset_id=dataset_id, row_range=req.row_range, results={})

    results = compute_metrics(
        csv_path=ds.path,
        columns=valid_cols,
        offset=offset,
        limit=limit,
        metrics=req.metrics,
    )

    return StatsResponse(dataset_id=dataset_id, row_range=req.row_range, results=results)
