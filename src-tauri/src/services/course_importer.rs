use rusqlite::Connection;
use serde::Deserialize;
use serde_json::json;

use crate::models::imports::{DuplicateCheckResult, ImportCourseResult};
use crate::services::llm_client::LlmClient;

#[derive(Debug, Deserialize)]
pub struct AiQuizQuestion {
    pub question_text: String,
    pub options: Vec<String>,
    pub correct_answer_index: i64,
    pub explanation: String,
}

#[derive(Debug, Deserialize)]
pub struct AiQuiz {
    pub title: String,
    pub questions: Vec<AiQuizQuestion>,
}

#[derive(Debug, Deserialize)]
pub struct AiLesson {
    pub title: String,
    pub content_md: String,
    pub quiz: Option<AiQuiz>,
}

#[derive(Debug, Deserialize)]
pub struct AiChapter {
    pub title: String,
    pub lessons: Vec<AiLesson>,
}

#[derive(Debug, Deserialize)]
pub struct AiCourseOutput {
    pub course_title: String,
    pub course_description: String,
    pub chapters: Vec<AiChapter>,
}

const COURSE_STRUCTURE_PROMPT: &str = r#"你是一位专业的课程编辑。请将以下网页内容转化为结构化的学习课程。

要求：
1. 提取核心知识点，组织成有逻辑的章节和课时结构
2. 每个章节包含 2-4 个课时
3. 每个课时内容为 Markdown 格式，包含标题、正文、代码块（如适用）
4. 总课时 3-8 个
5. 每个课时配 3-4 道单项选择题，每题 4 个选项，有且仅有一个正确答案
6. 课程标题和描述使用中文
7. 如果原文是英文，请翻译为中文

来源URL: {source_url}

网页内容:
{source_text}

请以JSON格式回复，不要包含markdown标记或其他文字：
{
  "course_title": "课程标题",
  "course_description": "课程简介（1-2句话）",
  "chapters": [
    {
      "title": "章节标题",
      "lessons": [
        {
          "title": "课时标题",
          "content_md": "Markdown 正文内容...",
          "quiz": {
            "title": "测验标题",
            "questions": [
              {
                "question_text": "题目",
                "options": ["选项A", "选项B", "选项C", "选项D"],
                "correct_answer_index": 0,
                "explanation": "解析说明"
              }
            ]
          }
        }
      ]
    }
  ]
}"#;

pub fn check_duplicate_url(conn: &Connection, url: &str) -> Result<DuplicateCheckResult, String> {
    let result = conn.query_row(
        "SELECT id, title FROM courses WHERE source_url = ?1 AND source_url != ''",
        rusqlite::params![url],
        |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
    );

    match result {
        Ok((id, title)) => Ok(DuplicateCheckResult {
            exists: true,
            existing_course_id: Some(id),
            existing_course_title: Some(title),
        }),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(DuplicateCheckResult {
            exists: false,
            existing_course_id: None,
            existing_course_title: None,
        }),
        Err(e) => Err(format!("Duplicate check failed: {}", e)),
    }
}

fn validate_url(url: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(url).map_err(|e| format!("Invalid URL: {}", e))?;
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(format!("URL scheme '{}' is not allowed", scheme));
    }
    let host = parsed.host_str().unwrap_or("");
    if host.is_empty() {
        return Err("URL has no host".into());
    }
    if host == "localhost" || host == "127.0.0.1" || host == "::1" {
        return Err("Localhost URLs are not allowed".into());
    }
    if host.starts_with("10.")
        || host.starts_with("172.16.")
        || host.starts_with("172.17.")
        || host.starts_with("172.18.")
        || host.starts_with("172.19.")
        || host.starts_with("172.2")
        || host.starts_with("172.30.")
        || host.starts_with("172.31.")
        || host.starts_with("192.168.")
        || host == "169.254.169.254"
        || host == "0.0.0.0"
    {
        return Err("Private/internal IP addresses are not allowed".into());
    }
    Ok(())
}

pub async fn fetch_url_content(url: &str) -> Result<String, String> {
    validate_url(url)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (compatible; AI-Learning-Platform/1.0)")
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            let url = attempt.url();
            let host = url.host_str().unwrap_or("");
            if host == "localhost"
                || host == "127.0.0.1"
                || host == "::1"
                || host == "0.0.0.0"
                || host == "169.254.169.254"
                || host.starts_with("10.")
                || host.starts_with("192.168.")
                || host.starts_with("172.")
            {
                attempt.error("Redirect to private address blocked")
            } else if attempt.previous().len() >= 5 {
                attempt.error("Too many redirects")
            } else {
                attempt.follow()
            }
        }))
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

    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if content_type.contains("text/html") || content_type.contains("text/plain") {
        response
            .text()
            .await
            .map_err(|e| format!("Failed to read response body: {}", e))
    } else {
        Err(format!(
            "Unsupported content type: {}. Please use HTML pages or plain text.",
            content_type
        ))
    }
}

pub fn extract_text_from_html(html: &str) -> String {
    let document = scraper::Html::parse_document(html);
    let mut output = String::new();

    let selectors = [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "li",
        "pre",
        "code",
        "blockquote",
    ];

    for selector_str in &selectors {
        let sel = scraper::Selector::parse(selector_str).unwrap();
        for element in document.select(&sel) {
            let tag = element.value().name();

            // skip <code> that is a direct child of <pre> — <pre> already handles it
            if tag == "code" {
                let parent_is_pre = element.ancestors().any(|a| {
                    a.value()
                        .as_element()
                        .map(|e| e.name() == "pre")
                        .unwrap_or(false)
                });
                if parent_is_pre {
                    continue;
                }
            }

            let text = element
                .text()
                .collect::<Vec<_>>()
                .join(" ")
                .trim()
                .to_string();

            if text.is_empty() {
                continue;
            }

            match tag {
                "h1" => output.push_str(&format!("# {}\n\n", text)),
                "h2" => output.push_str(&format!("## {}\n\n", text)),
                "h3" => output.push_str(&format!("### {}\n\n", text)),
                "h4" | "h5" | "h6" => output.push_str(&format!("#### {}\n\n", text)),
                "p" => output.push_str(&format!("{}\n\n", text)),
                "li" => output.push_str(&format!("- {}\n", text)),
                "pre" | "code" => {
                    let inner = element.inner_html();
                    let cleaned = inner
                        .replace("<br>", "\n")
                        .replace("<br/>", "\n")
                        .replace("<br />", "\n");
                    if !cleaned.trim().is_empty() {
                        output.push_str(&format!("```\n{}\n```\n\n", cleaned.trim()));
                    }
                }
                "blockquote" => {
                    for line in text.lines() {
                        output.push_str(&format!("> {}\n", line));
                    }
                    output.push('\n');
                }
                _ => {}
            }
        }
    }

    let limit = 50_000usize;
    if output.chars().count() > limit {
        let truncated: String = output.chars().take(limit).collect();
        output = truncated;
        output.push_str("\n\n[Content truncated due to length limit]");
    }

    if output.trim().is_empty() {
        return html
            .replace("<p>", "\n")
            .replace("<br>", "\n")
            .replace("<br/>", "\n")
            .replace("<div>", "\n")
            .split('>')
            .map(|s| {
                if let Some(idx) = s.rfind('<') {
                    s[..idx].to_string()
                } else {
                    s.to_string()
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(limit)
            .collect();
    }

    output
}

pub async fn ai_structure_course(
    source_text: &str,
    source_url: &str,
    client: &LlmClient,
) -> Result<AiCourseOutput, String> {
    let user_message = COURSE_STRUCTURE_PROMPT
        .replace("{source_url}", source_url)
        .replace("{source_text}", source_text);

    let response_text = client
        .chat(
            "你是一位专业的课程编辑。你只回复 JSON，不包含 markdown 标记或其他文字。",
            &user_message,
            4000,
        )
        .await?;

    let cleaned = clean_json_response(&response_text);
    serde_json::from_str::<AiCourseOutput>(&cleaned).map_err(|e| {
        format!(
            "Failed to parse AI course structure: {}. Raw: {}",
            e,
            &cleaned.chars().take(300).collect::<String>()
        )
    })
}

pub async fn fetch_and_structure_course(
    url: &str,
    client: &LlmClient,
) -> Result<AiCourseOutput, String> {
    let html = fetch_url_content(url).await?;

    let text = if html.trim().starts_with("<!DOCTYPE")
        || html.trim().starts_with("<html")
        || html.trim().starts_with('<')
    {
        extract_text_from_html(&html)
    } else {
        html
    };

    if text.trim().len() < 100 {
        return Err("Extracted text is too short to build a course. The page may be mostly JavaScript or non-text content.".to_string());
    }

    ai_structure_course(&text, url, client).await
}

pub fn insert_course_to_db(
    conn: &Connection,
    ai_course: &AiCourseOutput,
    url: &str,
) -> Result<ImportCourseResult, String> {
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("BEGIN: {}", e))?;

    let result = (|| -> Result<ImportCourseResult, String> {
        let slug_base = slugify(&ai_course.course_title);
        let slug = ensure_unique_slug(&tx, &slug_base)?;

        let metadata = json!({
            "fetched_at": chrono::Utc::now().to_rfc3339(),
        });

        tx.execute(
            "INSERT INTO courses (title, slug, description, source_url, source_type, source_metadata) VALUES (?1, ?2, ?3, ?4, 'url_import', ?5)",
            rusqlite::params![
                ai_course.course_title,
                slug,
                ai_course.course_description,
                url,
                metadata.to_string(),
            ],
        )
        .map_err(|e| format!("Insert course: {}", e))?;

        let course_id = tx.last_insert_rowid();

        let mut chapters_count = 0i64;
        let mut lessons_count = 0i64;
        let mut quiz_count = 0i64;

        for (ch_idx, chapter) in ai_course.chapters.iter().enumerate() {
            tx.execute(
                "INSERT INTO chapters (course_id, title, order_index) VALUES (?1, ?2, ?3)",
                rusqlite::params![course_id, chapter.title, ch_idx as i64],
            )
            .map_err(|e| format!("Insert chapter: {}", e))?;

            let chapter_id = tx.last_insert_rowid();
            chapters_count += 1;

            for (l_idx, lesson) in chapter.lessons.iter().enumerate() {
                tx.execute(
                    "INSERT INTO lessons (chapter_id, title, content_md, order_index) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![chapter_id, lesson.title, lesson.content_md, l_idx as i64],
                )
                .map_err(|e| format!("Insert lesson: {}", e))?;

                let lesson_id = tx.last_insert_rowid();
                lessons_count += 1;

                if let Some(ref quiz) = lesson.quiz {
                    tx.execute(
                        "INSERT INTO quizzes (lesson_id, title) VALUES (?1, ?2)",
                        rusqlite::params![lesson_id, quiz.title],
                    )
                    .map_err(|e| format!("Insert quiz: {}", e))?;

                    let quiz_id = tx.last_insert_rowid();
                    quiz_count += 1;

                    for q in &quiz.questions {
                        let options_json =
                            serde_json::to_string(&q.options).unwrap_or_else(|_| "[]".to_string());
                        tx.execute(
                            "INSERT INTO quiz_questions (quiz_id, question_text, options, correct_answer_index, explanation) VALUES (?1, ?2, ?3, ?4, ?5)",
                            rusqlite::params![
                                quiz_id,
                                q.question_text,
                                options_json,
                                q.correct_answer_index,
                                q.explanation,
                            ],
                        )
                        .map_err(|e| format!("Insert question: {}", e))?;
                    }
                }
            }
        }

        Ok(ImportCourseResult {
            course_id,
            course_title: ai_course.course_title.clone(),
            course_slug: slug,
            chapters_count,
            lessons_count,
            quiz_count,
        })
    })();

    match result {
        Ok(r) => {
            tx.commit().map_err(|e| format!("COMMIT: {}", e))?;
            Ok(r)
        }
        Err(e) => Err(e),
    }
}

fn slugify(title: &str) -> String {
    title
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn ensure_unique_slug(conn: &Connection, base_slug: &str) -> Result<String, String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM courses WHERE slug = ?1 OR slug LIKE ?2",
            rusqlite::params![base_slug, format!("{}-%", base_slug)],
            |row| row.get(0),
        )
        .map_err(|e| format!("Slug check: {}", e))?;

    if count == 0 {
        return Ok(base_slug.to_string());
    }

    Ok(format!("{}-{}", base_slug, count + 1))
}

fn clean_json_response(text: &str) -> String {
    let t = text.trim();
    if let Some(inner) = t.strip_prefix("```json") {
        if let Some(end) = inner.rfind("```") {
            return inner[..end].trim().to_string();
        }
        return inner.trim().to_string();
    }
    if let Some(inner) = t.strip_prefix("```") {
        if let Some(end) = inner.rfind("```") {
            return inner[..end].trim().to_string();
        }
        return inner.trim().to_string();
    }
    t.to_string()
}
