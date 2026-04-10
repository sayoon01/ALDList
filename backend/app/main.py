"""FastAPI 메인 애플리케이션"""
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.datasets import router as datasets_router
from .api.stats import router as stats_router
from .api.admin import router as admin_router
from .api.query import router as query_router
from .api import meta
from .core.metadata_pipeline import refresh_registry_if_needed

app = FastAPI(
    title="ALDList API",
    description="CSV 데이터 분석 API",
    version="1.0.0"
)


# 한글 유니코드 이스케이프 방지를 위한 커스텀 JSON 인코더
class UnicodeJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")


# 기본 JSONResponse를 커스텀 인코더로 교체
app.default_response_class = UnicodeJSONResponse

# 서버 시작 시 메타데이터 확인 및 자동 생성
@app.on_event("startup")
async def startup_event():
    """서버 시작 시 메타데이터 자동 확인"""
    r = refresh_registry_if_needed(force=False)
    if not r.ok:
        print("❌ Registry refresh failed on startup")
        print(r.stderr)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발용: 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(datasets_router)
app.include_router(stats_router)
app.include_router(admin_router)
app.include_router(query_router)
app.include_router(meta.router)


@app.get("/")
def root():
    """API 정보"""
    return {
        "name": "ALDList API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "datasets": "/api/datasets",
            "preview": "/api/datasets/{dataset_id}/preview",
            "stats": "/api/datasets/{dataset_id}/stats",
            "histogram": "/api/datasets/{dataset_id}/histogram",
            "columns": "/api/datasets/{dataset_id}/columns",
            "query": "/api/query"
        }
    }
