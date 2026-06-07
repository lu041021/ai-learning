use tauri::State;

use crate::db::DbPool;
use crate::services::search;

#[tauri::command]
pub fn search_all(
    query: String,
    limit: Option<usize>,
    db: State<'_, DbPool>,
) -> Result<Vec<search::SearchResult>, String> {
    search::search_all(&db, &query, limit.unwrap_or(20))
}
