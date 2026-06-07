use crate::models::user_profile::{AssessmentResponse, SkillAssessment, UserProfileFull};
use crate::services::llm_client::LlmClient;

const ASSESSMENT_PROMPT: &str = r#"你是一位 AI 学习路径规划顾问。你正在评估一位新学生的 AI/ML 知识水平，以便为他们设计个性化的学习路线。

学生回答了以下评估问题。请根据他们的回答，评估：

1. experience_level: "beginner"（完全新手）, "intermediate"（有一定了解）, 或 "advanced"（已有基础）
2. interests: 他们感兴趣的 AI 相关话题列表（数组）
3. learning_goals: 总结他们的学习目标（一段文字）
4. summary: 对学生的综合评估和鼓励性建议（一段文字，中文，友好鼓励的语气）

评估问题及答案：
{responses_text}

请以JSON格式回复，不要包含markdown标记或其他文字：
{{
  "experience_level": "...",
  "interests": ["...", "..."],
  "learning_goals": "...",
  "summary": "..."
}}"#;

pub async fn assess_skill(
    responses: &[AssessmentResponse],
    client: &LlmClient,
) -> Result<SkillAssessment, String> {
    let responses_text: String = responses
        .iter()
        .map(|r| format!("Q: {}\nA: {}", r.question_text, r.answer_text))
        .collect::<Vec<_>>()
        .join("\n\n");

    let user_message = ASSESSMENT_PROMPT.replace("{responses_text}", &responses_text);

    let response_text = client
        .chat(
            "你是一位专业的 AI 教育顾问。你只回复 JSON，不包含 markdown 标记或其他文字。",
            &user_message,
            2048,
        )
        .await?;

    let cleaned = clean_json_response(&response_text);
    serde_json::from_str::<SkillAssessment>(&cleaned).map_err(|e| {
        format!(
            "Failed to parse AI assessment: {}. Raw: {}",
            e,
            &cleaned.chars().take(200).collect::<String>()
        )
    })
}

pub fn clean_json_response(text: &str) -> String {
    let t = text.trim();
    if let Some(inner) = t.strip_prefix("```json") {
        if let Some(end) = inner.rfind("```") {
            return inner[..end].trim().to_string();
        }
        return inner.trim().to_string();
    }
    if let Some(inner) = t.strip_prefix("```") {
        if let Some(end) = inner.rfind("```") {
            return inner[..end].trim().to_string();
        }
        return inner.trim().to_string();
    }
    t.to_string()
}

#[allow(clippy::items_after_test_module)]
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_plain_json() {
        let input = r#"{"experience_level": "beginner"}"#;
        assert_eq!(clean_json_response(input), input);
    }

    #[test]
    fn test_clean_json_with_markdown_json_tag() {
        let input = "```json\n{\"key\": \"value\"}\n```";
        assert_eq!(clean_json_response(input), "{\"key\": \"value\"}");
    }

    #[test]
    fn test_clean_json_with_markdown_tag() {
        let input = "```\n{\"key\": \"value\"}\n```";
        assert_eq!(clean_json_response(input), "{\"key\": \"value\"}");
    }

    #[test]
    fn test_clean_json_with_whitespace() {
        let input = "\n\n  {\"key\": \"value\"}  \n";
        assert_eq!(clean_json_response(input), "{\"key\": \"value\"}");
    }

    #[test]
    fn test_clean_json_empty_string() {
        assert_eq!(clean_json_response(""), "");
    }

    #[test]
    fn test_clean_json_multiline_content() {
        let input = "```json\n{\n  \"experience_level\": \"beginner\",\n  \"interests\": [\"AI\", \"ML\"]\n}\n```";
        let expected =
            "{\n  \"experience_level\": \"beginner\",\n  \"interests\": [\"AI\", \"ML\"]\n}";
        assert_eq!(clean_json_response(input), expected);
    }
}

const PATH_PROMPT: &str = r#"你是一位 AI 学习路径设计师。请为以下学生创建个性化的学习路线。

学生画像：
- 经验水平：{experience_level}
- 兴趣领域：{interests}
- 学习目标：{learning_goals}
- 已完成课时：{completed_count}/{total_lessons}
- 测验平均分：{quiz_avg}

现有课程内容：
{course_outline}

请设计一个包含 5-10 个步骤的学习路线。每个步骤可以是：
- course_lesson: 学习现有课程中的特定课时
- ai_concept: 学习一个新的AI概念
- practice_quiz: 做一个练习测验
- project: 完成一个小项目

每个步骤需要：
- order: 序号（从1开始）
- title: 标题（中文，简洁）
- description: 描述（中文，1-2句话说明学什么和为什么学）
- step_type: 类型（course_lesson / ai_concept / practice_quiz / project）
- course_id: 如果是现有课程课时，提供 course_id；否则 null
- lesson_id: 如果是现有课程课时，提供 lesson_id；否则 null
- estimated_minutes: 预计学习时间（分钟）

请以JSON数组格式回复，不要包含markdown标记或其他文字：
[
  {{
    "order": 1,
    "title": "...",
    "description": "...",
    "step_type": "course_lesson",
    "course_id": 1,
    "lesson_id": 1,
    "estimated_minutes": 30
  }},
  ...
]"#;

#[allow(clippy::items_after_test_module, clippy::too_many_arguments)]
pub async fn generate_path(
    experience_level: &str,
    interests: &[String],
    learning_goals: &str,
    completed_count: i64,
    total_lessons: i64,
    quiz_avg: &str,
    course_outline: &str,
    client: &LlmClient,
) -> Result<Vec<crate::models::learning_path::LearningPathStep>, String> {
    let user_message = PATH_PROMPT
        .replace("{experience_level}", experience_level)
        .replace("{interests}", &interests.join(", "))
        .replace("{learning_goals}", learning_goals)
        .replace("{completed_count}", &completed_count.to_string())
        .replace("{total_lessons}", &total_lessons.to_string())
        .replace("{quiz_avg}", quiz_avg)
        .replace("{course_outline}", course_outline);

    let response_text = client
        .chat(
            "你是一位专业的 AI 学习路径设计师。你只回复 JSON，不包含 markdown 标记或其他文字。",
            &user_message,
            4096,
        )
        .await
        .map_err(|e| format!("LLM 请求失败: {e}"))?;

    let cleaned = clean_json_response(&response_text);
    let mut steps: Vec<crate::models::learning_path::LearningPathStep> =
        serde_json::from_str(&cleaned).map_err(|e| {
            format!(
                "解析学习路线 JSON 失败: {}. 原始内容(前500字符): {}",
                e,
                &cleaned.chars().take(500).collect::<String>()
            )
        })?;

    for step in &mut steps {
        step.status = "available".to_string();
    }

    Ok(steps)
}

const GOAL_PATH_PROMPT: &str = r#"你是一位 AI 学习路径设计师。请根据学生的完整画像创建个性化学习路线。

学生画像：
- 经验水平：{experience_level}
- 兴趣领域：{interests}
- 学习目标：{learning_goals}
- 已完成课时：{completed_count}/{total_lessons}
- 测验平均分：{quiz_avg}

Claude Code 使用行为分析：
{usage_context}

现有课程内容：
{course_outline}

请设计一个包含 5-10 个步骤的学习路线。优先补充使用分析中发现的知识短板，并与学生的学习目标对齐。
每个步骤的类型与格式同标准路径生成。

只输出 JSON 数组，不含 markdown 标记或其他文字：
[
  {{
    "order": 1,
    "title": "...",
    "description": "...",
    "step_type": "course_lesson",
    "course_id": 1,
    "lesson_id": 1,
    "estimated_minutes": 30
  }},
  ...
]"#;

#[allow(clippy::too_many_arguments)]
pub async fn generate_goal_path(
    experience_level: &str,
    interests: &[String],
    learning_goals: &str,
    completed_count: i64,
    total_lessons: i64,
    quiz_avg: &str,
    course_outline: &str,
    usage_context: &str,
    client: &LlmClient,
) -> Result<Vec<crate::models::learning_path::LearningPathStep>, String> {
    let user_message = GOAL_PATH_PROMPT
        .replace("{experience_level}", experience_level)
        .replace("{interests}", &interests.join(", "))
        .replace("{learning_goals}", learning_goals)
        .replace("{completed_count}", &completed_count.to_string())
        .replace("{total_lessons}", &total_lessons.to_string())
        .replace("{quiz_avg}", quiz_avg)
        .replace("{course_outline}", course_outline)
        .replace("{usage_context}", usage_context);

    let response_text = client
        .chat(
            "你是一位专业的 AI 学习路径设计师。你只回复 JSON，不包含 markdown 标记或其他文字。",
            &user_message,
            4096,
        )
        .await
        .map_err(|e| format!("LLM 请求失败: {e}"))?;

    let cleaned = clean_json_response(&response_text);
    let mut steps: Vec<crate::models::learning_path::LearningPathStep> =
        serde_json::from_str(&cleaned).map_err(|e| {
            format!(
                "解析学习路线 JSON 失败: {}. 原始内容(前500字符): {}",
                e,
                &cleaned.chars().take(500).collect::<String>()
            )
        })?;

    for step in &mut steps {
        step.status = "available".to_string();
    }

    Ok(steps)
}

const ENRICHED_PATH_PROMPT: &str = r#"你是一位 AI 学习路径架构师。请基于以下多维度学习者画像，设计一条精准个性化学习路线。

{profile_context}

现有课程内容：
{course_outline}

设计要求：
1. 生成 6-12 个步骤，形成清晰的学习递进路径
2. 每个步骤必须针对画像中的具体薄弱环节或目标领域
3. 步骤类型：
   - course_lesson: 学习现有课时（必须提供 course_id 和 lesson_id）
   - ai_concept: 讲解一个 AI 概念（针对薄弱领域）
   - practice_quiz: 针对性练习（针对薄弱概念设计）
   - project: 综合实践项目（整合多个领域）
   - review: 复习巩固（针对之前学过但测验得分低的课时）
4. 步骤安排要有层次：
   - 前 1/3：补齐最关键短板（severity=high 的薄弱环节）
   - 中间 1/3：拓展核心领域知识，与学习目标对齐
   - 最后 1/3：综合应用 + 项目实践
5. 考虑学习风格：
   - 如果偏好 practice，多安排 project/practice_quiz
   - 如果偏好 reading，多安排 course_lesson/ai_concept
   - 如果节奏 fast，减少冗余步骤，增加深度
   - 如果持续性 irregular，增加 review 步骤帮助巩固
6. 每个步骤：
   - order: 序号
   - title: 中文标题，简洁有力
   - description: 包含「学什么」「为什么学这个」「针对性说明」
   - step_type: 类型
   - course_id/lesson_id: 如适用
   - estimated_minutes: 考虑用户 pace 的合理估计
   - target_weakness: 如果针对某个薄弱概念，在此标注；否则 null

只输出 JSON 数组，不含 markdown 标记：
[
  {{
    "order": 1,
    "title": "...",
    "description": "...",
    "step_type": "course_lesson",
    "course_id": 1,
    "lesson_id": 1,
    "estimated_minutes": 30,
    "target_weakness": null
  }}
]"#;

pub async fn generate_path_from_profile(
    profile: &UserProfileFull,
    course_outline: &str,
    client: &LlmClient,
) -> Result<Vec<crate::models::learning_path::LearningPathStep>, String> {
    let profile_context = crate::services::profile_builder::format_full_profile_context(profile);

    let user_message = ENRICHED_PATH_PROMPT
        .replace("{profile_context}", &profile_context)
        .replace("{course_outline}", course_outline);

    let response_text = client
        .chat(
            "你是一位专业的 AI 学习路径架构师。你只回复 JSON，不包含 markdown 标记或其他文字。",
            &user_message,
            4096,
        )
        .await
        .map_err(|e| format!("LLM 请求失败: {e}"))?;

    let cleaned = clean_json_response(&response_text);
    let mut steps: Vec<crate::models::learning_path::LearningPathStep> =
        serde_json::from_str(&cleaned).map_err(|e| {
            format!(
                "解析学习路线 JSON 失败: {}. 原始内容(前500字符): {}",
                e,
                &cleaned.chars().take(500).collect::<String>()
            )
        })?;

    for step in &mut steps {
        step.status = "available".to_string();
    }

    Ok(steps)
}
