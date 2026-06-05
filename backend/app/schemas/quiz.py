from pydantic import BaseModel


class QuizSubmitRequest(BaseModel):
    user_id: int
    quiz_id: int
    answers: list[int]


class QuizResultOut(BaseModel):
    score: float
    total: int
    correct: int
    feedback: str
