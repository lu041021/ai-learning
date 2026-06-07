use tauri::State;

use crate::db::DbPool;
use crate::services::analytics::{self, AnalyticsData};

#[tauri::command]
pub fn get_analytics(user_id: i64, db: State<'_, DbPool>) -> Result<AnalyticsData, String> {
    analytics::get_analytics(&db, user_id)
}
