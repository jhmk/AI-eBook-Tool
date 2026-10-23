use std::{
    env,
    fs,
    io::{self, BufRead, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
    time::Duration,
};

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use zip::ZipArchive;

const OLLAMA_API_BASE: &str = "http://127.0.0.1:11434/api";
const OLLAMA_RELEASE_BASE: &str = "https://github.com/ollama/ollama/releases/latest/download";
const RUNTIME_FOLDER: &str = "runtime/ollama";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LocalModelState {
    Idle,
    Starting,
    Downloading,
    Ready,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelStatusRecord {
    pub model_name: String,
    pub state: LocalModelState,
    pub message: String,
    pub server_running: bool,
    pub model_ready: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<u8>,
}

static OLLAMA_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

fn child_slot() -> &'static Mutex<Option<Child>> {
    OLLAMA_CHILD.get_or_init(|| Mutex::new(None))
}

fn client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(120))
        .user_agent("ai-ebook-tool")
        .build()
        .map_err(|err| err.to_string())
}

fn emit_status(app: &tauri::AppHandle, status: &LocalModelStatusRecord) {
    let _ = app.emit("local-model-status", status.clone());
}

fn status(
    model_name: &str,
    state: LocalModelState,
    message: impl Into<String>,
    server_running: bool,
    model_ready: bool,
    progress: Option<u8>,
) -> LocalModelStatusRecord {
    LocalModelStatusRecord {
        model_name: model_name.to_string(),
        state,
        message: message.into(),
        server_running,
        model_ready,
        progress,
    }
}

fn runtime_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|err| err.to_string())?;
    Ok(base.join("ai-ebook-tool").join(RUNTIME_FOLDER))
}

fn system_runtime_binary_path() -> Option<PathBuf> {
    if let Ok(path) = env::var("AI_EBOOK_TOOL_OLLAMA_BIN") {
        let candidate = PathBuf::from(path);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn bundled_runtime_binary_path(bundle_dir: Option<&str>) -> Option<PathBuf> {
    if let Some(dir) = bundle_dir {
        let root = PathBuf::from(dir);
        if let Some(found) = find_binary_recursively(&root) {
            return Some(found);
        }

        let candidate = root.join(runtime_binary_name());
        if candidate.exists() {
            return Some(candidate);
        }
    }

    if let Ok(path) = env::var("AI_EBOOK_TOOL_OLLAMA_BUNDLED_BIN") {
        let candidate = PathBuf::from(path);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    if let Ok(directory) = env::var("AI_EBOOK_TOOL_OLLAMA_BUNDLE_DIR") {
        let root = PathBuf::from(directory);
        if let Some(found) = find_binary_recursively(&root) {
            return Some(found);
        }

        let candidate = root.join(runtime_binary_name());
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn platform_asset_name() -> Option<&'static str> {
    match (env::consts::OS, env::consts::ARCH) {
        ("macos", _) => Some("Ollama-darwin.zip"),
        ("windows", "arm64") => Some("ollama-windows-arm64.zip"),
        ("windows", _) => Some("ollama-windows-amd64.zip"),
        _ => None,
    }
}

fn runtime_binary_name() -> &'static str {
    if cfg!(windows) {
        "ollama.exe"
    } else if cfg!(target_os = "macos") {
        "Ollama"
    } else {
        "ollama"
    }
}

fn runtime_binary_candidates() -> &'static [&'static str] {
    if cfg!(windows) {
        &["ollama.exe"]
    } else if cfg!(target_os = "macos") {
        &["Ollama", "ollama"]
    } else {
        &["ollama"]
    }
}

fn ensure_directory(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|err| err.to_string())
}

fn find_binary_recursively(root: &Path) -> Option<PathBuf> {
    if !root.exists() {
        return None;
    }

    if root.is_file() {
        let file_name = root.file_name()?.to_string_lossy();
        if runtime_binary_candidates()
            .iter()
            .any(|candidate| file_name == *candidate)
        {
            return Some(root.to_path_buf());
        }
        return None;
    }

    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_binary_recursively(&path) {
                return Some(found);
            }
        } else if path
            .file_name()
            .map(|file_name| {
                runtime_binary_candidates()
                    .iter()
                    .any(|candidate| file_name == *candidate)
            })
            .unwrap_or(false)
        {
            return Some(path);
        }
    }

    None
}

fn binary_path_from_install(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let runtime_dir = runtime_root(app)?;
    ensure_directory(&runtime_dir)?;

    if let Some(found) = find_binary_recursively(&runtime_dir) {
        return Ok(found);
    }

    let candidate = if cfg!(windows) {
        runtime_dir.join("ollama.exe")
    } else {
        runtime_dir.join("ollama")
    };

    if candidate.exists() {
        return Ok(candidate);
    }

    Err("Local Ollama runtime is not installed".to_string())
}

fn runtime_binary_path(app: &tauri::AppHandle, bundle_dir: Option<&str>) -> Result<PathBuf, String> {
    if let Some(path) = bundled_runtime_binary_path(bundle_dir) {
        return Ok(path);
    }

    if let Some(path) = system_runtime_binary_path() {
        return Ok(path);
    }

    binary_path_from_install(app)
}

fn server_ready(client: &Client) -> bool {
    client
        .get(format!("{OLLAMA_API_BASE}/tags"))
        .send()
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

fn download_runtime_archive(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let asset = platform_asset_name().ok_or_else(|| {
        "This platform does not have an automatic Ollama runtime bundle yet".to_string()
    })?;

    let runtime_dir = runtime_root(app)?;
    ensure_directory(&runtime_dir)?;

    let archive_path = runtime_dir.join(asset);
    if archive_path.exists() {
        return Ok(archive_path);
    }

    let url = format!("{OLLAMA_RELEASE_BASE}/{asset}");
    let mut response = client()?.get(url).send().map_err(|err| err.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Runtime download returned HTTP {}",
            response.status().as_u16()
        ));
    }

    let mut file = fs::File::create(&archive_path).map_err(|err| err.to_string())?;
    io::copy(&mut response, &mut file).map_err(|err| err.to_string())?;
    file.flush().map_err(|err| err.to_string())?;

    Ok(archive_path)
}

fn extract_zip_archive(archive_path: &Path, destination: &Path) -> Result<(), String> {
    let file = fs::File::open(archive_path).map_err(|err| err.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|err| err.to_string())?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|err| err.to_string())?;
        let outpath = destination.join(entry.name());

        if entry.name().ends_with('/') {
            ensure_directory(&outpath)?;
            continue;
        }

        if let Some(parent) = outpath.parent() {
            ensure_directory(parent)?;
        }

        let mut outfile = fs::File::create(&outpath).map_err(|err| err.to_string())?;
        io::copy(&mut entry, &mut outfile).map_err(|err| err.to_string())?;
        outfile.flush().map_err(|err| err.to_string())?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if outpath
                .file_name()
                .map(|name| {
                    runtime_binary_candidates()
                        .iter()
                        .any(|candidate| name == *candidate)
                })
                .unwrap_or(false)
            {
                let mut permissions = fs::metadata(&outpath)
                    .map_err(|err| err.to_string())?
                    .permissions();
                permissions.set_mode(0o755);
                fs::set_permissions(&outpath, permissions).map_err(|err| err.to_string())?;
            }
        }
    }

    Ok(())
}

fn download_and_install_runtime(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let runtime_dir = runtime_root(app)?;
    ensure_directory(&runtime_dir)?;

    let archive_path = download_runtime_archive(app)?;
    extract_zip_archive(&archive_path, &runtime_dir)?;

    if let Some(found) = find_binary_recursively(&runtime_dir) {
        return Ok(found);
    }

    Err("The Ollama runtime archive was downloaded but the executable could not be located".to_string())
}

fn ensure_runtime_binary(
    app: &tauri::AppHandle,
    bundle_dir: Option<&str>,
) -> Result<PathBuf, String> {
    match runtime_binary_path(app, bundle_dir) {
        Ok(path) => Ok(path),
        Err(_) => download_and_install_runtime(app),
    }
}

fn spawn_server(app: &tauri::AppHandle, bundle_dir: Option<&str>) -> Result<(), String> {
    let binary_path = ensure_runtime_binary(app, bundle_dir)?;
    let mut guard = child_slot().lock().map_err(|err| err.to_string())?;
    if let Some(child) = guard.as_mut() {
        if child.try_wait().map_err(|err| err.to_string())?.is_none() {
            return Ok(());
        }
        *guard = None;
    }

    let child = Command::new(binary_path)
        .arg("serve")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|err| err.to_string())?;

    *guard = Some(child);
    Ok(())
}

fn ensure_server_running(
    app: &tauri::AppHandle,
    client: &Client,
    bundle_dir: Option<&str>,
) -> Result<bool, String> {
    if server_ready(client) {
        return Ok(false);
    }

    spawn_server(app, bundle_dir)?;

    for _ in 0..30 {
        if server_ready(client) {
            return Ok(true);
        }
        thread::sleep(Duration::from_secs(1));
    }

    Err("The local Ollama server did not become ready in time".to_string())
}

fn model_is_ready(client: &Client, model_name: &str) -> bool {
    client
        .post(format!("{OLLAMA_API_BASE}/show"))
        .json(&serde_json::json!({ "model": model_name }))
        .send()
        .map(|response| response.status().is_success())
        .unwrap_or(false)
}

fn pull_model(app: &tauri::AppHandle, client: &Client, model_name: &str) -> Result<(), String> {
    let response = client
        .post(format!("{OLLAMA_API_BASE}/pull"))
        .json(&serde_json::json!({
            "model": model_name,
            "stream": true,
        }))
        .send()
        .map_err(|err| err.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Model download returned HTTP {}",
            response.status().as_u16()
        ));
    }

    let reader = io::BufReader::new(response);
    for line in reader.lines() {
        let line = line.map_err(|err| err.to_string())?;
        if line.trim().is_empty() {
            continue;
        }

        if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
            let message = event
                .get("status")
                .and_then(|value| value.as_str())
                .map(|value| format!("{model_name}: {value}"))
                .unwrap_or_else(|| format!("{model_name} is downloading."));

            let download_progress = event
                .get("completed")
                .and_then(|value| value.as_f64())
                .and_then(|completed| {
                    event
                        .get("total")
                        .and_then(|value| value.as_f64())
                        .and_then(|total| {
                            if total > 0.0 {
                                Some(((completed / total) * 100.0).clamp(0.0, 100.0) as u8)
                            } else {
                                None
                            }
                        })
                });

            let progress = download_progress.map(|value| {
                50u8.saturating_add((value.saturating_mul(45)) / 100)
            });

            emit_status(
                app,
                &status(
                    model_name,
                    LocalModelState::Downloading,
                    message,
                    true,
                    false,
                    progress,
                ),
            );
        }
    }

    Ok(())
}

pub fn prepare_local_model(
    app: &tauri::AppHandle,
    model_name: &str,
    runtime_bundle_dir: Option<&str>,
) -> Result<LocalModelStatusRecord, String> {
    let client = client()?;
    emit_status(
        app,
        &status(
            model_name,
            LocalModelState::Starting,
            format!("Preparing {model_name}..."),
            false,
            false,
            Some(5),
        ),
    );
    emit_status(
        app,
        &status(
            model_name,
            LocalModelState::Starting,
            "Checking bundled runtime...".to_string(),
            false,
            false,
            Some(10),
        ),
    );
    let server_started = ensure_server_running(app, &client, runtime_bundle_dir)?;

    let running = server_started || server_ready(&client);

    if !running {
        let status = status(
            model_name,
            LocalModelState::Unavailable,
            "The local model runtime could not be started automatically.",
            false,
            false,
            Some(0),
        );
        emit_status(app, &status);
        return Ok(status);
    }

    if model_is_ready(&client, model_name) {
        let status = status(
            model_name,
            LocalModelState::Ready,
            format!("{model_name} is ready for grounded answers."),
            true,
            true,
            Some(100),
        );
        emit_status(app, &status);
        return Ok(status);
    }

    emit_status(
        app,
        &status(
            model_name,
            LocalModelState::Downloading,
            format!("{model_name} is being downloaded."),
            true,
            false,
            Some(55),
        ),
    );
    let _ = pull_model(app, &client, model_name)?;

    if model_is_ready(&client, model_name) {
        let status = status(
            model_name,
            LocalModelState::Ready,
            format!("{model_name} was downloaded and is ready."),
            true,
            true,
            Some(100),
        );
        emit_status(app, &status);
        return Ok(status);
    }

    let status = status(
        model_name,
        LocalModelState::Downloading,
        format!("{model_name} is still being prepared."),
        true,
        false,
        Some(75),
    );
    emit_status(app, &status);
    Ok(status)
}

pub fn inspect_local_model(
    app: &tauri::AppHandle,
    model_name: &str,
    runtime_bundle_dir: Option<&str>,
) -> Result<LocalModelStatusRecord, String> {
    let client = client()?;
    let runtime_available = runtime_binary_path(app, runtime_bundle_dir).is_ok();
    let server_running = server_ready(&client);
    let model_ready = server_running && model_is_ready(&client, model_name);

    if model_ready {
        return Ok(status(
            model_name,
            LocalModelState::Ready,
            format!("{model_name} is ready for grounded answers."),
            true,
            true,
            Some(100),
        ));
    }

    if server_running {
        return Ok(status(
            model_name,
            LocalModelState::Downloading,
            format!("{model_name} is still being prepared."),
            true,
            false,
            Some(70),
        ));
    }

    if runtime_available {
        return Ok(status(
            model_name,
            LocalModelState::Starting,
            "The local AI runtime is starting.",
            false,
            false,
            Some(15),
        ));
    }

    Ok(status(
        model_name,
        LocalModelState::Unavailable,
        "The local AI runtime is not available yet.",
        false,
        false,
        Some(0),
    ))
}
