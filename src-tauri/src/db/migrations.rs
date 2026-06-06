use rusqlite::Connection;

const CURRENT_VERSION: i64 = 1;

pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    let version = get_schema_version(conn)?;

    if version < 1 {
        migrate_v0_to_v1(conn)?;
    }

    set_schema_version(conn, CURRENT_VERSION)?;
    Ok(())
}

fn get_schema_version(conn: &Connection) -> Result<i64, String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER NOT NULL DEFAULT 0
        );",
    )
    .map_err(|e| format!("Failed to create schema_version: {}", e))?;

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM schema_version", [], |r| r.get(0))
        .unwrap_or(0);

    if count == 0 {
        conn.execute("INSERT INTO schema_version (version) VALUES (0)", [])
            .map_err(|e| format!("Failed to init schema_version: {}", e))?;
        return Ok(0);
    }

    conn.query_row("SELECT MAX(version) FROM schema_version", [], |r| r.get(0))
        .map_err(|e| format!("Failed to read schema version: {}", e))
}

fn set_schema_version(conn: &Connection, version: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE schema_version SET version = ?1",
        rusqlite::params![version],
    )
    .map_err(|e| format!("Failed to update schema version: {}", e))?;
    Ok(())
}

fn migrate_v0_to_v1(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            source_url TEXT DEFAULT '',
            source_type TEXT DEFAULT 'seed',
            source_metadata TEXT DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS chapters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            order_index INTEGER NOT NULL,
            FOREIGN KEY (course_id) REFERENCES courses(id)
        );

        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chapter_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content_md TEXT DEFAULT '',
            order_index INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (chapter_id) REFERENCES chapters(id)
        );

        CREATE TABLE IF NOT EXISTS quizzes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id INTEGER NOT NULL,
            title TEXT DEFAULT '',
            FOREIGN KEY (lesson_id) REFERENCES lessons(id)
        );

        CREATE TABLE IF NOT EXISTS quiz_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            options TEXT NOT NULL,
            correct_answer_index INTEGER NOT NULL,
            explanation TEXT DEFAULT '',
            FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
        );

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            local_id TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS user_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            lesson_id INTEGER NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            completed_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (lesson_id) REFERENCES lessons(id)
        );

        CREATE TABLE IF NOT EXISTS quiz_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            quiz_id INTEGER NOT NULL,
            score REAL DEFAULT 0.0,
            answers TEXT DEFAULT '[]',
            feedback TEXT DEFAULT '',
            next_step_recommendation TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            lesson_id INTEGER,
            title TEXT DEFAULT 'New Chat',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );

        CREATE TABLE IF NOT EXISTS user_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            experience_level TEXT NOT NULL DEFAULT 'beginner',
            interests TEXT NOT NULL DEFAULT '[]',
            learning_goals TEXT NOT NULL DEFAULT '',
            assessment_completed INTEGER NOT NULL DEFAULT 0,
            assessment_responses TEXT NOT NULL DEFAULT '[]',
            summary TEXT NOT NULL DEFAULT '',
            profile_data TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS learning_paths (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            steps_json TEXT NOT NULL DEFAULT '[]',
            generated_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS learning_path_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            steps_json TEXT NOT NULL DEFAULT '[]',
            version INTEGER NOT NULL DEFAULT 1,
            is_active INTEGER NOT NULL DEFAULT 1,
            context_snapshot TEXT DEFAULT '{}',
            generated_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_active_path
            ON learning_path_history(user_id) WHERE is_active = 1;

        CREATE TABLE IF NOT EXISTS feed_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feed_url TEXT NOT NULL UNIQUE,
            feed_title TEXT DEFAULT '',
            last_fetched_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
            source_type, source_id, title, content, context_id, context_type,
            tokenize='porter unicode61'
        );

        CREATE TABLE IF NOT EXISTS concepts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            domain TEXT DEFAULT 'general',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS lesson_concepts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id INTEGER NOT NULL,
            concept_id INTEGER NOT NULL,
            relevance REAL DEFAULT 0.5,
            FOREIGN KEY (lesson_id) REFERENCES lessons(id),
            FOREIGN KEY (concept_id) REFERENCES concepts(id),
            UNIQUE(lesson_id, concept_id)
        );

        CREATE INDEX IF NOT EXISTS idx_user_progress_user_completed ON user_progress(user_id, completed);
        CREATE INDEX IF NOT EXISTS idx_user_progress_user_lesson ON user_progress(user_id, lesson_id);
        CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
        CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON quiz_attempts(user_id, quiz_id);
        CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
        CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_quizzes_lesson_id ON quizzes(lesson_id);
        CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
        CREATE INDEX IF NOT EXISTS idx_lessons_chapter_id ON lessons(chapter_id);
        CREATE INDEX IF NOT EXISTS idx_chapters_course_id ON chapters(course_id);
        CREATE INDEX IF NOT EXISTS idx_lesson_concepts_lesson_id ON lesson_concepts(lesson_id);
        CREATE INDEX IF NOT EXISTS idx_lesson_concepts_concept_id ON lesson_concepts(concept_id);
        ",
    )
    .map_err(|e| format!("Migration v0→v1 failed: {}", e))?;

    add_column_if_not_exists(conn, "courses", "source_url", "TEXT DEFAULT ''")?;
    add_column_if_not_exists(conn, "courses", "source_type", "TEXT DEFAULT 'seed'")?;
    add_column_if_not_exists(conn, "courses", "source_metadata", "TEXT DEFAULT '{}'")?;
    add_column_if_not_exists(
        conn,
        "quiz_attempts",
        "next_step_recommendation",
        "TEXT DEFAULT ''",
    )?;
    add_column_if_not_exists(conn, "user_profiles", "profile_data", "TEXT DEFAULT ''")?;

    setup_fts_triggers(conn)?;
    seed_concepts(conn)?;

    Ok(())
}

fn add_column_if_not_exists(
    conn: &Connection,
    table: &str,
    column: &str,
    col_def: &str,
) -> Result<(), String> {
    let sql = format!(
        "SELECT COUNT(*) FROM pragma_table_info('{}') WHERE name = '{}'",
        table, column
    );
    let exists: i64 = conn
        .query_row(&sql, [], |row| row.get(0))
        .map_err(|e| format!("Failed to check column {}: {}", column, e))?;
    if exists == 0 {
        conn.execute(
            &format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, col_def),
            [],
        )
        .map_err(|e| format!("Failed to add column {}: {}", column, e))?;
    }
    Ok(())
}

fn setup_fts_triggers(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TRIGGER IF NOT EXISTS search_courses_insert AFTER INSERT ON courses BEGIN
            INSERT INTO search_index(source_type, source_id, title, content, context_id, context_type)
            VALUES ('course', NEW.id, NEW.title, NEW.description, NEW.id, 'course');
        END;

        CREATE TRIGGER IF NOT EXISTS search_courses_update AFTER UPDATE ON courses BEGIN
            UPDATE search_index SET title=NEW.title, content=NEW.description
            WHERE source_type='course' AND source_id=NEW.id;
        END;

        CREATE TRIGGER IF NOT EXISTS search_courses_delete AFTER DELETE ON courses BEGIN
            DELETE FROM search_index WHERE source_type='course' AND source_id=OLD.id;
        END;

        CREATE TRIGGER IF NOT EXISTS search_lessons_insert AFTER INSERT ON lessons BEGIN
            INSERT INTO search_index(source_type, source_id, title, content, context_id, context_type)
            VALUES ('lesson', NEW.id, NEW.title, NEW.content_md,
                (SELECT course_id FROM chapters WHERE id=NEW.chapter_id), 'course');
        END;

        CREATE TRIGGER IF NOT EXISTS search_lessons_update AFTER UPDATE ON lessons BEGIN
            UPDATE search_index SET title=NEW.title, content=NEW.content_md,
                context_id=(SELECT course_id FROM chapters WHERE id=NEW.chapter_id)
            WHERE source_type='lesson' AND source_id=NEW.id;
        END;

        CREATE TRIGGER IF NOT EXISTS search_lessons_delete AFTER DELETE ON lessons BEGIN
            DELETE FROM search_index WHERE source_type='lesson' AND source_id=OLD.id;
        END;

        CREATE TRIGGER IF NOT EXISTS search_questions_insert AFTER INSERT ON quiz_questions BEGIN
            INSERT INTO search_index(source_type, source_id, title, content, context_id, context_type)
            VALUES ('quiz_question', NEW.id, NEW.question_text, NEW.explanation,
                (SELECT lesson_id FROM quizzes WHERE id=NEW.quiz_id), 'lesson');
        END;

        CREATE TRIGGER IF NOT EXISTS search_questions_update AFTER UPDATE ON quiz_questions BEGIN
            UPDATE search_index SET title=NEW.question_text, content=NEW.explanation,
                context_id=(SELECT lesson_id FROM quizzes WHERE id=NEW.quiz_id)
            WHERE source_type='quiz_question' AND source_id=NEW.id;
        END;

        CREATE TRIGGER IF NOT EXISTS search_questions_delete AFTER DELETE ON quiz_questions BEGIN
            DELETE FROM search_index WHERE source_type='quiz_question' AND source_id=OLD.id;
        END;",
    )
    .map_err(|e| format!("FTS triggers: {}", e))?;
    Ok(())
}

fn seed_concepts(conn: &Connection) -> Result<(), String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM concepts", [], |r| r.get(0))
        .unwrap_or(0);
    if count == 0 {
        let concepts = vec![
            "Artificial Intelligence",
            "Machine Learning",
            "Supervised Learning",
            "Unsupervised Learning",
            "Reinforcement Learning",
            "Neural Networks",
            "Deep Learning",
            "NLP",
            "Computer Vision",
            "AI Ethics",
            "Data Preprocessing",
            "Model Evaluation",
            "Feature Engineering",
            "Transfer Learning",
            "Generative AI",
        ];
        for name in &concepts {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO concepts (name, description, domain) VALUES (?1, '', 'general')",
                rusqlite::params![name],
            );
        }

        let mut l_stmt = conn
            .prepare("SELECT l.id, l.title, l.content_md FROM lessons l")
            .map_err(|e| e.to_string())?;
        let lessons: Vec<(i64, String, String)> = l_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        let mut c_stmt = conn
            .prepare("SELECT id, name FROM concepts")
            .map_err(|e| e.to_string())?;
        let concept_rows: Vec<(i64, String)> = c_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        for (lesson_id, lesson_title, lesson_content) in &lessons {
            let combined = format!(
                "{} {}",
                lesson_title.to_lowercase(),
                lesson_content.to_lowercase()
            );
            for (concept_id, concept_name) in &concept_rows {
                let lower_name = concept_name.to_lowercase();
                let terms: Vec<&str> = lower_name.split_whitespace().collect();
                let match_count = terms.iter().filter(|t| combined.contains(*t)).count();
                if match_count > 0 {
                    let relevance = (match_count as f64 / terms.len() as f64).min(1.0);
                    let _ = conn.execute(
                        "INSERT OR IGNORE INTO lesson_concepts (lesson_id, concept_id, relevance) VALUES (?1, ?2, ?3)",
                        rusqlite::params![lesson_id, concept_id, relevance],
                    );
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        conn
    }

    #[test]
    fn fresh_db_runs_v1() {
        let conn = setup();
        run_migrations(&conn).unwrap();
        let v: i64 = conn
            .query_row("SELECT version FROM schema_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, CURRENT_VERSION);
    }

    #[test]
    fn migration_is_idempotent() {
        let conn = setup();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        let v: i64 = conn
            .query_row("SELECT version FROM schema_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, CURRENT_VERSION);
    }

    #[test]
    fn all_tables_exist_after_migration() {
        let conn = setup();
        run_migrations(&conn).unwrap();
        let tables = [
            "courses",
            "users",
            "conversations",
            "learning_path_history",
            "search_index",
            "concepts",
        ];
        for t in &tables {
            let exists: bool = conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                    rusqlite::params![t],
                    |r| r.get(0),
                )
                .unwrap();
            assert!(exists, "table {} should exist", t);
        }
    }
}
