import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from backends.database import get_db
from backends.dependencies import limiter
from backends.models import StudySession
from datetime import datetime, timedelta, timezone
from backends.schemas.study import StudyRequest, StudyResponse, PreviewResponse, ReviewRequest, ReviewResponse
from backends.services.study import generate_recommendation, apply_sm2
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


@router.post("/preview", response_model=PreviewResponse)
@limiter.limit("3/hour")
def preview_study(
    request: Request,
    body: StudyRequest,
    db: Session = Depends(get_db),
):
    recommendation = generate_recommendation(
        subject=body.subject,
        level=body.level,
        time=body.time,
        goal=body.goal,
    )
    return PreviewResponse(
        subject=body.subject,
        time=body.time,
        level=body.level,
        goal=body.goal,
        recommendation=recommendation,
    )


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


@router.post("/{session_id}/review", response_model=ReviewResponse)
def review_session(
    session_id: int,
    body: ReviewRequest,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    session = db.query(StudySession).filter(
        StudySession.id == session_id,
        StudySession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    new_interval, new_ef, new_count = apply_sm2(
        session.ease_factor, session.interval_days, session.review_count, body.quality
    )
    now = datetime.now(timezone.utc)
    session.last_reviewed_at = now
    session.next_review_at = now + timedelta(days=new_interval)
    session.review_count = new_count
    session.ease_factor = new_ef
    session.interval_days = new_interval
    db.commit()
    db.refresh(session)
    return session
