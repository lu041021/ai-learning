use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressOut {
    pub completed_lesson_ids: Vec<i64>,
    pub quiz_scores: HashMap<i64, f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuizResult {
    pub score: f64,
    pub total: i64,
    pub correct: i64,
    pub feedback: String,
    pub next_step_recommendation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WrongAnswerItem {
    pub quiz_id: i64,
    pub quiz_title: String,
    pub question_text: String,
    pub options: Vec<String>,
    pub your_answer_index: i64,
    pub correct_answer_index: i64,
    pub explanation: String,
    pub lesson_id: i64,
    pub lesson_title: String,
    pub course_slug: String,
    pub attempted_at: String,
}
