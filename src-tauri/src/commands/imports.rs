use crate::db::DbPool;
use crate::error::AppError;
use tauri::State;

use crate::commands::config_cmd::ConfigState;
use crate::models::imports::{
    AwesomeLink, AwesomeRepo, DuplicateCheckResult, FeedArticle, FeedSubscription,
    ImportCourseResult, LinkPreview,
};
use crate::services::llm_client::{LlmClient, LlmProvider};

fn validate_https_url(url: &str) -> Result<(), AppError> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(AppError::InvalidInput(format!(
            "不支持的 URL 协议，仅允许 http:// 或 https://：{}",
            url
        )));
    }
    let host = url
        .splitn(3, '/')
        .nth(2)
        .unwrap_or("")
        .split([':', '/'])
        .next()
        .unwrap_or("");
    if host == "localhost"
        || host.starts_with("127.")
        || host.starts_with("10.")
        || host.starts_with("192.168.")
        || host.starts_with("172.")
        || host == "0.0.0.0"
        || host == "[::1]"
    {
        return Err(AppError::InvalidInput(format!(
            "不允许访问本地或内网地址：{}",
            host
        )));
    }
    Ok(())
}

#[tauri::command]
pub async fn import_from_url(
    url: String,
    db: State<'_, DbPool>,
    config: State<'_, ConfigState>,
) -> Result<ImportCourseResult, AppError> {
    validate_https_url(&url)?;
    let (api_key, model, api_provider) = {
        let cfg = config.config.lock()?;
        (
            cfg.api_key.clone(),
            cfg.model.clone(),
            cfg.api_provider.clone(),
        )
    };
    let client = LlmClient::new(LlmProvider::from_name(&api_provider), api_key, model);
    let ai_course = crate::services::course_importer::fetch_and_structure_course(&url, &client)
        .await
        .map_err(AppError::from)?;

    let conn = db.get()?;
    crate::services::course_importer::insert_course_to_db(&conn, &ai_course, &url)
        .map_err(AppError::from)
}

#[tauri::command]
pub fn check_import_url(
    url: String,
    db: State<'_, DbPool>,
) -> Result<DuplicateCheckResult, AppError> {
    validate_https_url(&url)?;
    let conn = db.get()?;
    crate::services::course_importer::check_duplicate_url(&conn, &url).map_err(AppError::from)
}

#[tauri::command]
pub async fn search_github_awesome(query: String) -> Result<Vec<AwesomeRepo>, AppError> {
    crate::services::github_importer::search_awesome_repos(&query)
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn fetch_awesome_links(
    owner: String,
    repo: String,
) -> Result<Vec<AwesomeLink>, AppError> {
    crate::services::github_importer::fetch_awesome_readme_links(&owner, &repo)
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub async fn preview_import_link(url: String) -> Result<LinkPreview, AppError> {
    validate_https_url(&url)?;
    crate::services::github_importer::preview_link_content(&url)
        .await
        .map_err(AppError::from)
}

#[tauri::command]
pub fn subscribe_feed(
    feed_url: String,
    db: State<'_, DbPool>,
) -> Result<FeedSubscription, AppError> {
    let conn = db.get()?;
    crate::services::feed_importer::subscribe_feed(&conn, &feed_url, "").map_err(AppError::from)
}

#[tauri::command]
pub fn unsubscribe_feed(id: i64, db: State<'_, DbPool>) -> Result<(), AppError> {
    let conn = db.get()?;
    crate::services::feed_importer::unsubscribe_feed(&conn, id).map_err(AppError::from)
}

#[tauri::command]
pub fn list_feed_subscriptions(db: State<'_, DbPool>) -> Result<Vec<FeedSubscription>, AppError> {
    let conn = db.get()?;
    crate::services::feed_importer::list_subscriptions(&conn).map_err(AppError::from)
}

#[tauri::command]
pub async fn fetch_feed_articles(
    feed_url: String,
    db: State<'_, DbPool>,
) -> Result<Vec<FeedArticle>, AppError> {
    validate_https_url(&feed_url)?;
    let (feed_title, articles) = crate::services::feed_importer::fetch_feed_articles(&feed_url)
        .await
        .map_err(AppError::from)?;

    let conn = db.get()?;
    if !feed_title.is_empty() {
        let _ = conn.execute(
            "UPDATE feed_subscriptions SET feed_title = ?1 WHERE feed_url = ?2",
            rusqlite::params![feed_title, feed_url],
        );
    }
    crate::services::feed_importer::update_last_fetched(&conn, &feed_url)
        .map_err(AppError::from)?;

    Ok(articles)
}
