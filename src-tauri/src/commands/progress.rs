use crate::db::DbPool;
use crate::error::AppError;
use std::collections::HashMap;
use tauri::State;

use crate::commands::config_cmd::ConfigState;
use crate::models::progress::{ProgressOut, QuizResult, WrongAnswerItem};
use crate::services::llm_client::{LlmClient, LlmProvider};

#[tauri::command]
pub fn get_progress(user_id: i64, db: State<'_, DbPool>) -> Result<ProgressOut, AppError> {
    let conn = db.get()?;

    let mut p_stmt =
        conn.prepare("SELECT lesson_id FROM user_progress WHERE user_id = ?1 AND completed = 1")?;
    let completed_lesson_ids: Vec<i64> = p_stmt
        .query_map(rusqlite::params![user_id], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let mut q_stmt = conn.prepare(
        "SELECT quiz_id, score FROM quiz_attempts WHERE user_id = ?1 ORDER BY created_at DESC",
    )?;
    let quiz_scores: HashMap<i64, f64> = q_stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?))
        })?
        .filter_map(|r| r.ok())
        .fold(HashMap::new(), |mut acc, (qid, score)| {
            acc.entry(qid).or_insert(score);
            acc
        });

    Ok(ProgressOut {
        completed_lesson_ids,
        quiz_scores,
    })
}

#[tauri::command]
pub fn mark_complete(
    user_id: i64,
    lesson_id: i64,
    db: State<'_, DbPool>,
) -> Result<String, AppError> {
    let conn = db.get()?;

    conn.execute(
        "INSERT INTO user_progress (user_id, lesson_id, completed, completed_at)
         VALUES (?1, ?2, 1, datetime('now'))
         ON CONFLICT(user_id, lesson_id) DO UPDATE SET
             completed = 1,
             completed_at = datetime('now')",
        rusqlite::params![user_id, lesson_id],
    )?;

    crate::services::memory_bridge::update_learning_memory(&conn, user_id);

    Ok("ok".to_string())
}

#[tauri::command]
pub async fn submit_quiz(
    user_id: i64,
    quiz_id: i64,
    answers: Vec<i64>,
    db: State<'_, DbPool>,
    config: State<'_, ConfigState>,
) -> Result<QuizResult, AppError> {
    let (api_key, model, api_provider) = {
        let cfg = config.config.lock()?;
        (
            cfg.api_key.clone(),
            cfg.model.clone(),
            cfg.api_provider.clone(),
        )
    };
    let questions_data: Vec<crate::services::quiz_grader::QuizQuestionData> = {
        let conn = db.get()?;
        let mut stmt = conn.prepare(
            "SELECT question_text, options, correct_answer_index, explanation \
             FROM quiz_questions WHERE quiz_id = ?1",
        )?;
        let result = stmt
            .query_map(rusqlite::params![quiz_id], |row| {
                Ok(crate::services::quiz_grader::QuizQuestionData {
                    question_text: row.get(0)?,
                    options: row.get(1)?,
                    correct_answer_index: row.get(2)?,
                    explanation: row.get::<_, String>(3).unwrap_or_default(),
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        result
    };

    let client = LlmClient::new(LlmProvider::from_name(&api_provider), api_key, model);
    let (score, feedback, next_step_recommendation) =
        crate::services::quiz_grader::grade_quiz(&questions_data, &answers, &client).await;

    let total = questions_data.len() as i64;
    let correct = (score * total as f64).round() as i64;

    {
        let conn = db.get()?;
        conn.execute(
            "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback, next_step_recommendation) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                user_id,
                quiz_id,
                score,
                serde_json::to_string(&answers).unwrap_or_default(),
                feedback,
                next_step_recommendation,
            ],
        )?;

        if score >= 0.7 {
            let lesson_id: Option<i64> = conn
                .query_row(
                    "SELECT l.id FROM lessons l JOIN quizzes q ON q.lesson_id = l.id WHERE q.id = ?1",
                    rusqlite::params![quiz_id],
                    |row| row.get(0),
                )
                .ok();
            if let Some(lid) = lesson_id {
                let _ = conn.execute(
                    "INSERT INTO user_progress (user_id, lesson_id, completed, completed_at)
                     VALUES (?1, ?2, 1, datetime('now'))
                     ON CONFLICT(user_id, lesson_id) DO UPDATE SET
                         completed = 1,
                         completed_at = datetime('now')",
                    rusqlite::params![user_id, lid],
                );
            }
        }

        crate::services::memory_bridge::update_learning_memory(&conn, user_id);
    }

    Ok(QuizResult {
        score,
        total,
        correct,
        feedback,
        next_step_recommendation,
    })
}

#[tauri::command]
pub fn clear_user_data(user_id: i64, db: State<'_, DbPool>) -> Result<(), AppError> {
    let conn = db.get()?;
    conn.execute(
        "DELETE FROM messages WHERE conversation_id IN \
         (SELECT id FROM conversations WHERE user_id = ?1)",
        rusqlite::params![user_id],
    )?;
    conn.execute(
        "DELETE FROM conversations WHERE user_id = ?1",
        rusqlite::params![user_id],
    )?;
    conn.execute(
        "DELETE FROM quiz_attempts WHERE user_id = ?1",
        rusqlite::params![user_id],
    )?;
    conn.execute(
        "DELETE FROM user_progress WHERE user_id = ?1",
        rusqlite::params![user_id],
    )?;
    conn.execute(
        "DELETE FROM learning_path_history WHERE user_id = ?1",
        rusqlite::params![user_id],
    )?;
    conn.execute(
        "DELETE FROM user_profiles WHERE user_id = ?1",
        rusqlite::params![user_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn get_wrong_answers(
    user_id: i64,
    db: State<'_, DbPool>,
) -> Result<Vec<WrongAnswerItem>, AppError> {
    let conn = db.get()?;

    let mut stmt = conn.prepare(
        "SELECT qa.quiz_id, qa.answers, qa.created_at,
                qz.title as quiz_title,
                l.id as lesson_id, l.title as lesson_title,
                c.slug as course_slug
         FROM quiz_attempts qa
         JOIN quizzes qz ON qz.id = qa.quiz_id
         JOIN lessons l ON l.id = qz.lesson_id
         JOIN chapters ch ON ch.id = l.chapter_id
         JOIN courses c ON c.id = ch.course_id
         WHERE qa.user_id = ?1
         ORDER BY qa.created_at DESC",
    )?;

    let attempts: Vec<(i64, String, String, String, i64, String, String)> = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    if attempts.is_empty() {
        return Ok(Vec::new());
    }

    let mut quiz_ids: Vec<i64> = attempts.iter().map(|(qid, ..)| *qid).collect();
    quiz_ids.sort_unstable();
    quiz_ids.dedup();
    let placeholders = quiz_ids
        .iter()
        .map(|id| id.to_string())
        .collect::<Vec<_>>()
        .join(",");
    let q_sql = format!(
        "SELECT quiz_id, question_text, options, correct_answer_index, explanation \
         FROM quiz_questions WHERE quiz_id IN ({}) ORDER BY quiz_id, id",
        placeholders
    );
    let mut questions_by_quiz: HashMap<i64, Vec<(String, String, i64, String)>> = HashMap::new();
    {
        let mut q_stmt = conn.prepare(&q_sql)?;
        q_stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, String>(4).unwrap_or_default(),
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .for_each(|(qid, qtext, opts, cidx, expl)| {
                questions_by_quiz
                    .entry(qid)
                    .or_default()
                    .push((qtext, opts, cidx, expl));
            });
    }

    let mut result = Vec::new();
    for (quiz_id, answers_json, attempted_at, quiz_title, lesson_id, lesson_title, course_slug) in
        &attempts
    {
        let answers: Vec<i64> = serde_json::from_str(answers_json).unwrap_or_default();
        if let Some(questions) = questions_by_quiz.get(quiz_id) {
            for (i, (question_text, options_json, correct_idx, explanation)) in
                questions.iter().enumerate()
            {
                let user_answer = answers.get(i).copied().unwrap_or(-1);
                if user_answer != *correct_idx {
                    let options: Vec<String> =
                        serde_json::from_str(options_json).unwrap_or_default();
                    result.push(WrongAnswerItem {
                        quiz_id: *quiz_id,
                        quiz_title: quiz_title.clone(),
                        question_text: question_text.clone(),
                        options,
                        your_answer_index: user_answer,
                        correct_answer_index: *correct_idx,
                        explanation: explanation.clone(),
                        lesson_id: *lesson_id,
                        lesson_title: lesson_title.clone(),
                        course_slug: course_slug.clone(),
                        attempted_at: attempted_at.clone(),
                    });
                }
            }
        }
    }

    Ok(result)
}
