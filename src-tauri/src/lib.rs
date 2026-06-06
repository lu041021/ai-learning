mod commands;
pub mod config;
pub mod db;
mod error;
pub mod models;
pub mod services;

use commands::chat::StreamCancellers;
use commands::config_cmd::ConfigState;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .setup(|app| {
            config::load_env();

            let app_data_dir = config::get_app_data_dir()?;
            let db_path = app_data_dir.join("learning_platform.db");
            let cfg_path = config::config_path(&app_data_dir);

            let conn = db::initialize(&db_path)?;
            let db = Arc::new(Mutex::new(conn));
            app.manage(db.clone());

            let app_config = config::load_config(&cfg_path);
            app.manage(ConfigState {
                path: cfg_path,
                config: Mutex::new(app_config),
            });

            app.manage(StreamCancellers(Mutex::new(
                HashMap::<i64, Arc<AtomicBool>>::new(),
            )));

            // Start MCP server on port 9529
            let mcp_port: u16 = 9529;
            services::mcp_server::start_mcp_server(db, mcp_port);
            println!("[MCP] Server started on http://127.0.0.1:{}", mcp_port);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::courses::list_courses,
            commands::courses::get_course,
            commands::courses::get_lesson,
            commands::courses::get_quiz,
            commands::user::create_user,
            commands::user::get_user_by_local,
            commands::progress::get_progress,
            commands::progress::mark_complete,
            commands::progress::submit_quiz,
            commands::progress::clear_user_data,
            commands::progress::get_wrong_answers,
            commands::chat::list_conversations,
            commands::chat::get_messages,
            commands::chat::send_chat,
            commands::chat::cancel_chat,
            commands::config_cmd::get_config,
            commands::config_cmd::set_config,
            commands::skill_assessment::assess_user_skill,
            commands::skill_assessment::get_user_profile,
            commands::skill_assessment::generate_learning_path,
            commands::skill_assessment::get_learning_path,
            commands::skill_assessment::list_learning_path_versions,
            commands::skill_assessment::get_learning_path_version,
            commands::dashboard::get_dashboard_data,
            commands::imports::import_from_url,
            commands::imports::check_import_url,
            commands::imports::search_github_awesome,
            commands::imports::fetch_awesome_links,
            commands::imports::preview_import_link,
            commands::imports::subscribe_feed,
            commands::imports::unsubscribe_feed,
            commands::imports::list_feed_subscriptions,
            commands::imports::fetch_feed_articles,
            commands::search::search_all,
            commands::knowledge_graph::get_knowledge_graph,
            commands::recommendation::get_recommendations,
            commands::analytics::get_analytics,
            commands::usage_analyzer_cmd::analyze_usage,
            commands::usage_analyzer_cmd::generate_goal_path,
            commands::skill_assessment::assess_user_skill_deep,
            commands::skill_assessment::generate_enriched_learning_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
