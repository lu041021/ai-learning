pub mod migrations;
pub mod seed;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::Path;

pub type DbPool = Pool<SqliteConnectionManager>;

pub fn initialize(db_path: &Path) -> Result<DbPool, String> {
    let manager = SqliteConnectionManager::file(db_path).with_init(|conn| {
        conn.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
        )
    });
    let pool = Pool::builder()
        .max_size(8)
        .build(manager)
        .map_err(|e| format!("Failed to create connection pool: {}", e))?;

    let conn = pool
        .get()
        .map_err(|e| format!("Failed to get connection: {}", e))?;
    migrations::run_migrations(&conn)?;
    seed::run_seed(&conn)?;
    Ok(pool)
}
