use std::{collections::BTreeMap, io::Cursor};

use crate::models::imports::{
    NativeImportBatchInput, NativeImportChunkRecord, NativeImportedDocumentRecord,
};
use crate::services::{ocr, storage};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ImportStage {
    Queued,
    Extracting,
    Chunking,
    Ready,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateImportJobInput {
    pub project_id: String,
    pub source_label: String,
    pub source_path: String,
    pub source_kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportJobRecord {
    pub id: String,
    pub project_id: String,
    pub source_label: String,
    pub source_path: String,
    pub source_kind: String,
    pub stage: ImportStage,
    pub progress: u8,
    pub message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

fn extension_for_file(name: &str) -> String {
    name.split('.')
        .next_back()
        .unwrap_or_default()
        .to_lowercase()
}

fn normalize_body_text(value: &str) -> String {
    value
        .replace('\u{00a0}', " ")
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace("\n\n\n", "\n\n")
        .replace("  ", " ")
        .trim()
        .to_string()
}

fn tokenize(value: &str) -> Vec<String> {
    value
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_alphanumeric() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .map(|token| token.trim().to_string())
        .filter(|token| token.len() > 2)
        .collect()
}

fn build_term_weights(text: &str) -> BTreeMap<String, usize> {
    let mut weights = BTreeMap::new();
    for token in tokenize(text) {
        *weights.entry(token).or_insert(0) += 1;
    }
    weights
}

fn mark_text_sections(sections: Vec<String>, label_prefix: &str) -> String {
    sections
        .into_iter()
        .enumerate()
        .filter_map(|(index, section)| {
            let normalized = normalize_body_text(&section);
            if normalized.is_empty() {
                None
            } else {
                Some(format!(
                    "[[{label_prefix} {}]]\n\n{}",
                    index + 1,
                    normalized
                ))
            }
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn extract_section_marker(paragraph: &str) -> Option<String> {
    let trimmed = paragraph.trim();
    if trimmed.starts_with("[[") && trimmed.ends_with("]]") {
        Some(
            trimmed
                .trim_start_matches("[[")
                .trim_end_matches("]]")
                .trim()
                .to_string(),
        )
    } else {
        None
    }
}

fn chunk_text(text: &str, chunk_size: usize, source_label: &str) -> Vec<NativeImportChunkRecord> {
    let normalized = normalize_body_text(text);
    if normalized.is_empty() {
        return Vec::new();
    }

    let paragraphs: Vec<String> = normalized
        .split("\n\n")
        .map(|paragraph| paragraph.trim().to_string())
        .filter(|paragraph| !paragraph.is_empty())
        .collect();

    let mut chunks: Vec<(String, Option<String>)> = Vec::new();
    let mut current = String::new();
    let mut current_source_ref: Option<String> = None;

    for paragraph in paragraphs {
        if let Some(marker) = extract_section_marker(&paragraph) {
            if !current.is_empty() {
                chunks.push((current.clone(), current_source_ref.clone()));
                current.clear();
            }
            current_source_ref = Some(marker);
            continue;
        }

        let next = if current.is_empty() {
            paragraph.clone()
        } else {
            format!("{current}\n\n{paragraph}")
        };

        if next.len() <= chunk_size {
            current = next;
            continue;
        }

        if !current.is_empty() {
            chunks.push((current.clone(), current_source_ref.clone()));
            current.clear();
        }

        if paragraph.len() <= chunk_size {
            current = paragraph;
            continue;
        }

        let mut sentence_buffer = String::new();
        for sentence in paragraph.split_terminator(['.', '!', '?']) {
            let trimmed = sentence.trim();
            if trimmed.is_empty() {
                continue;
            }

            let candidate = if sentence_buffer.is_empty() {
                trimmed.to_string()
            } else {
                format!("{sentence_buffer} {trimmed}")
            };

            if candidate.len() <= chunk_size {
                sentence_buffer = candidate;
            } else {
                if !sentence_buffer.is_empty() {
                    chunks.push((sentence_buffer.clone(), current_source_ref.clone()));
                }
                sentence_buffer = trimmed.to_string();
            }
        }

        if !sentence_buffer.is_empty() {
            current = sentence_buffer;
        }
    }

    if !current.is_empty() {
        chunks.push((current, current_source_ref.clone()));
    }

    chunks
        .into_iter()
        .enumerate()
        .map(|(index, (chunk, source_ref))| NativeImportChunkRecord {
            id: format!("chunk-{}-{}", source_label.replace(' ', "-"), index),
            text: chunk.clone(),
            order: index,
            source_label: source_label.to_string(),
            source_ref,
            term_weights: build_term_weights(&chunk),
        })
        .collect()
}

fn clean_pdf_text(value: &str) -> String {
    value
        .replace("\\n", "\n")
        .replace("\\r", "\r")
        .replace("\\t", "\t")
        .replace("\\(", "(")
        .replace("\\)", ")")
        .replace("\\\\", "\\")
}

fn extract_pdf_strings(raw: &str) -> Vec<String> {
    let mut matches = Vec::new();
    let bytes = raw.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'(' {
            let mut end = index + 1;
            let mut depth = 1;
            while end < bytes.len() && depth > 0 {
                match bytes[end] {
                    b'(' => depth += 1,
                    b')' => depth -= 1,
                    b'\\' => end += 1,
                    _ => {}
                }
                end += 1;
            }

            let slice = &raw[index + 1..end.saturating_sub(1)];
            let tail = &raw[end..raw.len().min(end + 3)];
            if tail.contains("Tj") || tail.contains("TJ") {
                matches.push(clean_pdf_text(slice));
            }
            index = end;
            continue;
        }

        index += 1;
    }

    matches
}

fn extract_plain_text(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).to_string()
}

fn extract_pdf_text(bytes: &[u8]) -> Result<String, String> {
    match pdf_extract::extract_text_from_mem(bytes) {
        Ok(text) => {
            let normalized = normalize_body_text(&text);
            if normalized.is_empty() {
                let raw = String::from_utf8_lossy(bytes).to_string();
                let fallback = extract_pdf_strings(&raw).join("\n");
                if fallback.is_empty() {
                    Err("PDF did not contain readable text".to_string())
                } else {
                    Ok(fallback)
                }
            } else {
                Ok(normalized)
            }
        }
        Err(err) => {
            let raw = String::from_utf8_lossy(bytes).to_string();
            let fallback = extract_pdf_strings(&raw).join("\n");
            if fallback.is_empty() {
                Err(err.to_string())
            } else {
                Ok(fallback)
            }
        }
    }
}

fn read_pdf_text(name: &str, bytes: &[u8], mode: &ocr::OcrMode) -> (String, String, String) {
    match extract_pdf_text(bytes) {
        Ok(text) => {
            let should_use_ocr = ocr::should_use_ocr(mode, &text);
            let sections: Vec<String> = text
                .split('\u{000C}')
                .map(normalize_body_text)
                .filter(|section| !section.is_empty())
                .collect();
            let marked_text = if sections.is_empty() {
                text.clone()
            } else {
                mark_text_sections(sections, "Page")
            };
            if !should_use_ocr {
                (
                    marked_text,
                    "Imported from PDF with native text extraction.".to_string(),
                    "indexed".to_string(),
                )
            } else {
                match ocr::run_ocr_backend(name, bytes) {
                    Ok(ocr_text) => (
                        ocr_text,
                        "Imported from PDF through the configured OCR backend.".to_string(),
                        "indexed".to_string(),
                    ),
                    Err(message) => (
                        marked_text,
                        format!(
                            "Native text extraction succeeded, but OCR backend was unavailable or failed: {message}"
                        ),
                        "indexed".to_string(),
                    ),
                }
            }
        }
        Err(message) => {
            if matches!(mode, ocr::OcrMode::Off) {
                (
                    String::new(),
                    format!("PDF import failed in the native extractor: {message}"),
                    "error".to_string(),
                )
            } else {
                match ocr::run_ocr_backend(name, bytes) {
                    Ok(ocr_text) => (
                        ocr_text,
                        "Imported from PDF through the configured OCR backend.".to_string(),
                        "indexed".to_string(),
                    ),
                    Err(ocr_message) => (
                        String::new(),
                        format!(
                            "PDF native extraction failed and OCR backend was unavailable or failed: {ocr_message}"
                        ),
                        "error".to_string(),
                    ),
                }
            }
        }
    }
}

fn extract_epub_text(bytes: &[u8]) -> Result<String, String> {
    let reader = Cursor::new(bytes.to_vec());
    let mut archive = zip::ZipArchive::new(reader).map_err(|err| err.to_string())?;

    let mut container_xml = String::new();
    if let Ok(mut file) = archive.by_name("META-INF/container.xml") {
        use std::io::Read;
        file.read_to_string(&mut container_xml)
            .map_err(|err| err.to_string())?;
    }

    let rootfile_path = roxmltree::Document::parse(&container_xml)
        .ok()
        .and_then(|doc| {
            doc.descendants()
                .find(|node| node.has_tag_name("rootfile"))
                .and_then(|node| node.attribute("full-path"))
                .map(|value| value.to_string())
        });

    let mut ordered_content_paths: Vec<String> = Vec::new();

    if let Some(rootfile_path) = rootfile_path {
        let mut package_xml = String::new();
        if let Ok(mut file) = archive.by_name(&rootfile_path) {
            use std::io::Read;
            file.read_to_string(&mut package_xml)
                .map_err(|err| err.to_string())?;
        }

        if let Ok(doc) = roxmltree::Document::parse(&package_xml) {
            let mut manifest = BTreeMap::new();
            for node in doc.descendants().filter(|node| node.has_tag_name("item")) {
                if let (Some(id), Some(href)) = (node.attribute("id"), node.attribute("href")) {
                    manifest.insert(id.to_string(), href.to_string());
                }
            }

            let base_path = rootfile_path
                .rsplit_once('/')
                .map(|(prefix, _)| prefix.to_string());

            for node in doc.descendants().filter(|node| node.has_tag_name("itemref")) {
                if let Some(idref) = node.attribute("idref") {
                    if let Some(href) = manifest.get(idref) {
                        let full_path = match &base_path {
                            Some(base) if !base.is_empty() => format!("{base}/{href}"),
                            _ => href.to_string(),
                        };
                        ordered_content_paths.push(full_path);
                    }
                }
            }
        }
    }

    if ordered_content_paths.is_empty() {
        ordered_content_paths = archive
            .file_names()
            .filter(|path| path.ends_with(".xhtml") || path.ends_with(".html") || path.ends_with(".htm"))
            .map(|path| path.to_string())
            .collect();
        ordered_content_paths.sort();
    }

    let mut chapters = Vec::new();
    for content_path in ordered_content_paths {
        if let Ok(mut file) = archive.by_name(&content_path) {
            use std::io::Read;
            let mut html = String::new();
            file.read_to_string(&mut html)
                .map_err(|err| err.to_string())?;
            let text = roxmltree::Document::parse(&html)
                .ok()
                .and_then(|doc| {
                    let text = doc
                        .descendants()
                        .filter_map(|node| node.text())
                        .collect::<Vec<_>>()
                        .join(" ");
                    let normalized = normalize_body_text(&text);
                    if normalized.is_empty() {
                        None
                    } else {
                        Some(normalized)
                    }
                });

            if let Some(text) = text {
                chapters.push(text);
            }
        }
    }

    let text = mark_text_sections(chapters, "Chapter");
    if text.is_empty() {
        Err("EPUB did not contain readable chapters".to_string())
    } else {
        Ok(text)
    }
}

fn extract_legacy_ebook_text(bytes: &[u8]) -> String {
    let raw = String::from_utf8_lossy(bytes);
    let cleaned = normalize_body_text(
        &raw.replace("<script", " ")
            .replace("</script>", " ")
            .replace("<style", " ")
            .replace("</style>", " ")
            .replace('<', " ")
            .replace('>', " "),
    );

    if cleaned.len() >= 200 {
        mark_text_sections(vec![cleaned], "Legacy ebook text")
    } else {
        String::new()
    }
}

fn read_imported_text(name: &str, bytes: &[u8], mode: &ocr::OcrMode) -> (String, String, String) {
    match extension_for_file(name).as_str() {
        "txt" | "md" | "markdown" | "csv" | "json" | "log" => {
            let text = normalize_body_text(&extract_plain_text(bytes));
            (text.clone(), "Imported as plain text.".to_string(), "indexed".to_string())
        }
        "pdf" => read_pdf_text(name, bytes, mode),
        "epub" => match extract_epub_text(bytes) {
            Ok(text) => (
                text,
                "Imported from EPUB with native archive extraction.".to_string(),
                "indexed".to_string(),
            ),
            Err(message) => (
                String::new(),
                format!("EPUB import failed in the native extractor: {message}"),
                "error".to_string(),
            ),
        },
        "mobi" | "azw3" => {
            let text = extract_legacy_ebook_text(bytes);
            if text.is_empty() {
                (
                    String::new(),
                    "This ebook format still needs a stronger native conversion path.".to_string(),
                    "queued".to_string(),
                )
            } else {
                (
                    text,
                    "Imported with a best-effort native ebook text fallback.".to_string(),
                    "indexed".to_string(),
                )
            }
        }
        _ => (
            String::new(),
            "Unsupported format in the native import pipeline.".to_string(),
            "error".to_string(),
        ),
    }
}

pub fn complete_import_batch(
    app: &tauri::AppHandle,
    batch: NativeImportBatchInput,
) -> Result<Vec<NativeImportedDocumentRecord>, String> {
    let config = storage::load_app_config(app)?;
    let ocr_mode = config
        .as_ref()
        .map(|record| ocr::OcrMode::from_string(&record.ocr_mode))
        .unwrap_or(ocr::OcrMode::Auto);

    let _ = crate::services::import_jobs::update_job(
        app,
        batch.job_id.clone(),
        Some(ImportStage::Extracting),
        Some(15),
        Some("Reading source files".to_string()),
    )?;

    let mut results = Vec::new();
    let total = batch.files.len().max(1);

    for (index, file) in batch.files.iter().enumerate() {
        let progress = 15 + ((index as u8).saturating_mul(70) / total as u8);
        let _ = crate::services::import_jobs::update_job(
            app,
            batch.job_id.clone(),
            Some(ImportStage::Chunking),
            Some(progress),
            Some(format!("Processing {}", file.name)),
        )?;

        let (text, note, status) = read_imported_text(&file.name, &file.bytes, &ocr_mode);
        let chunks = chunk_text(&text, batch.chunk_size, &file.name);
        let chunk_count = chunks.len();
        let record = NativeImportedDocumentRecord {
            id: format!("doc-{}-{}", batch.project_id, index),
            name: file.name.clone(),
            kind: extension_for_file(&file.name),
            source_label: batch.source_label.clone(),
            source_path: batch.source_path.clone(),
            status,
            imported_at: chrono_like_now(),
            note: Some(note),
            extracted_text: if text.is_empty() { None } else { Some(text) },
            chunk_count: Some(chunk_count),
            chunks: if chunk_count > 0 { Some(chunks) } else { None },
        };

        results.push(record);
    }

    let _ = crate::services::import_jobs::update_job(
        app,
        batch.job_id,
        Some(ImportStage::Ready),
        Some(100),
        Some("Import complete".to_string()),
    )?;

    Ok(results)
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    now.to_string()
}
