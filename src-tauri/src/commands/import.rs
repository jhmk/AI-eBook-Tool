use crate::services::{
    import::{
        complete_import_batch as complete_import_batch_service, CreateImportJobInput,
        ImportJobRecord, ImportStage,
    },
    import_jobs,
};

#[tauri::command]
pub fn create_import_job(
    app: tauri::AppHandle,
    job: CreateImportJobInput,
) -> Result<ImportJobRecord, String> {
    import_jobs::create_job(&app, job.project_id, job.source_label, job.source_path, job.source_kind)
}

#[tauri::command]
pub fn update_import_job(
    app: tauri::AppHandle,
    job_id: String,
    patch: serde_json::Value,
) -> Result<Option<ImportJobRecord>, String> {
    let stage = patch
        .get("stage")
        .and_then(|value| value.as_str())
        .and_then(|value| match value {
            "queued" => Some(ImportStage::Queued),
            "extracting" => Some(ImportStage::Extracting),
            "chunking" => Some(ImportStage::Chunking),
            "ready" => Some(ImportStage::Ready),
            "error" => Some(ImportStage::Error),
            _ => None,
        });
    let progress = patch.get("progress").and_then(|value| value.as_u64()).map(|value| {
        if value > u8::MAX as u64 {
            u8::MAX
        } else {
            value as u8
        }
    });
    let message = patch
        .get("message")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string());

    import_jobs::update_job(&app, job_id, stage, progress, message)
}

#[tauri::command]
pub fn list_import_jobs(app: tauri::AppHandle) -> Result<Vec<ImportJobRecord>, String> {
    import_jobs::list_jobs(&app)
}

#[tauri::command]
pub fn reset_import_jobs(app: tauri::AppHandle) -> Result<(), String> {
    import_jobs::reset_jobs(&app)
}

#[tauri::command]
pub fn cancel_import_job(
    app: tauri::AppHandle,
    job_id: String,
) -> Result<Option<ImportJobRecord>, String> {
    import_jobs::update_job(&app, job_id, Some(ImportStage::Error), Some(100), Some("Cancelled by user".to_string()))
}

#[tauri::command]
pub fn complete_import_batch(
    app: tauri::AppHandle,
    batch: crate::models::imports::NativeImportBatchInput,
) -> Result<Vec<crate::models::imports::NativeImportedDocumentRecord>, String> {
    complete_import_batch_service(&app, batch)
}
