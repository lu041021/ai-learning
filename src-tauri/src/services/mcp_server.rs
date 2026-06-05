use std::io::Cursor;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use serde_json::{json, Value};
use tiny_http::{Header, Method, Response, Server};

use crate::config::{get_app_data_dir, load_config};
use crate::services::llm_client::{LlmClient, LlmProvider};
use crate::services::search;
use crate::services::knowledge_graph;
use crate::services::recommendation;
use crate::services::analytics;

type McpResponse = Response<Cursor<Vec<u8>>>;

fn json_response(data: Value) -> McpResponse {
    let body = data.to_string();
    Response::from_string(body)
        .with_header(
            Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap(),
        )
        .with_header(
            Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"http://127.0.0.1:1420"[..]).unwrap(),
        )
}

fn read_body(request: &mut tiny_http::Request) -> Result<Value, McpResponse> {
    let mut body = String::new();
    if request.as_reader().read_to_string(&mut body).is_err() {
        return Err(json_response(json!({
            "jsonrpc":"2.0","id":null,
            "error":{"code":-32700,"message":"Parse error"}
        })));
    }
    serde_json::from_str(&body).map_err(|e| {
        json_response(json!({
            "jsonrpc":"2.0","id":null,
            "error":{"code":-32700,"message":format!("Parse error: {}", e)}
        }))
    })
}

fn handle_mcp_request(
    request: &mut tiny_http::Request,
    db: &Arc<Mutex<Connection>>,
) -> McpResponse {
    let req_body = match read_body(request) {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    let method = req_body.get("method").and_then(|m| m.as_str()).unwrap_or("");
    let id = req_body.get("id").cloned().unwrap_or(Value::Null);
    let params = req_body.get("params").cloned().unwrap_or(json!({}));

    match method {
        "initialize" => {
            json_response(json!({
                "jsonrpc":"2.0","id":id,
                "result":{
                    "protocolVersion":"2024-11-05",
                    "capabilities":{"tools":{},"resources":{}},
                    "serverInfo":{"name":"ai-learning-platform","version":"1.0.0"}
                }
            }))
        }
        "notifications/initialized" => json_response(json!({"jsonrpc":"2.0","id":id,"result":{}})),
        "tools/list" => handle_tools_list(id),
        "tools/call" => handle_tools_call(id, &params, db),
        "resources/list" => handle_resources_list(id, db),
        "resources/read" => handle_resources_read(id, &params, db),
        "ping" => json_response(json!({"jsonrpc":"2.0","id":id,"result":{}})),
        _ => json_response(json!({
            "jsonrpc":"2.0","id":id,
            "error":{"code":-32601,"message":format!("Method not found: {}", method)}
        })),
    }
}

fn handle_tools_list(id: Value) -> McpResponse {
    json_response(json!({
        "jsonrpc":"2.0","id":id,
        "result":{"tools":[
            {
                "name":"list_courses",
                "description":"List all courses in the learning platform. Returns course id, title, slug, and description.",
                "inputSchema":{"type":"object","properties":{},"required":[]}
            },
            {
                "name":"get_course",
                "description":"Get course detail by slug, including all chapters and lessons.",
                "inputSchema":{
                    "type":"object",
                    "properties":{"slug":{"type":"string","description":"Course slug (URL-friendly identifier)"}},
                    "required":["slug"]
                }
            },
            {
                "name":"get_lesson",
                "description":"Get full lesson content by lesson ID. Returns title, markdown content, chapter_id, and order_index.",
                "inputSchema":{
                    "type":"object",
                    "properties":{"lesson_id":{"type":"integer","description":"Lesson ID"}},
                    "required":["lesson_id"]
                }
            },
            {
                "name":"get_progress",
                "description":"Get user learning progress: completed lesson IDs and quiz scores.",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"User ID (defaults to 1)"}},
                    "required":[]
                }
            },
            {
                "name":"get_dashboard",
                "description":"Get full dashboard data: total/completed lessons, quiz stats, skill radar, course progress, calendar heatmap, knowledge tree.",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"User ID (defaults to 1)"}},
                    "required":[]
                }
            },
            {
                "name":"search_courses",
                "description":"Search courses by title keyword.",
                "inputSchema":{
                    "type":"object",
                    "properties":{"query":{"type":"string","description":"Search keyword"}},
                    "required":["query"]
                }
            },
            {
                "name":"import_url",
                "description":"Import a URL as a new course. Fetches content, uses AI to structure it into chapters/lessons/quizzes. Requires Anthropic API key configured in the app.",
                "inputSchema":{
                    "type":"object",
                    "properties":{
                        "url":{"type":"string","description":"URL to import"},
                        "api_key":{"type":"string","description":"Anthropic API key (optional, uses app config if not provided)"},
                        "model":{"type":"string","description":"Model to use (optional, defaults to app config)"}
                    },
                    "required":["url"]
                }
            },
            {
                "name":"get_learning_path",
                "description":"Get the user's personalized learning path with recommended courses and milestones.",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"User ID (defaults to 1)"}},
                    "required":[]
                }
            },
            {
                "name":"semantic_search",
                "description":"Full-text search across courses, lessons, and quiz questions. Returns ranked results with highlighted snippets.",
                "inputSchema":{
                    "type":"object",
                    "properties":{
                        "query":{"type":"string","description":"Search query"},
                        "limit":{"type":"integer","description":"Max results (default: 20)"}
                    },
                    "required":["query"]
                }
            },
            {
                "name":"get_knowledge_graph",
                "description":"Get the knowledge graph with AI concepts, their relationships, and user mastery overlay.",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"User ID (defaults to 1)"}},
                    "required":[]
                }
            },
            {
                "name":"get_recommendations",
                "description":"Get personalized course recommendations based on user interests, progress, and learning profile.",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"User ID (defaults to 1)"}},
                    "required":[]
                }
            },
            {
                "name":"get_analytics",
                "description":"Get advanced learning analytics: completion rate, accuracy trends, study streaks, domain mastery, and weak areas.",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"User ID (defaults to 1)"}},
                    "required":[]
                }
            }
        ]}
    }))
}

fn handle_tools_call(id: Value, params: &Value, db: &Arc<Mutex<Connection>>) -> McpResponse {
    let name = params.get("name").and_then(|n| n.as_str()).unwrap_or("");
    let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

    let result = match name {
        "list_courses" => tool_list_courses(db),
        "get_course" => tool_get_course(db, &arguments),
        "get_lesson" => tool_get_lesson(db, &arguments),
        "get_progress" => tool_get_progress(db, &arguments),
        "get_dashboard" => tool_get_dashboard(db, &arguments),
        "search_courses" => tool_search_courses(db, &arguments),
        "import_url" => tool_import_url(db, &arguments),
        "get_learning_path" => tool_get_learning_path(db, &arguments),
        "semantic_search" => tool_semantic_search(db, &arguments),
        "get_knowledge_graph" => tool_get_knowledge_graph(db, &arguments),
        "get_recommendations" => tool_get_recommendations(db, &arguments),
        "get_analytics" => tool_get_analytics(db, &arguments),
        _ => Err(format!("Unknown tool: {}", name)),
    };

    match result {
        Ok(content) => json_response(json!({
            "jsonrpc":"2.0","id":id,
            "result":{"content":[{"type":"text","text":content}]}
        })),
        Err(e) => json_response(json!({
            "jsonrpc":"2.0","id":id,
            "result":{"content":[{"type":"text","text":format!("Error: {}", e)}],"isError":true}
        })),
    }
}

fn handle_resources_list(id: Value, db: &Arc<Mutex<Connection>>) -> McpResponse {
    let conn = match db.lock() {
        Ok(c) => c,
        Err(e) => {
            return json_response(json!({
                "jsonrpc":"2.0","id":id,
                "error":{"code":-32603,"message":format!("DB lock error: {}", e)}
            }))
        }
    };

    let mut resources = vec![json!({
        "uri":"courses://list","name":"All Courses",
        "description":"List of all courses in the learning platform","mimeType":"application/json"
    })];

    if let Ok(mut stmt) = conn.prepare("SELECT slug, title FROM courses ORDER BY id") {
        if let Ok(rows) = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }) {
            for row in rows.flatten() {
                resources.push(json!({
                    "uri":format!("courses://{}", row.0),
                    "name":row.1,
                    "description":format!("Course: {}", row.1),
                    "mimeType":"application/json"
                }));
            }
        }
    }

    if let Ok(mut stmt) = conn.prepare("SELECT id FROM users LIMIT 5") {
        if let Ok(rows) = stmt.query_map([], |row| row.get::<_, i64>(0)) {
            for row in rows.flatten() {
                resources.push(json!({
                    "uri":format!("progress://{}", row),
                    "name":format!("User {} Progress", row),
                    "mimeType":"application/json"
                }));
            }
        }
    }

    json_response(json!({"jsonrpc":"2.0","id":id,"result":{"resources":resources}}))
}

fn handle_resources_read(
    id: Value,
    params: &Value,
    db: &Arc<Mutex<Connection>>,
) -> McpResponse {
    let uri = params.get("uri").and_then(|u| u.as_str()).unwrap_or("");

    let result = if uri == "courses://list" {
        tool_list_courses(db)
    } else if let Some(slug) = uri.strip_prefix("courses://") {
        tool_get_course(db, &json!({"slug": slug}))
    } else if let Some(user_str) = uri.strip_prefix("progress://") {
        if let Ok(uid) = user_str.parse::<i64>() {
            tool_get_progress(db, &json!({"user_id": uid}))
        } else {
            Err("Invalid user ID".to_string())
        }
    } else {
        Err(format!("Unknown resource: {}", uri))
    };

    match result {
        Ok(text) => json_response(json!({
            "jsonrpc":"2.0","id":id,
            "result":{"contents":[{"uri":uri,"mimeType":"application/json","text":text}]}
        })),
        Err(e) => json_response(json!({
            "jsonrpc":"2.0","id":id,
            "error":{"code":-32603,"message":e}
        })),
    }
}

// ─── Tool Implementations ───

fn tool_list_courses(db: &Arc<Mutex<Connection>>) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, slug, description, source_type FROM courses ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows: Vec<Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "title": row.get::<_, String>(1)?,
                "slug": row.get::<_, String>(2)?,
                "description": row.get::<_, String>(3)?,
                "source_type": row.get::<_, String>(4).unwrap_or_default()
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&rows).map_err(|e| e.to_string())
}

fn tool_get_course(db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let slug = args
        .get("slug")
        .and_then(|s| s.as_str())
        .ok_or("Missing 'slug' parameter")?;

    let conn = db.lock().map_err(|e| e.to_string())?;

    let course = conn
        .query_row(
            "SELECT id, title, slug, description FROM courses WHERE slug = ?1",
            rusqlite::params![slug],
            |row| {
                Ok(json!({
                    "id": row.get::<_, i64>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "slug": row.get::<_, String>(2)?,
                    "description": row.get::<_, String>(3)?
                }))
            },
        )
        .map_err(|e| format!("Course not found: {}", e))?;

    let mut ch_stmt = conn
        .prepare("SELECT id, title, order_index FROM chapters WHERE course_id = ?1 ORDER BY order_index")
        .map_err(|e| e.to_string())?;
    let course_id = course.get("id").and_then(|v| v.as_i64()).unwrap_or(0);

    let mut chapters = Vec::new();
    let ch_rows: Vec<(i64, String, i64)> = ch_stmt
        .query_map(rusqlite::params![course_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for (ch_id, ch_title, ch_order) in &ch_rows {
        let mut l_stmt = conn
            .prepare("SELECT id, title, order_index FROM lessons WHERE chapter_id = ?1 ORDER BY order_index")
            .map_err(|e| e.to_string())?;
        let lessons: Vec<Value> = l_stmt
            .query_map(rusqlite::params![ch_id], |row| {
                Ok(json!({
                    "id": row.get::<_, i64>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "order_index": row.get::<_, i64>(2)?
                }))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        chapters.push(json!({
            "id": ch_id,
            "title": ch_title,
            "order_index": ch_order,
            "lessons": lessons
        }));
    }

    let result = json!({
        "course": course,
        "chapters": chapters
    });
    serde_json::to_string_pretty(&result).map_err(|e| e.to_string())
}

fn tool_get_lesson(db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let lesson_id = args
        .get("lesson_id")
        .and_then(|v| v.as_i64())
        .ok_or("Missing 'lesson_id' parameter")?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let lesson = conn
        .query_row(
            "SELECT l.id, l.title, l.content_md, l.order_index, l.chapter_id, ch.title as chapter_title, c.title as course_title, c.slug as course_slug
             FROM lessons l
             JOIN chapters ch ON ch.id = l.chapter_id
             JOIN courses c ON c.id = ch.course_id
             WHERE l.id = ?1",
            rusqlite::params![lesson_id],
            |row| {
                Ok(json!({
                    "id": row.get::<_, i64>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "content_md": row.get::<_, String>(2)?,
                    "order_index": row.get::<_, i64>(3)?,
                    "chapter_id": row.get::<_, i64>(4)?,
                    "chapter_title": row.get::<_, String>(5)?,
                    "course_title": row.get::<_, String>(6)?,
                    "course_slug": row.get::<_, String>(7)?
                }))
            },
        )
        .map_err(|e| format!("Lesson not found: {}", e))?;

    serde_json::to_string_pretty(&lesson).map_err(|e| e.to_string())
}

fn tool_get_progress(db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let user_id = args.get("user_id").and_then(|v| v.as_i64()).unwrap_or(1);

    let conn = db.lock().map_err(|e| e.to_string())?;

    let mut p_stmt = conn
        .prepare("SELECT lesson_id FROM user_progress WHERE user_id = ?1 AND completed = 1")
        .map_err(|e| e.to_string())?;
    let completed_lesson_ids: Vec<i64> = p_stmt
        .query_map(rusqlite::params![user_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut q_stmt = conn
        .prepare("SELECT quiz_id, score FROM quiz_attempts WHERE user_id = ?1")
        .map_err(|e| e.to_string())?;
    let quiz_scores: Vec<Value> = q_stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok(json!({
                "quiz_id": row.get::<_, i64>(0)?,
                "score": row.get::<_, f64>(1)?
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let result = json!({
        "user_id": user_id,
        "completed_lesson_ids": completed_lesson_ids,
        "completed_count": completed_lesson_ids.len(),
        "quiz_scores": quiz_scores
    });
    serde_json::to_string_pretty(&result).map_err(|e| e.to_string())
}

fn tool_get_dashboard(db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let user_id = args.get("user_id").and_then(|v| v.as_i64()).unwrap_or(1);

    let conn = db.lock().map_err(|e| e.to_string())?;

    let (total_lessons, completed_lessons) = {
        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM lessons", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        let completed: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM user_progress WHERE user_id = ?1 AND completed = 1",
                rusqlite::params![user_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        (total, completed)
    };

    let (total_quizzes, avg_score) = {
        let row: (i64, Option<f64>) = conn
            .query_row(
                "SELECT COUNT(*), AVG(score) FROM quiz_attempts WHERE user_id = ?1",
                rusqlite::params![user_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;
        (row.0, row.1.unwrap_or(0.0))
    };

    let mut course_stmt = conn
        .prepare(
            "SELECT c.id, c.title, c.slug, COUNT(l.id) as total
             FROM courses c
             JOIN chapters ch ON ch.course_id = c.id
             JOIN lessons l ON l.chapter_id = ch.id
             GROUP BY c.id",
        )
        .map_err(|e| e.to_string())?;
    let course_progress: Vec<Value> = course_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|(cid, title, slug, total)| {
            let completed: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM user_progress up
                     JOIN lessons l ON l.id = up.lesson_id
                     JOIN chapters ch ON ch.id = l.chapter_id
                     WHERE ch.course_id = ?1 AND up.user_id = ?2 AND up.completed = 1",
                    rusqlite::params![cid, user_id],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            json!({
                "course_id": cid, "title": title, "slug": slug,
                "total_lessons": total, "completed_lessons": completed
            })
        })
        .collect();

    let result = json!({
        "user_id": user_id,
        "total_lessons": total_lessons,
        "completed_lessons": completed_lessons,
        "completion_percent": if total_lessons > 0 {
            format!("{:.1}%", completed_lessons as f64 / total_lessons as f64 * 100.0)
        } else { "0%".to_string() },
        "total_quizzes": total_quizzes,
        "avg_quiz_score": format!("{:.1}%", avg_score * 100.0),
        "course_progress": course_progress
    });
    serde_json::to_string_pretty(&result).map_err(|e| e.to_string())
}

fn tool_search_courses(db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let query = args
        .get("query")
        .and_then(|q| q.as_str())
        .ok_or("Missing 'query' parameter")?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare("SELECT id, title, slug, description FROM courses WHERE title LIKE ?1 ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows: Vec<Value> = stmt
        .query_map(rusqlite::params![pattern], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "title": row.get::<_, String>(1)?,
                "slug": row.get::<_, String>(2)?,
                "description": row.get::<_, String>(3)?
            }))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&rows).map_err(|e| e.to_string())
}

fn tool_import_url(_db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let url = args
        .get("url")
        .and_then(|u| u.as_str())
        .ok_or("Missing 'url' parameter")?;

    // Import is async and requires API key — spawn a blocking task
    let url = url.to_string();
    let db = Arc::clone(_db);

    // Read config for API key
    let api_key = args.get("api_key").and_then(|k| k.as_str()).map(|s| s.to_string());
    let model = args.get("model").and_then(|m| m.as_str()).map(|s| s.to_string());

    // Try to use provided key, then fall back to config
    let (key, selected_model, provider_str) = match (api_key.clone(), model.clone()) {
        (Some(k), Some(m)) => (k, m, "anthropic".to_string()),
        (Some(k), None) => (k, "claude-sonnet-4-20250514".to_string(), "anthropic".to_string()),
        (None, _) => {
            let app_data_dir = get_app_data_dir()?;
            let cfg_path = crate::config::config_path(&app_data_dir);
            let config = load_config(&cfg_path);
            if config.api_key.is_empty() {
                return Err("No API key configured. Set it in app Settings or pass api_key parameter.".to_string());
            }
            let m = model.unwrap_or(config.model);
            let p = config.api_provider.clone();
            (config.api_key, m, p)
        }
    };

    let client = LlmClient::new(LlmProvider::from_str(&provider_str), key, selected_model);

    // Run import synchronously (blocks the MCP thread, but import is infrequent)
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    let result = rt.block_on(async {
        crate::services::course_importer::fetch_and_structure_course(&url, &client).await
    })?;

    let conn = db.lock().map_err(|e| e.to_string())?;
    let import_result = crate::services::course_importer::insert_course_to_db(&conn, &result, &url)?;
    drop(conn);

    serde_json::to_string_pretty(&json!({
        "course_id": import_result.course_id,
        "course_title": import_result.course_title,
        "course_slug": import_result.course_slug,
        "chapters_count": import_result.chapters_count,
        "lessons_count": import_result.lessons_count,
        "quiz_count": import_result.quiz_count
    })).map_err(|e| e.to_string())
}

fn tool_get_learning_path(db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let user_id = args.get("user_id").and_then(|v| v.as_i64()).unwrap_or(1);

    let conn = db.lock().map_err(|e| e.to_string())?;
    let path: Option<String> = conn
        .query_row(
            "SELECT path_data FROM learning_paths WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1",
            rusqlite::params![user_id],
            |row| row.get(0),
        )
        .ok();

    match path {
        Some(data) => Ok(data),
        None => Ok(json!({"message":"No learning path generated yet. Use the app to generate one first."}).to_string()),
    }
}

fn tool_semantic_search(db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let query = args
        .get("query")
        .and_then(|q| q.as_str())
        .ok_or("Missing 'query' parameter")?;
    let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(20) as usize;

    let results = search::search_all(db, query, limit)?;
    let json_results: Vec<Value> = results
        .iter()
        .map(|r| {
            json!({
                "source_type": r.source_type,
                "source_id": r.source_id,
                "title": r.title,
                "snippet": r.snippet,
                "context_id": r.context_id,
                "context_type": r.context_type,
                "rank": r.rank
            })
        })
        .collect();
    serde_json::to_string_pretty(&json_results).map_err(|e| e.to_string())
}

fn tool_get_knowledge_graph(db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let user_id = args.get("user_id").and_then(|v| v.as_i64()).unwrap_or(1);
    let data = knowledge_graph::build_knowledge_graph(db, user_id)?;
    serde_json::to_string_pretty(&data).map_err(|e| e.to_string())
}

fn tool_get_recommendations(db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let user_id = args.get("user_id").and_then(|v| v.as_i64()).unwrap_or(1);
    let data = recommendation::get_recommendations(db, user_id)?;
    serde_json::to_string_pretty(&data).map_err(|e| e.to_string())
}

fn tool_get_analytics(db: &Arc<Mutex<Connection>>, args: &Value) -> Result<String, String> {
    let user_id = args.get("user_id").and_then(|v| v.as_i64()).unwrap_or(1);
    let data = analytics::get_analytics(db, user_id)?;
    serde_json::to_string_pretty(&data).map_err(|e| e.to_string())
}

// ─── Public API ───

pub fn start_mcp_server(db: Arc<Mutex<Connection>>, port: u16) {
    std::thread::spawn(move || {
        let addr = format!("127.0.0.1:{}", port);
        let server = match Server::http(&addr) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[MCP] Failed to start server on {}: {}", addr, e);
                return;
            }
        };
        println!("[MCP] Server listening on http://{}", addr);

        for mut request in server.incoming_requests() {
            let path = request.url().to_string();
            let method = request.method().clone();

            if method == Method::Post && path == "/mcp" {
                let response = handle_mcp_request(&mut request, &db);
                let _ = request.respond(response);
            } else if method == Method::Get && path == "/health" {
                let _ = request.respond(Response::from_string("ok"));
            } else if method == Method::Options {
                // CORS preflight — allow local origins only
                let resp = Response::from_string("")
                    .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"http://127.0.0.1:1420"[..]).unwrap())
                    .with_header(Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"POST, GET, OPTIONS"[..]).unwrap())
                    .with_header(Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type"[..]).unwrap());
                let _ = request.respond(resp);
            } else {
                let _ = request.respond(Response::from_string("Not Found").with_status_code(404));
            }
        }
    });
}
