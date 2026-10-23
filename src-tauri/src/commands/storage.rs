use crate::{
    models::storage::{AppConfigRecord, AppStateRecord},
    services::storage as storage_service,
};

#[tauri::command]
pub fn load_app_state(app: tauri::AppHandle) -> Result<Option<AppStateRecord>, String> {
    storage_service::load_app_state(&app)
}

#[tauri::command]
pub fn save_app_state(app: tauri::AppHandle, state: AppStateRecord) -> Result<(), String> {
    storage_service::save_app_state(&app, state)
}

#[tauri::command]
pub fn load_app_config(app: tauri::AppHandle) -> Result<Option<AppConfigRecord>, String> {
    storage_service::load_app_config(&app)
}

#[tauri::command]
pub fn save_app_config(app: tauri::AppHandle, config: AppConfigRecord) -> Result<(), String> {
    storage_service::save_app_config(&app, config)
}

#[tauri::command]
pub fn reset_app_data(app: tauri::AppHandle) -> Result<(), String> {
    storage_service::reset_app_data(&app)
}
