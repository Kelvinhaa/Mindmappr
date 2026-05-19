from sqlalchemy import Column, Integer, String, JSON, Uuid
from backends.database import Base


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Uuid(as_uuid=True), nullable=False, index=True)
    time = Column(Integer, nullable=False)
    subject = Column(String, nullable=False)
    level = Column(String, nullable=False)
    goal = Column(String, nullable=True)
    recommendation = Column(JSON, nullable=False)