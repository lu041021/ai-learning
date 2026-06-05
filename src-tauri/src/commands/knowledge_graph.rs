use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use tauri::State;

use crate::services::knowledge_graph::{self, KnowledgeGraphData};

type Db = Arc<Mutex<Connection>>;

#[tauri::command]
pub fn get_knowledge_graph(
    user_id: i64,
    db: State<'_, Db>,
) -> Result<KnowledgeGraphData, String> {
    knowledge_graph::build_knowledge_graph(&db, user_id)
}
