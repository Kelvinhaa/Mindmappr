from fastapi import APIRouter, HTTPException
from backends.schemas.study import StudyRequest, StudyResponse
from backends.services.study import generate_recommendation

router = APIRouter(
    prefix="/study",
    tags=["Study"]
)

database = []

@router.get("/", response_model=list[StudyResponse])
def list_studies():
    return database


@router.post(path="/", response_model=StudyResponse)
def create_study(payload: StudyRequest):
    try:
        recommendation = generate_recommendation(
            subject=payload.subject,
            level=payload.level,
            time=payload.time,
            goal=payload.goal,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    entry = {
        "id": len(database) + 1,
        **payload.model_dump(),
        "recommendation": recommendation.model_dump(),
    }
    database.append(entry)
    return entry

@router.get("/{study_id}", response_model=StudyResponse)
def get_study(study_id: int):
    for item in database:
        if item["id"] == study_id:
            return item
    raise HTTPException(status_code=404, detail="Study session not found")
