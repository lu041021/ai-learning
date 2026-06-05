use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportCourseResult {
    pub course_id: i64,
    pub course_title: String,
    pub course_slug: String,
    pub chapters_count: i64,
    pub lessons_count: i64,
    pub quiz_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DuplicateCheckResult {
    pub exists: bool,
    pub existing_course_id: Option<i64>,
    pub existing_course_title: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AwesomeRepo {
    pub full_name: String,
    pub description: String,
    pub stars: i64,
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AwesomeLink {
    pub text: String,
    pub url: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LinkPreview {
    pub title: String,
    pub description: String,
    pub url: String,
    pub text_length: usize,
    pub text_preview: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeedSubscription {
    pub id: i64,
    pub feed_url: String,
    pub feed_title: String,
    pub last_fetched_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FeedArticle {
    pub title: String,
    pub url: String,
    pub description: String,
    pub published_at: Option<String>,
    pub author: Option<String>,
}
