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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConceptMastery {
    pub concept_name: String,
    pub domain: String,
    pub mastery_score: f64,
    pub quiz_attempts: i64,
    pub last_score: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WeaknessDetail {
    pub domain: String,
    pub concept_name: String,
    pub severity: String,
    pub current_score: f64,
    pub suggested_focus: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LearningStyleProfile {
    pub pace: String,
    pub consistency: String,
    pub preferred_format: String,
    pub review_tendency: String,
    pub avg_session_minutes: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GoalAnalysis {
    pub goal_text: String,
    pub gap_description: String,
    pub priority_domains: Vec<String>,
    pub suggested_milestones: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfileFull {
    pub experience_level: String,
    pub interests: Vec<String>,
    pub learning_goals: String,
    pub concept_mastery: Vec<ConceptMastery>,
    pub domain_strengths: Vec<String>,
    pub weakness_details: Vec<WeaknessDetail>,
    pub learning_style: LearningStyleProfile,
    pub total_lessons_completed: i64,
    pub total_lessons: i64,
    pub total_quizzes_taken: i64,
    pub avg_quiz_score: f64,
    pub streak_days: i64,
    pub completion_pct: f64,
    pub external_skill_context: Option<String>,
    pub goal_analysis: Option<GoalAnalysis>,
    pub summary: String,
    pub profile_version: i32,
    pub generated_at: String,
}
