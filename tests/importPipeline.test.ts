import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { readImportedText } from "../src/lib/importPipeline";

type XmlAttrs = Record<string, string>;

class MockXmlElement {
  constructor(private attrs: XmlAttrs) {}

  getAttribute(name: string) {
    return this.attrs[name] ?? null;
  }
}

class MockXmlDocument {
  constructor(private contents: string) {}

  querySelector(selector: string) {
    if (selector === "rootfile") {
      const match = this.contents.match(/<rootfile[^>]*full-path="([^"]+)"/i);
      return match ? new MockXmlElement({ "full-path": match[1] }) : null;
    }

    return null;
  }

  querySelectorAll(selector: string) {
    if (selector === "spine itemref") {
      return Array.from(this.contents.matchAll(/<itemref[^>]*idref="([^"]+)"/gi)).map(
        (match) => new MockXmlElement({ idref: match[1] }),
      );
    }

    if (selector === "manifest item") {
      return Array.from(
        this.contents.matchAll(/<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"/gi),
      ).map((match) => new MockXmlElement({ id: match[1], href: match[2] }));
    }

    return [];
  }
}

class MockHtmlDocument {
  body: { textContent: string };
  documentElement: { textContent: string };

  constructor(contents: string) {
    const stripped = contents
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    this.body = { textContent: stripped };
    this.documentElement = { textContent: stripped };
  }
}

class MockDOMParser {
  parseFromString(contents: string, type: string) {
    if (type === "text/html") {
      return new MockHtmlDocument(contents);
    }

    return new MockXmlDocument(contents);
  }
}

const originalDomParser = globalThis.DOMParser;

beforeAll(() => {
  Object.defineProperty(globalThis, "DOMParser", {
    configurable: true,
    writable: true,
    value: MockDOMParser,
  });
});

afterAll(() => {
  Object.defineProperty(globalThis, "DOMParser", {
    configurable: true,
    writable: true,
    value: originalDomParser,
  });
});

describe("import pipeline", () => {
  it("reads plain text imports with indexed metadata", async () => {
    const file = new File(["Wing lift depends on airfoil shape."], "course-notes.txt", {
      type: "text/plain",
    });

    const imported = await readImportedText(file);

    expect(imported.status).toBe("indexed");
    expect(imported.note).toContain("plain text");
    expect(imported.text).toContain("airfoil shape");
    expect(imported.sections?.[0].sourceRef).toBeUndefined();
  });

  it("falls back to local PDF string extraction when needed", async () => {
    const pdfLike = `%PDF-1.4
1 0 obj
<< /Length 44 >>
stream
BT
(Wing design balances lift and drag.) Tj
ET
endstream
endobj`;
    const file = new File([pdfLike], "airplane.pdf", { type: "application/pdf" });

    const imported = await readImportedText(file);

    expect(imported.status).toBe("indexed");
    expect(imported.note).toContain("fallback local text extraction path");
    expect(imported.text).toContain("Wing design balances lift and drag.");
    expect(imported.sections?.[0].sourceRef).toBe("PDF text fallback");
  });

  it("reads EPUB imports in spine order and keeps source text", async () => {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0"?>
      <container version="1.0">
        <rootfiles>
          <rootfile full-path="OEBPS/content.opf" />
        </rootfiles>
      </container>`,
    );
    zip.file(
      "OEBPS/content.opf",
      `<?xml version="1.0"?>
      <package version="3.0">
        <manifest>
          <item id="chap1" href="chapter1.xhtml" />
          <item id="chap2" href="chapter2.xhtml" />
        </manifest>
        <spine>
          <itemref idref="chap1" />
          <itemref idref="chap2" />
        </spine>
      </package>`,
    );
    zip.file(
      "OEBPS/chapter1.xhtml",
      "<html><body><h1>Wing structure</h1><p>Wings are shaped for lift.</p></body></html>",
    );
    zip.file(
      "OEBPS/chapter2.xhtml",
      "<html><body><p>They also balance drag and stability.</p></body></html>",
    );

    const file = new File([await zip.generateAsync({ type: "uint8array" })], "airplane.epub", {
      type: "application/epub+zip",
    });

    const imported = await readImportedText(file);

    expect(imported.status).toBe("indexed");
    expect(imported.note).toContain("EPUB");
    expect(imported.text).toContain("Wing structure");
    expect(imported.text).toContain("They also balance drag and stability.");
    expect(imported.text.indexOf("Wing structure")).toBeLessThan(
      imported.text.indexOf("They also balance drag and stability."),
    );
    expect(imported.sections?.[0].sourceRef).toBe("Chapter 1");
    expect(imported.sections?.[1].sourceRef).toBe("Chapter 2");
  });

  it("uses the best-effort ebook fallback for MOBI-style content", async () => {
    const file = new File(
      [
        "<html><body>Wing loading and airfoil geometry support efficient flight. ".repeat(6),
      ],
      "airplane.mobi",
      { type: "application/octet-stream" },
    );

    const imported = await readImportedText(file);

    expect(imported.status).toBe("indexed");
    expect(imported.note).toContain("best-effort local ebook text fallback");
    expect(imported.text).toContain("Wing loading");
    expect(imported.sections?.[0].sourceRef).toBe("Legacy ebook text");
  });
});
