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
    time: int
    subject: str
    level: str
    goal: Optional[str] = None
    recommendation: StudyRecommendation
