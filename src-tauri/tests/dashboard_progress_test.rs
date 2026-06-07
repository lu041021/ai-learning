mod common;

use rusqlite::Connection;

fn setup() -> Connection {
    common::setup_in_memory_db()
}

// ── helpers ────────────────────────────────────────────────────────────────

fn seed_course_structure(conn: &Connection) {
    conn.execute(
        "INSERT INTO users (id, username, local_id) VALUES (1, 'alice', 'local-a')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO courses (id, title, slug) VALUES (1, 'Course A', 'course-a')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO chapters (id, course_id, title, order_index) VALUES (1, 1, 'Ch1', 1)",
        [],
    )
    .unwrap();
    for i in 1i64..=3 {
        conn.execute(
            "INSERT INTO lessons (id, chapter_id, title, content_md, order_index) VALUES (?1, 1, ?2, '', ?1)",
            rusqlite::params![i, format!("Lesson {}", i)],
        )
        .unwrap();
    }
}

fn seed_quiz(conn: &Connection) {
    conn.execute(
        "INSERT INTO quizzes (id, lesson_id, title) VALUES (1, 1, 'Quiz 1')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO quiz_questions (quiz_id, question_text, options, correct_answer_index) VALUES (1, 'Q?', '[]', 0)",
        [],
    )
    .unwrap();
}

// ── dashboard: build_course_progress 聚合查询 ──────────────────────────────

#[test]
fn course_progress_aggregation_no_progress() {
    let conn = setup();
    seed_course_structure(&conn);

    let (total, completed): (i64, i64) = conn
        .query_row(
            "SELECT COUNT(l.id),
                    COUNT(CASE WHEN up.completed = 1 THEN 1 END)
             FROM courses c
             JOIN chapters ch ON ch.course_id = c.id
             JOIN lessons l ON l.chapter_id = ch.id
             LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = 1
             WHERE c.id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();

    assert_eq!(total, 3, "course should have 3 lessons");
    assert_eq!(completed, 0, "no completions yet");
}

#[test]
fn course_progress_aggregation_partial() {
    let conn = setup();
    seed_course_structure(&conn);

    conn.execute(
        "INSERT INTO user_progress (user_id, lesson_id, completed, completed_at) VALUES (1, 1, 1, datetime('now'))",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO user_progress (user_id, lesson_id, completed, completed_at) VALUES (1, 2, 1, datetime('now'))",
        [],
    )
    .unwrap();

    let (total, completed): (i64, i64) = conn
        .query_row(
            "SELECT COUNT(l.id),
                    COUNT(CASE WHEN up.completed = 1 THEN 1 END)
             FROM courses c
             JOIN chapters ch ON ch.course_id = c.id
             JOIN lessons l ON l.chapter_id = ch.id
             LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = 1
             WHERE c.id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();

    assert_eq!(total, 3);
    assert_eq!(completed, 2);
}

#[test]
fn course_progress_aggregation_all_done() {
    let conn = setup();
    seed_course_structure(&conn);

    for lesson_id in 1i64..=3 {
        conn.execute(
            "INSERT INTO user_progress (user_id, lesson_id, completed, completed_at) VALUES (1, ?1, 1, datetime('now'))",
            rusqlite::params![lesson_id],
        )
        .unwrap();
    }

    let (total, completed): (i64, i64) = conn
        .query_row(
            "SELECT COUNT(l.id),
                    COUNT(CASE WHEN up.completed = 1 THEN 1 END)
             FROM courses c
             JOIN chapters ch ON ch.course_id = c.id
             JOIN lessons l ON l.chapter_id = ch.id
             LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = 1
             WHERE c.id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();

    assert_eq!(total, 3);
    assert_eq!(completed, 3);
}

// ── dashboard: knowledge_tree 知识树课时完成判断 ────────────────────────────

#[test]
fn knowledge_tree_lesson_completion_via_progress() {
    let conn = setup();
    seed_course_structure(&conn);

    conn.execute(
        "INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (1, 1, 1)",
        [],
    )
    .unwrap();

    let is_completed: i64 = conn
        .query_row(
            "SELECT CASE WHEN up.completed = 1 THEN 1 ELSE 0 END
             FROM lessons l
             LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = 1
             WHERE l.id = 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(is_completed, 1);
}

#[test]
fn knowledge_tree_lesson_completion_via_quiz_score() {
    let conn = setup();
    seed_course_structure(&conn);
    seed_quiz(&conn);

    conn.execute(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback) VALUES (1, 1, 0.8, '[]', '')",
        [],
    )
    .unwrap();

    let is_completed: i64 = conn
        .query_row(
            "SELECT CASE WHEN up.completed = 1 OR qa.score >= 0.7 THEN 1 ELSE 0 END
             FROM lessons l
             LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = 1
             LEFT JOIN quizzes qz ON qz.lesson_id = l.id
             LEFT JOIN quiz_attempts qa ON qa.quiz_id = qz.id AND qa.user_id = 1
             WHERE l.id = 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(is_completed, 1);
}

#[test]
fn knowledge_tree_lesson_not_complete_low_quiz_score() {
    let conn = setup();
    seed_course_structure(&conn);
    seed_quiz(&conn);

    conn.execute(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback) VALUES (1, 1, 0.5, '[]', '')",
        [],
    )
    .unwrap();

    let is_completed: i64 = conn
        .query_row(
            "SELECT CASE WHEN up.completed = 1 OR qa.score >= 0.7 THEN 1 ELSE 0 END
             FROM lessons l
             LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = 1
             LEFT JOIN quizzes qz ON qz.lesson_id = l.id
             LEFT JOIN quiz_attempts qa ON qa.quiz_id = qz.id AND qa.user_id = 1
             WHERE l.id = 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(is_completed, 0);
}

// ── progress: get_progress 完成课时列表 ──────────────────────────────────

#[test]
fn get_progress_returns_only_completed_lessons() {
    let conn = setup();
    seed_course_structure(&conn);

    conn.execute(
        "INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (1, 1, 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (1, 2, 0)",
        [],
    )
    .unwrap();

    let mut stmt = conn
        .prepare("SELECT lesson_id FROM user_progress WHERE user_id = 1 AND completed = 1")
        .unwrap();
    let ids: Vec<i64> = stmt
        .query_map([], |r| r.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(ids, vec![1i64]);
}

#[test]
fn get_progress_quiz_scores_dedup_keeps_latest() {
    let conn = setup();
    seed_course_structure(&conn);
    seed_quiz(&conn);

    conn.execute(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback, created_at) VALUES (1, 1, 0.5, '[]', '', '2024-01-01 10:00:00')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback, created_at) VALUES (1, 1, 0.9, '[]', '', '2024-01-02 10:00:00')",
        [],
    )
    .unwrap();

    let mut stmt = conn
        .prepare(
            "SELECT quiz_id, score FROM quiz_attempts WHERE user_id = 1 ORDER BY created_at DESC",
        )
        .unwrap();
    let rows: Vec<(i64, f64)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    let mut scores = std::collections::HashMap::new();
    for (qid, score) in rows {
        scores.entry(qid).or_insert(score);
    }

    assert!((scores[&1] - 0.9).abs() < 0.001);
}

// ── progress: mark_complete upsert 语义 ──────────────────────────────────

#[test]
fn mark_complete_upsert_idempotent() {
    let conn = setup();
    seed_course_structure(&conn);

    for _ in 0..2 {
        conn.execute(
            "INSERT INTO user_progress (user_id, lesson_id, completed, completed_at)
             VALUES (1, 1, 1, datetime('now'))
             ON CONFLICT(user_id, lesson_id) DO UPDATE SET
                 completed = 1, completed_at = datetime('now')",
            [],
        )
        .unwrap();
    }

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM user_progress WHERE user_id = 1 AND lesson_id = 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
}

// ── analytics: 统计查询准确性 ─────────────────────────────────────────────

#[test]
fn analytics_completion_pct_calculation() {
    let conn = setup();
    seed_course_structure(&conn);

    conn.execute(
        "INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (1, 1, 1)",
        [],
    )
    .unwrap();

    let (total, completed): (i64, i64) = conn
        .query_row(
            "SELECT (SELECT COUNT(*) FROM lessons),
                    (SELECT COUNT(*) FROM user_progress WHERE user_id = 1 AND completed = 1)",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();

    assert_eq!(total, 3);
    assert_eq!(completed, 1);
    let pct = (completed as f64 / total as f64 * 100.0 * 10.0).round() / 10.0;
    assert!((pct - 33.3).abs() < 0.1);
}

#[test]
fn analytics_quiz_avg_and_count() {
    let conn = setup();
    seed_course_structure(&conn);
    seed_quiz(&conn);

    conn.execute(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback) VALUES (1, 1, 0.6, '[]', '')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback) VALUES (1, 1, 0.8, '[]', '')",
        [],
    )
    .unwrap();

    let (avg, distinct_quizzes, total_attempts): (f64, i64, i64) = conn
        .query_row(
            "SELECT AVG(score), COUNT(DISTINCT quiz_id), COUNT(*) FROM quiz_attempts WHERE user_id = 1",
            [],
            |r| Ok((r.get::<_, f64>(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();

    assert!((avg - 0.7).abs() < 0.001);
    assert_eq!(distinct_quizzes, 1);
    assert_eq!(total_attempts, 2);
}
