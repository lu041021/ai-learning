use rusqlite::Connection;
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::models::imports::{AwesomeLink, AwesomeRepo, DuplicateCheckResult, FeedArticle, FeedSubscription, ImportCourseResult, LinkPreview};
use crate::services::llm_client::{LlmClient, LlmProvider};

#[tauri::command]
pub async fn import_from_url(
    url: String,
    api_key: String,
    model: String,
    api_provider: String,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<ImportCourseResult, String> {
    let client = LlmClient::new(LlmProvider::from_str(&api_provider), api_key, model);
    let ai_course = crate::services::course_importer::fetch_and_structure_course(
        &url,
        &client,
    )
    .await?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    crate::services::course_importer::insert_course_to_db(&conn, &ai_course, &url)
}

#[tauri::command]
pub fn check_import_url(
    url: String,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<DuplicateCheckResult, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    crate::services::course_importer::check_duplicate_url(&conn, &url)
}

#[tauri::command]
pub async fn search_github_awesome(query: String) -> Result<Vec<AwesomeRepo>, String> {
    crate::services::github_importer::search_awesome_repos(&query).await
}

#[tauri::command]
pub async fn fetch_awesome_links(owner: String, repo: String) -> Result<Vec<AwesomeLink>, String> {
    crate::services::github_importer::fetch_awesome_readme_links(&owner, &repo).await
}

#[tauri::command]
pub async fn preview_import_link(url: String) -> Result<LinkPreview, String> {
    crate::services::github_importer::preview_link_content(&url).await
}

#[tauri::command]
pub fn subscribe_feed(
    feed_url: String,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<FeedSubscription, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    crate::services::feed_importer::subscribe_feed(&conn, &feed_url, "")
}

#[tauri::command]
pub fn unsubscribe_feed(id: i64, db: State<'_, Arc<Mutex<Connection>>>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    crate::services::feed_importer::unsubscribe_feed(&conn, id)
}

#[tauri::command]
pub fn list_feed_subscriptions(
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<Vec<FeedSubscription>, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    crate::services::feed_importer::list_subscriptions(&conn)
}

#[tauri::command]
pub async fn fetch_feed_articles(
    feed_url: String,
    db: State<'_, Arc<Mutex<Connection>>>,
) -> Result<Vec<FeedArticle>, String> {
    let (feed_title, articles) = crate::services::feed_importer::fetch_feed_articles(&feed_url).await?;

    // Update feed title and last_fetched in DB
    let conn = db.lock().map_err(|e| e.to_string())?;
    if !feed_title.is_empty() {
        let _ = conn.execute(
            "UPDATE feed_subscriptions SET feed_title = ?1 WHERE feed_url = ?2",
            rusqlite::params![feed_title, feed_url],
        );
    }
    crate::services::feed_importer::update_last_fetched(&conn, &feed_url)?;

    Ok(articles)
}
