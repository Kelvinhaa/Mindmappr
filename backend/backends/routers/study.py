import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from backends.database import get_db
from backends.dependencies import limiter
from backends.models import StudySession
from backends.schemas.study import StudyRequest, StudyResponse
from backends.services.study import generate_recommendation
from backends.auth import get_current_user_id

router = APIRouter(
    prefix="/study",
    tags=["Study"]
)


@router.get("", response_model=list[StudyResponse])
def list_studies(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    return db.query(StudySession).filter(StudySession.user_id == user_id).all()


@router.post("", response_model=StudyResponse)
@limiter.limit("5/minute")
def create_study(
    request: Request,
    payload: StudyRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    recommendation = generate_recommendation(
        subject=payload.subject,
        level=payload.level,
        time=payload.time,
        goal=payload.goal,
    )

    try:
        parsed_user_id = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user identity in token")

    session = StudySession(
        user_id=parsed_user_id,
        time=payload.time,
        subject=payload.subject,
        level=payload.level,
        goal=payload.goal,
        recommendation=recommendation.model_dump(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{study_id}", response_model=StudyResponse)
def get_study(
    study_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    session = (
        db.query(StudySession)
        .filter(StudySession.id == study_id, StudySession.user_id == user_id)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Study session not found")
    return session
