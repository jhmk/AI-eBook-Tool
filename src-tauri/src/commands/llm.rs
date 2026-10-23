use crate::models::llm::{GenerateAnswerInput, GenerateAnswerOutput};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OllamaChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OllamaChatRequest<'a> {
    model: &'a str,
    stream: bool,
    messages: Vec<OllamaChatMessage<'a>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OllamaChatResponseMessage {
    content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OllamaChatResponse {
    message: Option<OllamaChatResponseMessage>,
}

fn build_context_prompt(input: &GenerateAnswerInput) -> String {
    let mut lines = Vec::with_capacity(input.context.len() + 4);
    lines.push(
        "Use only the provided source passages to answer the question. If the sources are insufficient, say so clearly."
            .to_string(),
    );
    lines.push("Do not invent facts. Prefer concise, grounded answers.".to_string());
    lines.push(String::new());
    lines.push(format!("Question: {}", input.question));
    lines.push(String::new());
    lines.push("Source passages:".to_string());

    for (index, chunk) in input.context.iter().enumerate() {
        let location = chunk
            .source_ref
            .as_ref()
            .map(|value| format!(" ({value})"))
            .unwrap_or_default();
        lines.push(format!(
            "{}. {}{} [{}]: {}",
            index + 1,
            chunk.document_name,
            location,
            chunk.chunk_id,
            chunk.text.replace('\n', " ")
        ));
    }

    lines.join("\n")
}

#[tauri::command]
pub fn generate_llm_answer(
    input: GenerateAnswerInput,
) -> Result<GenerateAnswerOutput, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|err| err.to_string())?;

    let prompt = build_context_prompt(&input);
    let request = OllamaChatRequest {
        model: &input.model_name,
        stream: false,
        messages: vec![
            OllamaChatMessage {
                role: "system",
                content:
                    "You are a careful research assistant who answers only from the provided source passages.",
            },
            OllamaChatMessage {
                role: "user",
                content: &prompt,
            },
        ],
    };

    let response = client
        .post("http://127.0.0.1:11434/api/chat")
        .json(&request)
        .send()
        .map_err(|err| {
            format!(
                "Unable to reach the local Ollama server at http://127.0.0.1:11434: {}",
                err
            )
        })?;

    if !response.status().is_success() {
        return Err(format!(
            "Ollama returned HTTP {}",
            response.status().as_u16()
        ));
    }

    let response: OllamaChatResponse = response.json().map_err(|err| err.to_string())?;
    let content = response
        .message
        .map(|message| message.content)
        .unwrap_or_default()
        .trim()
        .to_string();

    if content.is_empty() {
        return Err("Ollama returned an empty answer".to_string());
    }

    Ok(GenerateAnswerOutput { content })
}
