use tauri::State;

use crate::db::DbPool;
use crate::error::AppError;
use crate::services::search;

#[tauri::command]
pub fn search_all(
    query: String,
    limit: Option<usize>,
    db: State<'_, DbPool>,
) -> Result<Vec<search::SearchResult>, AppError> {
    search::search_all(&db, &query, limit.unwrap_or(20)).map_err(AppError::from)
}
