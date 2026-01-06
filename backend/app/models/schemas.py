from pydantic import BaseModel, Field
from typing import Literal

Metric = Literal["avg", "max", "min", "count"]

class RowRange(BaseModel):
    start: int = Field(ge=0)
    end: int = Field(ge=0)  # [start, end) 권장

class StatsRequest(BaseModel):
    columns: list[str] = Field(min_length=1)
    row_range: RowRange
    metrics: list[Metric] = Field(min_length=1)

class StatsResponse(BaseModel):
    dataset_id: str
    row_range: RowRange
    results: dict[str, dict[str, float | int | None]]
