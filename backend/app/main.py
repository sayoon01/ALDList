from fastapi import FastAPI
from .api.datasets import router as datasets_router
from .api.stats import router as stats_router

app = FastAPI(title="CSV Analyzer")

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
