from pydantic import BaseModel


class LessonSummary(BaseModel):
    id: int
    title: str
    order_index: int

    class Config:
        from_attributes = True


class ChapterDetail(BaseModel):
    id: int
    title: str
    order_index: int
    lessons: list[LessonSummary] = []

    class Config:
        from_attributes = True


class CourseSummary(BaseModel):
    id: int
    title: str
    slug: str
    description: str

    class Config:
        from_attributes = True


class CourseDetail(BaseModel):
    id: int
    title: str
    slug: str
    description: str
    chapters: list[ChapterDetail] = []

    class Config:
        from_attributes = True


class LessonDetail(BaseModel):
    id: int
    title: str
    content_md: str
    order_index: int
    chapter_id: int

    class Config:
        from_attributes = True


class QuizQuestionOut(BaseModel):
    id: int
    question_text: str
    options: str  # JSON string
    explanation: str = ""

    class Config:
        from_attributes = True


class QuizOut(BaseModel):
    id: int
    lesson_id: int
    title: str
    questions: list[QuizQuestionOut] = []

    class Config:
        from_attributes = True
