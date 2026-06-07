use rusqlite::Connection;
use serde_json::json;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

use crate::services::llm_client::LlmClient;

pub struct PrepareResult {
    pub conv_id: i64,
    pub was_new: bool,
    pub history: Vec<serde_json::Value>,
    pub system_prompt: String,
}

pub struct StreamRequest {
    pub conv_id: i64,
    pub was_new: bool,
    pub user_msg: String,
    pub system_prompt: String,
    pub history: Vec<serde_json::Value>,
    pub llm_client: LlmClient,
    pub cancel: Arc<std::sync::atomic::AtomicBool>,
}

pub fn prepare_conversation(
    conn: &Connection,
    user_id: i64,
    lesson_id: Option<i64>,
    message: &str,
    selected_text: Option<&str>,
    conversation_id: Option<i64>,
    max_history: i64,
) -> Result<PrepareResult, String> {
    let (conv_id, was_new) = if let Some(existing_id) = conversation_id {
        let _ = conn.execute(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![existing_id],
        );
        (existing_id, false)
    } else {
        let title = truncate_title(message, 80);
        conn.execute(
            "INSERT INTO conversations (user_id, lesson_id, title) VALUES (?1, ?2, ?3)",
            rusqlite::params![user_id, lesson_id, title],
        )
        .map_err(|e| e.to_string())?;
        (conn.last_insert_rowid(), true)
    };

    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?1, 'user', ?2)",
        rusqlite::params![conv_id, message],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT role, content FROM messages WHERE conversation_id = ?1 ORDER BY created_at DESC LIMIT ?2")
        .map_err(|e| e.to_string())?;
    let mut msgs: Vec<(String, String)> = stmt
        .query_map(rusqlite::params![conv_id, max_history], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    msgs.reverse();

    let history = msgs
        .iter()
        .map(|(role, content)| json!({"role": role, "content": content}))
        .collect();

    let system_prompt =
        crate::services::ai_tutor::build_system_prompt(conn, user_id, lesson_id, selected_text)?;

    Ok(PrepareResult {
        conv_id,
        was_new,
        history,
        system_prompt,
    })
}

pub async fn stream_response(handle: AppHandle, req: StreamRequest) {
    let StreamRequest {
        conv_id,
        was_new,
        user_msg,
        system_prompt,
        history,
        llm_client,
        cancel,
    } = req;
    use futures_util::StreamExt;
    use std::sync::atomic::Ordering;

    let mut stream = match llm_client.stream_chat(&system_prompt, history, 2000).await {
        Ok(s) => s,
        Err(e) => {
            let err_msg = format!("AI 导师暂时不可用: {}", e);
            let _ = handle.emit(
                "chat-token",
                json!({"token": err_msg, "conversation_id": conv_id}),
            );
            save_assistant(&handle, conv_id, &err_msg);
            let _ = handle.emit("chat-done", json!({"conversation_id": conv_id}));
            cleanup_cancel(&handle, conv_id);
            return;
        }
    };

    let mut full_response = String::new();
    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::SeqCst) {
            break;
        }
        match chunk {
            Ok(token) => {
                full_response.push_str(&token);
                let _ = handle.emit(
                    "chat-token",
                    json!({"token": token, "conversation_id": conv_id}),
                );
            }
            Err(e) => {
                let _ = handle.emit("chat-token", json!({"token": format!("\n[Stream error: {}]", e), "conversation_id": conv_id}));
                break;
            }
        }
    }

    save_assistant(&handle, conv_id, &full_response);
    let _ = handle.emit("chat-done", json!({"conversation_id": conv_id}));

    if was_new && !full_response.is_empty() {
        let title = generate_title(&llm_client, &user_msg)
            .await
            .unwrap_or_else(|_| truncate_title(&user_msg, 80));
        if let Some(db) = handle.try_state::<Arc<Mutex<Connection>>>() {
            if let Ok(conn) = db.lock() {
                conn.execute(
                    "UPDATE conversations SET title = ?1 WHERE id = ?2",
                    rusqlite::params![title, conv_id],
                )
                .map_err(|e| eprintln!("Failed to update title: {}", e))
                .ok();
            }
        }
        let _ = handle.emit(
            "chat-title",
            json!({"conversation_id": conv_id, "title": title}),
        );
    }

    cleanup_cancel(&handle, conv_id);
}

async fn generate_title(client: &LlmClient, user_msg: &str) -> Result<String, String> {
    let snippet: String = user_msg.chars().take(200).collect();
    client
        .chat(
            "Generate a short conversation title (max 10 words, in the user's language). Output ONLY the title, no quotes, no extra text.",
            &format!("Generate a title for a conversation starting with: {}", snippet),
            30,
        )
        .await
        .map(|title| {
            let t = title.trim().replace('"', "").replace('\n', " ");
            if t.len() > 80 { t.chars().take(80).collect() } else { t }
        })
}

fn save_assistant(handle: &AppHandle, conv_id: i64, content: &str) {
    if let Some(db) = handle.try_state::<Arc<Mutex<Connection>>>() {
        if let Ok(conn) = db.lock() {
            conn.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (?1, 'assistant', ?2)",
                rusqlite::params![conv_id, content],
            )
            .map_err(|e| eprintln!("Failed to save assistant message: {}", e))
            .ok();
        }
    }
}

fn cleanup_cancel(handle: &AppHandle, conv_id: i64) {
    use crate::commands::chat::StreamCancellers;
    if let Some(cancellers) = handle.try_state::<StreamCancellers>() {
        if let Ok(mut map) = cancellers.0.lock() {
            map.remove(&conv_id);
        }
    }
}

fn truncate_title(s: &str, max: usize) -> String {
    if s.chars().count() > max {
        format!("{}...", s.chars().take(max).collect::<String>())
    } else {
        s.to_string()
    }
}
