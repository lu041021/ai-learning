mod common;

use ai_learning_platform_lib::services::course_importer::{
    check_duplicate_url, extract_text_from_html, insert_course_to_db, AiChapter, AiCourseOutput,
    AiLesson, AiQuiz, AiQuizQuestion,
};

fn setup_db() -> rusqlite::Connection {
    common::setup_in_memory_db()
}

fn make_course(title: &str) -> AiCourseOutput {
    AiCourseOutput {
        course_title: title.to_string(),
        course_description: "A test course".to_string(),
        chapters: vec![AiChapter {
            title: "Chapter 1".to_string(),
            lessons: vec![AiLesson {
                title: "Lesson 1".to_string(),
                content_md: "## Hello\n\nThis is lesson content.".to_string(),
                quiz: Some(AiQuiz {
                    title: "Quiz 1".to_string(),
                    questions: vec![AiQuizQuestion {
                        question_text: "What is 1+1?".to_string(),
                        options: vec![
                            "1".to_string(),
                            "2".to_string(),
                            "3".to_string(),
                            "4".to_string(),
                        ],
                        correct_answer_index: 1,
                        explanation: "Basic math".to_string(),
                    }],
                }),
            }],
        }],
    }
}

// ── insert_course_to_db ───────────────────────────────────────────────────────

#[test]
fn import_inserts_course_chapter_lesson_quiz() {
    let conn = setup_db();
    let course = make_course("Rust Basics");

    let result = insert_course_to_db(&conn, &course, "https://example.com/rust").unwrap();

    assert_eq!(result.course_title, "Rust Basics");
    assert_eq!(result.chapters_count, 1);
    assert_eq!(result.lessons_count, 1);
    assert_eq!(result.quiz_count, 1);
    assert!(!result.course_slug.is_empty());

    // Verify rows exist in DB
    let course_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM courses WHERE title='Rust Basics'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(course_count, 1);

    let lesson_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM lessons", [], |r| r.get(0))
        .unwrap();
    assert_eq!(lesson_count, 1);

    let quiz_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM quizzes", [], |r| r.get(0))
        .unwrap();
    assert_eq!(quiz_count, 1);

    let question_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM quiz_questions", [], |r| r.get(0))
        .unwrap();
    assert_eq!(question_count, 1);
}

#[test]
fn import_stores_source_url() {
    let conn = setup_db();
    let course = make_course("ML Guide");
    let url = "https://example.com/ml-guide";

    insert_course_to_db(&conn, &course, url).unwrap();

    let stored_url: String = conn
        .query_row(
            "SELECT source_url FROM courses WHERE title='ML Guide'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(stored_url, url);
}

#[test]
fn import_slug_is_unique_on_duplicate_title() {
    let conn = setup_db();
    let course = make_course("Deep Learning");

    let r1 = insert_course_to_db(&conn, &course, "https://example.com/dl1").unwrap();
    let r2 = insert_course_to_db(&conn, &course, "https://example.com/dl2").unwrap();

    assert_ne!(
        r1.course_slug, r2.course_slug,
        "duplicate titles must get distinct slugs"
    );

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM courses WHERE title='Deep Learning'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 2);
}

#[test]
fn import_course_without_quiz() {
    let conn = setup_db();
    let course = AiCourseOutput {
        course_title: "No Quiz Course".to_string(),
        course_description: "desc".to_string(),
        chapters: vec![AiChapter {
            title: "Ch".to_string(),
            lessons: vec![AiLesson {
                title: "L".to_string(),
                content_md: "content".to_string(),
                quiz: None,
            }],
        }],
    };

    let result = insert_course_to_db(&conn, &course, "https://example.com/nq").unwrap();
    assert_eq!(result.quiz_count, 0);
    assert_eq!(result.lessons_count, 1);
}

#[test]
fn import_multi_chapter_multi_lesson() {
    let conn = setup_db();
    let course = AiCourseOutput {
        course_title: "Big Course".to_string(),
        course_description: "desc".to_string(),
        chapters: vec![
            AiChapter {
                title: "Ch1".to_string(),
                lessons: vec![
                    AiLesson {
                        title: "L1".to_string(),
                        content_md: "c".to_string(),
                        quiz: None,
                    },
                    AiLesson {
                        title: "L2".to_string(),
                        content_md: "c".to_string(),
                        quiz: None,
                    },
                ],
            },
            AiChapter {
                title: "Ch2".to_string(),
                lessons: vec![AiLesson {
                    title: "L3".to_string(),
                    content_md: "c".to_string(),
                    quiz: None,
                }],
            },
        ],
    };

    let result = insert_course_to_db(&conn, &course, "https://example.com/big").unwrap();
    assert_eq!(result.chapters_count, 2);
    assert_eq!(result.lessons_count, 3);
}

// ── check_duplicate_url ───────────────────────────────────────────────────────

#[test]
fn duplicate_check_returns_false_for_new_url() {
    let conn = setup_db();
    let result = check_duplicate_url(&conn, "https://example.com/new").unwrap();
    assert!(!result.exists);
    assert!(result.existing_course_id.is_none());
}

#[test]
fn duplicate_check_detects_existing_url() {
    let conn = setup_db();
    let course = make_course("Existing Course");
    insert_course_to_db(&conn, &course, "https://example.com/existing").unwrap();

    let result = check_duplicate_url(&conn, "https://example.com/existing").unwrap();
    assert!(result.exists);
    assert!(result.existing_course_id.is_some());
    assert_eq!(
        result.existing_course_title.as_deref(),
        Some("Existing Course")
    );
}

#[test]
fn duplicate_check_empty_url_not_considered_duplicate() {
    let conn = setup_db();
    // Insert a course with empty source_url (manually inserted, not via importer)
    conn.execute(
        "INSERT INTO courses (title, slug, source_url) VALUES ('Manual', 'manual', '')",
        [],
    )
    .unwrap();

    // Empty string URL should not be treated as duplicate
    let result = check_duplicate_url(&conn, "").unwrap();
    assert!(!result.exists);
}

// ── extract_text_from_html ────────────────────────────────────────────────────

#[test]
fn extract_text_preserves_headings_and_paragraphs() {
    let html = r#"<html><body>
        <h1>Title</h1>
        <h2>Section</h2>
        <p>A paragraph of text.</p>
        <li>List item one</li>
    </body></html>"#;

    let text = extract_text_from_html(html);
    assert!(text.contains("# Title"), "h1 → markdown heading");
    assert!(text.contains("## Section"), "h2 → markdown heading");
    assert!(text.contains("A paragraph of text."), "paragraph preserved");
    assert!(text.contains("- List item one"), "list item preserved");
}

#[test]
fn extract_text_truncates_at_50k() {
    // Build HTML with a very long paragraph
    let long_para = "x".repeat(60_000);
    let html = format!("<html><body><p>{}</p></body></html>", long_para);
    let text = extract_text_from_html(&html);
    assert!(
        text.len() <= 50_100,
        "output should not exceed truncation limit"
    );
    assert!(
        text.contains("[Content truncated"),
        "truncation marker present"
    );
}

#[test]
fn extract_text_empty_html_returns_fallback() {
    let html = "<html><body></body></html>";
    let text = extract_text_from_html(html);
    // Empty selectors → fallback path, no panic
    assert!(text.len() < 200);
}
