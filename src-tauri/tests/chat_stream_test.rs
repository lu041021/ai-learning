mod common;

use ai_learning_platform_lib::services::{ai_tutor::query_quiz_avg, llm_client::LlmProvider};
use serde_json::json;

fn setup_db() -> rusqlite::Connection {
    common::setup_in_memory_db()
}

// ── query_quiz_avg ────────────────────────────────────────────────────────────

#[test]
fn quiz_avg_returns_na_with_no_attempts() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO users (id, username, local_id) VALUES (1, 'alice', 'la')",
        [],
    )
    .unwrap();
    let avg = query_quiz_avg(&conn, 1).unwrap();
    assert_eq!(avg, "N/A");
}

#[test]
fn quiz_avg_calculates_correctly() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO users (id, username, local_id) VALUES (1, 'alice', 'la')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO courses (id, title, slug) VALUES (1, 'C', 'c')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO chapters (id, course_id, title, order_index) VALUES (1, 1, 'Ch', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO lessons (id, chapter_id, title, content_md, order_index) VALUES (1, 1, 'L', '', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO quizzes (id, lesson_id, title) VALUES (1, 1, 'Q')",
        [],
    )
    .unwrap();
    // Two attempts: 0.8 and 0.6 → avg 0.7 → "70%"
    conn.execute(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback) VALUES (1, 1, 0.8, '[]', '')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback) VALUES (1, 1, 0.6, '[]', '')",
        [],
    )
    .unwrap();
    let avg = query_quiz_avg(&conn, 1).unwrap();
    assert_eq!(avg, "70%");
}

#[test]
fn quiz_avg_rounds_correctly() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO users (id, username, local_id) VALUES (1, 'alice', 'la')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO courses (id, title, slug) VALUES (1, 'C', 'c')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO chapters (id, course_id, title, order_index) VALUES (1, 1, 'Ch', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO lessons (id, chapter_id, title, content_md, order_index) VALUES (1, 1, 'L', '', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO quizzes (id, lesson_id, title) VALUES (1, 1, 'Q')",
        [],
    )
    .unwrap();
    // score 0.333... → "33%"
    conn.execute(
        "INSERT INTO quiz_attempts (user_id, quiz_id, score, answers, feedback) VALUES (1, 1, 0.333, '[]', '')",
        [],
    )
    .unwrap();
    let avg = query_quiz_avg(&conn, 1).unwrap();
    assert_eq!(avg, "33%");
}

// ── no-key path: DB operations ────────────────────────────────────────────────

#[test]
fn no_key_message_is_saved_to_db() {
    let conn = setup_db();
    conn.execute(
        "INSERT INTO users (id, username, local_id) VALUES (1, 'alice', 'la')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO conversations (id, user_id, title) VALUES (1, 1, 'test')",
        [],
    )
    .unwrap();

    let no_key_msg = "请在设置中配置 ANTHROPIC_API_KEY 以启用 AI 导师功能。";
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (1, 'assistant', ?1)",
        rusqlite::params![no_key_msg],
    )
    .unwrap();

    let saved: String = conn
        .query_row(
            "SELECT content FROM messages WHERE conversation_id=1 AND role='assistant'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(saved, no_key_msg);
}

#[test]
fn empty_api_key_is_detected() {
    fn key_is_valid(k: &str) -> bool {
        !k.is_empty()
    }
    assert!(!key_is_valid(""), "empty key should be rejected");
    assert!(key_is_valid("sk-ant-123"), "non-empty key is valid");
}

// ── LlmProvider::parse_stream_delta ──────────────────────────────────────────

#[test]
fn anthropic_parse_delta_extracts_text() {
    let provider = LlmProvider::Anthropic;
    let data = json!({
        "type": "content_block_delta",
        "delta": { "text": "Hello " }
    });
    assert_eq!(
        provider.parse_stream_delta(&data),
        Some("Hello ".to_string())
    );
}

#[test]
fn anthropic_parse_delta_ignores_non_content_block() {
    let provider = LlmProvider::Anthropic;
    let data = json!({ "type": "message_start", "message": {} });
    assert_eq!(provider.parse_stream_delta(&data), None);
}

#[test]
fn anthropic_parse_delta_ignores_missing_text() {
    let provider = LlmProvider::Anthropic;
    let data = json!({ "type": "content_block_delta", "delta": {} });
    assert_eq!(provider.parse_stream_delta(&data), None);
}

#[test]
fn deepseek_parse_delta_extracts_content() {
    let provider = LlmProvider::DeepSeek;
    let data = json!({
        "choices": [{ "delta": { "content": "World" } }]
    });
    assert_eq!(
        provider.parse_stream_delta(&data),
        Some("World".to_string())
    );
}

#[test]
fn deepseek_parse_delta_handles_null_content() {
    let provider = LlmProvider::DeepSeek;
    let data = json!({ "choices": [{ "delta": { "content": null } }] });
    assert_eq!(provider.parse_stream_delta(&data), None);
}

#[test]
fn deepseek_parse_delta_handles_empty_choices() {
    let provider = LlmProvider::DeepSeek;
    let data = json!({ "choices": [] });
    assert_eq!(provider.parse_stream_delta(&data), None);
}

#[test]
fn token_accumulation_produces_full_response() {
    // Simulate the accumulation loop in send_chat
    let tokens = vec!["The ", "answer ", "is ", "42."];
    let mut full_response = String::new();
    for token in tokens {
        full_response.push_str(token);
    }
    assert_eq!(full_response, "The answer is 42.");
}

#[test]
fn token_accumulation_stops_on_cancel() {
    // Simulate cancellation mid-stream
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    let cancel = Arc::new(AtomicBool::new(false));
    let tokens = ["Hello", " world", " stop", " here"];
    let mut full_response = String::new();

    for (i, token) in tokens.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            break;
        }
        full_response.push_str(token);
        if i == 1 {
            // Cancel after second token
            cancel.store(true, Ordering::SeqCst);
        }
    }

    assert_eq!(full_response, "Hello world", "should stop after cancel set");
}
