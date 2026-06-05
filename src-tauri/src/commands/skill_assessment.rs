use rusqlite::Connection;
use serde_json::json;
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::models::user_profile::{
    AssessUserSkillInput, SkillAssessment, UserProfileOut,
};
use crate::models::learning_path::{LearningPathOut, LearningPathStep};
use crate::services::llm_client::{LlmClient, LlmProvider};

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

    let client = LlmClient::new(LlmProvider::from_str(&api_provider), api_key, model);
    let assessment: SkillAssessment = crate::services::skill_assessor::assess_skill(
        &input.responses,
        &client,
    )
    .await?;

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

    let (experience_level, interests, learning_goals, completed_count, total_lessons, quiz_avg, course_outline) = {
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

        (el, interests, lg, completed_count, total_lessons, quiz_avg, outline)
    };

    let client = LlmClient::new(LlmProvider::from_str(&api_provider), api_key, model);
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
    .await?;

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
            let steps: Vec<serde_json::Value> = serde_json::from_str(&steps_str).unwrap_or_default();
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

fn build_course_outline(conn: &Connection) -> Result<String, String> {
    let mut course_stmt = conn
        .prepare("SELECT id, title FROM courses ORDER BY id")
        .map_err(|e| e.to_string())?;
    let courses: Vec<(i64, String)> = course_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut lines = Vec::new();
    for (course_id, course_title) in &courses {
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
                lines.push(format!("    Lesson: {} (id={})", ls_title, ls_id));
            }
        }
    }
    Ok(lines.join("\n"))
}
