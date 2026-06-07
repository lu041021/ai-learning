pub mod migrations;
pub mod seed;

use rusqlite::Connection;
use std::path::Path;

pub fn initialize(db_path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    )
    .map_err(|e| format!("Failed to set pragmas: {}", e))?;
    migrations::run_migrations(&conn)?;
    seed::run_seed(&conn)?;
    Ok(conn)
}
