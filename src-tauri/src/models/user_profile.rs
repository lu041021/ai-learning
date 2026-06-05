use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssessmentResponse {
    pub question_index: i64,
    pub question_text: String,
    pub answer_index: i64,
    pub answer_text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillAssessment {
    pub experience_level: String,
    pub interests: Vec<String>,
    pub learning_goals: String,
    pub summary: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfileOut {
    pub id: i64,
    pub user_id: i64,
    pub experience_level: String,
    pub interests: Vec<String>,
    pub learning_goals: String,
    pub assessment_completed: bool,
    pub summary: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AssessUserSkillInput {
    pub user_id: i64,
    pub responses: Vec<AssessmentResponse>,
}
