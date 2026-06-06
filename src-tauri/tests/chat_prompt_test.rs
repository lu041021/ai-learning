mod common;

use ai_learning_platform_lib::services::ai_tutor::build_system_prompt;

fn setup_db() -> rusqlite::Connection {
    common::setup_in_memory_db()
}

fn seed_course_with_lesson(conn: &rusqlite::Connection) {
    conn.execute(
        "INSERT INTO courses (id, title, slug, description) VALUES (1, 'ML Fundamentals', 'ml-fundamentals', 'Intro to ML')",
        [],
    ).unwrap();
    conn.execute(
        "INSERT INTO chapters (id, course_id, title, order_index) VALUES (1, 1, 'Basics', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO lessons (id, chapter_id, title, content_md, order_index) VALUES (1, 1, 'What is ML?', '## ML Intro\n\nMachine learning is...', 1)",
        [],
    ).unwrap();
    conn.execute(
        "INSERT INTO lessons (id, chapter_id, title, content_md, order_index) VALUES (2, 1, 'Types of ML', '## Supervised\n\nSupervised learning...', 2)",
        [],
    ).unwrap();
}

fn seed_user(conn: &rusqlite::Connection, user_id: i64) {
    conn.execute(
        "INSERT INTO users (id, username, local_id) VALUES (?1, 'student', 'local-test')",
        rusqlite::params![user_id],
    )
    .unwrap();
}

// ── build_system_prompt ───────────────────────────────────────────────────────

#[test]
fn prompt_without_lesson_uses_general_defaults() {
    let conn = setup_db();
    seed_user(&conn, 1);

    let prompt = build_system_prompt(&conn, 1, None, None).unwrap();

    assert!(
        prompt.contains("AI Basics"),
        "default course title when no lesson"
    );
    assert!(
        prompt.contains("General"),
        "default lesson title when no lesson"
    );
    assert!(!prompt.is_empty());
}

#[test]
fn prompt_with_lesson_includes_lesson_title_and_content() {
    let conn = setup_db();
    seed_user(&conn, 1);
    seed_course_with_lesson(&conn);

    let prompt = build_system_prompt(&conn, 1, Some(1), None).unwrap();

    assert!(prompt.contains("What is ML?"), "lesson title in prompt");
    assert!(
        prompt.contains("ML Intro"),
        "lesson content heading in prompt"
    );
    assert!(prompt.contains("ML Fundamentals"), "course title in prompt");
}

#[test]
fn prompt_includes_progress_counts() {
    let conn = setup_db();
    seed_user(&conn, 1);
    seed_course_with_lesson(&conn);

    // Mark lesson 1 as complete
    conn.execute(
        "INSERT INTO user_progress (user_id, lesson_id, completed) VALUES (1, 1, 1)",
        [],
    )
    .unwrap();

    let prompt = build_system_prompt(&conn, 1, Some(1), None).unwrap();

    // completed_count/total_lessons should be interpolated (not raw placeholders)
    assert!(
        !prompt.contains("{completed_count}"),
        "placeholder should be replaced"
    );
    assert!(
        !prompt.contains("{total_lessons}"),
        "placeholder should be replaced"
    );
}

#[test]
fn prompt_includes_selected_text_section() {
    let conn = setup_db();
    seed_user(&conn, 1);

    let prompt = build_system_prompt(&conn, 1, None, Some("gradient descent")).unwrap();

    assert!(
        prompt.contains("gradient descent"),
        "selected text appears in prompt"
    );
    assert!(
        prompt.contains("SELECTED THIS TEXT"),
        "selected text section header present"
    );
}

#[test]
fn prompt_ignores_empty_selected_text() {
    let conn = setup_db();
    seed_user(&conn, 1);

    let prompt_empty = build_system_prompt(&conn, 1, None, Some("   ")).unwrap();
    let prompt_none = build_system_prompt(&conn, 1, None, None).unwrap();

    assert_eq!(
        prompt_empty, prompt_none,
        "whitespace-only selected text should produce same prompt as None"
    );
}

#[test]
fn prompt_chapter_outline_lists_all_lessons() {
    let conn = setup_db();
    seed_user(&conn, 1);
    seed_course_with_lesson(&conn);

    let prompt = build_system_prompt(&conn, 1, Some(1), None).unwrap();

    assert!(prompt.contains("What is ML?"), "lesson 1 in outline");
    assert!(prompt.contains("Types of ML"), "lesson 2 in outline");
}

#[test]
fn prompt_nonexistent_lesson_falls_back_to_general() {
    let conn = setup_db();
    seed_user(&conn, 1);

    // lesson_id 999 does not exist
    let prompt = build_system_prompt(&conn, 1, Some(999), None).unwrap();

    // Should succeed with fallback values, not error
    assert!(
        prompt.contains("AI Basics"),
        "falls back to default course title"
    );
    assert!(
        prompt.contains("General"),
        "falls back to default lesson title"
    );
}
