import { describe, expect, it } from "vitest";

import { answerFromSources, retrieveRelevantChunks } from "../src/lib/retrieval";
import { prepareImportedDocument } from "../src/lib/textProcessing";
import type { ProjectDocument } from "../src/lib/types";

function buildDocument(
  name: string,
  text: string,
  sections?: Array<{ text: string; sourceRef?: string }>,
): ProjectDocument {
  const prepared = prepareImportedDocument({ name }, text, "Imported text", "indexed", 180, sections);

  return {
    id: name,
    name,
    kind: "pdf",
    sourceLabel: name,
    sourcePath: `/tmp/${name}`,
    status: "indexed",
    importedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    ...prepared,
  };
}

describe("retrieval and grounding", () => {
  it("prioritizes the most relevant source chunk", () => {
    const airplaneDoc = buildDocument(
      "airplane-design.pdf",
      "Wing shape affects lift, drag, and stability. Airfoils are designed to optimize airflow over the wing.",
    );
    const unrelatedDoc = buildDocument(
      "history-notes.pdf",
      "This chapter covers medieval trade routes and city growth.",
    );

    const matches = retrieveRelevantChunks("why are wings designed this way", [
      airplaneDoc,
      unrelatedDoc,
    ]);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].document.name).toBe("airplane-design.pdf");
  });

  it("keeps large projects from over-representing one noisy document", () => {
    const repeatedDoc = buildDocument(
      "airplane-handbook.pdf",
      [
        "Wing lift depends on airfoil shape and angle of attack.",
        "Wing lift depends on airfoil shape and angle of attack.",
        "Wing lift depends on airfoil shape and angle of attack.",
        "Wing lift depends on airfoil shape and angle of attack.",
      ].join("\n\n"),
    );
    const supportingDoc = buildDocument(
      "aerodynamics-notes.pdf",
      [
        "Lift is produced when the wing redirects airflow downward.",
        "Drag increases when the wing shape or angle of attack creates more resistance.",
      ].join("\n\n"),
    );

    const matches = retrieveRelevantChunks("why does the wing need this shape", [
      repeatedDoc,
      supportingDoc,
    ]);

    const repeatedDocMatches = matches.filter(
      (match) => match.document.name === "airplane-handbook.pdf",
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(repeatedDocMatches.length).toBeLessThanOrEqual(2);
    expect(matches.some((match) => match.document.name === "aerodynamics-notes.pdf")).toBe(true);
  });

  it("answers only from the uploaded sources and includes citations", () => {
    const constructionDoc = buildDocument(
      "airplane-construction.pdf",
      "Wings are shaped to generate lift efficiently while minimizing drag and structural weight.",
      [
        {
          text: "Wings are shaped to generate lift efficiently while minimizing drag and structural weight.",
          sourceRef: "Page 12",
        },
      ],
    );
    const designDoc = buildDocument(
      "airplane-design-book.epub",
      "Wing geometry balances lift, stability, fuel efficiency, and controllability.",
      [
        {
          text: "Wing geometry balances lift, stability, fuel efficiency, and controllability.",
          sourceRef: "Chapter 4",
        },
      ],
    );

    const answer = answerFromSources("why are the wings designed the way they are", [
      constructionDoc,
      designDoc,
    ]);

    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.content).toContain("Based on the indexed sources");
    expect(answer.content).toContain("Wing geometry");
    expect(answer.content).toContain("Wings are shaped");
    expect(answer.citations[0].sourceRef).toBeTruthy();
  });

  it("keeps page and chapter citations intact for mixed source projects", () => {
    const pdfDoc = buildDocument(
      "airplane-construction.pdf",
      "Wing sweep improves cruise efficiency by reducing wave drag and balancing stability.",
      [
        {
          text: "Wing sweep improves cruise efficiency by reducing wave drag and balancing stability.",
          sourceRef: "Page 21",
        },
      ],
    );
    const ebookDoc = buildDocument(
      "airplane-design-book.epub",
      "Wing planform influences lift distribution, stall behavior, and control response.",
      [
        {
          text: "Wing planform influences lift distribution, stall behavior, and control response.",
          sourceRef: "Chapter 7",
        },
      ],
    );

    const answer = answerFromSources("why do wings use sweep and planform changes", [
      pdfDoc,
      ebookDoc,
    ]);

    const sourceRefs = answer.citations.map((citation) => citation.sourceRef).filter(Boolean);

    expect(sourceRefs).toContain("Page 21");
    expect(sourceRefs).toContain("Chapter 7");
    expect(answer.content).toContain("Wing sweep improves cruise efficiency");
    expect(answer.content).toContain("Wing planform influences lift distribution");
  });

  it("refuses to guess when the sources do not support the question", () => {
    const historyDoc = buildDocument(
      "history-notes.pdf",
      "This chapter describes trade routes, city growth, and medieval markets.",
    );

    const answer = answerFromSources("how does wing sweep improve cruise performance", [
      historyDoc,
    ]);

    expect(answer.citations).toEqual([]);
    expect(answer.content).toContain("I could not find enough support");
  });
});
