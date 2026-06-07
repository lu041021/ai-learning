use crate::config::AppConfig;
use crate::McpToken;
use std::sync::Mutex;
use tauri::State;

pub struct ConfigState {
    pub path: std::path::PathBuf,
    pub config: Mutex<AppConfig>,
}

#[tauri::command]
pub fn get_config(state: State<'_, ConfigState>) -> Result<AppConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn set_config(
    api_key: String,
    model: String,
    theme: String,
    api_provider: String,
    state: State<'_, ConfigState>,
) -> Result<(), String> {
    let config_data = {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        config.api_key = api_key;
        config.model = model;
        config.theme = theme;
        config.api_provider = api_provider;
        config.clone()
    };
    crate::config::save_config(&state.path, &config_data)
}

#[tauri::command]
pub fn log_frontend_error(message: String, stack: Option<String>) -> Result<(), String> {
    use std::io::Write;
    if let Ok(log_dir) = crate::config::get_log_dir() {
        let log_path = log_dir.join("frontend_errors.log");
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let ts = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
            let stack_str = stack.as_deref().unwrap_or("(no stack)");
            let _ = writeln!(file, "[{ts}] ERROR: {message}\nStack: {stack_str}\n");
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_mcp_token(token: State<'_, McpToken>) -> String {
    token.0.clone()
}
