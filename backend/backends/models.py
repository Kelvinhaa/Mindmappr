from sqlalchemy import Column, Integer, String, JSON
from backends.database import Base

# Database table 
class StudySession(Base):
    __tablename__ = "study sessions"

    id = Column(Integer, primary_key=True, index=True)
    time = Column(Integer, nullable=False)
    subject = Column(String, nullable=False)
    level = Column(String, nullable=False)
    goal = Column(String, nullable=True)
    recommendation = Column(JSON, nullable=False)