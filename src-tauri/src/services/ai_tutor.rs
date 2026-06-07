use rusqlite::Connection;

const SYSTEM_PROMPT_TEMPLATE: &str = r#"你是一位 AI 导师，正在帮助初学者学习人工智能和机器学习概念。

教学风格：
- 鼓励、耐心、支持——学生是 AI 新手
- 先用简单的术语解释概念，再逐步深入
- 用日常生活中的类比让抽象概念变得具体
- 当学生表现出困惑时，主动提出进一步拆解话题
- 提问以检查理解程度
- 如果学生要求，可以生成测验题目来测试他们的知识
- 用中文回复，但保留 AI 专业术语的英文原名（如 Machine Learning、Neural Network 等）

{user_profile}

课程上下文：
课程：{course_title}
{chapter_outline}

当前课时：{lesson_title}
课时内容：
{lesson_content}

学生进度：已完成 {completed_count}/{total_lessons} 课时。测验平均分：{quiz_avg}。

{completed_lessons_section}
{weak_areas_section}
{learning_path_section}
{selected_text_section}
{doc_context_section}
用中文回复学生。保持回答聚焦、清晰。"#;

pub fn build_system_prompt(
    conn: &Connection,
    user_id: i64,
    lesson_id: Option<i64>,
    selected_text: Option<&str>,
    message: Option<&str>,
) -> Result<String, String> {
    let mut course_title = "AI Basics".to_string();
    let mut chapter_outline = String::new();
    let mut lesson_title = "General".to_string();
    let mut lesson_content =
        "(No specific lesson selected — answer based on general AI knowledge)".to_string();

    if let Some(lid) = lesson_id {
        if let Ok(Some((ltitle, lcontent, chapter_id))) = query_lesson(conn, lid) {
            lesson_title = ltitle;
            lesson_content = truncate(&lcontent, 8000);

            if let Ok(Some((ctitle, course_id))) = query_course_by_chapter(conn, chapter_id) {
                course_title = ctitle;

                let mut ch_stmt = conn
                    .prepare(
                        "SELECT ch.title, l.title
                         FROM chapters ch
                         JOIN lessons l ON l.chapter_id = ch.id
                         WHERE ch.course_id = ?1
                         ORDER BY ch.order_index, l.order_index",
                    )
                    .map_err(|e| e.to_string())?;
                let ch_rows: Vec<(String, String)> = ch_stmt
                    .query_map(rusqlite::params![course_id], |row| {
                        Ok((row.get(0)?, row.get(1)?))
                    })
                    .map_err(|e| e.to_string())?
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(|e| e.to_string())?;

                let mut lines = Vec::new();
                let mut last_ch = String::new();
                for (ch_title, l_title) in &ch_rows {
                    if *ch_title != last_ch {
                        lines.push(format!("Chapter: {}", ch_title));
                        last_ch = ch_title.clone();
                    }
                    lines.push(format!("  - {}", l_title));
                }
                chapter_outline = lines.join("\n");
            }
        }
    } else {
        // No specific lesson: include ALL courses outline for cross-course awareness
        chapter_outline = build_all_courses_outline(conn).unwrap_or_default();
    }

    // Progress
    let completed_count = query_completed_count(conn, user_id).unwrap_or(0);
    let total_lessons = query_total_lessons(conn).unwrap_or(0);
    let quiz_avg = query_quiz_avg(conn, user_id).unwrap_or_else(|_| "N/A".to_string());

    // User profile
    let user_profile = query_user_profile_section(conn, user_id).unwrap_or_default();

    // Completed lessons
    let completed_lessons_section =
        query_completed_lessons_section(conn, user_id).unwrap_or_default();

    // Weak areas
    let weak_areas_section = query_weak_areas_section(conn, user_id).unwrap_or_default();

    // Learning path
    let learning_path_section = query_learning_path_section(conn, user_id).unwrap_or_default();

    let selected_text_section = if let Some(text) = selected_text {
        if text.trim().is_empty() {
            String::new()
        } else {
            format!(
                "THE STUDENT HAS SELECTED THIS TEXT AND IS ASKING ABOUT IT:\n---\n{}\n---\n",
                text
            )
        }
    } else {
        String::new()
    };

    let query = message.unwrap_or_default();
    let doc_context_section = if !query.trim().is_empty() {
        query_doc_context(conn, user_id, query).unwrap_or_default()
    } else {
        String::new()
    };

    Ok(SYSTEM_PROMPT_TEMPLATE
        .replace("{user_profile}", &user_profile)
        .replace("{course_title}", &course_title)
        .replace("{chapter_outline}", &chapter_outline)
        .replace("{lesson_title}", &lesson_title)
        .replace("{lesson_content}", &lesson_content)
        .replace("{completed_count}", &completed_count.to_string())
        .replace("{total_lessons}", &total_lessons.to_string())
        .replace("{quiz_avg}", &quiz_avg)
        .replace("{completed_lessons_section}", &completed_lessons_section)
        .replace("{weak_areas_section}", &weak_areas_section)
        .replace("{learning_path_section}", &learning_path_section)
        .replace("{selected_text_section}", &selected_text_section)
        .replace("{doc_context_section}", &doc_context_section))
}

fn truncate(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        s.to_string()
    } else {
        s.chars().take(max_chars).collect()
    }
}

fn query_lesson(
    conn: &Connection,
    lesson_id: i64,
) -> Result<Option<(String, String, i64)>, String> {
    let mut stmt = conn
        .prepare("SELECT title, content_md, chapter_id FROM lessons WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(rusqlite::params![lesson_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.next().and_then(|r| r.ok()))
}

fn query_course_by_chapter(
    conn: &Connection,
    chapter_id: i64,
) -> Result<Option<(String, i64)>, String> {
    let mut stmt = conn
        .prepare("SELECT c.title, c.id FROM courses c JOIN chapters ch ON ch.course_id = c.id WHERE ch.id = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(rusqlite::params![chapter_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| e.to_string())?;
    Ok(rows.next().and_then(|r| r.ok()))
}

fn query_completed_count(conn: &Connection, user_id: i64) -> Result<i64, String> {
    conn.query_row(
        "SELECT COUNT(*) FROM user_progress WHERE user_id = ?1 AND completed = 1",
        rusqlite::params![user_id],
        |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

fn query_total_lessons(conn: &Connection) -> Result<i64, String> {
    conn.query_row("SELECT COUNT(*) FROM lessons", [], |r| r.get(0))
        .map_err(|e| e.to_string())
}

pub fn query_quiz_avg(conn: &Connection, user_id: i64) -> Result<String, String> {
    let avg: Option<f64> = conn
        .query_row(
            "SELECT AVG(score) FROM quiz_attempts WHERE user_id = ?1",
            rusqlite::params![user_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    match avg {
        Some(v) => Ok(format!("{:.0}%", v * 100.0)),
        None => Ok("N/A".to_string()),
    }
}

fn query_user_profile_section(conn: &Connection, user_id: i64) -> Result<String, String> {
    let result = conn.query_row(
        "SELECT experience_level, interests, learning_goals FROM user_profiles WHERE user_id = ?1",
        rusqlite::params![user_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        },
    );
    match result {
        Ok((level, interests_json, goals)) => {
            let interests: Vec<String> = serde_json::from_str(&interests_json).unwrap_or_default();
            let interests_str = if interests.is_empty() {
                "未设置".to_string()
            } else {
                interests.join("、")
            };
            Ok(format!(
                "学生画像：\n- 经验水平：{}\n- 兴趣领域：{}\n- 学习目标：{}\n",
                level,
                interests_str,
                if goals.is_empty() {
                    "未设置"
                } else {
                    &goals
                }
            ))
        }
        Err(_) => Ok(String::new()),
    }
}

fn query_completed_lessons_section(conn: &Connection, user_id: i64) -> Result<String, String> {
    let mut stmt = conn
        .prepare(
            "SELECT l.title, c.title as course_title
             FROM user_progress up
             JOIN lessons l ON l.id = up.lesson_id
             JOIN chapters ch ON ch.id = l.chapter_id
             JOIN courses c ON c.id = ch.course_id
             WHERE up.user_id = ?1 AND up.completed = 1
             ORDER BY up.completed_at DESC
             LIMIT 10",
        )
        .map_err(|e| e.to_string())?;
    let items: Vec<(String, String)> = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if items.is_empty() {
        return Ok(String::new());
    }

    let lines: Vec<String> = items
        .iter()
        .map(|(lesson, course)| format!("  - {}（{}）", lesson, course))
        .collect();
    Ok(format!("已完成的课时：\n{}\n", lines.join("\n")))
}

fn query_weak_areas_section(conn: &Connection, user_id: i64) -> Result<String, String> {
    let mut stmt = conn
        .prepare(
            "SELECT l.title, MIN(qa.score) as min_score
             FROM quiz_attempts qa
             JOIN quizzes qz ON qz.id = qa.quiz_id
             JOIN lessons l ON l.id = qz.lesson_id
             WHERE qa.user_id = ?1 AND qa.score < 0.7
             GROUP BY l.id
             ORDER BY min_score ASC
             LIMIT 5",
        )
        .map_err(|e| e.to_string())?;
    let items: Vec<(String, f64)> = stmt
        .query_map(rusqlite::params![user_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if items.is_empty() {
        return Ok(String::new());
    }

    let lines: Vec<String> = items
        .iter()
        .map(|(title, score)| format!("  - {}（得分：{:.0}%）", title, score * 100.0))
        .collect();
    Ok(format!(
        "需要复习的内容（测验分数低于70%）：\n{}\n",
        lines.join("\n")
    ))
}

fn query_learning_path_section(conn: &Connection, user_id: i64) -> Result<String, String> {
    let result = conn.query_row(
        "SELECT steps_json FROM learning_path_history WHERE user_id = ?1 AND is_active = 1",
        rusqlite::params![user_id],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(steps_json) => {
            let steps: Vec<serde_json::Value> =
                serde_json::from_str(&steps_json).unwrap_or_default();
            if steps.is_empty() {
                return Ok(String::new());
            }
            let lines: Vec<String> = steps
                .iter()
                .enumerate()
                .map(|(i, step)| {
                    let title = step["title"].as_str().unwrap_or("");
                    let status = step["status"].as_str().unwrap_or("available");
                    let status_label = match status {
                        "completed" => "已完成",
                        "in_progress" => "进行中",
                        _ => "待解锁",
                    };
                    format!("  {}. [{}] {}", i + 1, status_label, title)
                })
                .collect();
            Ok(format!("当前学习路线：\n{}\n", lines.join("\n")))
        }
        Err(_) => Ok(String::new()),
    }
}

fn build_all_courses_outline(conn: &Connection) -> Result<String, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.title, ch.id, ch.title, l.title
             FROM courses c
             JOIN chapters ch ON ch.course_id = c.id
             JOIN lessons l ON l.chapter_id = ch.id
             ORDER BY c.id, ch.order_index, l.order_index",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<(i64, String, i64, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if rows.is_empty() {
        return Ok("(暂无课程)".to_string());
    }

    let mut lines = Vec::new();
    let mut last_course_id = -1i64;
    let mut last_chapter_id = -1i64;
    for (course_id, course_title, chapter_id, chapter_title, lesson_title) in &rows {
        if *course_id != last_course_id {
            lines.push(format!("课程：{}", course_title));
            last_course_id = *course_id;
            last_chapter_id = -1;
        }
        if *chapter_id != last_chapter_id {
            lines.push(format!("  Chapter: {}", chapter_title));
            last_chapter_id = *chapter_id;
        }
        lines.push(format!("    - {}", lesson_title));
    }
    Ok(lines.join("\n"))
}

fn query_doc_context(conn: &Connection, user_id: i64, query: &str) -> Result<String, String> {
    let fts_query = query
        .split_whitespace()
        .map(|w| {
            let cleaned: String = w
                .chars()
                .filter(|c| c.is_alphanumeric() || c.is_alphabetic())
                .collect();
            format!("\"{}\"", cleaned.replace('"', ""))
        })
        .filter(|w| w.len() > 2)
        .collect::<Vec<_>>()
        .join(" OR ");

    if fts_query.is_empty() {
        return Ok(String::new());
    }

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM doc_chunks WHERE user_id = ?1",
            rusqlite::params![user_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if count == 0 {
        return Ok(String::new());
    }

    let sql = "SELECT content FROM doc_chunks
         WHERE doc_chunks MATCH ?1
           AND user_id = ?2
         ORDER BY rank LIMIT 3";
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return Ok(String::new()),
    };
    let chunks: Vec<String> = stmt
        .query_map(rusqlite::params![fts_query, user_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if chunks.is_empty() {
        return Ok(String::new());
    }

    let joined = chunks
        .iter()
        .enumerate()
        .map(|(i, c)| format!("[{}] {}", i + 1, c))
        .collect::<Vec<_>>()
        .join("\n\n");

    Ok(format!(
        "以下是学生上传的参考文档中与当前问题相关的片段：\n---\n{}\n---\n",
        joined
    ))
}
