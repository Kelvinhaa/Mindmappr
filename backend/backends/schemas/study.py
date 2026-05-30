import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List


class StudyRequest(BaseModel):
    time: int = Field(gt=0, description="Study duration in minutes")
    subject: str
    level: str
    goal: Optional[str] = Field(default=None, description="Optional learning goal")


class Technique(BaseModel):
    title: str
    description: str
    duration_minutes: int


class StudyRecommendation(BaseModel):
    summary: str
    techniques: List[Technique]
    tips: List[str]


class StudyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: uuid.UUID
    time: int
    subject: str
    level: str
    goal: Optional[str] = None
    recommendation: StudyRecommendation
    created_at: Optional[datetime] = None
    next_review_at: Optional[datetime] = None
    review_count: int = 0
    interval_days: int = 1


class PreviewResponse(BaseModel):
    subject: str
    time: int
    level: str
    goal: Optional[str]
    recommendation: StudyRecommendation


class ReviewRequest(BaseModel):
    quality: int  # 0=Again, 2=Hard, 4=Good, 5=Easy


class ReviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    next_review_at: datetime
    review_count: int
    interval_days: int
    ease_factor: float
