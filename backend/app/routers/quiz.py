import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.course import Quiz, QuizQuestion
from ..models.progress import QuizAttempt
from ..schemas.quiz import QuizSubmitRequest, QuizResultOut
from ..services.quiz_grader import grade_quiz

router = APIRouter(prefix="/api")


@router.post("/quiz/submit", response_model=QuizResultOut)
async def submit_quiz(data: QuizSubmitRequest, db: AsyncSession = Depends(get_db)):
    q_result = await db.execute(select(Quiz).where(Quiz.id == data.quiz_id))
    quiz = q_result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    qq_result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id)
    )
    questions = qq_result.scalars().all()

    q_list = [
        {
            "question_text": q.question_text,
            "options": q.options,
            "correct_answer_index": q.correct_answer_index,
            "explanation": q.explanation,
        }
        for q in questions
    ]

    score, feedback = await grade_quiz(q_list, data.answers)

    attempt = QuizAttempt(
        user_id=data.user_id,
        quiz_id=data.quiz_id,
        score=score,
        answers=json.dumps(data.answers),
        feedback=feedback,
    )
    db.add(attempt)
    await db.commit()

    return QuizResultOut(
        score=score,
        total=len(questions),
        correct=int(score * len(questions)),
        feedback=feedback,
    )
