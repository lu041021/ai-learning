from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, DateTime
from ..database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    order_index = Column(Integer, nullable=False)


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chapter_id = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    content_md = Column(Text, default="")
    order_index = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lesson_id = Column(Integer, nullable=False)
    title = Column(String(200), default="")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    quiz_id = Column(Integer, nullable=False)
    question_text = Column(Text, nullable=False)
    options = Column(Text, nullable=False)  # JSON array
    correct_answer_index = Column(Integer, nullable=False)
    explanation = Column(Text, default="")
