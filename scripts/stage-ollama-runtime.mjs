import { mkdir, readdir, rm, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourceDir = process.argv[2] ?? process.env.AI_EBOOK_TOOL_OLLAMA_SOURCE;
const destinationDir = path.resolve("src-tauri/runtime/ollama");

if (!sourceDir) {
  console.error(
    "Usage: node scripts/stage-ollama-runtime.mjs <ollama-runtime-folder> or set AI_EBOOK_TOOL_OLLAMA_SOURCE",
  );
  process.exit(1);
}

async function copyRecursive(from, to) {
  const fromStat = await stat(from);
  if (fromStat.isDirectory()) {
    await mkdir(to, { recursive: true });
    const entries = await readdir(from, { withFileTypes: true });
    for (const entry of entries) {
      await copyRecursive(path.join(from, entry.name), path.join(to, entry.name));
    }
    return;
  }

  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(from, to);
}

async function main() {
  await rm(destinationDir, { recursive: true, force: true });
  await mkdir(destinationDir, { recursive: true });
  await copyRecursive(path.resolve(sourceDir), destinationDir);
  console.log(`Staged Ollama runtime from ${path.resolve(sourceDir)} to ${destinationDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
