use rusqlite::Connection;

use crate::models::imports::{FeedArticle, FeedSubscription};

pub fn subscribe_feed(
    conn: &Connection,
    feed_url: &str,
    feed_title: &str,
) -> Result<FeedSubscription, String> {
    conn.execute(
        "INSERT OR IGNORE INTO feed_subscriptions (feed_url, feed_title) VALUES (?1, ?2)",
        rusqlite::params![feed_url, feed_title],
    )
    .map_err(|e| format!("Subscribe feed: {}", e))?;

    let id = conn.last_insert_rowid();
    let sub = conn
        .query_row(
            "SELECT id, feed_url, feed_title, last_fetched_at, created_at FROM feed_subscriptions WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(FeedSubscription {
                    id: row.get(0)?,
                    feed_url: row.get(1)?,
                    feed_title: row.get(2)?,
                    last_fetched_at: row.get(3)?,
                    created_at: row.get(4)?,
                })
            },
        )
        .or_else(|_| {
            conn.query_row(
                "SELECT id, feed_url, feed_title, last_fetched_at, created_at FROM feed_subscriptions WHERE feed_url = ?1",
                rusqlite::params![feed_url],
                |row| {
                    Ok(FeedSubscription {
                        id: row.get(0)?,
                        feed_url: row.get(1)?,
                        feed_title: row.get(2)?,
                        last_fetched_at: row.get(3)?,
                        created_at: row.get(4)?,
                    })
                },
            )
        })
        .map_err(|e| format!("Query subscription: {}", e))?;

    Ok(sub)
}

pub fn unsubscribe_feed(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute(
        "DELETE FROM feed_subscriptions WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| format!("Unsubscribe feed: {}", e))?;
    Ok(())
}

pub fn list_subscriptions(conn: &Connection) -> Result<Vec<FeedSubscription>, String> {
    let mut stmt = conn
        .prepare("SELECT id, feed_url, feed_title, last_fetched_at, created_at FROM feed_subscriptions ORDER BY created_at DESC")
        .map_err(|e| format!("List subscriptions: {}", e))?;

    let subs = stmt
        .query_map([], |row| {
            Ok(FeedSubscription {
                id: row.get(0)?,
                feed_url: row.get(1)?,
                feed_title: row.get(2)?,
                last_fetched_at: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| format!("Query subscriptions: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(subs)
}

pub async fn fetch_feed_articles(feed_url: &str) -> Result<(String, Vec<FeedArticle>), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (compatible; AI-Learning-Platform/1.0)")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(feed_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch feed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let body = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read feed body: {}", e))?;

    let feed =
        feed_rs::parser::parse(&body[..]).map_err(|e| format!("Failed to parse feed: {}", e))?;

    let feed_title = feed.title.map(|t| t.content).unwrap_or_default();

    let articles: Vec<FeedArticle> = feed
        .entries
        .iter()
        .map(|entry| {
            let title = entry
                .title
                .as_ref()
                .map(|t| t.content.clone())
                .unwrap_or_default();
            let url = entry
                .links
                .first()
                .map(|l| l.href.clone())
                .unwrap_or_default();
            let description = entry
                .summary
                .as_ref()
                .map(|s| s.content.clone())
                .unwrap_or_default();
            let published_at = entry.published.or(entry.updated).map(|d| d.to_rfc3339());
            let author = entry.authors.first().map(|a| a.name.clone());

            FeedArticle {
                title,
                url,
                description,
                published_at,
                author,
            }
        })
        .filter(|a| !a.url.is_empty())
        .collect();

    Ok((feed_title, articles))
}

pub fn update_last_fetched(conn: &Connection, feed_url: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE feed_subscriptions SET last_fetched_at = datetime('now') WHERE feed_url = ?1",
        rusqlite::params![feed_url],
    )
    .map_err(|e| format!("Update last_fetched: {}", e))?;
    Ok(())
}
