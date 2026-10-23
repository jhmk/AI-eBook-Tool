pub mod commands;
pub mod models;
pub mod services;

use std::thread;

use crate::services::model_runtime::prepare_local_model;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let runtime_bundle_dir = app
                .path()
                .resource_dir()
                .ok()
                .map(|dir| dir.join("runtime/ollama"));

            thread::spawn(move || {
                let bundle_dir = runtime_bundle_dir
                    .as_ref()
                    .map(|path| path.to_string_lossy().to_string());
                let _ = prepare_local_model(
                    &app_handle,
                    "gemma3:1b",
                    bundle_dir.as_deref(),
                );
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::files::list_directory_entries,
            commands::files::read_file_bytes,
            commands::index::load_project_index,
            commands::index::save_project_index,
            commands::index::reset_project_index,
            commands::index::reset_all_indexes,
            commands::llm::generate_llm_answer,
            commands::runtime::prepare_local_model_command,
            commands::import::create_import_job,
            commands::import::complete_import_batch,
            commands::import::update_import_job,
            commands::import::list_import_jobs,
            commands::import::reset_import_jobs,
            commands::runtime::inspect_local_model_command,
            commands::storage::load_app_state,
            commands::storage::save_app_state,
            commands::storage::load_app_config,
            commands::storage::save_app_config,
            commands::storage::reset_app_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
