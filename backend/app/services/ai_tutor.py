import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models.course import Course, Chapter, Lesson, Quiz, QuizQuestion
from ..models.chat import Conversation, Message
from ..models.progress import UserProgress, QuizAttempt


SYSTEM_PROMPT_TEMPLATE = """你是一位 AI 导师，正在帮助初学者学习人工智能和机器学习概念。

教学风格：
- 鼓励、耐心、支持——学生是 AI 新手
- 先用简单的术语解释概念，再逐步深入
- 用日常生活中的类比让抽象概念变得具体
- 当学生表现出困惑时，主动提出进一步拆解话题
- 提问以检查理解程度
- 如果学生要求，可以生成测验题目来测试他们的知识
- 用中文回复，但保留 AI 专业术语的英文原名（如 Machine Learning、Neural Network 等）

课程上下文：
课程：{course_title}
{chapter_outline}

当前课时：{lesson_title}
课时内容：
{lesson_content}

学生进度：已完成 {completed_count}/{total_lessons} 课时。测验平均分：{quiz_avg}。

{selected_text_section}

用中文回复学生。保持回答聚焦、清晰。"""


def _build_chapter_outline(chapters: list[Chapter], lessons_map: dict[int, list[Lesson]]) -> str:
    lines = []
    for ch in sorted(chapters, key=lambda c: c.order_index):
        lines.append(f"Chapter: {ch.title}")
        for l in sorted(lessons_map.get(ch.id, []), key=lambda l: l.order_index):
            lines.append(f"  - {l.title}")
    return "\n".join(lines)


async def build_system_prompt(
    db: AsyncSession,
    user_id: int,
    lesson_id: int | None,
    selected_text: str | None,
) -> str:
    course_title = "AI Basics"
    chapter_outline = ""
    lesson_title = "General"
    lesson_content = "(No specific lesson selected — answer based on general AI knowledge)"

    if lesson_id:
        lesson_result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
        lesson = lesson_result.scalar_one_or_none()
        if lesson:
            lesson_title = lesson.title
            lesson_content = lesson.content_md or ""

            ch_result = await db.execute(select(Chapter).where(Chapter.id == lesson.chapter_id))
            chapter = ch_result.scalar_one_or_none()
            if chapter:
                course_result = await db.execute(select(Course).where(Course.id == chapter.course_id))
                course = course_result.scalar_one_or_none()
                if course:
                    course_title = course.title
                    all_ch = await db.execute(
                        select(Chapter).where(Chapter.course_id == course.id).order_by(Chapter.order_index)
                    )
                    chapters = all_ch.scalars().all()
                    chapter_ids = [ch.id for ch in chapters]
                    l_result = await db.execute(
                        select(Lesson).where(Lesson.chapter_id.in_(chapter_ids)).order_by(Lesson.order_index)
                    )
                    all_lessons_list = l_result.scalars().all()
                    lessons_map: dict[int, list[Lesson]] = {}
                    for l in all_lessons_list:
                        lessons_map.setdefault(l.chapter_id, []).append(l)
                    chapter_outline = _build_chapter_outline(chapters, lessons_map)

    # Progress
    p_result = await db.execute(
        select(UserProgress).where(UserProgress.user_id == user_id, UserProgress.completed == True)
    )
    completed_count = len(p_result.scalars().all())

    q_result = await db.execute(select(QuizAttempt).where(QuizAttempt.user_id == user_id))
    attempts = q_result.scalars().all()
    quiz_avg = f"{sum(a.score for a in attempts) / len(attempts) * 100:.0f}%" if attempts else "N/A"

    # Count total lessons
    total_result = await db.execute(select(Lesson))
    total_lessons = len(total_result.scalars().all())

    selected_text_section = ""
    if selected_text:
        selected_text_section = f"""THE STUDENT HAS SELECTED THIS TEXT AND IS ASKING ABOUT IT:
---
{selected_text}
---
"""

    return SYSTEM_PROMPT_TEMPLATE.format(
        course_title=course_title,
        chapter_outline=chapter_outline,
        lesson_title=lesson_title,
        lesson_content=lesson_content[:8000],  # safety truncation
        completed_count=completed_count,
        total_lessons=total_lessons,
        quiz_avg=quiz_avg,
        selected_text_section=selected_text_section,
    )
