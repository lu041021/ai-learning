use crate::db::DbPool;
use crate::error::AppError;
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::commands::config_cmd::ConfigState;
use crate::models::chat::{ConversationOut, MessageOut};
use crate::services::chat_service::{prepare_conversation, stream_response, StreamRequest};
use crate::services::llm_client::{LlmClient, LlmProvider};

pub struct StreamCancellers(pub Mutex<HashMap<i64, Arc<AtomicBool>>>);

#[tauri::command]
pub fn list_conversations(
    user_id: i64,
    db: State<'_, DbPool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<ConversationOut>, AppError> {
    let conn = db.get()?;
    let limit = limit.unwrap_or(100);
    let offset = offset.unwrap_or(0);
    let mut stmt = conn.prepare(
        "SELECT id, title, lesson_id, created_at, updated_at FROM conversations \
         WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT ?2 OFFSET ?3",
    )?;
    let rows = stmt.query_map(rusqlite::params![user_id, limit, offset], |row| {
        Ok(ConversationOut {
            id: row.get(0)?,
            title: row.get(1)?,
            lesson_id: row.get(2)?,
            created_at: row.get::<_, String>(3).unwrap_or_default(),
            updated_at: row.get::<_, String>(4).unwrap_or_default(),
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn get_messages(conv_id: i64, db: State<'_, DbPool>) -> Result<Vec<MessageOut>, AppError> {
    let conn = db.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, role, content, created_at FROM messages \
         WHERE conversation_id = ?1 ORDER BY created_at",
    )?;
    let rows = stmt.query_map(rusqlite::params![conv_id], |row| {
        Ok(MessageOut {
            id: row.get(0)?,
            role: row.get(1)?,
            content: row.get(2)?,
            created_at: row.get::<_, String>(3).unwrap_or_default(),
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn send_chat(
    app_handle: AppHandle,
    config: State<'_, ConfigState>,
    user_id: i64,
    lesson_id: Option<i64>,
    message: String,
    selected_text: Option<String>,
    conversation_id: Option<i64>,
    max_chat_history: Option<i64>,
) -> Result<i64, AppError> {
    let (api_key, model, api_provider) = {
        let cfg = config.config.lock()?;
        (
            cfg.api_key.clone(),
            cfg.model.clone(),
            cfg.api_provider.clone(),
        )
    };
    let max_history = max_chat_history.unwrap_or(20);

    let prepared = {
        let db = app_handle.state::<DbPool>();
        let conn = db.get()?;
        prepare_conversation(
            &conn,
            user_id,
            lesson_id,
            &message,
            selected_text.as_deref(),
            conversation_id,
            max_history,
        )
        .map_err(AppError::from)?
    };

    let conv_id = prepared.conv_id;

    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let cancellers = app_handle.state::<StreamCancellers>();
        let mut map = cancellers.0.lock()?;
        map.insert(conv_id, cancel_flag.clone());
    }

    if api_key.is_empty() {
        let no_key_msg = "请在设置中配置 ANTHROPIC_API_KEY 以启用 AI 导师功能。";
        let handle = app_handle.clone();
        tokio::spawn(async move {
            let _ = handle.emit(
                "chat-token",
                json!({"token": no_key_msg, "conversation_id": conv_id}),
            );
            if let Some(db) = handle.try_state::<DbPool>() {
                if let Ok(conn) = db.get() {
                    let _ = conn.execute(
                        "INSERT INTO messages (conversation_id, role, content) VALUES (?1, 'assistant', ?2)",
                        rusqlite::params![conv_id, no_key_msg],
                    );
                }
            }
            let _ = handle.emit("chat-done", json!({"conversation_id": conv_id}));
            if let Some(c) = handle.try_state::<StreamCancellers>() {
                if let Ok(mut m) = c.0.lock() {
                    m.remove(&conv_id);
                }
            }
        });
        return Ok(conv_id);
    }

    let llm_client = LlmClient::new(LlmProvider::from_name(&api_provider), api_key, model);

    tokio::spawn(stream_response(
        app_handle,
        StreamRequest {
            conv_id,
            was_new: prepared.was_new,
            user_msg: message,
            system_prompt: prepared.system_prompt,
            history: prepared.history,
            llm_client,
            cancel: cancel_flag,
        },
    ));

    Ok(conv_id)
}

#[tauri::command]
pub fn cancel_chat(conv_id: i64, cancellers: State<'_, StreamCancellers>) -> Result<(), AppError> {
    let map = cancellers.0.lock()?;
    if let Some(cancel) = map.get(&conv_id) {
        cancel.store(true, Ordering::SeqCst);
    }
    Ok(())
}
