import { describe, expect, it } from "vitest";

import { chunkText, prepareImportedDocument } from "../src/lib/textProcessing";

describe("text processing", () => {
  it("chunks long study text into multiple source chunks", () => {
    const text = [
      "Wing design balances lift, drag, and structural load.",
      "A longer wing can improve lift efficiency.",
      "Control surfaces help the aircraft maneuver safely.",
      "Materials and spars determine how much load the wing can carry.",
    ].join("\n\n");

    const chunks = chunkText(text, 60);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text).toContain("Wing design");
    expect(chunks[0].termWeights).toBeTruthy();
  });

  it("prepares imported study documents with chunk metadata", () => {
    const prepared = prepareImportedDocument(
      { name: "airplane-construction.pdf" },
      "Lift depends on airfoil shape and wing loading.",
      "Imported from PDF with PDF.js text extraction.",
      "indexed",
      120,
    );

    expect(prepared.status).toBe("indexed");
    expect(prepared.chunkCount).toBe(1);
    expect(prepared.chunks[0].sourceLabel).toBe("airplane-construction.pdf");
    expect(prepared.extractedText).toContain("airfoil shape");
  });
});
