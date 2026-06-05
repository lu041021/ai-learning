from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.progress import UserProgress, QuizAttempt
from ..schemas.progress import ProgressOut, MarkCompleteRequest

router = APIRouter(prefix="/api")


@router.get("/progress", response_model=ProgressOut)
async def get_progress(user_id: int, db: AsyncSession = Depends(get_db)):
    p_result = await db.execute(
        select(UserProgress).where(UserProgress.user_id == user_id, UserProgress.completed == True)
    )
    completed = [p.lesson_id for p in p_result.scalars().all()]

    q_result = await db.execute(
        select(QuizAttempt).where(QuizAttempt.user_id == user_id)
    )
    scores = {a.quiz_id: a.score for a in q_result.scalars().all()}

    return ProgressOut(completed_lesson_ids=completed, quiz_scores=scores)


@router.post("/progress")
async def mark_complete(data: MarkCompleteRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserProgress).where(
            UserProgress.user_id == data.user_id,
            UserProgress.lesson_id == data.lesson_id,
        )
    )
    progress = result.scalar_one_or_none()

    if progress:
        progress.completed = True
        progress.completed_at = datetime.now(timezone.utc)
    else:
        progress = UserProgress(
            user_id=data.user_id,
            lesson_id=data.lesson_id,
            completed=True,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(progress)

    await db.commit()
    return {"status": "ok"}
