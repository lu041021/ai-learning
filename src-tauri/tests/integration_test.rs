mod common;

use rusqlite::Connection;

fn setup_db() -> Connection {
    common::setup_in_memory_db()
}

#[test]
fn migration_is_idempotent() {
    let conn = setup_db();
    ai_learning_platform_lib::db::migrations::run_migrations(&conn).unwrap();
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(count > 0);
}

#[test]
fn all_expected_tables_exist() {
    let conn = setup_db();
    let tables = [
        "courses",
        "chapters",
        "lessons",
        "quizzes",
        "quiz_questions",
        "users",
        "user_progress",
        "quiz_attempts",
        "conversations",
        "messages",
        "user_profiles",
        "learning_paths",
        "learning_path_history",
        "feed_subscriptions",
        "search_index",
        "concepts",
        "lesson_concepts",
    ];
    for table in &tables {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                rusqlite::params![table],
                |r| r.get(0),
            )
            .unwrap();
        assert!(exists, "table {} should exist", table);
    }
}

#[test]
fn foreign_key_enforcement_blocks_invalid_chapter() {
    let conn = setup_db();
    conn.execute("PRAGMA foreign_keys=ON", []).unwrap();
    let result = conn.execute(
        "INSERT INTO chapters (course_id, title, order_index) VALUES (999, 'Bad', 1)",
        [],
    );
    assert!(result.is_err());
}

#[test]
fn foreign_key_enforcement_blocks_invalid_lesson() {
    let conn = setup_db();
    conn.execute("PRAGMA foreign_keys=ON", []).unwrap();
    let result = conn.execute(
        "INSERT INTO lessons (chapter_id, title, content_md, order_index) VALUES (999, 'Bad', '', 1)",
        [],
    );
    assert!(result.is_err());
}

#[test]
fn user_unique_constraints() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO users (username, local_id) VALUES ('u1', 'L1')",
        [],
    )
    .unwrap();
    let dup_name = conn.execute(
        "INSERT INTO users (username, local_id) VALUES ('u1', 'L2')",
        [],
    );
    assert!(dup_name.is_err(), "duplicate username should fail");
    let dup_local = conn.execute(
        "INSERT INTO users (username, local_id) VALUES ('u2', 'L1')",
        [],
    );
    assert!(dup_local.is_err(), "duplicate local_id should fail");
}

#[test]
fn course_unique_slug() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO courses (title, slug) VALUES ('C1', 'my-course')",
        [],
    )
    .unwrap();
    let dup = conn.execute(
        "INSERT INTO courses (title, slug) VALUES ('C2', 'my-course')",
        [],
    );
    assert!(dup.is_err());
}

#[test]
fn fts5_search_inserts_and_queries() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO courses (id, title, slug, description) VALUES (1, 'Rust Tutorial', 'rust', 'Learn Rust')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO chapters (id, course_id, title, order_index) VALUES (1, 1, 'Basics', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO lessons (id, chapter_id, title, content_md, order_index) VALUES (1, 1, 'Ownership', 'Ownership is key', 1)",
        [],
    )
    .unwrap();

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM search_index", [], |r| r.get(0))
        .unwrap();
    assert!(count >= 2, "search_index should have at least 2 entries");

    let matches: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT title FROM search_index WHERE search_index MATCH ?1")
            .unwrap();
        let rows = stmt
            .query_map(rusqlite::params!["Ownership"], |r| r.get(0))
            .unwrap();
        rows.filter_map(|r| r.ok()).collect()
    };
    assert!(!matches.is_empty(), "should find 'Ownership' via FTS5");
}

#[test]
fn conversation_message_flow() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO users (id, username, local_id) VALUES (1, 'alice', 'local-a')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO conversations (id, user_id, title) VALUES (1, 1, 'Chat 1')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (1, 'user', 'Hello')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (1, 'assistant', 'Hi there')",
        [],
    )
    .unwrap();

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM messages WHERE conversation_id=1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 2);

    let last_msg: String = conn
        .query_row(
            "SELECT content FROM messages WHERE conversation_id=1 ORDER BY id DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(last_msg, "Hi there");
}

#[test]
fn learning_path_history_versioning() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO users (id, username, local_id) VALUES (1, 'alice', 'local-a')",
        [],
    )
    .unwrap();

    conn.execute(
        "INSERT INTO learning_path_history (user_id, steps_json, version, is_active) VALUES (1, '[]', 1, 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO learning_path_history (user_id, steps_json, version, is_active) VALUES (1, '[]', 2, 0)",
        [],
    )
    .unwrap();

    let active_version: i64 = conn
        .query_row(
            "SELECT version FROM learning_path_history WHERE user_id=1 AND is_active=1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(active_version, 1);

    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM learning_path_history WHERE user_id=1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(total, 2);
}

#[test]
fn user_progress_tracks_completion() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO users (id, username, local_id) VALUES (1, 'alice', 'local-a')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO courses (id, title, slug) VALUES (1, 'C1', 'c1')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO chapters (id, course_id, title, order_index) VALUES (1, 1, 'Ch1', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO lessons (id, chapter_id, title, content_md, order_index) VALUES (1, 1, 'L1', '', 1)",
        [],
    )
    .unwrap();

    conn.execute(
        "INSERT INTO user_progress (user_id, lesson_id, completed, completed_at) VALUES (1, 1, 1, datetime('now'))",
        [],
    )
    .unwrap();

    let completed: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM user_progress WHERE user_id=1 AND completed=1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(completed, 1);
}

#[test]
fn quiz_attempt_scoring() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO users (id, username, local_id) VALUES (1, 'alice', 'local-a')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO courses (id, title, slug) VALUES (1, 'C1', 'c1')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO chapters (id, course_id, title, order_index) VALUES (1, 1, 'Ch1', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO lessons (id, chapter_id, title, content_md, order_index) VALUES (1, 1, 'L1', '', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO quizzes (id, lesson_id, title) VALUES (1, 1, 'Q1')",
        [],
    )
    .unwrap();

    conn.execute(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback) VALUES (1, 1, 85.0, '[0,2]', 'Good')",
        [],
    )
    .unwrap();

    let avg: f64 = conn
        .query_row(
            "SELECT AVG(score) FROM quiz_attempts WHERE user_id=1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!((avg - 85.0).abs() < 0.01);
}

#[test]
fn concept_lesson_linking() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO courses (id, title, slug) VALUES (1, 'C1', 'c1')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO chapters (id, course_id, title, order_index) VALUES (1, 1, 'Ch1', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO lessons (id, chapter_id, title, content_md, order_index) VALUES (1, 1, 'L1', '', 1)",
        [],
    )
    .unwrap();

    conn.execute(
        "INSERT OR IGNORE INTO concepts (name, description, domain) VALUES ('Rust', 'Rust lang', 'programming')",
        [],
    )
    .unwrap();
    let concept_id: i64 = conn
        .query_row("SELECT id FROM concepts WHERE name='Rust'", [], |r| {
            r.get(0)
        })
        .unwrap();

    conn.execute(
        "INSERT OR IGNORE INTO lesson_concepts (lesson_id, concept_id, relevance) VALUES (1, ?1, 0.9)",
        rusqlite::params![concept_id],
    )
    .unwrap();

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM lesson_concepts WHERE lesson_id=1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn feed_subscription_management() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO feed_subscriptions (feed_url, feed_title) VALUES ('https://example.com/rss', 'Test Feed')",
        [],
    )
    .unwrap();

    let title: String = conn
        .query_row(
            "SELECT feed_title FROM feed_subscriptions WHERE feed_url='https://example.com/rss'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(title, "Test Feed");

    let dup = conn.execute(
        "INSERT INTO feed_subscriptions (feed_url, feed_title) VALUES ('https://example.com/rss', 'Dup')",
        [],
    );
    assert!(dup.is_err());
}
