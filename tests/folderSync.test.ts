import { describe, expect, it } from "vitest";

import { buildFolderWatchSignature, filterImportableFolderEntries } from "../src/lib/folderSync";
import type { NativeDirectoryEntryRecord } from "../src/lib/types";

function buildEntries(count: number, overrides?: Partial<NativeDirectoryEntryRecord>) {
  return Array.from({ length: count }, (_, index) => ({
    name: `chapter-${index + 1}.pdf`,
    path: `/study/course/chapter-${index + 1}.pdf`,
    isDirectory: false,
    size: 1000 + index,
    modified: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    ...overrides,
  }));
}

describe("folder synchronization", () => {
  it("builds a stable signature for large folder imports", () => {
    const entries = [
      ...buildEntries(250),
      { name: "notes.txt", path: "/study/course/notes.txt", isDirectory: false, size: 10 },
      {
        name: "ignored-folder",
        path: "/study/course/ignored-folder",
        isDirectory: true,
        size: 0,
      },
      { name: "draft.epub", path: "/study/course/draft.epub", isDirectory: false, size: 55 },
    ] satisfies NativeDirectoryEntryRecord[];

    const signature = buildFolderWatchSignature(entries);

    expect(signature.length).toBeGreaterThan(0);
    expect(signature).toContain("/study/course/chapter-1.pdf");
    expect(signature).toContain("/study/course/draft.epub");
    expect(signature).not.toContain("ignored-folder");
  });

  it("changes when a tracked source file is modified", () => {
    const baseEntries = buildEntries(200);
    const modifiedEntries = baseEntries.map((entry) =>
      entry.path === "/study/course/chapter-117.pdf"
        ? {
            ...entry,
            size: (entry.size ?? 0) + 99,
          }
        : entry,
    );

    const baseSignature = buildFolderWatchSignature(baseEntries);
    const modifiedSignature = buildFolderWatchSignature(modifiedEntries);

    expect(baseSignature).not.toEqual(modifiedSignature);
  });

  it("filters only supported importable files", () => {
    const entries: NativeDirectoryEntryRecord[] = [
      { name: "readme.md", path: "/study/course/readme.md", isDirectory: false },
      { name: "slides.pptx", path: "/study/course/slides.pptx", isDirectory: false },
      { name: "lecture.pdf", path: "/study/course/lecture.pdf", isDirectory: false },
      { name: "folder", path: "/study/course/folder", isDirectory: true },
    ];

    const filtered = filterImportableFolderEntries(entries);

    expect(filtered.map((entry) => entry.name)).toEqual(["readme.md", "lecture.pdf"]);
  });
});
