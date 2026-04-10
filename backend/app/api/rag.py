"""RAG 검색 API."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..core.rag_search import rag_search

router = APIRouter(prefix="/api/rag", tags=["rag"])


class RagSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20)
    filters: Optional[Dict[str, Any]] = None


class RagSearchResult(BaseModel):
    id: str
    score: float
    text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    distance: float


class RagSearchResponse(BaseModel):
    query: str
    results: List[RagSearchResult]


@router.post("/search", response_model=RagSearchResponse)
def search(req: RagSearchRequest):
    try:
        payload = rag_search(req.query, req.top_k, req.filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG search failed: {str(e)}")
    return RagSearchResponse(**payload)
