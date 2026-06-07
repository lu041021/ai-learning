use crate::db::DbPool;
use crate::error::AppError;
use crate::services::doc_parser;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentOut {
    pub id: i64,
    pub filename: String,
    pub file_type: String,
    pub size_bytes: i64,
    pub chunk_count: i64,
    pub created_at: String,
}

#[tauri::command]
pub fn upload_document(
    user_id: i64,
    filename: String,
    file_bytes: Vec<u8>,
    db: State<'_, DbPool>,
) -> Result<DocumentOut, AppError> {
    let ext = Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let size_bytes = file_bytes.len() as i64;

    let text = doc_parser::extract_text_from_bytes(&file_bytes, &ext).map_err(AppError::from)?;
    let chunks = doc_parser::chunk_text(&text);
    let chunk_count = chunks.len() as i64;

    if chunk_count == 0 {
        return Err(AppError::InvalidInput("文档中未提取到文本内容".to_string()));
    }

    let conn = db.get()?;

    conn.execute(
        "INSERT INTO user_documents (user_id, filename, file_type, size_bytes, chunk_count)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![user_id, filename, ext, size_bytes, chunk_count],
    )?;
    let doc_id = conn.last_insert_rowid();

    let mut stmt = conn.prepare(
        "INSERT INTO doc_chunks (doc_id, user_id, chunk_index, content)
         VALUES (?1, ?2, ?3, ?4)",
    )?;

    for (i, chunk) in chunks.iter().enumerate() {
        stmt.execute(rusqlite::params![doc_id, user_id, i as i64, chunk])?;
    }

    let created_at: String = conn.query_row(
        "SELECT created_at FROM user_documents WHERE id = ?1",
        rusqlite::params![doc_id],
        |r| r.get(0),
    )?;

    Ok(DocumentOut {
        id: doc_id,
        filename,
        file_type: ext,
        size_bytes,
        chunk_count,
        created_at,
    })
}

#[tauri::command]
pub fn list_documents(user_id: i64, db: State<'_, DbPool>) -> Result<Vec<DocumentOut>, AppError> {
    let conn = db.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, filename, file_type, size_bytes, chunk_count, created_at
         FROM user_documents WHERE user_id = ?1
         ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(rusqlite::params![user_id], |row| {
        Ok(DocumentOut {
            id: row.get(0)?,
            filename: row.get(1)?,
            file_type: row.get(2)?,
            size_bytes: row.get(3)?,
            chunk_count: row.get(4)?,
            created_at: row.get::<_, String>(5).unwrap_or_default(),
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
}

#[tauri::command]
pub fn delete_document(doc_id: i64, user_id: i64, db: State<'_, DbPool>) -> Result<(), AppError> {
    let conn = db.get()?;
    conn.execute(
        "DELETE FROM doc_chunks WHERE doc_id = ?1 AND user_id = ?2",
        rusqlite::params![doc_id, user_id],
    )?;
    conn.execute(
        "DELETE FROM user_documents WHERE id = ?1 AND user_id = ?2",
        rusqlite::params![doc_id, user_id],
    )?;
    Ok(())
}
