use ai_learning_platform_lib::db;
use rusqlite::Connection;

pub fn setup_in_memory_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .unwrap();
    db::migrations::run_migrations(&conn).unwrap();
    conn
}

#[allow(dead_code)]
pub fn seed_test_data(conn: &Connection) {
    conn.execute(
        "INSERT INTO courses (id, title, slug, description) VALUES (1, 'Test Course', 'test-course', 'A test')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO chapters (id, course_id, title, order_index) VALUES (1, 1, 'Ch1', 1)",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO lessons (id, chapter_id, title, content_md, order_index) VALUES (1, 1, 'L1', '# Hello', 1)",
        [],
    )
    .unwrap();
}
