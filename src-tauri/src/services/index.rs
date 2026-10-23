use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::models::index::ProjectIndexRecord;
use tauri::Manager;

const STORAGE_FOLDER: &str = "ai-ebook-tool";
const INDEX_FOLDER: &str = "indexes";

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

fn index_path(app: &tauri::AppHandle, project_id: &str) -> Result<PathBuf, String> {
    Ok(storage_root(app)?
        .join(INDEX_FOLDER)
        .join(format!("{project_id}.json")))
}

pub fn load_project_index(
    app: &tauri::AppHandle,
    project_id: &str,
) -> Result<Option<ProjectIndexRecord>, String> {
    let path = index_path(app, project_id)?;
    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let parsed = serde_json::from_str(&contents).map_err(|err| err.to_string())?;
    Ok(Some(parsed))
}

pub fn save_project_index(
    app: &tauri::AppHandle,
    record: ProjectIndexRecord,
) -> Result<(), String> {
    let path = index_path(app, &record.project_id)?;
    ensure_parent(&path)?;
    let contents = serde_json::to_string_pretty(&record).map_err(|err| err.to_string())?;
    fs::write(path, contents).map_err(|err| err.to_string())
}

pub fn reset_project_index(app: &tauri::AppHandle, project_id: &str) -> Result<(), String> {
    let path = index_path(app, project_id)?;
    if path.exists() {
        fs::remove_file(path).map_err(|err| err.to_string())?;
    }
    Ok(())
}

pub fn reset_all_indexes(app: &tauri::AppHandle) -> Result<(), String> {
    let path = storage_root(app)?.join(INDEX_FOLDER);
    if path.exists() {
        fs::remove_dir_all(path).map_err(|err| err.to_string())?;
    }
    Ok(())
}
