import json

from ..config import settings

GRADER_PROMPT = """你是一位 AI 测验评分老师，为 AI/ML 初学者课程批改测验。检查学生的答案并提供鼓励性、有教育意义的反馈。

测验：{quiz_title}
题目和学生答案：
{qa_pairs}

对每道题，告诉学生：
- 他们答对了还是答错了
- 对正确答案的简要解释
- 一句鼓励的话

最后给出总分和激励性的话语。保持友好和支持的态度。用中文回复。"""


async def grade_quiz(
    questions: list[dict],
    user_answers: list[int],
) -> tuple[float, str]:
    correct = 0
    qa_pairs = []
    for i, q in enumerate(questions):
        user_idx = user_answers[i] if i < len(user_answers) else -1
        is_correct = user_idx == q["correct_answer_index"]
        if is_correct:
            correct += 1

        options = json.loads(q["options"]) if isinstance(q["options"], str) else q["options"]
        user_ans_text = options[user_idx] if 0 <= user_idx < len(options) else "(no answer)"
        correct_ans_text = options[q["correct_answer_index"]]

        qa_pairs.append(
            f"Q{i+1}: {q['question_text']}\n"
            f"  Student answered: [{user_idx}] {user_ans_text}\n"
            f"  Correct answer: [{q['correct_answer_index']}] {correct_ans_text}\n"
            f"  Explanation: {q.get('explanation', 'N/A')}"
        )

    score = correct / len(questions) if questions else 0

    if not settings.anthropic_api_key:
        return score, _build_simple_feedback(score, correct, len(questions), qa_pairs)

    try:
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        prompt = GRADER_PROMPT.format(
            quiz_title="Lesson Quiz",
            qa_pairs="\n\n".join(qa_pairs),
        )
        response = await client.messages.create(
            model=settings.model,
            max_tokens=800,
            system="你是一位支持性的 AI 测验评分老师，帮助初学者学习 AI。",
            messages=[{"role": "user", "content": prompt}],
        )
        feedback = response.content[0].text
        return score, feedback
    except Exception:
        return score, _build_simple_feedback(score, correct, len(questions), qa_pairs)


def _build_simple_feedback(score: float, correct: int, total: int, qa_pairs: list[str]) -> str:
    pct = int(score * 100)
    if pct == 100:
        msg = f"满分！你已经完全掌握了这个知识点，太棒了！"
    elif pct >= 70:
        msg = f"不错！你答对了 {correct}/{total} 题。回顾一下做错的题目，巩固理解。"
    else:
        msg = f"你答对了 {correct}/{total} 题。别担心——学习需要时间！复习一下课程再试试。"
    return msg
