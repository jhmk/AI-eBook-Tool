use crate::models::index::ProjectIndexRecord;
use crate::services::index as index_service;

#[tauri::command]
pub fn load_project_index(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<Option<serde_json::Value>, String> {
    Ok(index_service::load_project_index(&app, &project_id)?.map(|record| record.documents))
}

#[tauri::command]
pub fn save_project_index(
    app: tauri::AppHandle,
    record: ProjectIndexRecord,
) -> Result<(), String> {
    index_service::save_project_index(&app, record)
}

#[tauri::command]
pub fn reset_project_index(app: tauri::AppHandle, project_id: String) -> Result<(), String> {
    index_service::reset_project_index(&app, &project_id)
}

#[tauri::command]
pub fn reset_all_indexes(app: tauri::AppHandle) -> Result<(), String> {
    index_service::reset_all_indexes(&app)
}
