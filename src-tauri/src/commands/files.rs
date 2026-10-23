#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportSourceKind {
    File,
    Folder,
}

#[tauri::command]
pub fn list_directory_entries(path: String) -> Result<Vec<crate::models::files::DirectoryEntryRecord>, String> {
    use std::fs;
    use std::path::Path;

    let mut entries = Vec::new();
    let dir = Path::new(&path);

    for entry in fs::read_dir(dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let metadata = entry.metadata().map_err(|err| err.to_string())?;
        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs().to_string());
        entries.push(crate::models::files::DirectoryEntryRecord {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            size: if metadata.is_file() { Some(metadata.len()) } else { None },
            modified,
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|err| err.to_string())
}
