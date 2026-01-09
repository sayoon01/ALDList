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
    columns: List[str]  # 전체 컬럼 목록 (유효성 검사용)
    row_range: Optional[RowRange] = None
    # 확장 포인트: 계산할 컬럼 선택 (없으면 columns 전체 사용)
    compute_columns: Optional[List[str]] = None  # 선택적으로 일부 컬럼만 계산 (None이면 columns 전체)


class StatsResponse(BaseModel):
    metrics: dict[str, Metric]


