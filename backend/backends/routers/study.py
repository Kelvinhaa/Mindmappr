from fastapi import APIRouter, HTTPException, Request
from backends.dependencies import limiter
from backends.schemas.study import StudyRequest, StudyResponse
from backends.services.study import generate_recommendation

router = APIRouter(
    prefix="/study",
    tags=["Study"]
)

database = []

# Return all study sessions
@router.get("/", response_model=list[StudyResponse])
def list_studies():
    return database


@router.post(path="/", response_model=StudyResponse)
@limiter.limit("5/minute")
def create_study(request: Request, payload: StudyRequest):
    recommendation = generate_recommendation(
        subject=payload.subject,
        level=payload.level,
        time=payload.time,
        goal=payload.goal,
    )

    entry = {
        "id": len(database) + 1,
        **payload.model_dump(),
        "recommendation": recommendation.model_dump(),
    }
    database.append(entry)
    return entry

# Later for implementing persistent postgresql
@router.get("/{study_id}", response_model=StudyResponse)
def get_study(study_id: int):
    for item in database:
        if item["id"] == study_id:
            return item
    raise HTTPException(status_code=404, detail="Study session not found")
