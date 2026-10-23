import type { ProjectRecord } from "./types";

function escapeMarkdown(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/#/g, "\\#")
    .replace(/`/g, "\\`");
}

function formatCitations(project: ProjectRecord) {
  return project.savedAnswers
    .flatMap((answer) =>
      answer.citations.map(
        (citation) =>
          `- ${escapeMarkdown(citation.documentName)}${citation.sourceRef ? ` (${escapeMarkdown(citation.sourceRef)})` : ""}: ${escapeMarkdown(citation.snippet)}`,
      ),
    )
    .join("\n");
}

export function formatProjectStudyMarkdown(project: ProjectRecord) {
  const lines: string[] = [
    `# ${project.name} Study Export`,
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Saved Answers",
  ];

  if (project.savedAnswers.length === 0) {
    lines.push("- No saved answers yet.");
  } else {
    for (const answer of project.savedAnswers) {
      lines.push(
        `### ${escapeMarkdown(answer.question)}`,
        "",
        escapeMarkdown(answer.answer),
        "",
        `Created: ${new Date(answer.createdAt).toLocaleString()}`,
        "",
      );

      if (answer.citations.length > 0) {
        lines.push("Citations:");
        for (const citation of answer.citations) {
          lines.push(
            `- ${escapeMarkdown(citation.documentName)}${citation.sourceRef ? ` (${escapeMarkdown(citation.sourceRef)})` : ""}: ${escapeMarkdown(citation.snippet)}`,
          );
        }
        lines.push("");
      }
    }
  }

  lines.push("## Notes");
  if (project.notes.length === 0) {
    lines.push("- No notes yet.");
  } else {
    for (const note of project.notes) {
      lines.push(
        `### ${escapeMarkdown(note.title)}`,
        "",
        escapeMarkdown(note.body),
        "",
        `Created: ${new Date(note.createdAt).toLocaleString()}`,
        "",
      );
    }
  }

  lines.push("## Bookmarks");
  if (project.bookmarks.length === 0) {
    lines.push("- No bookmarks yet.");
  } else {
    for (const bookmark of project.bookmarks) {
      lines.push(
        `- ${escapeMarkdown(bookmark.documentName)}: ${escapeMarkdown(bookmark.label)}`,
      );
    }
  }

  lines.push("", "## Highlights");
  if (project.highlights.length === 0) {
    lines.push("- No highlights yet.");
  } else {
    for (const highlight of project.highlights) {
      lines.push(
        `- ${escapeMarkdown(highlight.documentName)} (${highlight.color}): ${escapeMarkdown(highlight.snippet)}`,
      );
    }
  }

  const citations = formatCitations(project);
  if (citations) {
    lines.push("", "## Citation Index", citations);
  }

  return lines.join("\n");
}

export function formatProjectBackupJson(project: ProjectRecord) {
  return JSON.stringify(
    {
      exportType: "project-backup",
      generatedAt: new Date().toISOString(),
      project,
    },
    null,
    2,
  );
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/plain;charset=utf-8") {
  if (typeof document === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
