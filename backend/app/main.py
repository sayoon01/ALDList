from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.datasets import router as datasets_router
from .api.stats import router as stats_router

app = FastAPI(title="CSV Analyzer")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 환경에서는 모든 origin 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "ALDList API",
        "docs": "/docs",
        "endpoints": {
            "datasets": "/api/datasets",
            "stats": "/api/datasets/{dataset_id}/stats"
        }
    }

app.include_router(datasets_router)
app.include_router(stats_router)
