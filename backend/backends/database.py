from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Temporary database framework - Learn and Implement soon!!!

DATABASE_URL = "sqlite:///./mindmappr.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()