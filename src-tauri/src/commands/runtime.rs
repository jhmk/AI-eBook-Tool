use crate::services::model_runtime::{
    inspect_local_model, prepare_local_model, LocalModelStatusRecord,
};

#[tauri::command]
pub fn prepare_local_model_command(
    app: tauri::AppHandle,
    model_name: String,
    runtime_bundle_dir: Option<String>,
) -> Result<LocalModelStatusRecord, String> {
    prepare_local_model(&app, &model_name, runtime_bundle_dir.as_deref())
}

#[tauri::command]
pub fn inspect_local_model_command(
    app: tauri::AppHandle,
    model_name: String,
    runtime_bundle_dir: Option<String>,
) -> Result<LocalModelStatusRecord, String> {
    inspect_local_model(&app, &model_name, runtime_bundle_dir.as_deref())
}
