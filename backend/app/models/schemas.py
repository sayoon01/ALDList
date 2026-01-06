"""API 스키마 정의"""
from typing import List, Optional, Union
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
    columns: List[str]
    row_range: Optional[RowRange] = None


class StatsResponse(BaseModel):
    metrics: dict[str, Metric]


