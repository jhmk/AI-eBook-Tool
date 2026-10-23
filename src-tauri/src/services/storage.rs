use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::models::storage::{AppConfigRecord, AppStateRecord};
use tauri::Manager;

const STORAGE_FOLDER: &str = "ai-ebook-tool";
const STATE_FILE: &str = "app-state.json";
const CONFIG_FILE: &str = "app-config.json";

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

fn read_json<T: for<'de> serde::Deserialize<'de>>(path: &Path) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let parsed = serde_json::from_str(&contents).map_err(|err| err.to_string())?;
    Ok(Some(parsed))
}

fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    ensure_parent(path)?;
    let contents = serde_json::to_string_pretty(value).map_err(|err| err.to_string())?;
    fs::write(path, contents).map_err(|err| err.to_string())
}

pub fn load_app_state(app: &tauri::AppHandle) -> Result<Option<AppStateRecord>, String> {
    let path = storage_root(app)?.join(STATE_FILE);
    read_json(&path)
}

pub fn save_app_state(app: &tauri::AppHandle, state: AppStateRecord) -> Result<(), String> {
    let path = storage_root(app)?.join(STATE_FILE);
    write_json(&path, &state)
}

pub fn load_app_config(app: &tauri::AppHandle) -> Result<Option<AppConfigRecord>, String> {
    let path = storage_root(app)?.join(CONFIG_FILE);
    read_json(&path)
}

pub fn save_app_config(app: &tauri::AppHandle, config: AppConfigRecord) -> Result<(), String> {
    let path = storage_root(app)?.join(CONFIG_FILE);
    write_json(&path, &config)
}

pub fn reset_app_data(app: &tauri::AppHandle) -> Result<(), String> {
    let root = storage_root(app)?;
    if root.exists() {
        fs::remove_dir_all(root).map_err(|err| err.to_string())?;
    }

    Ok(())
}
