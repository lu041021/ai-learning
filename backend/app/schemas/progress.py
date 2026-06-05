from pydantic import BaseModel


class ProgressOut(BaseModel):
    completed_lesson_ids: list[int]
    quiz_scores: dict[int, float]


class MarkCompleteRequest(BaseModel):
    user_id: int
    lesson_id: int
