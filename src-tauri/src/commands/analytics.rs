use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use tauri::State;

use crate::services::analytics::{self, AnalyticsData};

type Db = Arc<Mutex<Connection>>;

#[tauri::command]
pub fn get_analytics(
    user_id: i64,
    db: State<'_, Db>,
) -> Result<AnalyticsData, String> {
    analytics::get_analytics(&db, user_id)
}
