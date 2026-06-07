use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationItem {
    pub course_id: i64,
    pub title: String,
    pub slug: String,
    pub description: String,
    pub score: f64,
    pub reason: String,
    pub tags: Vec<String>,
    pub total_lessons: i64,
    pub completed_lessons: i64,
}

pub fn get_recommendations(db: &DbPool, user_id: i64) -> Result<Vec<RecommendationItem>, String> {
    let conn = db.get().map_err(|e| e.to_string())?;

    // Get user profile
    let (interests, experience_level) = match conn.query_row(
        "SELECT interests, experience_level FROM user_profiles WHERE user_id = ?1",
        rusqlite::params![user_id],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
    ) {
        Ok(v) => v,
        Err(_) => return Ok(Vec::new()),
    };
    let interests: Vec<String> = serde_json::from_str(&interests).unwrap_or_default();
    let interest_lower: Vec<String> = interests.iter().map(|s| s.to_lowercase()).collect();

    // Get all courses with lesson counts
    let mut c_stmt = conn
        .prepare(
            "SELECT c.id, c.title, c.slug, c.description, COUNT(l.id) as total
             FROM courses c
             JOIN chapters ch ON ch.course_id = c.id
             JOIN lessons l ON l.chapter_id = ch.id
             GROUP BY c.id",
        )
        .map_err(|e| e.to_string())?;
    let courses: Vec<(i64, String, String, String, i64)> = c_stmt
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

    // Get quiz scores per course for affinity
    let course_scores: HashMap<i64, f64> = {
        let mut stmt = conn
            .prepare(
                "SELECT ch.course_id, AVG(qa.score) FROM quiz_attempts qa
                 JOIN quizzes qz ON qz.id = qa.quiz_id
                 JOIN lessons l ON l.id = qz.lesson_id
                 JOIN chapters ch ON ch.id = l.chapter_id
                 WHERE qa.user_id = ?1
                 GROUP BY ch.course_id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![user_id], |row| {
                Ok((row.get(0)?, row.get::<_, f64>(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<HashMap<i64, f64>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };

    // One-shot: completed/total per course
    let course_progress: HashMap<i64, (i64, i64)> = {
        let mut stmt = conn
            .prepare(
                "SELECT c.id,
                        COUNT(l.id) as total,
                        SUM(CASE WHEN up.completed = 1 THEN 1 ELSE 0 END) as done
                 FROM courses c
                 JOIN chapters ch ON ch.course_id = c.id
                 JOIN lessons l ON l.chapter_id = ch.id
                 LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = ?1
                 GROUP BY c.id",
            )
            .map_err(|e| e.to_string())?;
        let rows: Vec<(i64, i64, i64)> = stmt
            .query_map(rusqlite::params![user_id], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows.into_iter()
            .map(|(id, total, done)| (id, (done, total)))
            .collect()
    };

    let mut scored: Vec<RecommendationItem> = courses
        .iter()
        .map(|(id, title, slug, desc, _total)| {
            let combined = format!("{} {}", title.to_lowercase(), desc.to_lowercase());
            let (course_completed, course_total) =
                course_progress.get(id).copied().unwrap_or((0, 0));

            // 1. Interest match (40%)
            let interest_score = if interest_lower.is_empty() {
                0.3 // neutral
            } else {
                let hits = interest_lower
                    .iter()
                    .filter(|kw| combined.contains(kw.as_str()))
                    .count();
                (hits as f64 / interest_lower.len().max(1) as f64).min(1.0)
            };

            // 2. Progress state (25%)
            let progress_score = if course_completed == course_total && course_total > 0 {
                0.1 // fully completed — low priority
            } else if course_completed > 0 {
                0.9 // in-progress — "continue learning" boost
            } else {
                0.4 // unstarted — small novelty bonus
            };

            // 3. Experience level match (20%)
            let exp_score = match experience_level.as_str() {
                "beginner" => {
                    let title_lower = title.to_lowercase();
                    if title_lower.contains("introduction")
                        || title_lower.contains("basics")
                        || title_lower.contains("入门")
                    {
                        0.9
                    } else {
                        0.5
                    }
                }
                "intermediate" => 0.7,
                "advanced" => 0.6,
                _ => 0.5,
            };

            // 4. Course affinity (15%)
            let affinity_score = if let Some(score) = course_scores.get(id) {
                if *score > 0.7 {
                    0.8
                } else if *score > 0.5 {
                    0.5
                } else {
                    0.2
                }
            } else {
                0.0
            };

            let score = interest_score * 0.40
                + progress_score * 0.25
                + exp_score * 0.20
                + affinity_score * 0.15;

            // Build reason
            let reason = if course_completed > 0 && course_completed < course_total {
                format!(
                    "继续学习 — 已完成 {}/{} 课时",
                    course_completed, course_total
                )
            } else if interest_score > 0.6 {
                "与你的兴趣匹配".to_string()
            } else if affinity_score > 0.5 {
                "与你擅长的领域相关".to_string()
            } else if exp_score > 0.7 {
                "适合你的水平".to_string()
            } else {
                "推荐学习".to_string()
            };

            // Tags from matching interests
            let tags: Vec<String> = interest_lower
                .iter()
                .filter(|kw| combined.contains(kw.as_str()))
                .cloned()
                .collect();

            RecommendationItem {
                course_id: *id,
                title: title.clone(),
                slug: slug.clone(),
                description: desc.clone(),
                score: (score * 100.0).round() / 100.0,
                reason,
                tags,
                total_lessons: course_total,
                completed_lessons: course_completed,
            }
        })
        .collect();

    scored.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    Ok(scored)
}
