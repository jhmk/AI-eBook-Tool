use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::services::import::{ImportJobRecord, ImportStage};
use tauri::{Emitter, Manager};

const STORAGE_FOLDER: &str = "ai-ebook-tool";
const JOBS_FILE: &str = "import-jobs.json";

fn storage_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|err| err.to_string())?;
    Ok(base.join(STORAGE_FOLDER))
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn jobs_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(storage_root(app)?.join(JOBS_FILE))
}

fn load_jobs(app: &tauri::AppHandle) -> Result<Vec<ImportJobRecord>, String> {
    let path = jobs_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&contents).map_err(|err| err.to_string())
}

fn save_jobs(app: &tauri::AppHandle, jobs: &[ImportJobRecord]) -> Result<(), String> {
    let path = jobs_path(app)?;
    ensure_parent(&path)?;
    let contents = serde_json::to_string_pretty(jobs).map_err(|err| err.to_string())?;
    fs::write(path, contents).map_err(|err| err.to_string())
}

pub fn create_job(
    app: &tauri::AppHandle,
    project_id: String,
    source_label: String,
    source_path: String,
    source_kind: String,
) -> Result<ImportJobRecord, String> {
    let now = chrono_like_now();
    let mut jobs = load_jobs(app)?;
    let job = ImportJobRecord {
        id: uuid_like_now(),
        project_id,
        source_label,
        source_path,
        source_kind,
        stage: ImportStage::Queued,
        progress: 0,
        message: None,
        created_at: now.clone(),
        updated_at: now,
    };
    jobs.insert(0, job.clone());
    save_jobs(app, &jobs)?;
    Ok(job)
}

pub fn update_job(
    app: &tauri::AppHandle,
    job_id: String,
    stage: Option<ImportStage>,
    progress: Option<u8>,
    message: Option<String>,
) -> Result<Option<ImportJobRecord>, String> {
    let mut jobs = load_jobs(app)?;
    let now = chrono_like_now();
    let mut updated: Option<ImportJobRecord> = None;

    for job in &mut jobs {
        if job.id == job_id {
            if let Some(stage) = stage.clone() {
                job.stage = stage;
            }
            if let Some(progress) = progress {
                job.progress = progress;
            }
            if message.is_some() {
                job.message = message.clone();
            }
            job.updated_at = now.clone();
            updated = Some(job.clone());
            break;
        }
    }

    if updated.is_some() {
        save_jobs(app, &jobs)?;
        if let Some(ref job) = updated {
            let _ = app.emit("import-job-updated", job.clone());
        }
    }

    Ok(updated)
}

pub fn list_jobs(app: &tauri::AppHandle) -> Result<Vec<ImportJobRecord>, String> {
    load_jobs(app)
}

pub fn reset_jobs(app: &tauri::AppHandle) -> Result<(), String> {
    let path = jobs_path(app)?;
    if path.exists() {
        fs::remove_file(path).map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    now.to_string()
}

fn uuid_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("job-{now}")
}
