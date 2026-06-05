use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub source_type: String,
    pub source_id: i64,
    pub title: String,
    pub snippet: String,
    pub context_id: i64,
    pub context_type: String,
    pub context_slug: String,
    pub rank: f64,
}

pub fn search_all(
    db: &Arc<Mutex<Connection>>,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let conn = db.lock().map_err(|e| e.to_string())?;

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM search_index", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if count == 0 {
        drop(conn);
        seed_fts_index(db)?;
    } else {
        drop(conn);
    }

    let conn = db.lock().map_err(|e| e.to_string())?;
    let fts_query = query
        .split_whitespace()
        .map(|w| {
            let cleaned: String = w
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || c.is_alphabetic())
                .collect();
            format!("\"{}\"", cleaned.replace('\"', ""))
        })
        .filter(|w| w.len() > 2) // skip empty quoted strings
        .collect::<Vec<_>>()
        .join(" OR ");

    if fts_query.is_empty() {
        return Ok(Vec::new());
    }

    let sql = format!(
        "SELECT source_type, source_id, title, snippet(search_index, 2, '<mark>', '</mark>', '...', 32) as snippet,
                context_id, context_type, bm25(search_index, 0, 0, 0, 0, 0) as rank
         FROM search_index WHERE search_index MATCH ?1
         ORDER BY rank
         LIMIT {}",
        limit
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let mut rows: Vec<SearchResult> = stmt
        .query_map(rusqlite::params![fts_query], |row| {
            Ok(SearchResult {
                source_type: row.get(0)?,
                source_id: row.get(1)?,
                title: row.get(2)?,
                snippet: row.get(3)?,
                context_id: row.get(4)?,
                context_type: row.get(5)?,
                context_slug: String::new(),
                rank: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Resolve context_slug for each result
    for r in &mut rows {
        r.context_slug = match r.source_type.as_str() {
            "course" => {
                conn.query_row(
                    "SELECT slug FROM courses WHERE id = ?1",
                    rusqlite::params![r.source_id],
                    |row| row.get(0),
                )
                .unwrap_or_default()
            }
            "lesson" => {
                conn.query_row(
                    "SELECT c.slug FROM courses c JOIN chapters ch ON ch.course_id = c.id WHERE ch.id = (SELECT chapter_id FROM lessons WHERE id = ?1)",
                    rusqlite::params![r.source_id],
                    |row| row.get(0),
                )
                .unwrap_or_default()
            }
            "quiz_question" => {
                conn.query_row(
                    "SELECT c.slug FROM courses c JOIN chapters ch ON ch.course_id = c.id JOIN lessons l ON l.chapter_id = ch.id JOIN quizzes qz ON qz.lesson_id = l.id WHERE qz.id = (SELECT quiz_id FROM quiz_questions WHERE id = ?1)",
                    rusqlite::params![r.source_id],
                    |row| row.get(0),
                )
                .unwrap_or_default()
            }
            _ => String::new(),
        };
    }

    Ok(rows)
}

fn seed_fts_index(db: &Arc<Mutex<Connection>>) -> Result<(), String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    conn.execute_batch(
        "INSERT INTO search_index(source_type, source_id, title, content, context_id, context_type)
         SELECT 'course', id, title, description, id, 'course' FROM courses;
         INSERT INTO search_index(source_type, source_id, title, content, context_id, context_type)
         SELECT 'lesson', l.id, l.title, l.content_md, ch.course_id, 'course'
         FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id;
         INSERT INTO search_index(source_type, source_id, title, content, context_id, context_type)
         SELECT 'quiz_question', qq.id, qq.question_text, qq.explanation, qz.lesson_id, 'lesson'
         FROM quiz_questions qq JOIN quizzes qz ON qz.id = qq.quiz_id;",
    )
    .map_err(|e| format!("seed FTS index: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::sync::{Arc, Mutex};

    fn setup_db() -> Arc<Mutex<Connection>> {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT, slug TEXT UNIQUE, description TEXT DEFAULT '');
             CREATE TABLE chapters (id INTEGER PRIMARY KEY, course_id INTEGER, title TEXT, order_index INTEGER);
             CREATE TABLE lessons (id INTEGER PRIMARY KEY, chapter_id INTEGER, title TEXT, content_md TEXT DEFAULT '', order_index INTEGER);
             CREATE TABLE quizzes (id INTEGER PRIMARY KEY, lesson_id INTEGER, title TEXT DEFAULT '');
             CREATE TABLE quiz_questions (id INTEGER PRIMARY KEY, quiz_id INTEGER, question_text TEXT, options TEXT DEFAULT '[]', correct_answer_index INTEGER, explanation TEXT DEFAULT '');

             CREATE VIRTUAL TABLE search_index USING fts5(source_type, source_id, title, content, context_id, context_type);",
        ).unwrap();

        conn.execute_batch(
            "INSERT INTO courses VALUES (1, 'Machine Learning', 'machine-learning', 'An introduction to ML');
             INSERT INTO chapters VALUES (1, 1, 'Basics', 1);
             INSERT INTO lessons VALUES (1, 1, 'What is ML', 'Machine Learning is a subset of AI', 1);
             INSERT INTO quizzes VALUES (1, 1, 'ML Quiz');
             INSERT INTO quiz_questions VALUES (1, 1, 'What does ML stand for?', '[]', 0, 'Machine Learning');

             INSERT INTO search_index(source_type, source_id, title, content, context_id, context_type)
             SELECT 'course', id, title, description, id, 'course' FROM courses;
             INSERT INTO search_index(source_type, source_id, title, content, context_id, context_type)
             SELECT 'lesson', l.id, l.title, l.content_md, ch.course_id, 'course'
             FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id;
             INSERT INTO search_index(source_type, source_id, title, content, context_id, context_type)
             SELECT 'quiz_question', qq.id, qq.question_text, qq.explanation, qz.lesson_id, 'lesson'
             FROM quiz_questions qq JOIN quizzes qz ON qz.id = qq.quiz_id;",
        ).unwrap();

        Arc::new(Mutex::new(conn))
    }

    #[test]
    fn test_search_returns_results() {
        let db = setup_db();
        let results = search_all(&db, "Machine Learning", 10).unwrap();
        assert!(!results.is_empty());
        assert!(results.iter().any(|r| r.source_type == "course"));
    }

    #[test]
    fn test_search_no_match() {
        let db = setup_db();
        let results = search_all(&db, "nonexistentkeyword", 10).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_respects_limit() {
        let db = setup_db();
        let results = search_all(&db, "ML OR Learning OR Machine", 1).unwrap();
        assert!(results.len() <= 1);
    }

    #[test]
    fn test_search_empty_query() {
        let db = setup_db();
        let results = search_all(&db, "", 10).unwrap();
        assert!(results.is_empty());
    }
}
