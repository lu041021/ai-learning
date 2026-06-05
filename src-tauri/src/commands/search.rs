use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use tauri::State;

use crate::services::search;

type Db = Arc<Mutex<Connection>>;

#[tauri::command]
pub fn search_all(
    query: String,
    limit: Option<usize>,
    db: State<'_, Db>,
) -> Result<Vec<search::SearchResult>, String> {
    search::search_all(&db, &query, limit.unwrap_or(20))
}
