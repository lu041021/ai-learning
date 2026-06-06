use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CourseSummary {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: String,
    pub difficulty: String,
    pub duration_minutes: i64,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LessonSummary {
    pub id: i64,
    pub title: String,
    pub order_index: i64,
    pub duration_minutes: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChapterDetail {
    pub id: i64,
    pub title: String,
    pub order_index: i64,
    pub lessons: Vec<LessonSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CourseDetail {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: String,
    pub difficulty: String,
    pub duration_minutes: i64,
    pub tags: Vec<String>,
    pub chapters: Vec<ChapterDetail>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LessonDetail {
    pub id: i64,
    pub title: String,
    pub content_md: String,
    pub order_index: i64,
    pub chapter_id: i64,
    pub duration_minutes: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuizQuestionOut {
    pub id: i64,
    pub question_text: String,
    pub options: String,
    pub explanation: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuizOut {
    pub id: i64,
    pub lesson_id: i64,
    pub title: String,
    pub questions: Vec<QuizQuestionOut>,
}
