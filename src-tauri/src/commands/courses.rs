use crate::db::DbPool;
use crate::error::AppError;
use tauri::State;

use crate::models::course::{
    ChapterDetail, CourseDetail, CourseSummary, LessonDetail, LessonSummary, QuizOut,
    QuizQuestionOut,
};

#[tauri::command]
pub fn list_courses(
    db: State<'_, DbPool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<CourseSummary>, AppError> {
    let conn = db.get()?;
    let limit = limit.unwrap_or(200);
    let offset = offset.unwrap_or(0);
    let mut stmt = conn.prepare(
        "SELECT id, title, slug, description, difficulty, duration_minutes, tags \
         FROM courses ORDER BY id LIMIT ?1 OFFSET ?2",
    )?;
    let rows = stmt.query_map(rusqlite::params![limit, offset], |row| {
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
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn get_course(slug: String, db: State<'_, DbPool>) -> Result<CourseDetail, AppError> {
    let conn = db.get()?;

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
        .map_err(|e| {
            if e == rusqlite::Error::QueryReturnedNoRows {
                AppError::NotFound(format!("Course not found: {}", slug))
            } else {
                AppError::Sqlite(e)
            }
        })?;

    let mut l_stmt = conn.prepare(
        "SELECT ch.id, ch.title, ch.order_index, l.id, l.title, l.order_index, l.duration_minutes
         FROM chapters ch
         JOIN lessons l ON l.chapter_id = ch.id
         WHERE ch.course_id = ?1
         ORDER BY ch.order_index, l.order_index",
    )?;
    let lesson_rows: Vec<(i64, String, i64, i64, String, i64, i64)> = l_stmt
        .query_map(rusqlite::params![course.0], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get::<_, i64>(6).unwrap_or(0),
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut chapters_out: Vec<ChapterDetail> = Vec::new();
    for (ch_id, ch_title, ch_order, l_id, l_title, l_order, l_dur) in lesson_rows {
        match chapters_out.last_mut() {
            Some(ch) if ch.id == ch_id => {
                ch.lessons.push(LessonSummary {
                    id: l_id,
                    title: l_title,
                    order_index: l_order,
                    duration_minutes: l_dur,
                });
            }
            _ => {
                chapters_out.push(ChapterDetail {
                    id: ch_id,
                    title: ch_title,
                    order_index: ch_order,
                    lessons: vec![LessonSummary {
                        id: l_id,
                        title: l_title,
                        order_index: l_order,
                        duration_minutes: l_dur,
                    }],
                });
            }
        }
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
pub fn get_lesson(lesson_id: i64, db: State<'_, DbPool>) -> Result<LessonDetail, AppError> {
    let conn = db.get()?;
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
    .map_err(|_| AppError::NotFound(format!("Lesson not found: {}", lesson_id)))
}

#[tauri::command]
pub fn get_quiz(lesson_id: i64, db: State<'_, DbPool>) -> Result<QuizOut, AppError> {
    let conn = db.get()?;

    let (quiz_id, quiz_title) = conn
        .query_row(
            "SELECT id, title FROM quizzes WHERE lesson_id = ?1",
            rusqlite::params![lesson_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|_| AppError::NotFound(format!("Quiz not found for lesson: {}", lesson_id)))?;

    let mut q_stmt = conn.prepare(
        "SELECT id, question_text, options, explanation FROM quiz_questions WHERE quiz_id = ?1",
    )?;
    let questions: Vec<QuizQuestionOut> = q_stmt
        .query_map(rusqlite::params![quiz_id], |row| {
            Ok(QuizQuestionOut {
                id: row.get(0)?,
                question_text: row.get(1)?,
                options: row.get(2)?,
                explanation: row.get::<_, String>(3).unwrap_or_default(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(QuizOut {
        id: quiz_id,
        lesson_id,
        title: quiz_title,
        questions,
    })
}
