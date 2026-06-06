use crate::models::user_profile::{
    ConceptMastery, GoalAnalysis, LearningStyleProfile, UserProfileFull, WeaknessDetail,
};

pub struct ProfileBuildData {
    pub responses_text: String,
    pub goal_text: String,
    pub quiz_history: Vec<QuizHistoryItem>,
    pub concept_scores: Vec<(String, String, f64, i64)>,
    pub completed_lessons: Vec<String>,
    pub chat_topics: Vec<String>,
    pub streak_days: i64,
    pub completion_pct: f64,
    pub avg_quiz_score: f64,
    pub total_lessons: i64,
    pub total_quizzes: i64,
    pub usage_context: Option<String>,
    pub wrong_concepts: Vec<(String, f64)>,
    pub domain_accuracy: Vec<(String, f64, i64)>,
}

pub struct QuizHistoryItem {
    pub lesson_title: String,
    pub score: f64,
    pub attempted_at: String,
}

const DEEP_PROFILE_PROMPT: &str = r#"你是一位资深 AI 教育诊断专家。请基于以下多维数据，生成一份深度学习者画像。

## 自评数据
{responses_text}

## 学习目标
{goal_text}

## 学习行为数据
- 已完成课时数：{completed_count}/{total_lessons}（{completion_pct}%）
- 测验总数：{total_quizzes}，平均分：{avg_quiz_score}
- 连续学习天数：{streak_days}
- 已完成课时：{completed_lessons}

## 测验历史
{quiz_history}

## 概念掌握度（来自测验数据）
{concept_scores}

## 薄弱领域（正确率 < 70%）
{weak_concepts}

## 领域正确率
{domain_accuracy}

## AI 对话话题
{chat_topics}

## Claude Code 使用行为
{usage_context}

请基于以上数据，输出一个多维度学习画像。严格按以下 JSON 格式输出，不含 markdown 标记：

{{
  "experience_level": "具体描述（不仅是 beginner/intermediate/advanced，要结合具体领域说明）",
  "interests": ["从行为和自评推断的真实兴趣领域"],
  "learning_goals": "结合自评目标和数据推断的学习方向",
  "concept_mastery": [
    {{"concept_name": "概念名", "domain": "所属领域", "mastery_score": 0.0-1.0, "quiz_attempts": 次数, "last_score": 最近得分或null}}
  ],
  "domain_strengths": ["用户掌握较好的领域"],
  "weakness_details": [
    {{"domain": "领域", "concept_name": "薄弱概念", "severity": "high/medium/low", "current_score": 得分, "suggested_focus": "建议学习方向"}}
  ],
  "learning_style": {{
    "pace": "fast/moderate/slow",
    "consistency": "consistent/irregular/burst",
    "preferred_format": "reading/practice/video/interactive",
    "review_tendency": "frequent/occasional/rare",
    "avg_session_minutes": 估计值
  }},
  "goal_analysis": {{
    "goal_text": "学习目标",
    "gap_description": "当前水平与目标的差距分析",
    "priority_domains": ["优先学习的领域"],
    "suggested_milestones": ["阶段性里程碑"]
  }},
  "summary": "综合画像总结（300-500字中文，包含：知识水平总评、学习风格分析、关键短板、与目标的差距、推荐策略）"
}}

要求：
1. concept_mastery 中列出所有已知概念，不仅是有数据的
2. weakness_details 按 severity 排序，high 优先
3. learning_style 必须从数据中推断，不能全是默认值
4. goal_analysis 要有具体差距分析，不能说"没有差距"
5. summary 要有可操作的策略建议"#;

pub fn build_deep_profile_prompt(data: &ProfileBuildData) -> String {
    let quiz_history = if data.quiz_history.is_empty() {
        "暂无测验记录".to_string()
    } else {
        data.quiz_history
            .iter()
            .map(|q| {
                format!(
                    "- {}: {}% ({})",
                    q.lesson_title,
                    (q.score * 100.0) as i64,
                    q.attempted_at
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let concept_scores = if data.concept_scores.is_empty() {
        "暂无概念数据".to_string()
    } else {
        data.concept_scores
            .iter()
            .map(|(name, domain, score, attempts)| {
                format!(
                    "- {}/{}: {}% ({}次测验)",
                    domain,
                    name,
                    (*score * 100.0) as i64,
                    attempts
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let weak_concepts = if data.wrong_concepts.is_empty() {
        "无显著薄弱领域".to_string()
    } else {
        data.wrong_concepts
            .iter()
            .map(|(name, score)| format!("- {}: {}%", name, (*score * 100.0) as i64))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let domain_accuracy = if data.domain_accuracy.is_empty() {
        "暂无数据".to_string()
    } else {
        data.domain_accuracy
            .iter()
            .map(|(domain, acc, attempts)| format!("- {}: {}% ({}次)", domain, acc, attempts))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let completed_lessons = if data.completed_lessons.is_empty() {
        "暂无".to_string()
    } else {
        data.completed_lessons.join("、")
    };

    let chat_topics = if data.chat_topics.is_empty() {
        "暂无 AI 对话记录".to_string()
    } else {
        data.chat_topics.join("、")
    };

    let usage_context = data
        .usage_context
        .as_deref()
        .unwrap_or("未分析 Claude Code 使用记录");

    DEEP_PROFILE_PROMPT
        .replace("{responses_text}", &data.responses_text)
        .replace("{goal_text}", &data.goal_text)
        .replace(
            "{completed_count}",
            &data.completed_lessons.len().to_string(),
        )
        .replace("{total_lessons}", &data.total_lessons.to_string())
        .replace("{completion_pct}", &format!("{:.1}", data.completion_pct))
        .replace("{total_quizzes}", &data.total_quizzes.to_string())
        .replace("{avg_quiz_score}", &format!("{:.1}", data.avg_quiz_score))
        .replace("{streak_days}", &data.streak_days.to_string())
        .replace("{completed_lessons}", &completed_lessons)
        .replace("{quiz_history}", &quiz_history)
        .replace("{concept_scores}", &concept_scores)
        .replace("{weak_concepts}", &weak_concepts)
        .replace("{domain_accuracy}", &domain_accuracy)
        .replace("{chat_topics}", &chat_topics)
        .replace("{usage_context}", usage_context)
}

pub fn format_full_profile_context(profile: &UserProfileFull) -> String {
    let mut ctx = String::new();

    ctx.push_str(&format!("经验水平：{}\n", profile.experience_level));
    ctx.push_str(&format!("兴趣领域：{}\n", profile.interests.join("、")));
    ctx.push_str(&format!("学习目标：{}\n", profile.learning_goals));

    if !profile.domain_strengths.is_empty() {
        ctx.push_str(&format!(
            "优势领域：{}\n",
            profile.domain_strengths.join("、")
        ));
    }

    if !profile.weakness_details.is_empty() {
        ctx.push_str("薄弱环节：\n");
        for w in &profile.weakness_details {
            ctx.push_str(&format!(
                "  - [{severity}] {domain}/{concept}: {score}% — {focus}\n",
                severity = w.severity,
                domain = w.domain,
                concept = w.concept_name,
                score = (w.current_score * 100.0) as i64,
                focus = w.suggested_focus
            ));
        }
    }

    ctx.push_str(&format!(
        "学习风格：节奏={pace}、持续性={consistency}、偏好格式={format}、复习习惯={review}\n",
        pace = profile.learning_style.pace,
        consistency = profile.learning_style.consistency,
        format = profile.learning_style.preferred_format,
        review = profile.learning_style.review_tendency
    ));

    ctx.push_str(&format!(
        "学习数据：完成{completed}/{total}课时（{pct}%）、{quizzes}次测验均分{avg}、连续{streak}天\n",
        completed = profile.total_lessons_completed,
        total = 0i64,
        pct = profile.completion_pct,
        quizzes = profile.total_quizzes_taken,
        avg = profile.avg_quiz_score,
        streak = profile.streak_days
    ));

    if let Some(ref goal) = profile.goal_analysis {
        ctx.push_str(&format!("目标差距：{}\n", goal.gap_description));
        if !goal.priority_domains.is_empty() {
            ctx.push_str(&format!("优先领域：{}\n", goal.priority_domains.join("、")));
        }
    }

    if let Some(ref ext) = profile.external_skill_context {
        ctx.push_str(&format!("外部技能背景：{}\n", ext));
    }

    ctx
}

pub fn profile_from_llm_json(
    json_str: &str,
    total_lessons_completed: i64,
    total_quizzes_taken: i64,
    avg_quiz_score: f64,
    streak_days: i64,
    completion_pct: f64,
    external_skill_context: Option<String>,
) -> Result<UserProfileFull, String> {
    #[derive(serde::Deserialize)]
    struct RawProfile {
        experience_level: String,
        interests: Vec<String>,
        learning_goals: String,
        concept_mastery: Vec<ConceptMastery>,
        domain_strengths: Vec<String>,
        weakness_details: Vec<WeaknessDetail>,
        learning_style: LearningStyleProfile,
        goal_analysis: Option<GoalAnalysis>,
        summary: String,
    }

    let raw: RawProfile =
        serde_json::from_str(json_str).map_err(|e| format!("解析画像 JSON 失败: {}", e))?;

    Ok(UserProfileFull {
        experience_level: raw.experience_level,
        interests: raw.interests,
        learning_goals: raw.learning_goals,
        concept_mastery: raw.concept_mastery,
        domain_strengths: raw.domain_strengths,
        weakness_details: raw.weakness_details,
        learning_style: raw.learning_style,
        total_lessons_completed,
        total_quizzes_taken,
        avg_quiz_score,
        streak_days,
        completion_pct,
        external_skill_context,
        goal_analysis: raw.goal_analysis,
        summary: raw.summary,
        profile_version: 2,
        generated_at: String::new(),
    })
}
