use crate::models::imports::{AwesomeLink, AwesomeRepo, LinkPreview};

pub async fn search_awesome_repos(query: &str) -> Result<Vec<AwesomeRepo>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (compatible; AI-Learning-Platform/1.0)")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let search_query = if query.contains("awesome-") {
        query.to_string()
    } else {
        format!("awesome-{}", query)
    };

    let url = format!(
        "https://api.github.com/search/repositories?q={}+in:name+topic:awesome&sort=stars&order=desc&per_page=20",
        search_query
    );

    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    let items = body["items"]
        .as_array()
        .ok_or("Unexpected GitHub API response format")?;

    let repos: Vec<AwesomeRepo> = items
        .iter()
        .map(|item| AwesomeRepo {
            full_name: item["full_name"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            description: item["description"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            stars: item["stargazers_count"].as_i64().unwrap_or(0),
            url: item["html_url"]
                .as_str()
                .unwrap_or("")
                .to_string(),
        })
        .filter(|r| !r.full_name.is_empty())
        .collect();

    Ok(repos)
}

pub async fn fetch_awesome_readme_links(owner: &str, repo: &str) -> Result<Vec<AwesomeLink>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (compatible; AI-Learning-Platform/1.0)")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let readme_url = format!(
        "https://api.github.com/repos/{}/{}/readme",
        owner, repo
    );

    let response = client
        .get(&readme_url)
        .header("Accept", "application/vnd.github.v3.raw")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch README: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("README fetch error: {}", response.status()));
    }

    let markdown = response
        .text()
        .await
        .map_err(|e| format!("Failed to read README: {}", e))?;

    Ok(parse_markdown_links(&markdown))
}

fn parse_markdown_links(markdown: &str) -> Vec<AwesomeLink> {
    let mut links = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let bytes = markdown.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        // Look for '['
        if bytes[i] == b'[' {
            let text_start = i + 1;
            // Find closing ']'
            if let Some(text_end) = markdown[text_start..].find(']') {
                let text_end = text_start + text_end;
                let text = markdown[text_start..text_end].trim().to_string();

                // Check if followed by '('
                if text_end + 1 < len && bytes[text_end + 1] == b'(' {
                    let url_start = text_end + 2;
                    if let Some(url_end) = markdown[url_start..].find(')') {
                        let url_end = url_start + url_end;
                        let url = markdown[url_start..url_end].trim().to_string();

                        // Remove trailing title: url "title" -> url
                        let url = if let Some(space_idx) = url.find(" \"") {
                            url[..space_idx].to_string()
                        } else {
                            url
                        };

                        if url.starts_with("http")
                            && !url.starts_with("https://github.com")
                            && !text.is_empty()
                            && !text.starts_with("![")
                        {
                            let normalized = url.trim_end_matches('/').to_lowercase();
                            if seen.insert(normalized) {
                                links.push(AwesomeLink {
                                    text,
                                    url,
                                    description: String::new(),
                                });
                            }
                        }
                        i = url_end + 1;
                        continue;
                    }
                }
            }
        }
        i += 1;
    }

    links
}

pub async fn preview_link_content(url: &str) -> Result<LinkPreview, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (compatible; AI-Learning-Platform/1.0)")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let html = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let title = extract_title(&html);
    let description = extract_meta_description(&html);
    let text = crate::services::course_importer::extract_text_from_html(&html);
    let text_length = text.len();
    let text_preview = text.chars().take(500).collect::<String>();

    Ok(LinkPreview {
        title,
        description,
        url: url.to_string(),
        text_length,
        text_preview,
    })
}

fn extract_title(html: &str) -> String {
    if let Some(start) = html.find("<title>") {
        let inner = &html[start + 7..];
        if let Some(end) = inner.find("</title>") {
            return inner[..end].trim().to_string();
        }
    }
    if let Some(start) = html.find("<h1") {
        let inner = &html[start..];
        if let Some(tag_end) = inner.find('>') {
            let content = &inner[tag_end + 1..];
            if let Some(close) = content.find("</h1>") {
                let text = content[..close].trim().to_string();
                // Strip any inner tags
                let clean = text
                    .split('>')
                    .map(|s| {
                        if let Some(idx) = s.rfind('<') {
                            s[..idx].to_string()
                        } else {
                            s.to_string()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(" ");
                return clean;
            }
        }
    }
    String::new()
}

fn extract_meta_description(html: &str) -> String {
    let lower = html.to_lowercase();
    if let Some(start) = lower.find("<meta name=\"description\"") {
        let snippet = &html[start..];
        if let Some(content_start) = snippet.find("content=\"") {
            let inner = &snippet[content_start + 9..];
            if let Some(end) = inner.find('"') {
                return inner[..end].trim().to_string();
            }
        }
    }
    String::new()
}
