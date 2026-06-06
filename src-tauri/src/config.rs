use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    #[serde(default, alias = "anthropic_api_key")]
    pub api_key: String,
    #[serde(default = "default_provider")]
    pub api_provider: String,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_provider() -> String {
    "anthropic".into()
}
fn default_model() -> String {
    "claude-sonnet-4-20250514".into()
}
fn default_theme() -> String {
    "dark".into()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            api_provider: default_provider(),
            model: default_model(),
            theme: default_theme(),
        }
    }
}

pub fn config_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("config.json")
}

pub fn load_env() {
    // Look for .env in current directory and project root
    let candidates = [
        PathBuf::from(".env"),
        dirs::home_dir()
            .unwrap_or_default()
            .join(".claude")
            .join("ai-learning.env"),
    ];
    for path in &candidates {
        if path.exists() {
            let _ = dotenvy::from_path(path);
        }
    }
    // Also try default .env in CWD
    let _ = dotenvy::dotenv();
}

pub fn load_config(path: &PathBuf) -> AppConfig {
    let mut config: AppConfig = std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();

    // Env vars override file config (but GUI-saved config takes precedence via set_config)
    if let Ok(val) = std::env::var("ANTHROPIC_API_KEY") {
        if !val.is_empty() && config.api_key.is_empty() {
            config.api_key = val;
        }
    }
    if let Ok(val) = std::env::var("DEEPSEEK_API_KEY") {
        if !val.is_empty() && config.api_key.is_empty() {
            config.api_key = val;
        }
    }
    if let Ok(val) = std::env::var("API_PROVIDER") {
        if !val.is_empty() {
            config.api_provider = val;
        }
    }
    if let Ok(val) = std::env::var("MODEL") {
        if !val.is_empty() {
            config.model = val;
        }
    }
    if let Ok(val) = std::env::var("THEME") {
        if !val.is_empty() {
            config.theme = val;
        }
    }

    config
}

pub fn save_config(path: &PathBuf, config: &AppConfig) -> Result<(), String> {
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

pub fn get_app_data_dir() -> Result<PathBuf, String> {
    let dir = dirs::data_dir()
        .ok_or_else(|| "Cannot find app data directory".to_string())?
        .join("ai-learning-platform");
    std::fs::create_dir_all(&dir).map_err(|e| format!("Cannot create app data dir: {}", e))?;
    Ok(dir)
}
