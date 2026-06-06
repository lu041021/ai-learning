use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::models::course::{
    ChapterDetail, CourseDetail, CourseSummary, LessonDetail, LessonSummary, QuizOut,
    QuizQuestionOut,
};

#[tauri::command]
pub fn list_courses(db: State<'_, Arc<Mutex<Connection>>>) -> Result<Vec<CourseSummary>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, slug, description, difficulty, duration_minutes, tags \
             FROM courses ORDER BY id",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let tags_json: String = row.get::<_, String>(6).unwrap_or_else(|_| "[]".to_string());
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            Ok(CourseSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                slug: row.get(2)?,
                description: row.get(3)?,
                difficulty: row
                    .get::<_, String>(4)
                    .unwrap_or_else(|_| "beginner".to_string()),
                duration_minutes: row.get::<_, i64>(5).unwrap_or(0),
                tags,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_course(
    slug: String,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<CourseDetail, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let course = conn
        .query_row(
            "SELECT id, title, slug, description, difficulty, duration_minutes, tags \
             FROM courses WHERE slug = ?1",
            rusqlite::params![slug],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)
                        .unwrap_or_else(|_| "beginner".to_string()),
                    row.get::<_, i64>(5).unwrap_or(0),
                    row.get::<_, String>(6).unwrap_or_else(|_| "[]".to_string()),
                ))
            },
        )
        .map_err(|e| format!("Course not found: {}", e))?;

    let mut ch_stmt = conn
        .prepare(
            "SELECT id, title, order_index FROM chapters WHERE course_id = ?1 ORDER BY order_index",
        )
        .map_err(|e| e.to_string())?;
    let chapters: Vec<(i64, String, i64)> = ch_stmt
        .query_map(rusqlite::params![course.0], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let _chapter_ids: Vec<i64> = chapters.iter().map(|c| c.0).collect();
    let mut chapters_out = Vec::new();

    for (ch_id, ch_title, ch_order) in &chapters {
        let mut l_stmt = conn
            .prepare(
                "SELECT id, title, order_index, duration_minutes FROM lessons \
                 WHERE chapter_id = ?1 ORDER BY order_index",
            )
            .map_err(|e| e.to_string())?;
        let lessons: Vec<LessonSummary> = l_stmt
            .query_map(rusqlite::params![ch_id], |row| {
                Ok(LessonSummary {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    order_index: row.get(2)?,
                    duration_minutes: row.get::<_, i64>(3).unwrap_or(0),
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        chapters_out.push(ChapterDetail {
            id: *ch_id,
            title: ch_title.clone(),
            order_index: *ch_order,
            lessons,
        });
    }

    let tags: Vec<String> = serde_json::from_str(&course.6).unwrap_or_default();
    Ok(CourseDetail {
        id: course.0,
        title: course.1,
        slug: course.2,
        description: course.3,
        difficulty: course.4,
        duration_minutes: course.5,
        tags,
        chapters: chapters_out,
    })
}

#[tauri::command]
pub fn get_lesson(
    lesson_id: i64,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<LessonDetail, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, title, content_md, order_index, chapter_id, duration_minutes \
         FROM lessons WHERE id = ?1",
        rusqlite::params![lesson_id],
        |row| {
            Ok(LessonDetail {
                id: row.get(0)?,
                title: row.get(1)?,
                content_md: row.get(2)?,
                order_index: row.get(3)?,
                chapter_id: row.get(4)?,
                duration_minutes: row.get::<_, i64>(5).unwrap_or(0),
            })
        },
    )
    .map_err(|e| format!("Lesson not found: {}", e))
}

#[tauri::command]
pub fn get_quiz(lesson_id: i64, db: State<'_, Arc<Mutex<Connection>>>) -> Result<QuizOut, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let (quiz_id, quiz_title) = conn
        .query_row(
            "SELECT id, title FROM quizzes WHERE lesson_id = ?1",
            rusqlite::params![lesson_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|e| format!("Quiz not found: {}", e))?;

    let mut q_stmt = conn
        .prepare(
            "SELECT id, question_text, options, explanation FROM quiz_questions WHERE quiz_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let questions: Vec<QuizQuestionOut> = q_stmt
        .query_map(rusqlite::params![quiz_id], |row| {
            Ok(QuizQuestionOut {
                id: row.get(0)?,
                question_text: row.get(1)?,
                options: row.get(2)?,
                explanation: row.get::<_, String>(3).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(QuizOut {
        id: quiz_id,
        lesson_id,
        title: quiz_title,
        questions,
    })
}
