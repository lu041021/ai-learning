use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use tauri::State;

use crate::services::recommendation::{self, RecommendationItem};

type Db = Arc<Mutex<Connection>>;

#[tauri::command]
pub fn get_recommendations(
    user_id: i64,
    db: State<'_, Db>,
) -> Result<Vec<RecommendationItem>, String> {
    recommendation::get_recommendations(&db, user_id)
}
