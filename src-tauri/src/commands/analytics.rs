use tauri::State;

use crate::db::DbPool;
use crate::error::AppError;
use crate::services::analytics::{self, AnalyticsData};

#[tauri::command]
pub fn get_analytics(user_id: i64, db: State<'_, DbPool>) -> Result<AnalyticsData, AppError> {
    analytics::get_analytics(&db, user_id).map_err(AppError::from)
}
