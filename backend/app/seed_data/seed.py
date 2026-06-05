import asyncio
import json
import os

from app.database import init_db, async_session
from app.models.course import Course, Chapter, Lesson, Quiz, QuizQuestion

COURSE_DIR = os.path.dirname(os.path.abspath(__file__))

COURSE_DEF = {
    "title": "AI 入门基础",
    "slug": "ai-basics",
    "description": "面向初学者的 AI 入门课程，涵盖从什么是 AI 到神经网络、现实应用与 AI 伦理等核心概念。",
    "chapters": [
        {
            "title": "AI 基础概念",
            "lessons": [
                {"file": "lesson-01-what-is-ai.md", "quiz": "quiz-01.json"},
                {"file": "lesson-02-machine-learning.md", "quiz": "quiz-02.json"},
                {"file": "lesson-03-neural-networks.md", "quiz": "quiz-03.json"},
            ],
        },
        {
            "title": "AI 实践与未来",
            "lessons": [
                {"file": "lesson-04-applications.md", "quiz": "quiz-04.json"},
                {"file": "lesson-05-ethics.md", "quiz": "quiz-05.json"},
            ],
        },
    ],
}


def read_md(filename: str) -> str:
    path = os.path.join(COURSE_DIR, "courses", "ai-basics", filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def read_quiz(filename: str) -> dict:
    path = os.path.join(COURSE_DIR, "courses", "ai-basics", filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


async def seed():
    await init_db()

    async with async_session() as db:
        # Check if already seeded
        from sqlalchemy import select
        result = await db.execute(select(Course).where(Course.slug == COURSE_DEF["slug"]))
        if result.scalar_one_or_none():
            print("Database already seeded. Skipping.")
            return

        course = Course(
            title=COURSE_DEF["title"],
            slug=COURSE_DEF["slug"],
            description=COURSE_DEF["description"],
        )
        db.add(course)
        await db.flush()

        lesson_counter = 0
        for ch_idx, ch_def in enumerate(COURSE_DEF["chapters"]):
            chapter = Chapter(
                course_id=course.id,
                title=ch_def["title"],
                order_index=ch_idx,
            )
            db.add(chapter)
            await db.flush()

            for l_idx, l_def in enumerate(ch_def["lessons"]):
                content_md = read_md(l_def["file"])
                title = content_md.split("\n")[0].lstrip("# ").strip()

                lesson = Lesson(
                    chapter_id=chapter.id,
                    title=title,
                    content_md=content_md,
                    order_index=l_idx,
                )
                db.add(lesson)
                await db.flush()
                lesson_counter += 1

                quiz_data = read_quiz(l_def["quiz"])
                quiz = Quiz(
                    lesson_id=lesson.id,
                    title=quiz_data["title"],
                )
                db.add(quiz)
                await db.flush()

                for q in quiz_data["questions"]:
                    qq = QuizQuestion(
                        quiz_id=quiz.id,
                        question_text=q["question_text"],
                        options=json.dumps(q["options"]),
                        correct_answer_index=q["correct_answer_index"],
                        explanation=q.get("explanation", ""),
                    )
                    db.add(qq)

        await db.commit()
        print(f"Seeded: 1 course, 2 chapters, {lesson_counter} lessons with quizzes.")


if __name__ == "__main__":
    asyncio.run(seed())
