use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationOut {
    pub id: i64,
    pub title: String,
    pub lesson_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MessageOut {
    pub id: i64,
    pub role: String,
    pub content: String,
    pub created_at: String,
}
