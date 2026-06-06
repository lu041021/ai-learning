use rusqlite::Connection;
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::models::chat::{ConversationOut, MessageOut};
use crate::services::llm_client::{LlmClient, LlmProvider};

pub struct StreamCancellers(pub Mutex<HashMap<i64, Arc<AtomicBool>>>);

#[tauri::command]
pub fn list_conversations(
    user_id: i64,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<Vec<ConversationOut>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, lesson_id, created_at, updated_at FROM conversations WHERE user_id = ?1 ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(ConversationOut {
                id: row.get(0)?,
                title: row.get(1)?,
                lesson_id: row.get(2)?,
                created_at: row.get::<_, String>(3).unwrap_or_default(),
                updated_at: row.get::<_, String>(4).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_messages(
    conv_id: i64,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<Vec<MessageOut>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, role, content, created_at FROM messages WHERE conversation_id = ?1 ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![conv_id], |row| {
            Ok(MessageOut {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get::<_, String>(3).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn send_chat(
    app_handle: AppHandle,
    user_id: i64,
    lesson_id: Option<i64>,
    message: String,
    selected_text: Option<String>,
    conversation_id: Option<i64>,
    api_key: String,
    model: String,
    api_provider: String,
    max_chat_history: Option<i64>,
) -> Result<i64, String> {
    let max_history = max_chat_history.unwrap_or(20);

    // Get or create conversation, save user message, build system prompt
    let (conv_id, history_messages, system_prompt) = {
        let db = app_handle.state::<Mutex<Connection>>();
        let conn = db.lock().map_err(|e| e.to_string())?;

        let cid = if let Some(existing_id) = conversation_id {
            let _ = conn.execute(
                "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?1",
                rusqlite::params![existing_id],
            );
            existing_id
        } else {
            let title = if message.len() > 80 {
                format!("{}...", &message[..80])
            } else {
                message.clone()
            };
            conn.execute(
                "INSERT INTO conversations (user_id, lesson_id, title) VALUES (?1, ?2, ?3)",
                rusqlite::params![user_id, lesson_id, title],
            )
            .map_err(|e| e.to_string())?;
            conn.last_insert_rowid()
        };

        // Save user message
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?1, 'user', ?2)",
            rusqlite::params![cid, message],
        )
        .map_err(|e| e.to_string())?;

        // Get history
        let mut stmt = conn
            .prepare("SELECT role, content FROM messages WHERE conversation_id = ?1 ORDER BY created_at DESC LIMIT ?2")
            .map_err(|e| e.to_string())?;
        let mut msgs: Vec<(String, String)> = stmt
            .query_map(rusqlite::params![cid, max_history], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        msgs.reverse();

        // Build system prompt
        let prompt = crate::services::ai_tutor::build_system_prompt(
            &conn,
            user_id,
            lesson_id,
            selected_text.as_deref(),
        )?;

        (cid, msgs, prompt)
    };

    // Set up cancellation
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let cancellers = app_handle.state::<StreamCancellers>();
        let mut map = cancellers.0.lock().map_err(|e| e.to_string())?;
        map.insert(conv_id, cancel_flag.clone());
    }

    // Build anthropic messages from history
    let anthropic_messages: Vec<serde_json::Value> = history_messages
        .iter()
        .map(|(role, content)| json!({"role": role, "content": content}))
        .collect();

    if api_key.is_empty() {
        let no_key_msg = "请在设置中配置 ANTHROPIC_API_KEY 以启用 AI 导师功能。";
        let handle = app_handle.clone();
        tokio::spawn(async move {
            let _ = handle.emit(
                "chat-token",
                json!({"token": no_key_msg, "conversation_id": conv_id}),
            );

            let db = handle.state::<Mutex<Connection>>();
            if let Ok(conn) = db.lock() {
                let _ = conn.execute(
                    "INSERT INTO messages (conversation_id, role, content) VALUES (?1, 'assistant', ?2)",
                    rusqlite::params![conv_id, no_key_msg],
                );
            }
            let _ = handle.emit("chat-done", json!({"conversation_id": conv_id}));

            cleanup_cancellers(&handle, conv_id);
        });

        return Ok(conv_id);
    }

    let was_new = conversation_id.is_none();
    let handle = app_handle.clone();
    let cid = conv_id;
    let cancel = cancel_flag.clone();
    let api_key_clone = api_key.clone();
    let model_clone = model.clone();
    let api_provider_clone = api_provider.clone();
    let user_msg = message.clone();

    let llm_client = LlmClient::new(
        LlmProvider::from_name(&api_provider),
        api_key.clone(),
        model.clone(),
    );

    tokio::spawn(async move {
        let mut stream = match llm_client
            .stream_chat(&system_prompt, anthropic_messages, 2000)
            .await
        {
            Ok(s) => s,
            Err(e) => {
                let err_msg = format!("AI 导师暂时不可用: {}", e);
                let _ = handle.emit(
                    "chat-token",
                    json!({"token": err_msg, "conversation_id": cid}),
                );
                save_assistant_to_handle(&handle, cid, &err_msg);
                let _ = handle.emit("chat-done", json!({"conversation_id": cid}));
                cleanup_cancellers(&handle, cid);
                return;
            }
        };

        let mut full_response = String::new();
        use futures_util::StreamExt;
        while let Some(chunk_result) = stream.next().await {
            if cancel.load(Ordering::SeqCst) {
                break;
            }

            match chunk_result {
                Ok(token) => {
                    full_response.push_str(&token);
                    let _ = handle.emit(
                        "chat-token",
                        json!({"token": token, "conversation_id": cid}),
                    );
                }
                Err(e) => {
                    let _ = handle.emit("chat-token", json!({"token": format!("\n[Stream error: {}]", e), "conversation_id": cid}));
                    break;
                }
            }
        }

        save_assistant_to_handle(&handle, cid, &full_response);

        let _ = handle.emit("chat-done", json!({"conversation_id": cid}));

        // Generate title for new conversations after first exchange
        if was_new && !full_response.is_empty() {
            let title_client = LlmClient::new(
                LlmProvider::from_name(&api_provider_clone),
                api_key_clone.clone(),
                model_clone.clone(),
            );
            let title = generate_title(&title_client, &user_msg).await;
            let good_title = title.unwrap_or_else(|_| {
                if user_msg.len() > 80 {
                    format!("{}...", &user_msg[..80])
                } else {
                    user_msg.clone()
                }
            });
            if let Some(db) = handle.try_state::<Mutex<Connection>>() {
                if let Ok(conn) = db.lock() {
                    let _ = conn.execute(
                        "UPDATE conversations SET title = ?1 WHERE id = ?2",
                        rusqlite::params![good_title, cid],
                    );
                }
            }
            let _ = handle.emit(
                "chat-title",
                json!({"conversation_id": cid, "title": good_title}),
            );
        }

        cleanup_cancellers(&handle, cid);
    });

    Ok(conv_id)
}

fn save_assistant_to_handle(handle: &AppHandle, conv_id: i64, content: &str) {
    if let Some(db) = handle.try_state::<Mutex<Connection>>() {
        if let Ok(conn) = db.lock() {
            let _ = conn.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (?1, 'assistant', ?2)",
                rusqlite::params![conv_id, content],
            );
        }
    }
}

fn cleanup_cancellers(handle: &AppHandle, conv_id: i64) {
    if let Some(cancellers) = handle.try_state::<StreamCancellers>() {
        if let Ok(mut map) = cancellers.0.lock() {
            map.remove(&conv_id);
        }
    }
}

async fn generate_title(client: &LlmClient, user_msg: &str) -> Result<String, String> {
    let snippet: String = if user_msg.len() > 200 {
        user_msg.chars().take(200).collect()
    } else {
        user_msg.to_string()
    };
    client.chat(
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

#[tauri::command]
pub fn cancel_chat(conv_id: i64, cancellers: State<'_, StreamCancellers>) -> Result<(), String> {
    let map = cancellers.0.lock().map_err(|e| e.to_string())?;
    if let Some(cancel) = map.get(&conv_id) {
        cancel.store(true, Ordering::SeqCst);
    }
    Ok(())
}
