use tauri::State;

use crate::db::DbPool;
use crate::error::AppError;
use crate::services::knowledge_graph::{self, KnowledgeGraphData};

#[tauri::command]
pub fn get_knowledge_graph(
    user_id: i64,
    db: State<'_, DbPool>,
) -> Result<KnowledgeGraphData, AppError> {
    knowledge_graph::build_knowledge_graph(&db, user_id).map_err(AppError::from)
}
