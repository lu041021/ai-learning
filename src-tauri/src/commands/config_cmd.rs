use crate::config::AppConfig;
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
