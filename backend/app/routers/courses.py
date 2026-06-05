from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.course import Course, Chapter, Lesson, Quiz, QuizQuestion
from ..schemas.course import (
    CourseSummary, CourseDetail, ChapterDetail, LessonSummary,
    LessonDetail, QuizOut, QuizQuestionOut,
)

router = APIRouter(prefix="/api")


@router.get("/courses", response_model=list[CourseSummary])
async def list_courses(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Course).order_by(Course.id))
    return result.scalars().all()


@router.get("/courses/{slug}", response_model=CourseDetail)
async def get_course(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Course).where(Course.slug == slug))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    ch_result = await db.execute(
        select(Chapter).where(Chapter.course_id == course.id).order_by(Chapter.order_index)
    )
    chapters = ch_result.scalars().all()

    chapter_ids = [ch.id for ch in chapters]
    l_result = await db.execute(
        select(Lesson).where(Lesson.chapter_id.in_(chapter_ids)).order_by(Lesson.order_index)
    )
    all_lessons = l_result.scalars().all()
    lessons_by_chapter: dict[int, list[Lesson]] = {}
    for l in all_lessons:
        lessons_by_chapter.setdefault(l.chapter_id, []).append(l)

    chapters_out = []
    for ch in chapters:
        lessons = lessons_by_chapter.get(ch.id, [])
        chapters_out.append(ChapterDetail(
            id=ch.id,
            title=ch.title,
            order_index=ch.order_index,
            lessons=[LessonSummary(id=l.id, title=l.title, order_index=l.order_index) for l in lessons],
        ))

    return CourseDetail(
        id=course.id,
        title=course.title,
        slug=course.slug,
        description=course.description or "",
        chapters=chapters_out,
    )


@router.get("/lessons/{lesson_id}", response_model=LessonDetail)
async def get_lesson(lesson_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return LessonDetail(
        id=lesson.id,
        title=lesson.title,
        content_md=lesson.content_md or "",
        order_index=lesson.order_index,
        chapter_id=lesson.chapter_id,
    )


@router.get("/lessons/{lesson_id}/quiz", response_model=QuizOut)
async def get_quiz(lesson_id: int, db: AsyncSession = Depends(get_db)):
    q_result = await db.execute(select(Quiz).where(Quiz.lesson_id == lesson_id))
    quiz = q_result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    qq_result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id)
    )
    questions = qq_result.scalars().all()

    questions_out = []
    for q in questions:
        questions_out.append(QuizQuestionOut(
            id=q.id,
            question_text=q.question_text,
            options=q.options,
        ))

    return QuizOut(
        id=quiz.id,
        lesson_id=quiz.lesson_id,
        title=quiz.title,
        questions=questions_out,
    )
