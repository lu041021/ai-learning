use std::sync::{Arc, Mutex};

use crate::models::learning_path::{LearningPathOut, LearningPathStep};
use crate::models::usage_profile::UsageProfile;
use crate::services::llm_client::{LlmClient, LlmProvider};

#[tauri::command]
pub async fn analyze_usage(
    api_key: String,
    model: String,
    api_provider: String,
) -> Result<UsageProfile, String> {
    if api_key.is_empty() {
        return Err("请先在设置中配置 API Key".to_string());
    }
    let client = LlmClient::new(LlmProvider::from_name(&api_provider), api_key, model);
    crate::services::usage_analyzer::analyze_usage(&client).await
}

#[tauri::command]
pub async fn generate_goal_path(
    user_id: i64,
    db: tauri::State<'_, Arc<Mutex<rusqlite::Connection>>>,
    api_key: String,
    model: String,
    api_provider: String,
) -> Result<LearningPathOut, String> {
    if api_key.is_empty() {
        return Err("请先在设置中配置 API Key".to_string());
    }

    let usage_context = {
        let client = LlmClient::new(
            LlmProvider::from_name(&api_provider),
            api_key.clone(),
            model.clone(),
        );
        match crate::services::usage_analyzer::analyze_usage(&client).await {
            Ok(profile) => {
                let mut ctx = String::new();
                ctx.push_str(&format!(
                    "- 频繁主题：{}\n",
                    profile.frequent_topics.join("、")
                ));
                ctx.push_str("- 工具使用：\n");
                for t in &profile.tool_usage {
                    ctx.push_str(&format!(
                        "  - {} (频率: {}, 熟练度: {})\n",
                        t.tool_name, t.frequency, t.proficiency_hint
                    ));
                }
                if !profile.error_patterns.is_empty() {
                    ctx.push_str(&format!(
                        "- 常遇问题：{}\n",
                        profile.error_patterns.join("、")
                    ));
                }
                if !profile.knowledge_gaps.is_empty() {
                    ctx.push_str("- 知识缺口：\n");
                    for g in &profile.knowledge_gaps {
                        ctx.push_str(&format!(
                            "  - {} (严重度: {}): {}\n",
                            g.domain, g.severity, g.description
                        ));
                    }
                }
                if !profile.learning_recommendations.is_empty() {
                    ctx.push_str(&format!(
                        "- 推荐方向：{}\n",
                        profile.learning_recommendations.join("、")
                    ));
                }
                ctx.push_str(&format!("- 使用概况：{}\n", profile.experience_summary));
                ctx
            }
            Err(e) => {
                eprintln!("[generate_goal_path] usage analysis failed, continuing without: {e}");
                "暂无使用分析数据".to_string()
            }
        }
    };

    let (
        experience_level,
        interests,
        learning_goals,
        completed_count,
        total_lessons,
        quiz_avg,
        course_outline,
    ) = {
        let conn = db.lock().map_err(|e| e.to_string())?;

        let (el, interests_str, lg) = conn
            .query_row(
                "SELECT experience_level, interests, learning_goals FROM user_profiles WHERE user_id = ?1",
                rusqlite::params![user_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)),
            )
            .map_err(|_| "请先完成入门评估".to_string())?;

        let interests: Vec<String> = serde_json::from_str(&interests_str).unwrap_or_default();

        let completed_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM user_progress WHERE user_id = ?1 AND completed = 1",
                rusqlite::params![user_id],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let total_lessons: i64 = conn
            .query_row("SELECT COUNT(*) FROM lessons", [], |r| r.get(0))
            .unwrap_or(0);

        let quiz_avg = crate::services::ai_tutor::query_quiz_avg(&conn, user_id)
            .unwrap_or_else(|_| "N/A".to_string());

        let outline = crate::commands::skill_assessment::build_course_outline(&conn)?;

        (
            el,
            interests,
            lg,
            completed_count,
            total_lessons,
            quiz_avg,
            outline,
        )
    };

    let client = LlmClient::new(
        LlmProvider::from_name(&api_provider),
        api_key,
        model.clone(),
    );
    let steps: Vec<LearningPathStep> = crate::services::skill_assessor::generate_goal_path(
        &experience_level,
        &interests,
        &learning_goals,
        completed_count,
        total_lessons,
        &quiz_avg,
        &course_outline,
        &usage_context,
        &client,
    )
    .await
    .map_err(|e| format!("AI 生成路线失败: {e}"))?;

    let steps_json = serde_json::to_string(&steps).unwrap_or_default();
    let context_snapshot = serde_json::to_string(&serde_json::json!({
        "experience_level": experience_level,
        "interests": interests,
        "learning_goals": learning_goals,
        "completed_count": completed_count,
        "total_lessons": total_lessons,
        "quiz_avg": quiz_avg,
        "usage_context": usage_context,
    }))
    .unwrap_or_default();
    let conn = db.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE learning_path_history SET is_active = 0 WHERE user_id = ?1 AND is_active = 1",
        rusqlite::params![user_id],
    )
    .map_err(|e| e.to_string())?;

    let next_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) + 1 FROM learning_path_history WHERE user_id = ?1",
            rusqlite::params![user_id],
            |row| row.get(0),
        )
        .unwrap_or(1);

    conn.execute(
        "INSERT INTO learning_path_history (user_id, steps_json, version, is_active, context_snapshot) VALUES (?1, ?2, ?3, 1, ?4)",
        rusqlite::params![user_id, steps_json, next_version, context_snapshot],
    )
    .map_err(|e| e.to_string())?;

    let path_id = conn.last_insert_rowid();

    Ok(LearningPathOut {
        id: path_id,
        user_id,
        steps,
        generated_at: String::new(),
        updated_at: String::new(),
    })
}
