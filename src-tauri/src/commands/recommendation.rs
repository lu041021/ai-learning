use tauri::State;

use crate::db::DbPool;
use crate::error::AppError;
use crate::services::recommendation::{self, RecommendationItem};

#[tauri::command]
pub fn get_recommendations(
    user_id: i64,
    db: State<'_, DbPool>,
) -> Result<Vec<RecommendationItem>, AppError> {
    recommendation::get_recommendations(&db, user_id).map_err(AppError::from)
}
