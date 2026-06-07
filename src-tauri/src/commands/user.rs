use crate::db::DbPool;
use tauri::State;

use crate::models::user::UserOut;

#[tauri::command]
pub fn create_user(
    username: String,
    local_id: String,
    db: State<'_, DbPool>,
) -> Result<UserOut, String> {
    let conn = db.get().map_err(|e| e.to_string())?;

    // Check if user already exists by local_id
    let existing: Option<(i64, String, String)> = conn
        .query_row(
            "SELECT id, username, local_id FROM users WHERE local_id = ?1",
            rusqlite::params![local_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .ok();

    if let Some((id, uname, lid)) = existing {
        return Ok(UserOut {
            id,
            username: uname,
            local_id: lid,
        });
    }

    conn.execute(
        "INSERT INTO users (username, local_id) VALUES (?1, ?2)",
        rusqlite::params![username, local_id],
    )
    .map_err(|e| format!("Failed to create user: {}", e))?;

    let id = conn.last_insert_rowid();
    Ok(UserOut {
        id,
        username,
        local_id,
    })
}

#[tauri::command]
pub fn get_user_by_local(local_id: String, db: State<'_, DbPool>) -> Result<UserOut, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, username, local_id FROM users WHERE local_id = ?1",
        rusqlite::params![local_id],
        |row| {
            Ok(UserOut {
                id: row.get(0)?,
                username: row.get(1)?,
                local_id: row.get(2)?,
            })
        },
    )
    .map_err(|e| format!("User not found: {}", e))
}
