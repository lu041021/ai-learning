use std::io::Cursor;

use crate::db::DbPool;
use serde_json::{json, Value};

fn to_json(v: &impl serde::Serialize) -> Result<String, String> {
    serde_json::to_string_pretty(v).map_err(|e| e.to_string())
}

fn arg_i64(args: &Value, key: &str, default: i64) -> i64 {
    args.get(key).and_then(|v| v.as_i64()).unwrap_or(default)
}

use tiny_http::{Header, Method, Response, Server};

use crate::config::{get_app_data_dir, load_config};
use crate::services::analytics;
use crate::services::knowledge_graph;
use crate::services::llm_client::{LlmClient, LlmProvider};
use crate::services::recommendation;
use crate::services::search;

type McpResponse = Response<Cursor<Vec<u8>>>;

fn json_response(data: Value) -> McpResponse {
    let body = data.to_string();
    Response::from_string(body)
        .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
}

fn with_cors(resp: McpResponse, origin: &str) -> McpResponse {
    resp.with_header(
        Header::from_bytes(&b"Access-Control-Allow-Origin"[..], origin.as_bytes()).unwrap(),
    )
}

fn unauthorized() -> McpResponse {
    json_response(
        json!({"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Unauthorized"}}),
    )
    .with_status_code(401)
}

fn read_body(request: &mut tiny_http::Request) -> Result<Value, McpResponse> {
    let mut body = String::new();
    if request.as_reader().read_to_string(&mut body).is_err() {
        return Err(json_response(
            json!({"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}),
        ));
    }
    serde_json::from_str(&body).map_err(|e| {
        json_response(json!({"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":format!("Parse error: {}", e)}}))
    })
}

fn check_auth(request: &tiny_http::Request, token: &str, allowed_origin: &str) -> Option<String> {
    let origin = request
        .headers()
        .iter()
        .find(|h| h.field.equiv("Origin"))
        .map(|h| h.value.as_str().to_owned())
        .unwrap_or_default();

    if !origin.is_empty() && origin != allowed_origin {
        return None;
    }

    let auth = request
        .headers()
        .iter()
        .find(|h| h.field.equiv("Authorization"))
        .map(|h| h.value.as_str().to_owned())
        .unwrap_or_default();

    let expected = format!("Bearer {}", token);
    if auth != expected {
        return None;
    }

    Some(origin)
}

fn handle_mcp_request(
    request: &mut tiny_http::Request,
    db: &DbPool,
    token: &str,
    allowed_origin: &str,
) -> McpResponse {
    if check_auth(request, token, allowed_origin).is_none() {
        return unauthorized();
    }

    let req_body = match read_body(request) {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    let method = req_body
        .get("method")
        .and_then(|m| m.as_str())
        .unwrap_or("");
    let id = req_body.get("id").cloned().unwrap_or(Value::Null);
    let params = req_body.get("params").cloned().unwrap_or(json!({}));

    match method {
        "initialize" => json_response(json!({
            "jsonrpc":"2.0","id":id,
            "result":{
                "protocolVersion":"2024-11-05",
                "capabilities":{"tools":{},"resources":{}},
                "serverInfo":{"name":"ai-learning-platform","version":"1.0.0"}
            }
        })),
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
                "description":"列出学习平台中的所有课程，返回课程 ID、标题、slug 和描述。",
                "inputSchema":{"type":"object","properties":{},"required":[]}
            },
            {
                "name":"get_course",
                "description":"根据 slug 获取课程详情，包括所有章节和课时。",
                "inputSchema":{
                    "type":"object",
                    "properties":{"slug":{"type":"string","description":"课程 slug（URL 友好标识）"}},
                    "required":["slug"]
                }
            },
            {
                "name":"get_lesson",
                "description":"根据课时 ID 获取完整课时内容，返回标题、Markdown 内容、章节 ID 和排序索引。",
                "inputSchema":{
                    "type":"object",
                    "properties":{"lesson_id":{"type":"integer","description":"课时 ID"}},
                    "required":["lesson_id"]
                }
            },
            {
                "name":"get_progress",
                "description":"获取用户学习进度：已完成课时 ID 和测验分数。",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"用户 ID（默认值 1）"}},
                    "required":[]
                }
            },
            {
                "name":"get_dashboard",
                "description":"获取完整仪表盘数据：总课时/已完成课时、测验统计、技能雷达、课程进度、日历热力图、知识树。",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"用户 ID（默认值 1）"}},
                    "required":[]
                }
            },
            {
                "name":"search_courses",
                "description":"按标题关键词搜索课程。",
                "inputSchema":{
                    "type":"object",
                    "properties":{"query":{"type":"string","description":"搜索关键词"}},
                    "required":["query"]
                }
            },
            {
                "name":"import_url",
                "description":"导入 URL 作为新课程。获取内容，使用 AI 将其组织为章节/课时/测验。需要在应用中配置 API 密钥。",
                "inputSchema":{
                    "type":"object",
                    "properties":{
                        "url":{"type":"string","description":"要导入的 URL"},
                        "api_key":{"type":"string","description":"API 密钥（可选，未提供时使用应用配置）"},
                        "model":{"type":"string","description":"使用的模型（可选，默认使用应用配置）"}
                    },
                    "required":["url"]
                }
            },
            {
                "name":"get_learning_path",
                "description":"获取用户个性化学习路线，包含推荐课程和里程碑。",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"用户 ID（默认值 1）"}},
                    "required":[]
                }
            },
            {
                "name":"semantic_search",
                "description":"跨课程、课时和测验题目进行全文搜索，返回带高亮片段的排序结果。",
                "inputSchema":{
                    "type":"object",
                    "properties":{
                        "query":{"type":"string","description":"搜索查询"},
                        "limit":{"type":"integer","description":"最大结果数（默认 20）"}
                    },
                    "required":["query"]
                }
            },
            {
                "name":"get_knowledge_graph",
                "description":"获取知识图谱，包含 AI 概念、概念关联和用户掌握情况叠加。",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"用户 ID（默认值 1）"}},
                    "required":[]
                }
            },
            {
                "name":"get_recommendations",
                "description":"基于用户兴趣、学习进度和学习画像获取个性化课程推荐。",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"用户 ID（默认值 1）"}},
                    "required":[]
                }
            },
            {
                "name":"get_analytics",
                "description":"获取高级学习分析：完成率、正确率趋势、学习连续天数、领域掌握度和薄弱环节。",
                "inputSchema":{
                    "type":"object",
                    "properties":{"user_id":{"type":"integer","description":"用户 ID（默认值 1）"}},
                    "required":[]
                }
            }
        ]}
    }))
}

fn handle_tools_call(id: Value, params: &Value, db: &DbPool) -> McpResponse {
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

fn handle_resources_list(id: Value, db: &DbPool) -> McpResponse {
    let conn = match db.get() {
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

    if let Ok(mut stmt) = conn.prepare("SELECT slug, title FROM courses ORDER BY id LIMIT 200") {
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

fn handle_resources_read(id: Value, params: &Value, db: &DbPool) -> McpResponse {
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

fn tool_list_courses(db: &DbPool) -> Result<String, String> {
    let conn = db.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, slug, description, source_type FROM courses ORDER BY id LIMIT 200",
        )
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
    to_json(&rows)
}

fn tool_get_course(db: &DbPool, args: &Value) -> Result<String, String> {
    let slug = args
        .get("slug")
        .and_then(|s| s.as_str())
        .ok_or("Missing 'slug' parameter")?;

    let conn = db.get().map_err(|e| e.to_string())?;

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
        .prepare(
            "SELECT id, title, order_index FROM chapters WHERE course_id = ?1 ORDER BY order_index",
        )
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
    to_json(&result)
}

fn tool_get_lesson(db: &DbPool, args: &Value) -> Result<String, String> {
    let lesson_id = args
        .get("lesson_id")
        .and_then(|v| v.as_i64())
        .ok_or("Missing 'lesson_id' parameter")?;

    let conn = db.get().map_err(|e| e.to_string())?;
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

    to_json(&lesson)
}

fn tool_get_progress(db: &DbPool, args: &Value) -> Result<String, String> {
    let user_id = arg_i64(args, "user_id", 1);

    let conn = db.get().map_err(|e| e.to_string())?;

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
    to_json(&result)
}

fn tool_get_dashboard(db: &DbPool, args: &Value) -> Result<String, String> {
    let user_id = arg_i64(args, "user_id", 1);

    let conn = db.get().map_err(|e| e.to_string())?;

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
            "SELECT c.id, c.title, c.slug,
                    COUNT(l.id) as total,
                    SUM(CASE WHEN up.completed = 1 THEN 1 ELSE 0 END) as done
             FROM courses c
             JOIN chapters ch ON ch.course_id = c.id
             JOIN lessons l ON l.chapter_id = ch.id
             LEFT JOIN user_progress up ON up.lesson_id = l.id AND up.user_id = ?1
             GROUP BY c.id",
        )
        .map_err(|e| e.to_string())?;
    let course_progress: Vec<Value> = course_stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|(cid, title, slug, total, completed)| {
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
    to_json(&result)
}

fn tool_search_courses(db: &DbPool, args: &Value) -> Result<String, String> {
    let query = args
        .get("query")
        .and_then(|q| q.as_str())
        .ok_or("Missing 'query' parameter")?;

    let conn = db.get().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let mut stmt = conn
        .prepare("SELECT id, title, slug, description FROM courses WHERE title LIKE ?1 ORDER BY id LIMIT 50")
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
    to_json(&rows)
}

fn tool_import_url(_db: &DbPool, args: &Value) -> Result<String, String> {
    let url = args
        .get("url")
        .and_then(|u| u.as_str())
        .ok_or("Missing 'url' parameter")?;

    // Import is async and requires API key — spawn a blocking task
    let url = url.to_string();
    let db = _db.clone();

    // Read config for API key
    let api_key = args
        .get("api_key")
        .and_then(|k| k.as_str())
        .map(|s| s.to_string());
    let model = args
        .get("model")
        .and_then(|m| m.as_str())
        .map(|s| s.to_string());

    // Try to use provided key, then fall back to config
    let (key, selected_model, provider_str) = match (api_key.clone(), model.clone()) {
        (Some(k), Some(m)) => (k, m, "anthropic".to_string()),
        (Some(k), None) => (
            k,
            "claude-sonnet-4-20250514".to_string(),
            "anthropic".to_string(),
        ),
        (None, _) => {
            let app_data_dir = get_app_data_dir()?;
            let cfg_path = crate::config::config_path(&app_data_dir);
            let config = load_config(&cfg_path);
            if config.api_key.is_empty() {
                return Err(
                    "No API key configured. Set it in app Settings or pass api_key parameter."
                        .to_string(),
                );
            }
            let m = model.unwrap_or(config.model);
            let p = config.api_provider.clone();
            (config.api_key, m, p)
        }
    };

    let client = LlmClient::new(LlmProvider::from_name(&provider_str), key, selected_model);

    // Run import synchronously (blocks the MCP thread, but import is infrequent)
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    let result = rt.block_on(async {
        crate::services::course_importer::fetch_and_structure_course(&url, &client).await
    })?;

    let conn = db.get().map_err(|e| e.to_string())?;
    let import_result =
        crate::services::course_importer::insert_course_to_db(&conn, &result, &url)?;
    drop(conn);

    to_json(&json!({
        "course_id": import_result.course_id,
        "course_title": import_result.course_title,
        "course_slug": import_result.course_slug,
        "chapters_count": import_result.chapters_count,
        "lessons_count": import_result.lessons_count,
        "quiz_count": import_result.quiz_count
    }))
}

fn tool_get_learning_path(db: &DbPool, args: &Value) -> Result<String, String> {
    let user_id = arg_i64(args, "user_id", 1);

    let conn = db.get().map_err(|e| e.to_string())?;
    let result: Option<(i64, String, String, String)> = conn
        .query_row(
            "SELECT id, steps_json, generated_at, updated_at
             FROM learning_path_history
             WHERE user_id = ?1 AND is_active = 1
             ORDER BY version DESC LIMIT 1",
            rusqlite::params![user_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get::<_, String>(2).unwrap_or_default(),
                    row.get::<_, String>(3).unwrap_or_default(),
                ))
            },
        )
        .ok();

    match result {
        Some((id, steps_json, generated_at, updated_at)) => {
            let steps: serde_json::Value =
                serde_json::from_str(&steps_json).unwrap_or(serde_json::Value::Array(vec![]));
            Ok(json!({
                "id": id,
                "user_id": user_id,
                "steps": steps,
                "generated_at": generated_at,
                "updated_at": updated_at
            })
            .to_string())
        }
        None => Ok(
            json!({"message":"No learning path generated yet. Use the app to generate one first."})
                .to_string(),
        ),
    }
}

fn tool_semantic_search(db: &DbPool, args: &Value) -> Result<String, String> {
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
    to_json(&json_results)
}

fn tool_get_knowledge_graph(db: &DbPool, args: &Value) -> Result<String, String> {
    let user_id = arg_i64(args, "user_id", 1);
    let data = knowledge_graph::build_knowledge_graph(db, user_id)?;
    to_json(&data)
}

fn tool_get_recommendations(db: &DbPool, args: &Value) -> Result<String, String> {
    let user_id = arg_i64(args, "user_id", 1);
    let data = recommendation::get_recommendations(db, user_id)?;
    to_json(&data)
}

fn tool_get_analytics(db: &DbPool, args: &Value) -> Result<String, String> {
    let user_id = arg_i64(args, "user_id", 1);
    let data = analytics::get_analytics(db, user_id)?;
    to_json(&data)
}

// ─── Public API ───

pub fn start_mcp_server(db: DbPool, port: u16, token: String) {
    let allowed_origin = "tauri://localhost".to_string();
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
            let db_clone = db.clone();
            let token_clone = token.clone();
            let origin_clone = allowed_origin.clone();

            std::thread::spawn(move || {
                if method == Method::Post && path == "/mcp" {
                    let response =
                        handle_mcp_request(&mut request, &db_clone, &token_clone, &origin_clone);
                    let _ = request.respond(with_cors(response, &origin_clone));
                } else if method == Method::Get && path == "/health" {
                    let _ = request.respond(Response::from_string("ok"));
                } else if method == Method::Options {
                    let resp = Response::from_string("")
                        .with_header(
                            Header::from_bytes(
                                &b"Access-Control-Allow-Origin"[..],
                                origin_clone.as_bytes(),
                            )
                            .unwrap(),
                        )
                        .with_header(
                            Header::from_bytes(
                                &b"Access-Control-Allow-Methods"[..],
                                &b"POST, GET, OPTIONS"[..],
                            )
                            .unwrap(),
                        )
                        .with_header(
                            Header::from_bytes(
                                &b"Access-Control-Allow-Headers"[..],
                                &b"Content-Type, Authorization"[..],
                            )
                            .unwrap(),
                        );
                    let _ = request.respond(resp);
                } else {
                    let _ =
                        request.respond(Response::from_string("Not Found").with_status_code(404));
                }
            });
        }
    });
}
