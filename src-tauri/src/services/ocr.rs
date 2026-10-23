use std::{env, fs, path::PathBuf, process::Command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OcrBackend {
    PdfCraft,
    DeepSeekOcr,
    ExternalCommand(PathBuf),
    Disabled,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OcrMode {
    Off,
    Auto,
    Enhanced,
}

impl OcrMode {
    pub fn from_string(value: &str) -> Self {
        match value {
            "off" => Self::Off,
            "enhanced" => Self::Enhanced,
            _ => Self::Auto,
        }
    }
}

fn backend_candidates() -> Vec<OcrBackend> {
    let mut candidates = Vec::new();

    if let Ok(command) = env::var("AI_EBOOK_TOOL_OCR_COMMAND") {
        if !command.trim().is_empty() {
            candidates.push(OcrBackend::ExternalCommand(PathBuf::from(command)));
        }
    }

    candidates.push(OcrBackend::PdfCraft);
    candidates.push(OcrBackend::DeepSeekOcr);
    candidates.push(OcrBackend::Disabled);

    candidates
}

fn command_for_backend(backend: &OcrBackend) -> Option<Command> {
    match backend {
        OcrBackend::ExternalCommand(path) => Some(Command::new(path)),
        OcrBackend::PdfCraft => Some(Command::new("pdf-craft")),
        OcrBackend::DeepSeekOcr => Some(Command::new("deepseek-ocr")),
        OcrBackend::Disabled => None,
    }
}

fn backend_label(backend: &OcrBackend) -> &'static str {
    match backend {
        OcrBackend::PdfCraft => "pdf-craft",
        OcrBackend::DeepSeekOcr => "DeepSeek-OCR",
        OcrBackend::ExternalCommand(_) => "custom OCR command",
        OcrBackend::Disabled => "disabled",
    }
}

pub fn should_use_ocr(mode: &OcrMode, extracted_text: &str) -> bool {
    match mode {
        OcrMode::Off => false,
        OcrMode::Auto => extracted_text.trim().is_empty(),
        OcrMode::Enhanced => extracted_text.trim().chars().count() < 200,
    }
}

pub fn run_ocr_backend(name: &str, bytes: &[u8]) -> Result<String, String> {
    let temp_dir = env::temp_dir().join("ai-ebook-tool-ocr");
    fs::create_dir_all(&temp_dir).map_err(|err| err.to_string())?;

    let temp_path = temp_dir.join(format!(
        "{}-{}.pdf",
        name.replace(['/', '\\', ' '], "_"),
        uuid_like_suffix()
    ));
    fs::write(&temp_path, bytes).map_err(|err| err.to_string())?;

    let mut last_error = String::new();
    for backend in backend_candidates() {
        if let Some(mut command) = command_for_backend(&backend) {
            let output = command.arg(&temp_path).output();
            match output {
                Ok(output) if output.status.success() => {
                    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !stdout.is_empty() {
                        let _ = fs::remove_file(&temp_path);
                        return Ok(stdout);
                    }
                    last_error = format!(
                        "{} returned no OCR text for {}",
                        backend_label(&backend),
                        name
                    );
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                    last_error = if stderr.is_empty() {
                        format!("{} failed for {}", backend_label(&backend), name)
                    } else {
                        format!("{} failed for {}: {}", backend_label(&backend), name, stderr)
                    };
                }
                Err(err) => {
                    last_error = format!(
                        "{} is unavailable for {}: {}",
                        backend_label(&backend),
                        name,
                        err
                    );
                }
            }
        }
    }

    let _ = fs::remove_file(&temp_path);

    if last_error.is_empty() {
        Err("No OCR backend is configured".to_string())
    } else {
        Err(last_error)
    }
}

fn uuid_like_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
        .to_string()
}
