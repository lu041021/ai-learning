use crate::db::DbPool;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsData {
    pub completion_pct: f64,
    pub accuracy_pct: f64,
    pub streak_days: i64,
    pub longest_streak: i64,
    pub review_rate: f64,
    pub per_course: Vec<CourseAnalytics>,
    pub weekly_activity: Vec<WeekActivity>,
    pub accuracy_trend: Vec<AccuracyPoint>,
    pub domain_accuracy: Vec<DomainAccuracy>,
    pub weak_areas: Vec<WeakArea>,
    pub strong_areas: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseAnalytics {
    pub course_id: i64,
    pub title: String,
    pub slug: String,
    pub total_lessons: i64,
    pub completed: i64,
    pub avg_quiz_score: f64,
    pub quiz_attempts: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeekActivity {
    pub week: String,
    pub sessions: i64,
    pub lessons_completed: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccuracyPoint {
    pub label: String,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainAccuracy {
    pub domain: String,
    pub accuracy: f64,
    pub attempts: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeakArea {
    pub concept_name: String,
    pub accuracy: f64,
    pub lesson_title: String,
    pub course_slug: String,
    pub lesson_id: i64,
}

pub fn get_analytics(db: &DbPool, user_id: i64) -> Result<AnalyticsData, String> {
    let conn = db.get().map_err(|e| e.to_string())?;

    // Completion + accuracy + quiz review stats — 2 queries instead of 5
    let (total_lessons, completed_lessons) = conn
        .query_row(
            "SELECT
                (SELECT COUNT(*) FROM lessons),
                (SELECT COUNT(*) FROM user_progress WHERE user_id = ?1 AND completed = 1)",
            rusqlite::params![user_id],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)),
        )
        .map_err(|e| e.to_string())?;
    let completion_pct = if total_lessons > 0 {
        (completed_lessons as f64 / total_lessons as f64 * 100.0 * 10.0).round() / 10.0
    } else {
        0.0
    };

    let (accuracy_raw, unique_quizzes, total_attempts) = conn
        .query_row(
            "SELECT AVG(score), COUNT(DISTINCT quiz_id), COUNT(*)
             FROM quiz_attempts WHERE user_id = ?1",
            rusqlite::params![user_id],
            |r| {
                Ok((
                    r.get::<_, Option<f64>>(0)?.unwrap_or(0.0),
                    r.get::<_, i64>(1)?,
                    r.get::<_, i64>(2)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?;
    let accuracy_pct = (accuracy_raw * 100.0 * 10.0).round() / 10.0;
    let review_rate = if unique_quizzes > 0 {
        (total_attempts as f64 / unique_quizzes as f64 * 100.0).round() / 100.0 - 1.0
    } else {
        0.0
    };

    // Streak
    let completed_dates: Vec<String> = {
        let mut stmt = conn
            .prepare(
                "SELECT DISTINCT date(completed_at) FROM user_progress \
                 WHERE user_id = ?1 AND completed = 1 ORDER BY date(completed_at) DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![user_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<String>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    let (streak_days, longest_streak) = compute_streaks(&completed_dates);

    // Per-course analytics
    let per_course = compute_per_course(&conn, user_id)?;

    // Weekly activity (last 12 weeks)
    let weekly_activity = compute_weekly_activity(&conn, user_id)?;

    // Accuracy trend
    let accuracy_trend = compute_accuracy_trend(&conn, user_id)?;

    // Domain accuracy
    let (domain_accuracy, weak_areas, strong_areas) = compute_domain_metrics(&conn, user_id)?;

    Ok(AnalyticsData {
        completion_pct,
        accuracy_pct,
        streak_days,
        longest_streak,
        review_rate,
        per_course,
        weekly_activity,
        accuracy_trend,
        domain_accuracy,
        weak_areas,
        strong_areas,
    })
}

fn compute_streaks(dates: &[String]) -> (i64, i64) {
    use chrono::NaiveDate;
    let parsed: Vec<NaiveDate> = dates
        .iter()
        .filter_map(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .collect();

    if parsed.is_empty() {
        return (0, 0);
    }

    let mut streak = 1i64;
    let mut longest = 1i64;
    let mut current = 1i64;
    let mut first_streak_captured = false;

    for i in 1..parsed.len() {
        let prev = parsed[i - 1];
        let cur = parsed[i];
        if prev == cur {
            continue;
        }
        if prev.pred_opt() == Some(cur) {
            streak += 1;
        } else {
            if !first_streak_captured {
                current = streak;
                first_streak_captured = true;
            }
            longest = longest.max(streak);
            streak = 1;
        }
    }
    if !first_streak_captured {
        current = streak;
    }
    longest = longest.max(streak);
    (current, longest)
}

fn compute_per_course(conn: &Connection, user_id: i64) -> Result<Vec<CourseAnalytics>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.title, c.slug, COUNT(l.id),
                    COUNT(CASE WHEN up.completed = 1 THEN 1 END)
             FROM courses c
             JOIN chapters ch ON ch.course_id = c.id
             JOIN lessons l ON l.chapter_id = ch.id
             LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = ?1
             GROUP BY c.id
             ORDER BY c.id",
        )
        .map_err(|e| e.to_string())?;
    let courses: Vec<(i64, String, String, i64, i64)> = stmt
        .query_map(rusqlite::params![user_id], |row| {
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

    let mut quiz_stmt = conn
        .prepare(
            "SELECT ch.course_id, AVG(qa.score) * 100.0, COUNT(*)
             FROM quiz_attempts qa
             JOIN quizzes qz ON qz.id = qa.quiz_id
             JOIN lessons l ON l.id = qz.lesson_id
             JOIN chapters ch ON ch.id = l.chapter_id
             WHERE qa.user_id = ?1
             GROUP BY ch.course_id",
        )
        .map_err(|e| e.to_string())?;
    let quiz_stats: HashMap<i64, (f64, i64)> = quiz_stmt
        .query_map(rusqlite::params![user_id], |row| {
            let score: Option<f64> = row.get(1)?;
            let score = score.map(|s| (s * 10.0).round() / 10.0).unwrap_or(0.0);
            Ok((row.get(0)?, score, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(id, score, count)| (id, (score, count)))
        .collect();

    courses
        .iter()
        .map(|(id, title, slug, total, completed)| {
            let (avg_quiz_score, quiz_attempts) = quiz_stats.get(id).copied().unwrap_or((0.0, 0));
            Ok(CourseAnalytics {
                course_id: *id,
                title: title.clone(),
                slug: slug.clone(),
                total_lessons: *total,
                completed: *completed,
                avg_quiz_score,
                quiz_attempts,
            })
        })
        .collect()
}

fn compute_weekly_activity(conn: &Connection, user_id: i64) -> Result<Vec<WeekActivity>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-%W', completed_at) as week, COUNT(DISTINCT date(completed_at)) as days,
                    COUNT(*) as lessons
             FROM user_progress
             WHERE user_id = ?1 AND completed = 1 AND completed_at IS NOT NULL
             GROUP BY week
             ORDER BY week DESC
             LIMIT 12",
        )
        .map_err(|e| e.to_string())?;
    let mut rows: Vec<WeekActivity> = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(WeekActivity {
                week: row.get(0)?,
                sessions: row.get(1)?,
                lessons_completed: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    rows.reverse();
    Ok(rows)
}

fn compute_accuracy_trend(conn: &Connection, user_id: i64) -> Result<Vec<AccuracyPoint>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-%W', created_at) as week, AVG(score) * 100.0
             FROM quiz_attempts
             WHERE user_id = ?1
             GROUP BY week
             ORDER BY week ASC
             LIMIT 12",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<AccuracyPoint> = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(AccuracyPoint {
                label: row.get(0)?,
                score: (row.get::<_, f64>(1)? * 10.0).round() / 10.0,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[allow(clippy::type_complexity)]
fn compute_domain_metrics(
    conn: &Connection,
    user_id: i64,
) -> Result<(Vec<DomainAccuracy>, Vec<WeakArea>, Vec<String>), String> {
    // Get quiz scores per concept
    let mut stmt = conn
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
    let domain_accuracy: Vec<DomainAccuracy> = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(DomainAccuracy {
                domain: row.get(0)?,
                accuracy: (row.get::<_, f64>(1)? * 10.0).round() / 10.0,
                attempts: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Weak areas: concepts with score < 70%
    let mut weak_stmt = conn
        .prepare(
            "SELECT c.name, AVG(qa.score) * 100.0, l.title, co.slug, l.id
             FROM quiz_attempts qa
             JOIN quizzes qz ON qz.id = qa.quiz_id
             JOIN lessons l ON l.id = qz.lesson_id
             JOIN chapters ch ON ch.id = l.chapter_id
             JOIN courses co ON co.id = ch.course_id
             JOIN lesson_concepts lc ON lc.lesson_id = l.id
             JOIN concepts c ON c.id = lc.concept_id
             WHERE qa.user_id = ?1
             GROUP BY c.name, l.id
             HAVING AVG(qa.score) < 0.7
             ORDER BY AVG(qa.score) ASC
             LIMIT 8",
        )
        .map_err(|e| e.to_string())?;
    let weak_areas: Vec<WeakArea> = weak_stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(WeakArea {
                concept_name: row.get(0)?,
                accuracy: (row.get::<_, f64>(1)? * 10.0).round() / 10.0,
                lesson_title: row.get(2)?,
                course_slug: row.get(3)?,
                lesson_id: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Strong areas: concepts with score >= 80%
    let mut strong_stmt = conn
        .prepare(
            "SELECT DISTINCT c.name
             FROM quiz_attempts qa
             JOIN quizzes qz ON qz.id = qa.quiz_id
             JOIN lessons l ON l.id = qz.lesson_id
             JOIN lesson_concepts lc ON lc.lesson_id = l.id
             JOIN concepts c ON c.id = lc.concept_id
             WHERE qa.user_id = ?1
             GROUP BY c.name
             HAVING AVG(qa.score) >= 0.8
             LIMIT 8",
        )
        .map_err(|e| e.to_string())?;
    let strong_areas: Vec<String> = strong_stmt
        .query_map(rusqlite::params![user_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok((domain_accuracy, weak_areas, strong_areas))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_streaks_empty() {
        assert_eq!(compute_streaks(&[]), (0, 0));
    }

    #[test]
    fn test_streaks_single_day() {
        assert_eq!(compute_streaks(&["2025-06-01".into()]), (1, 1));
    }

    #[test]
    fn test_streaks_two_consecutive() {
        let dates: Vec<String> = vec!["2025-06-03".into(), "2025-06-02".into()];
        let (current, longest) = compute_streaks(&dates);
        assert_eq!(current, 2);
        assert_eq!(longest, 2);
    }

    #[test]
    fn test_streaks_with_gap() {
        let dates: Vec<String> = vec![
            "2025-06-05".into(),
            "2025-06-04".into(),
            "2025-06-02".into(),
            "2025-06-01".into(),
        ];
        let (current, longest) = compute_streaks(&dates);
        assert_eq!(current, 2);
        assert_eq!(longest, 2);
    }

    #[test]
    fn test_streaks_month_boundary() {
        let dates: Vec<String> = vec![
            "2025-03-01".into(),
            "2025-02-28".into(),
            "2025-02-27".into(),
        ];
        let (current, longest) = compute_streaks(&dates);
        assert_eq!(current, 3);
        assert_eq!(longest, 3);
    }

    #[test]
    fn test_streaks_duplicate_dates() {
        let dates: Vec<String> = vec![
            "2025-06-03".into(),
            "2025-06-02".into(),
            "2025-06-02".into(),
        ];
        let (current, longest) = compute_streaks(&dates);
        assert_eq!(current, 2);
        assert_eq!(longest, 2);
    }

    #[test]
    fn test_streaks_reset_on_big_gap() {
        let dates: Vec<String> = vec![
            "2025-06-05".into(),
            "2025-06-04".into(),
            "2025-06-01".into(),
        ];
        let (current, longest) = compute_streaks(&dates);
        assert_eq!(current, 2);
        assert_eq!(longest, 2);
    }
}
