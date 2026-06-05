use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LearningPathStep {
    pub order: i64,
    pub title: String,
    pub description: String,
    pub step_type: String,
    pub course_id: Option<i64>,
    pub lesson_id: Option<i64>,
    pub status: String,
    pub estimated_minutes: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LearningPathOut {
    pub id: i64,
    pub user_id: i64,
    pub steps: Vec<LearningPathStep>,
    pub generated_at: String,
    pub updated_at: String,
}
