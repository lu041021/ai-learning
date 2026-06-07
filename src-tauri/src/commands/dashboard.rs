use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::models::dashboard::{
    CalendarDay, CourseProgressItem, DashboardData, SkillRadarItem, TreeNodeData,
};

#[tauri::command]
pub fn get_dashboard_data(
    user_id: i64,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<DashboardData, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    let (total_lessons, completed_lessons) = {
        let mut stmt = conn
            .prepare("SELECT COUNT(*) FROM lessons")
            .map_err(|e| e.to_string())?;
        let total: i64 = stmt
            .query_row([], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare("SELECT COUNT(*) FROM user_progress WHERE user_id = ?1 AND completed = 1")
            .map_err(|e| e.to_string())?;
        let completed: i64 = stmt
            .query_row(rusqlite::params![user_id], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        (total, completed)
    };

    let (total_quizzes, avg_quiz_score) = {
        let mut stmt = conn
            .prepare("SELECT COUNT(*), AVG(score) FROM quiz_attempts WHERE user_id = ?1")
            .map_err(|e| e.to_string())?;
        let result: (i64, Option<f64>) = stmt
            .query_row(rusqlite::params![user_id], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| e.to_string())?;
        (result.0, result.1.unwrap_or(0.0))
    };

    let skill_radar = build_skill_radar(&conn, user_id)?;

    let course_progress = build_course_progress(&conn, user_id)?;

    let calendar_days = build_calendar_days(&conn, user_id)?;

    let knowledge_tree = build_knowledge_tree(&conn, user_id)?;

    Ok(DashboardData {
        total_lessons,
        completed_lessons,
        total_quizzes,
        avg_quiz_score,
        skill_radar,
        course_progress,
        calendar_days,
        knowledge_tree,
    })
}

fn build_skill_radar(conn: &Connection, user_id: i64) -> Result<Vec<SkillRadarItem>, String> {
    let interests_json: Option<String> = conn
        .query_row(
            "SELECT interests FROM user_profiles WHERE user_id = ?1",
            rusqlite::params![user_id],
            |row| row.get(0),
        )
        .ok();

    let interests: Vec<String> = interests_json
        .and_then(|j| serde_json::from_str(&j).ok())
        .unwrap_or_default();

    let global_avg: f64 = conn
        .query_row(
            "SELECT AVG(score) FROM quiz_attempts WHERE user_id = ?1",
            rusqlite::params![user_id],
            |row| {
                let v: Option<f64> = row.get(0)?;
                Ok(v.unwrap_or(0.0))
            },
        )
        .unwrap_or(0.0);

    let mut course_stmt = conn
        .prepare(
            "SELECT c.id, c.title, AVG(qa.score) as avg_score
             FROM quiz_attempts qa
             JOIN quizzes q ON q.id = qa.quiz_id
             JOIN lessons l ON l.id = q.lesson_id
             JOIN chapters ch ON ch.id = l.chapter_id
             JOIN courses c ON c.id = ch.course_id
             WHERE qa.user_id = ?1
             GROUP BY c.id",
        )
        .map_err(|e| e.to_string())?;
    let course_scores: Vec<(i64, String, f64)> = course_stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(interests
        .into_iter()
        .map(|label| {
            let matched = course_scores
                .iter()
                .find(|(_, title, _)| title.to_lowercase().contains(&label.to_lowercase()))
                .map(|(_, _, s)| *s)
                .unwrap_or(global_avg);
            SkillRadarItem {
                label,
                score: matched,
            }
        })
        .collect())
}

fn build_course_progress(
    conn: &Connection,
    user_id: i64,
) -> Result<Vec<CourseProgressItem>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.title, c.slug,
                    COUNT(l.id) as total,
                    COUNT(CASE WHEN up.completed = 1 THEN 1 END) as completed
             FROM courses c
             JOIN chapters ch ON ch.course_id = c.id
             JOIN lessons l ON l.chapter_id = ch.id
             LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = ?1
             GROUP BY c.id
             ORDER BY c.id",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(CourseProgressItem {
                course_id: row.get(0)?,
                title: row.get(1)?,
                slug: row.get(2)?,
                total_lessons: row.get(3)?,
                completed_lessons: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

fn build_calendar_days(conn: &Connection, user_id: i64) -> Result<Vec<CalendarDay>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT date(created_at) as d, COUNT(*) as cnt
             FROM quiz_attempts
             WHERE user_id = ?1 AND created_at >= date('now', '-90 days')
             GROUP BY d
             ORDER BY d",
        )
        .map_err(|e| e.to_string())?;

    let days: Vec<CalendarDay> = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(CalendarDay {
                date: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(days)
}

fn build_knowledge_tree(conn: &Connection, user_id: i64) -> Result<Vec<TreeNodeData>, String> {
    // One query: all courses + chapters (ordered)
    let mut ch_stmt = conn
        .prepare(
            "SELECT c.id, c.title, c.slug, ch.id, ch.title
             FROM courses c
             JOIN chapters ch ON ch.course_id = c.id
             ORDER BY c.id, ch.order_index",
        )
        .map_err(|e| e.to_string())?;
    let ch_rows: Vec<(i64, String, String, i64, String)> = ch_stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // One query: all lessons with completion status (ordered)
    let mut l_stmt = conn
        .prepare(
            "SELECT l.chapter_id, l.id, l.title,
                    CASE WHEN up.completed = 1 OR qa.score >= 0.7 THEN 1 ELSE 0 END as is_completed
             FROM lessons l
             LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = ?1
             LEFT JOIN quizzes qz ON qz.lesson_id = l.id
             LEFT JOIN quiz_attempts qa ON qa.quiz_id = qz.id AND qa.user_id = ?1
             ORDER BY l.chapter_id, l.order_index",
        )
        .map_err(|e| e.to_string())?;
    // chapter_id -> Vec<(lesson_id, title, completed)>
    let mut lessons_by_chapter: std::collections::HashMap<i64, Vec<(i64, String, bool)>> =
        std::collections::HashMap::new();
    l_stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)? != 0,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
        .into_iter()
        .for_each(|(ch_id, l_id, l_title, completed)| {
            lessons_by_chapter
                .entry(ch_id)
                .or_default()
                .push((l_id, l_title, completed));
        });

    // Assemble tree in memory
    let mut result: Vec<TreeNodeData> = Vec::new();
    let mut last_course_id = -1i64;

    for (course_id, course_title, slug, ch_id, ch_title) in ch_rows {
        if course_id != last_course_id {
            result.push(TreeNodeData {
                id: course_id,
                title: course_title,
                kind: "course".to_string(),
                completed: false,
                children: Vec::new(),
                course_slug: Some(slug),
            });
            last_course_id = course_id;
        }

        let course_node = result.last_mut().unwrap();
        let lessons = lessons_by_chapter.remove(&ch_id).unwrap_or_default();

        let lesson_nodes: Vec<TreeNodeData> = lessons
            .into_iter()
            .map(|(l_id, l_title, l_completed)| TreeNodeData {
                id: l_id,
                title: l_title,
                kind: "lesson".to_string(),
                completed: l_completed,
                children: Vec::new(),
                course_slug: None,
            })
            .collect();
        let ch_all_done = !lesson_nodes.is_empty() && lesson_nodes.iter().all(|l| l.completed);
        let chapter_node = TreeNodeData {
            id: ch_id,
            title: ch_title,
            kind: "chapter".to_string(),
            completed: ch_all_done,
            children: lesson_nodes,
            course_slug: None,
        };
        course_node.children.push(chapter_node);
    }

    // Compute course-level completion from children
    for course in &mut result {
        let has_lessons = course.children.iter().any(|ch| !ch.children.is_empty());
        if has_lessons {
            course.completed = course
                .children
                .iter()
                .all(|ch| ch.children.is_empty() || ch.completed);
        }
    }

    Ok(result)
}
