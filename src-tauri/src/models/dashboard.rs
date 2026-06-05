use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardData {
    pub total_lessons: i64,
    pub completed_lessons: i64,
    pub total_quizzes: i64,
    pub avg_quiz_score: f64,
    pub skill_radar: Vec<SkillRadarItem>,
    pub course_progress: Vec<CourseProgressItem>,
    pub calendar_days: Vec<CalendarDay>,
    pub knowledge_tree: Vec<TreeNodeData>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillRadarItem {
    pub label: String,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CourseProgressItem {
    pub course_id: i64,
    pub title: String,
    pub slug: String,
    pub total_lessons: i64,
    pub completed_lessons: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarDay {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TreeNodeData {
    pub id: i64,
    pub title: String,
    pub kind: String,
    pub completed: bool,
    pub children: Vec<TreeNodeData>,
    pub course_slug: Option<String>,
}
