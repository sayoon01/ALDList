"""API 스키마 정의"""
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class Metric(BaseModel):
    count: Optional[int] = None
    non_null_count: Optional[int] = None
    min: Optional[Union[float, str]] = None  # 숫자 또는 문자열 (날짜, 텍스트 등)
    max: Optional[Union[float, str]] = None  # 숫자 또는 문자열 (날짜, 텍스트 등)
    avg: Optional[float] = None
    stddev: Optional[float] = None
    error: Optional[str] = None


class RowRange(BaseModel):
    start: int = Field(ge=0, default=0)
    end: Optional[int] = Field(gt=0, default=None)


class StatsRequest(BaseModel):
    columns: List[str]  # 전체 컬럼 목록 (유효성 검사용)
    row_range: Optional[RowRange] = None
    # 확장 포인트: 계산할 컬럼 선택 (없으면 columns 전체 사용)
    compute_columns: Optional[List[str]] = None  # 선택적으로 일부 컬럼만 계산 (None이면 columns 전체)


class StatsResponse(BaseModel):
    metrics: dict[str, Metric]


# --- 응답 모델 ---

class Dataset(BaseModel):
    dataset_id: str
    filename: str
    size_bytes: int
    columns: List[str]


class DatasetSummary(BaseModel):
    dataset_id: str = Field(example="ds_6bbc5f246568")
    filename: str = Field(example="standard_trace_001.csv")
    size_bytes: int = Field(example=43688716)
    columns: List[str] = Field(example=["No.", "Recipe(Table) Name", "Step ID", "Date", "Time"])


class DatasetListResponse(BaseModel):
    datasets: List[DatasetSummary]
    
    class Config:
        json_schema_extra = {
            "example": {
                "datasets": [
                    {
                        "dataset_id": "ds_6bbc5f246568",
                        "filename": "standard_trace_001.csv",
                        "size_bytes": 43688716,
                        "columns": ["No.", "Recipe(Table) Name", "Step ID", "Date", "Time"]
                    }
                ]
            }
        }


class DatasetMetaResponse(BaseModel):
    dataset_id: str = Field(example="ds_6bbc5f246568")
    filename: str = Field(example="standard_trace_001.csv")
    path: str = Field(example="standard_trace_001.csv")
    size_bytes: int = Field(example=43688716)
    columns: List[str] = Field(example=["No.", "Recipe(Table) Name", "Step ID", "Date", "Time"])


class PreviewResponse(BaseModel):
    dataset_id: str
    offset: int
    limit: int
    columns: List[str]
    rows: List[Dict[str, Any]]
    row_count: int


class DatasetColumnsResponse(BaseModel):
    dataset_id: str
    columns: List[str]
    meta: Dict[str, Dict[str, Any]]


class FieldsByTypeResponse(BaseModel):
    dataset_id: str
    type: str
    count: int
    columns: List[str]


class AdminRefreshResponse(BaseModel):
    ok: bool
    changed: bool
    reason: str
    registry_path: str
    stdout: Optional[str] = None


class RefreshResponse(BaseModel):
    ran_scan: bool
    reason: str
    registry_path: str
    dataset_count: int
    created: List[str] = Field(default_factory=list, description="새로 생성된 dataset_id 리스트")
    changed: List[str] = Field(default_factory=list, description="변경된 dataset_id 리스트")
    deleted: List[str] = Field(default_factory=list, description="삭제된 dataset_id 리스트")


class ProfileBuildResponse(BaseModel):
    dataset_id: str
    profile_path: str
    generated_at: str
    sample_rows_used: int
    column_count: int
