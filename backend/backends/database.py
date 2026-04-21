import os
from typing import Any, cast
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Reads PostgreSQL URL from env for production. Falls back to SQLite locally.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mindmappr.db")

engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
	# `check_same_thread=False` is required when SQLite is used with FastAPI.
	engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, **engine_kwargs)
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
	connection = cast(Any, engine.connect())
	try:
		connection.execute(text("SELECT 1"))
	finally:
		connection.close()