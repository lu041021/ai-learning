use rusqlite::Connection;
use serde_json::json;
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::models::learning_path::{LearningPathOut, LearningPathStep};
use crate::models::user_profile::{
    AssessUserSkillInput, AssessmentResponse, SkillAssessment, UserProfileFull, UserProfileOut,
};
use crate::services::llm_client::{LlmClient, LlmProvider};
use crate::services::profile_builder::{ProfileBuildData, QuizHistoryItem};

#[tauri::command]
pub async fn assess_user_skill(
    input: AssessUserSkillInput,
    db: State<'_, Arc<Mutex<Connection>>>,
    api_key: String,
    model: String,
    api_provider: String,
) -> Result<UserProfileOut, String> {
    if api_key.is_empty() {
        return Err("请先在设置中配置 API Key".to_string());
    }

    let client = LlmClient::new(LlmProvider::from_name(&api_provider), api_key, model);
    let assessment: SkillAssessment =
        crate::services::skill_assessor::assess_skill(&input.responses, &client).await?;

    let conn = db.lock().map_err(|e| e.to_string())?;

    let interests_json = serde_json::to_string(&assessment.interests).unwrap_or_default();
    let responses_json = serde_json::to_string(&input.responses).unwrap_or_default();

    let existing_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM user_profiles WHERE user_id = ?1",
            rusqlite::params![input.user_id],
            |row| row.get(0),
        )
        .ok();

    let profile_id = if let Some(pid) = existing_id {
        conn.execute(
            "UPDATE user_profiles SET experience_level=?1, interests=?2, learning_goals=?3, assessment_completed=1, assessment_responses=?4, summary=?5, updated_at=datetime('now') WHERE id=?6",
            rusqlite::params![
                assessment.experience_level,
                interests_json,
                assessment.learning_goals,
                responses_json,
                assessment.summary,
                pid,
            ],
        ).map_err(|e| e.to_string())?;
        pid
    } else {
        conn.execute(
            "INSERT INTO user_profiles (user_id, experience_level, interests, learning_goals, assessment_completed, assessment_responses, summary) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)",
            rusqlite::params![
                input.user_id,
                assessment.experience_level,
                interests_json,
                assessment.learning_goals,
                responses_json,
                assessment.summary,
            ],
        ).map_err(|e| e.to_string())?;
        conn.last_insert_rowid()
    };

    Ok(UserProfileOut {
        id: profile_id,
        user_id: input.user_id,
        experience_level: assessment.experience_level,
        interests: assessment.interests,
        learning_goals: assessment.learning_goals,
        assessment_completed: true,
        summary: assessment.summary,
    })
}

#[tauri::command]
pub fn get_user_profile(
    user_id: i64,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<Option<UserProfileOut>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, user_id, experience_level, interests, learning_goals, assessment_completed, summary FROM user_profiles WHERE user_id = ?1",
        rusqlite::params![user_id],
        |row| {
            let interests_str: String = row.get(3)?;
            let interests: Vec<String> = serde_json::from_str(&interests_str).unwrap_or_default();
            Ok(UserProfileOut {
                id: row.get(0)?,
                user_id: row.get(1)?,
                experience_level: row.get(2)?,
                interests,
                learning_goals: row.get(4)?,
                assessment_completed: row.get::<_, i64>(5)? == 1,
                summary: row.get::<_, String>(6).unwrap_or_default(),
            })
        },
    );
    match result {
        Ok(profile) => Ok(Some(profile)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn generate_learning_path(
    user_id: i64,
    db: State<'_, Arc<Mutex<Connection>>>,
    api_key: String,
    model: String,
    api_provider: String,
) -> Result<LearningPathOut, String> {
    if api_key.is_empty() {
        return Err("请先在设置中配置 API Key".to_string());
    }

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
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
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

        let outline = build_course_outline(&conn)?;

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
    eprintln!("[generate_path] provider={api_provider} model={model} experience={experience_level} interests={interests:?} outline_len={}", course_outline.len());
    let steps: Vec<LearningPathStep> = crate::services::skill_assessor::generate_path(
        &experience_level,
        &interests,
        &learning_goals,
        completed_count,
        total_lessons,
        &quiz_avg,
        &course_outline,
        &client,
    )
    .await
    .map_err(|e| {
        eprintln!("[generate_path] LLM error: {e}");
        format!("AI 生成路线失败: {e}")
    })?;

    let steps_json = serde_json::to_string(&steps).unwrap_or_default();
    let context_snapshot = serde_json::to_string(&json!({
        "experience_level": experience_level,
        "interests": interests,
        "learning_goals": learning_goals,
        "completed_count": completed_count,
        "total_lessons": total_lessons,
        "quiz_avg": quiz_avg,
    }))
    .unwrap_or_default();
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Deactivate existing active paths
    conn.execute(
        "UPDATE learning_path_history SET is_active = 0 WHERE user_id = ?1 AND is_active = 1",
        rusqlite::params![user_id],
    )
    .map_err(|e| e.to_string())?;

    // Determine new version
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

#[tauri::command]
pub fn get_learning_path(
    user_id: i64,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<Option<LearningPathOut>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, steps_json, generated_at, updated_at FROM learning_path_history WHERE user_id = ?1 AND is_active = 1",
        rusqlite::params![user_id],
        |row| {
            let steps_str: String = row.get(1)?;
            let steps: Vec<LearningPathStep> = serde_json::from_str(&steps_str).unwrap_or_default();
            Ok(LearningPathOut {
                id: row.get(0)?,
                user_id,
                steps,
                generated_at: row.get::<_, String>(2).unwrap_or_default(),
                updated_at: row.get::<_, String>(3).unwrap_or_default(),
            })
        },
    );
    match result {
        Ok(mut path) => {
            // Patch step statuses based on current progress
            let mut found_incomplete = false;
            for step in &mut path.steps {
                if step.status == "completed" {
                    continue;
                }
                let is_completed = if let Some(lid) = step.lesson_id {
                    conn.query_row(
                        "SELECT EXISTS(SELECT 1 FROM user_progress WHERE user_id = ?1 AND lesson_id = ?2 AND completed = 1)",
                        rusqlite::params![user_id, lid],
                        |r| r.get::<_, i64>(0),
                    ).unwrap_or(0) == 1
                } else {
                    false
                };
                if is_completed {
                    step.status = "completed".to_string();
                } else if !found_incomplete {
                    step.status = "in_progress".to_string();
                    found_incomplete = true;
                }
            }
            Ok(Some(path))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct LearningPathVersionSummary {
    pub id: i64,
    pub version: i64,
    pub is_active: bool,
    pub generated_at: String,
    pub step_count: usize,
}

#[tauri::command]
pub fn list_learning_path_versions(
    user_id: i64,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<Vec<LearningPathVersionSummary>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, version, is_active, generated_at, steps_json FROM learning_path_history WHERE user_id = ?1 ORDER BY version DESC")
        .map_err(|e| e.to_string())?;
    let versions = stmt
        .query_map(rusqlite::params![user_id], |row| {
            let steps_str: String = row.get(4)?;
            let steps: Vec<serde_json::Value> =
                serde_json::from_str(&steps_str).unwrap_or_default();
            Ok(LearningPathVersionSummary {
                id: row.get(0)?,
                version: row.get(1)?,
                is_active: row.get::<_, i64>(2)? == 1,
                generated_at: row.get(3)?,
                step_count: steps.len(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(versions)
}

#[tauri::command]
pub fn get_learning_path_version(
    user_id: i64,
    version_id: i64,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<Option<LearningPathOut>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT id, steps_json, generated_at, updated_at FROM learning_path_history WHERE id = ?1 AND user_id = ?2",
        rusqlite::params![version_id, user_id],
        |row| {
            let steps_str: String = row.get(1)?;
            let steps: Vec<LearningPathStep> = serde_json::from_str(&steps_str).unwrap_or_default();
            Ok(LearningPathOut {
                id: row.get(0)?,
                user_id,
                steps,
                generated_at: row.get::<_, String>(2).unwrap_or_default(),
                updated_at: row.get::<_, String>(3).unwrap_or_default(),
            })
        },
    );
    match result {
        Ok(path) => Ok(Some(path)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn build_course_outline(conn: &Connection) -> Result<String, String> {
    let mut course_stmt = conn
        .prepare("SELECT id, title FROM courses ORDER BY id")
        .map_err(|e| e.to_string())?;
    let courses: Vec<(i64, String)> = course_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let total_lessons: i64 = conn
        .query_row("SELECT COUNT(*) FROM lessons", [], |r| r.get(0))
        .unwrap_or(0);

    let mut lines = Vec::new();
    let mut lesson_count = 0;
    const MAX_LESSONS: usize = 50;

    for (course_id, course_title) in &courses {
        if lesson_count >= MAX_LESSONS {
            break;
        }
        lines.push(format!("Course: {} (id={})", course_title, course_id));

        let mut ch_stmt = conn
            .prepare("SELECT id, title FROM chapters WHERE course_id = ?1 ORDER BY order_index")
            .map_err(|e| e.to_string())?;
        let chapters: Vec<(i64, String)> = ch_stmt
            .query_map(rusqlite::params![course_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        for (ch_id, ch_title) in &chapters {
            if lesson_count >= MAX_LESSONS {
                break;
            }
            lines.push(format!("  Chapter: {}", ch_title));

            let mut ls_stmt = conn
                .prepare("SELECT id, title FROM lessons WHERE chapter_id = ?1 ORDER BY order_index")
                .map_err(|e| e.to_string())?;
            let lessons: Vec<(i64, String)> = ls_stmt
                .query_map(rusqlite::params![ch_id], |row| {
                    Ok((row.get(0)?, row.get(1)?))
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;

            for (ls_id, ls_title) in &lessons {
                if lesson_count >= MAX_LESSONS {
                    break;
                }
                lines.push(format!("    Lesson: {} (id={})", ls_title, ls_id));
                lesson_count += 1;
            }
        }
    }
    if total_lessons > MAX_LESSONS as i64 {
        lines.push(format!(
            "\n(以上仅列出前{}课时，共{}课时。请基于已列出的课时设计路线。)",
            MAX_LESSONS, total_lessons
        ));
    }
    Ok(lines.join("\n"))
}

#[tauri::command]
pub async fn assess_user_skill_deep(
    input: AssessUserSkillInput,
    db: State<'_, Arc<Mutex<Connection>>>,
    api_key: String,
    model: String,
    api_provider: String,
) -> Result<UserProfileFull, String> {
    if api_key.is_empty() {
        return Err("请先在设置中配置 API Key".to_string());
    }

    let (
        responses_text,
        goal_text,
        quiz_history,
        concept_scores,
        completed_lessons,
        chat_topics,
        streak_days,
        completion_pct,
        avg_quiz_score,
        total_lessons,
        total_quizzes,
        wrong_concepts,
        domain_accuracy,
    ) = {
        let conn = db.lock().map_err(|e| e.to_string())?;
        gather_profile_data(&conn, input.user_id, &input.responses)?
    };

    let data = ProfileBuildData {
        responses_text,
        goal_text,
        quiz_history,
        concept_scores,
        completed_lessons,
        chat_topics,
        streak_days,
        completion_pct,
        avg_quiz_score,
        total_lessons,
        total_quizzes,
        usage_context: None,
        wrong_concepts,
        domain_accuracy,
    };

    let prompt = crate::services::profile_builder::build_deep_profile_prompt(&data);
    let client = LlmClient::new(LlmProvider::from_name(&api_provider), api_key, model);

    let response_text = client
        .chat(
            "你是一位资深 AI 教育诊断专家。你只回复 JSON，不包含 markdown 标记或其他文字。",
            &prompt,
            4096,
        )
        .await?;

    let cleaned = crate::services::skill_assessor::clean_json_response(&response_text);
    let mut profile = crate::services::profile_builder::profile_from_llm_json(
        &cleaned,
        data.completed_lessons.len() as i64,
        total_quizzes,
        avg_quiz_score,
        streak_days,
        completion_pct,
        None,
    )?;
    profile.generated_at = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let profile_json = serde_json::to_string(&profile).unwrap_or_default();
    let conn = db.lock().map_err(|e| e.to_string())?;
    let existing_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM user_profiles WHERE user_id = ?1",
            rusqlite::params![input.user_id],
            |row| row.get(0),
        )
        .ok();

    if let Some(pid) = existing_id {
        conn.execute(
            "UPDATE user_profiles SET profile_data = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![profile_json, pid],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(profile)
}

#[tauri::command]
pub async fn generate_enriched_learning_path(
    user_id: i64,
    db: State<'_, Arc<Mutex<Connection>>>,
    api_key: String,
    model: String,
    api_provider: String,
) -> Result<LearningPathOut, String> {
    if api_key.is_empty() {
        return Err("请先在设置中配置 API Key".to_string());
    }

    let (profile, course_outline) = {
        let conn = db.lock().map_err(|e| e.to_string())?;

        let profile_json: String = conn
            .query_row(
                "SELECT COALESCE(profile_data, '') FROM user_profiles WHERE user_id = ?1",
                rusqlite::params![user_id],
                |row| row.get(0),
            )
            .map_err(|_| "请先完成深度评估".to_string())?;

        if profile_json.is_empty() {
            return Err("请先完成深度评估再生成路线".to_string());
        }

        let profile: UserProfileFull =
            serde_json::from_str(&profile_json).map_err(|e| format!("读取画像数据失败: {}", e))?;

        let outline = build_course_outline(&conn)?;
        (profile, outline)
    };

    let client = LlmClient::new(
        LlmProvider::from_name(&api_provider),
        api_key,
        model.clone(),
    );
    let steps = crate::services::skill_assessor::generate_path_from_profile(
        &profile,
        &course_outline,
        &client,
    )
    .await
    .map_err(|e| format!("AI 生成路线失败: {e}"))?;

    let steps_json = serde_json::to_string(&steps).unwrap_or_default();
    let context_snapshot = serde_json::to_string(&profile).unwrap_or_default();
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

#[allow(clippy::type_complexity)]
fn gather_profile_data(
    conn: &Connection,
    user_id: i64,
    responses: &[AssessmentResponse],
) -> Result<
    (
        String,
        String,
        Vec<QuizHistoryItem>,
        Vec<(String, String, f64, i64)>,
        Vec<String>,
        Vec<String>,
        i64,
        f64,
        f64,
        i64,
        i64,
        Vec<(String, f64)>,
        Vec<(String, f64, i64)>,
    ),
    String,
> {
    let responses_text = responses
        .iter()
        .map(|r| format!("Q: {}\nA: {}", r.question_text, r.answer_text))
        .collect::<Vec<_>>()
        .join("\n\n");

    let goal_text = responses
        .iter()
        .find(|r| r.question_text.contains("目标"))
        .map(|r| r.answer_text.clone())
        .unwrap_or_default();

    let mut q_stmt = conn
        .prepare(
            "SELECT l.title, qa.score, qa.created_at
             FROM quiz_attempts qa
             JOIN quizzes qz ON qz.id = qa.quiz_id
             JOIN lessons l ON l.id = qz.lesson_id
             WHERE qa.user_id = ?1
             ORDER BY qa.created_at DESC
             LIMIT 20",
        )
        .map_err(|e| e.to_string())?;
    let quiz_history: Vec<QuizHistoryItem> = q_stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(QuizHistoryItem {
                lesson_title: row.get(0)?,
                score: row.get(1)?,
                attempted_at: row.get::<_, String>(2).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut c_stmt = conn
        .prepare(
            "SELECT c.name, c.domain, AVG(qa.score), COUNT(*)
             FROM quiz_attempts qa
             JOIN quizzes qz ON qz.id = qa.quiz_id
             JOIN lessons l ON l.id = qz.lesson_id
             JOIN lesson_concepts lc ON lc.lesson_id = l.id
             JOIN concepts c ON c.id = lc.concept_id
             WHERE qa.user_id = ?1
             GROUP BY c.name, c.domain
             ORDER BY AVG(qa.score) ASC",
        )
        .map_err(|e| e.to_string())?;
    let concept_scores: Vec<(String, String, f64, i64)> = c_stmt
        .query_map(rusqlite::params![user_id], |row| {
            let avg: f64 = row.get(2)?;
            Ok((
                row.get(0)?,
                row.get(1)?,
                (avg * 100.0).round() / 100.0,
                row.get(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let weak_concepts: Vec<(String, f64)> = concept_scores
        .iter()
        .filter(|(_, _, score, _)| *score < 0.7)
        .map(|(name, _, score, _)| (name.clone(), *score))
        .collect();

    let mut l_stmt = conn
        .prepare(
            "SELECT l.title FROM user_progress up
             JOIN lessons l ON l.id = up.lesson_id
             WHERE up.user_id = ?1 AND up.completed = 1
             ORDER BY up.completed_at DESC
             LIMIT 15",
        )
        .map_err(|e| e.to_string())?;
    let completed_lessons: Vec<String> = l_stmt
        .query_map(rusqlite::params![user_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let chat_topics: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT m.content FROM messages m
                 JOIN conversations conv ON conv.id = m.conversation_id
                 WHERE conv.user_id = ?1 AND m.role = 'user'
                 ORDER BY m.created_at DESC LIMIT 30",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![user_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        let msgs: Vec<String> = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        msgs.into_iter()
            .map(|m| {
                if m.len() > 80 {
                    format!("{}...", &m[..80])
                } else {
                    m
                }
            })
            .collect()
    };

    let completed_dates: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT DISTINCT date(completed_at) FROM user_progress
                 WHERE user_id = ?1 AND completed = 1
                 ORDER BY date(completed_at) DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![user_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    let streak_days = compute_current_streak(&completed_dates);

    let total_lessons: i64 = conn
        .query_row("SELECT COUNT(*) FROM lessons", [], |r| r.get(0))
        .unwrap_or(1);
    let completed_count = completed_lessons.len() as i64;
    let completion_pct = if total_lessons > 0 {
        ((completed_count as f64 / total_lessons as f64) * 1000.0).round() / 10.0
    } else {
        0.0
    };

    let avg_quiz_score: f64 = conn
        .query_row(
            "SELECT AVG(score) FROM quiz_attempts WHERE user_id = ?1",
            rusqlite::params![user_id],
            |r| {
                let avg: Option<f64> = r.get(0)?;
                Ok(avg.unwrap_or(0.0) * 100.0)
            },
        )
        .unwrap_or(0.0);
    let avg_quiz_score = (avg_quiz_score * 10.0).round() / 10.0;

    let total_quizzes: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM quiz_attempts WHERE user_id = ?1",
            rusqlite::params![user_id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let mut d_stmt = conn
        .prepare(
            "SELECT c.domain, AVG(qa.score) * 100.0, COUNT(*)
             FROM quiz_attempts qa
             JOIN quizzes qz ON qz.id = qa.quiz_id
             JOIN lessons l ON l.id = qz.lesson_id
             JOIN lesson_concepts lc ON lc.lesson_id = l.id
             JOIN concepts c ON c.id = lc.concept_id
             WHERE qa.user_id = ?1
             GROUP BY c.domain
             ORDER BY AVG(qa.score) ASC",
        )
        .map_err(|e| e.to_string())?;
    let d_rows = d_stmt
        .query_map(rusqlite::params![user_id], |row| {
            let acc: f64 = row.get(1)?;
            Ok((row.get(0)?, (acc * 10.0).round() / 10.0, row.get(2)?))
        })
        .map_err(|e| e.to_string())?;
    let domain_accuracy: Vec<(String, f64, i64)> = d_rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok((
        responses_text,
        goal_text,
        quiz_history,
        concept_scores,
        completed_lessons,
        chat_topics,
        streak_days,
        completion_pct,
        avg_quiz_score,
        total_lessons,
        total_quizzes,
        weak_concepts,
        domain_accuracy,
    ))
}

fn compute_current_streak(dates: &[String]) -> i64 {
    if dates.is_empty() {
        return 0;
    }
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let mut streak = if dates[0] == today { 1i64 } else { return 0i64 };

    for i in 1..dates.len() {
        let prev = &dates[i - 1];
        let cur = &dates[i];
        if prev == cur {
            continue;
        }
        if prev.len() < 10 || cur.len() < 10 {
            continue;
        }
        let prev_day: i64 = prev[8..10].parse().unwrap_or(0);
        let cur_day: i64 = cur[8..10].parse().unwrap_or(0);
        if prev_day == cur_day + 1 || prev_day == 1 && cur_day >= 28 {
            streak += 1;
        } else {
            break;
        }
    }
    streak
}
