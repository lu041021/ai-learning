from datetime import datetime, timezone

from sqlalchemy import Column, Integer, Float, Text, DateTime, Boolean
from ..database import Base


class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    lesson_id = Column(Integer, nullable=False)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    quiz_id = Column(Integer, nullable=False)
    score = Column(Float, default=0.0)
    answers = Column(Text, default="[]")  # JSON array
    feedback = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
