import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backends.routers.study import router as study_router

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://mindmappr-alpha.vercel.app",
]
app.add_middleware(
    CORSMiddleware, 
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
app.include_router(study_router)

database = {"technique":[]}

@app.get("/")
def root():
    return {"status": "AI Study Assistant running"}



if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)