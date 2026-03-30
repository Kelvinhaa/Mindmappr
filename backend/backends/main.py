import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backends.database import test_db_connection
from backends.routers.study import router as study_router

app = FastAPI(title="Mindmappr")


def _parse_cors_origins() -> list[str]:
    # Supports cors origin for deployment flexibility.
    raw_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:5500,http://localhost:5500,https://mindmappr-alpha.vercel.app,https://mindmappr-omega.vercel.app",
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

origins = _parse_cors_origins()
# Controls which can call API to each other (front to backend)
app.add_middleware(
    CORSMiddleware, 
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # This kinda allow GET, POST requrests
    allow_headers=["*"]
)
app.include_router(study_router)

# RESTAPI
# HTTP Request get method
@app.get("/")
def root():
    return {"status": "AI Study Assistant running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/db-test")
def db_test():
    try:
        test_db_connection()
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        return {"status": "error", "database": str(exc)}



if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)