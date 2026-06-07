use serde::Serializer;
use std::fmt;

#[derive(Debug)]
pub enum AppError {
    DbLock(String),
    Sqlite(rusqlite::Error),
    Serde(serde_json::Error),
    Io(std::io::Error),
    NotFound(String),
    InvalidInput(String),
    LlmError(String),
    Msg(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::DbLock(e) => write!(f, "数据库锁错误: {}", e),
            AppError::Sqlite(e) => write!(f, "数据库错误: {}", e),
            AppError::Serde(e) => write!(f, "序列化错误: {}", e),
            AppError::Io(e) => write!(f, "IO 错误: {}", e),
            AppError::NotFound(e) => write!(f, "未找到: {}", e),
            AppError::InvalidInput(e) => write!(f, "参数错误: {}", e),
            AppError::LlmError(e) => write!(f, "AI 服务错误: {}", e),
            AppError::Msg(e) => write!(f, "{}", e),
        }
    }
}

impl serde::Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Sqlite(e)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Serde(e)
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e)
    }
}

impl From<String> for AppError {
    fn from(e: String) -> Self {
        AppError::Msg(e)
    }
}

impl From<&str> for AppError {
    fn from(e: &str) -> Self {
        AppError::Msg(e.to_string())
    }
}

impl<T> From<std::sync::PoisonError<T>> for AppError {
    fn from(e: std::sync::PoisonError<T>) -> Self {
        AppError::DbLock(e.to_string())
    }
}

impl From<r2d2::Error> for AppError {
    fn from(e: r2d2::Error) -> Self {
        AppError::DbLock(e.to_string())
    }
}

impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        e.to_string()
    }
}
