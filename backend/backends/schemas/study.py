from pydantic import BaseModel, Field
from typing import Optional

class StudyRequest(BaseModel):
    time:int = Field(gt=0, description="Study duration")
    subject:str
    level:str

class StudyResponse(BaseModel):
    id: int
    time:int
    subject:str
    level:str
    # Optional (default to none, can be string or missing)
    recommendation: Optional[str]=None

