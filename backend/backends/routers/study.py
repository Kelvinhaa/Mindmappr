from fastapi import APIRouter
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
    recommendation = generate_recommendation(
        subject=payload.subject,
        level=payload.level,
        time=payload.time
    )
    entry = {
        "id": len(database) + 1,
        # Unpack all fields from payload (time, subject, level) into the dict.
        **payload.model_dump(),
        "recommendation": recommendation

    }
    database.append(entry)
    return entry

@router.get("/{study_id}", response_model=StudyResponse)
def get_study(study_id: int):
    for item in database:
        if item["id"] == study_id:
            return item
    return {"error": "Not found"}