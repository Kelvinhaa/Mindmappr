from typing import Any, cast

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Temporary database framework - Learn and Implement soon!!!

DATABASE_URL = "sqlite:///./mindmappr.db"

# `check_same_thread=False` is required when SQLite is used with FastAPI.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Testing CI/CD pipeline with github actions
def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()

def test_db_connection():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))