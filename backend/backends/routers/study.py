from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backends.database import get_db
from backends.dependencies import limiter
from backends.models import StudySession
from backends.schemas.study import StudyRequest, StudyResponse
from backends.services.study import generate_recommendation

router = APIRouter(
    prefix="/study",
    tags=["Study"]
)


@router.get("/", response_model=list[StudyResponse])
def list_studies(db: Session = Depends(get_db)):
    return db.query(StudySession).all()


@router.post("/", response_model=StudyResponse)
@limiter.limit("5/minute")
def create_study(request: Request, payload: StudyRequest, db: Session = Depends(get_db)):
    recommendation = generate_recommendation(
        subject=payload.subject,
        level=payload.level,
        time=payload.time,
        goal=payload.goal,
    )

    session = StudySession(
        time=payload.time,
        subject=payload.subject,
        level=payload.level,
        goal=payload.goal,
        recommendation=recommendation.model_dump(),
    )
    db.add(session)
    db.commit()
    # Refresh loads DB-generated values (e.g. the auto-incremented id) back into the object.
    db.refresh(session)
    return session


@router.get("/{study_id}", response_model=StudyResponse)
def get_study(study_id: int, db: Session = Depends(get_db)):
    session = db.query(StudySession).filter(StudySession.id == study_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Study session not found")
    return session
