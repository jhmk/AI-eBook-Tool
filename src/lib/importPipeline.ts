import JSZip from "jszip";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerSrc from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

import type { DocumentStatus } from "./types";
import type { DocumentTextSection } from "./textProcessing";
import { buildChunksForDocument } from "./textProcessing";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export interface ImportedTextResult {
  text: string;
  note: string;
  status: DocumentStatus;
  sections?: DocumentTextSection[];
}

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "log"]);

function extensionForFile(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function cleanPdfText(value: string) {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function normalizeBodyText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractPdfStrings(raw: string) {
  const matches: string[] = [];
  const regex = /\(([^()]|\\\(|\\\)|\\n|\\r|\\t|\\\d{3}){1,200}\)\s*T[Jj]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    const captured = match[0]
      .replace(/\)\s*T[Jj]$/, "")
      .replace(/^\(/, "")
      .replace(/\)$/, "");
    matches.push(cleanPdfText(captured));
  }

  return matches;
}

async function readPdfText(file: File): Promise<ImportedTextResult> {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    const pages: DocumentTextSection[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => {
          const candidate = item as { str?: string };
          return candidate.str ?? "";
        })
        .join(" ")
        .trim();

      if (pageText) {
        pages.push({
          text: pageText,
          sourceRef: `Page ${pageNumber}`,
        });
      }
    }

    const text = normalizeBodyText(pages.map((page) => page.text).join("\n\n"));
    if (text) {
      return {
        text,
        note: "Imported from PDF with PDF.js text extraction.",
        status: "indexed" as DocumentStatus,
        sections: pages,
      };
    }
  } catch {
    // Fall through to the legacy string extractor below.
  }

  const buffer = await file.arrayBuffer();
  const raw = new TextDecoder("iso-8859-1").decode(buffer);
  const strings = extractPdfStrings(raw);

  if (strings.length > 0) {
    return {
      text: strings.join("\n"),
      note: "Imported from PDF with a fallback local text extraction path.",
      status: "indexed" as DocumentStatus,
      sections: [
        {
          text: strings.join("\n"),
          sourceRef: "PDF text fallback",
        },
      ],
    };
  }

  return {
    text: "",
    note: "PDF imported, but text extraction did not find readable content.",
    status: "error" as DocumentStatus,
  };
}

async function readPlainText(file: File): Promise<ImportedTextResult> {
  const text = await file.text();
  return {
    text,
    note: "Imported as plain text.",
    status: "indexed" as DocumentStatus,
    sections: [
      {
        text,
      },
    ],
  };
}

function parseXmlString(contents: string) {
  return new DOMParser().parseFromString(contents, "application/xml");
}

function parseHtmlString(contents: string) {
  return new DOMParser().parseFromString(contents, "text/html");
}

function extractTextFromHtml(contents: string) {
  const document = parseHtmlString(contents);
  const bodyText = document.body?.textContent ?? document.documentElement?.textContent ?? "";
  return normalizeBodyText(bodyText);
}

function extractReadableTextFromLegacyBinary(raw: string) {
  return normalizeBodyText(
    raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[\u0000-\u001f]+/g, " "),
  );
}

async function readLegacyEbookText(file: File): Promise<ImportedTextResult> {
  const buffer = await file.arrayBuffer();
  const raw = new TextDecoder("iso-8859-1").decode(buffer);
  const text = extractReadableTextFromLegacyBinary(raw);

  if (text.length >= 200) {
    return {
      text,
      note: "Imported with a best-effort local ebook text fallback.",
      status: "indexed" as DocumentStatus,
      sections: [
        {
          text,
          sourceRef: "Legacy ebook text",
        },
      ],
    };
  }

  return {
    text: "",
    note: "This ebook format still needs a stronger native conversion path.",
    status: "queued" as DocumentStatus,
  };
}

async function readEpubText(file: File): Promise<ImportedTextResult> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const container = zip.file("META-INF/container.xml");
    const containerXml = container ? await container.async("text") : "";
    const containerDoc = containerXml ? parseXmlString(containerXml) : null;
    const rootfilePath =
      containerDoc?.querySelector("rootfile")?.getAttribute("full-path") ?? null;

    let orderedContentPaths: string[] = [];

    if (rootfilePath) {
      const packageFile = zip.file(rootfilePath);
      const packageXml = packageFile ? await packageFile.async("text") : "";
      const packageDoc = packageXml ? parseXmlString(packageXml) : null;
      const manifest = new Map<string, string>();
      const spineIds =
        packageDoc?.querySelectorAll("spine itemref")?.length
          ? Array.from(packageDoc.querySelectorAll("spine itemref"))
          : [];

      packageDoc?.querySelectorAll("manifest item").forEach((item) => {
        const id = item.getAttribute("id");
        const href = item.getAttribute("href");
        if (id && href) {
          manifest.set(id, href);
        }
      });

      const basePath = rootfilePath.includes("/")
        ? rootfilePath.split("/").slice(0, -1).join("/")
        : "";
      orderedContentPaths = spineIds
        .map((item) => item.getAttribute("idref"))
        .map((idref) => (idref ? manifest.get(idref) : null))
        .filter((href): href is string => Boolean(href))
        .map((href) => (basePath ? `${basePath}/${href}` : href));
    }

    if (orderedContentPaths.length === 0) {
      orderedContentPaths = Object.keys(zip.files)
        .filter((path) => /\.(xhtml?|html?)$/i.test(path))
        .sort();
    }

    const chapters: DocumentTextSection[] = [];
    let chapterNumber = 1;
    for (const contentPath of orderedContentPaths) {
      const entry = zip.file(contentPath);
      if (!entry) {
        continue;
      }

      const html = await entry.async("text");
      const text = extractTextFromHtml(html);
      if (text) {
        chapters.push({
          text,
          sourceRef: `Chapter ${chapterNumber}`,
        });
        chapterNumber += 1;
      }
    }

    const text = normalizeBodyText(chapters.map((chapter) => chapter.text).join("\n\n"));
    if (text) {
      return {
        text,
        note: "Imported from EPUB with local archive extraction.",
        status: "indexed" as DocumentStatus,
        sections: chapters,
      };
    }

    return {
      text: "",
      note: "EPUB imported, but no readable chapters were found.",
      status: "error" as DocumentStatus,
    };
  } catch {
    return {
      text: "",
      note: "EPUB import failed in the local extractor.",
      status: "error" as DocumentStatus,
    };
  }
}

export async function readImportedText(file: File): Promise<ImportedTextResult> {
  const extension = extensionForFile(file.name);

  if (TEXT_EXTENSIONS.has(extension)) {
    return readPlainText(file);
  }

  if (extension === "pdf") {
    return readPdfText(file);
  }

  if (extension === "epub") {
    return readEpubText(file);
  }

  if (extension === "mobi" || extension === "azw3") {
    return readLegacyEbookText(file);
  }

  return {
    text: "",
    note: "Unsupported format in the current local import pipeline.",
    status: "error" as DocumentStatus,
  };
}

export { chunkText, prepareImportedDocument } from "./textProcessing";
