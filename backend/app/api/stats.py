"""통계 API"""
from fastapi import APIRouter, HTTPException

from ..core.registry import get_dataset
from ..engine.duckdb_engine import compute_metrics
from ..models.schemas import StatsRequest, StatsResponse, Metric

router = APIRouter(prefix="/api/datasets", tags=["stats"])


@router.post("/{dataset_id}/stats", response_model=StatsResponse)
def stats(dataset_id: str, request: StatsRequest):
    """통계 계산"""
    meta = get_dataset(dataset_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # 유효한 컬럼만 필터링
    valid_columns = [c for c in request.columns if c in meta.columns]
    if not valid_columns:
        raise HTTPException(status_code=400, detail="No valid columns provided")
    
    # 계산할 컬럼 선택 (확장 포인트: compute_columns가 제공되면 그것만, 아니면 전체)
    compute_target_columns = valid_columns
    if request.compute_columns:
        # compute_columns가 제공되면 유효한 것만 필터링
        compute_target_columns = [c for c in request.compute_columns if c in valid_columns]
        if not compute_target_columns:
            raise HTTPException(status_code=400, detail="No valid compute_columns provided")
        print(f"[Stats API] Computing stats for selected columns only: {len(compute_target_columns)}/{len(valid_columns)} columns")
    else:
        print(f"[Stats API] Computing stats for all columns: {len(compute_target_columns)} columns")
    
    # 행 범위 설정
    row_start = 0
    row_end = None
    if request.row_range:
        row_start = request.row_range.start
        row_end = request.row_range.end
    
    # 통계 계산 - dataset_id를 전달하여 DuckDB View 캐싱 사용
    try:
        metrics_dict = compute_metrics(
            meta.path, 
            compute_target_columns,  # 계산 대상 컬럼만 전달
            row_start, 
            row_end,
            dataset_id=dataset_id  # 캐시 활성화
        )
        
        # 응답 형식 변환 (에러가 있는 경우도 처리)
        metrics = {}
        for k, v in metrics_dict.items():
            try:
                metrics[k] = Metric(**v)
            except Exception as e:
                # Metric 변환 실패 시 에러 정보만 포함
                metrics[k] = Metric(
                    count=0,
                    non_null_count=0,
                    error=f"Metric conversion error: {str(e)}"
                )
        
        return StatsResponse(metrics=metrics)
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"통계 계산 API 오류: {error_detail}")
        raise HTTPException(status_code=500, detail=f"Statistics calculation failed: {str(e)}")


