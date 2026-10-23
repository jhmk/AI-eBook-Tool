# Agent Handoff (AI eBook Tool)

This file is for AI agents working on this repo. You are not alone in this codebase. Avoid destructive actions and avoid reverting changes you did not make.

## Purpose

Build a local-first desktop app that lets non-technical users import multiple PDFs/ebooks into projects and ask questions grounded in those sources, with citations.

## Current Stack (Baseline)

- Desktop shell: Tauri (Rust)
- UI: React + TypeScript + Vite
- Local AI runtime: app-managed Ollama first (other local providers later)
- Data: local, project-scoped storage (no cloud required for MVP)

## Current State

- The React app now has working local project storage, create/open/rename/delete flows, import stubs, local text chunking, cited answers, project/source filtering, and a simple settings UI composed from feature modules.
- The core workflow is a student-style study assistant: upload multiple PDFs and ebooks into one project, ask plain-language questions, and get answers grounded only in those uploaded sources.
- The MVP now has a concrete acceptance checklist: launch without terminal setup, add multiple documents to one project, combine evidence across sources, show citations, keep projects isolated, and clearly refuse unsupported answers.
- The default local model name is now `gemma3:1b`, which is the app's first-run Ollama target unless the user changes it in settings.
- The app now attempts to start Ollama automatically, and if the runtime binary is missing it downloads and unpacks it into the app data directory before pulling `gemma3:1b`.
- The runtime bootstrap now also prefers a bundled Ollama binary path when one is shipped by the installer, including the macOS `Ollama.app` executable layout, and the Tauri bundle config is wired to include a `runtime/ollama` resource folder, which is the next step toward a fully install-free experience.
- A staging helper script now exists to copy a pre-downloaded Ollama runtime folder into `src-tauri/runtime/ollama` before packaging.
- The local AI status UI now shows a progress bar in the main shell and in Settings, and it falls back to periodic status inspection so startup does not get stuck on an early snapshot.
- The Tauri backend now has basic module scaffolding for commands, services, and model adapters, and it also owns the first native persistence commands for app state/config. The remaining work is to expand the command surface for files, import jobs, and model integration.
- Native import job records are now persisted in Rust, surfaced in the UI, and paired with a simple directory listing command. The active import path now routes batches through a native Rust command that extracts text and chunks documents before the frontend stores them.
- The user can now see upload-analysis progress for active imports in the main shell and in the Sources panel, which is useful for large PDFs while they are being processed.
- Derived project index data is now stored separately from the React app shell state in native per-project index files.
- Plain text, PDF, EPUB, and best-effort MOBI/AZW3 importing are handled through the native batch processor first, with a browser fallback only if the native path is unavailable.
- OCR now has a native backend wiring path: the importer reads the OCR mode from persisted config, attempts OCR for scanned PDFs when appropriate, and falls back cleanly when no OCR engine is available.
- Question answering now has a real local LLM path: the UI retrieves grounded chunks, then calls the native Ollama chat endpoint when the provider is set to Ollama or the native local model option.
- Search now uses a hybrid lexical plus vector embedding score over chunks, so retrieval is no longer keyword-only.
- Retrieval now also includes coverage-aware scoring and a per-document cap so large libraries do not over-represent a single noisy source.
- Study artifacts now persist per project as local notes, highlights, bookmarks, and saved answers, with basic UI actions from the chat panel and a dedicated study view.
- Study items can now be searched, edited, and exported, and active projects can be backed up as JSON.
- The current best-practice direction is to keep import jobs resumable, OCR optional, retrieval explicit, and the reading UX calm and project-based.
- The project/document state now uses explicit local data contracts, persisted app settings, and a frontend bridge to native storage commands. File selection still starts in the React layer, but import extraction and chunking now execute natively.
- Automated unit tests now exist for text chunking, project document preparation, retrieval ranking, source-grounded answer refusal, folder watch signatures, and mixed PDF/ebook citations; packaging verification, runtime installer bundling, retrieval tuning, and large-source validation remain open.
- The import progress now updates in real-time (fixed from being stuck at 15%) by emitting events from the Rust backend to the frontend.
- A cancel button is available for import jobs to stop stuck or unwanted imports.
- The app now has a loading screen during hydration to prevent flash of empty content.
- Text processing now uses LRU caching for tokenization, term weights, and embeddings to improve performance.
- The retrieval module caches chunk metadata to avoid re-computing embeddings on every query.
- The UI has been modernized with CSS custom properties, gradient backgrounds, glow effects, custom scrollbars, smooth transitions, and improved card styling.

## Repo Map (Key Files/Folders)

- `project-todos.md`: product goals, roadmap, MVP spec (treat as source of truth for scope)
- `README.md`: quick orientation
- `src/`: React UI scaffold
- `src-tauri/`: Tauri scaffold with native persistence commands and service/model structure
- `package.json`: frontend tooling/scripts
- `src/features/`: UI feature modules for projects, import, chat, documents, and settings
- `src/features/study/StudyPanel.tsx`: project-scoped notes, highlights, bookmarks, and saved answers
- `src-tauri/src/commands/`: backend command scaffolding
- `src-tauri/src/commands/index.rs`: native project index persistence commands
- `src-tauri/src/commands/import.rs`: native import job persistence commands
- `src-tauri/src/commands/files.rs`: native directory listing helper
- `src-tauri/src/services/`: backend service scaffolding
- `src-tauri/src/services/import_jobs.rs`: resumable import-job storage
- `src-tauri/src/services/import.rs`: native import extraction, chunking, and batch completion
- `src-tauri/src/services/index.rs`: native project index persistence
- `src-tauri/src/services/ocr.rs`: OCR backend selection and scanned-PDF fallback wiring
- `src-tauri/src/models/`: provider adapter scaffolding
- `src-tauri/src/models/imports.rs`: native import payload and result records
- `src-tauri/src/models/index.rs`: native project index record
- `src-tauri/src/models/files.rs`: native directory entry record
- `src/lib/nativeBridge.ts`: frontend bridge for native persistence commands
- `src/lib/modelRuntime.ts`: frontend helper for app-managed local model preparation
- `src/lib/llm.ts`: grounded answer orchestration that falls back to source summaries when needed
- `src/lib/study.ts`: helpers for study artifacts such as notes, bookmarks, highlights, and saved answers

## What To Do First (Highest Leverage)

1. Implement the import pipeline as a resumable job system:
   - separate raw input, intermediate OCR/extraction output, and final indexed data
   - keep import state and errors persisted per project
2. Keep the user experience simple:
   - preserve welcome/onboarding
   - show clear import and indexing progress
   - keep project and settings flows obvious for non-technical users
3. Keep feature modules thin and composable:
   - project sidebar, chat panel, source panel, import actions, settings panel
   - favor small prop-driven React components over a single monolith

## Open Steps

- Package the bundled runtime payload into the installers so the app ships without a separate Ollama install step.
- Use the staging helper to place a platform Ollama runtime into `src-tauri/runtime/ollama` before building installers.
- Add macOS packaging and release verification.
- Add Windows packaging and compatibility verification.
- Tune the hybrid retrieval path on larger book sets, including the document-diversity cap and embedding balance.
- Stress test folder reindexing on large native folder imports.
- Stress test page-level citations on mixed PDF and ebook projects.
- Add large-source validation for the local AI startup progress flow and the import-analysis progress bars.
- Add folder-change tests and page-level citation tests for the student workflow.
- Add toast notifications for user feedback (project created, files imported, etc.).
- Add custom modals for delete confirmations instead of browser dialogs.

## Recent Fixes And Improvements

### Bug Fixes
- Fixed "Preparing local AI" progress bar stuck at 15% by adding the missing `prepareLocalModel` call in App.tsx.
- Fixed import progress stuck at 15% by adding event emission in Rust backend (`import_jobs.rs`) and frontend event listener.

### UI/UX Enhancements
- Modern dark theme with CSS custom properties for consistent theming.
- Gradient backgrounds and glow effects on buttons.
- Custom scrollbar styling.
- Loading screen with animated spinner during app hydration.
- Improved card styling with backdrop blur and subtle shadows.
- Better hover states and smooth transitions.
- Gradient text for headings.
- Cancel button for import jobs with distinctive styling.

### Performance Optimizations
- Added LRU caching for `tokenize()`, `buildTermWeights()`, and `buildEmbeddingVector()` functions in `textProcessing.ts`.
- Added chunk metadata cache in retrieval module (`retrieval.ts`) to avoid re-computing embeddings.
- Added loading state to prevent flash of empty content.

## Guardrails (Do Not Break These)

- Do not introduce a workflow that requires users to use the terminal for normal operation.
- Keep everything local-first and project-scoped.
- Answers must be source-grounded with citations (no "freeform" answers presented as fact).
- Preserve cross-platform assumptions (macOS first, Windows later) by avoiding OS-specific paths/behavior.

## Collaboration Rules (Avoid Conflicts)

- Do not revert or overwrite changes you did not make. If something looks wrong, add a follow-up commit that fixes it or raise it explicitly.
- Keep commits small and single-purpose with clear messages.
- Prefer additive changes over large refactors until the first vertical slice works.
- Before changing architecture or stack choices, align with `project-todos.md` and update it in the same commit (unless explicitly told not to).
- Avoid renaming/moving many files at once; it creates merge conflicts for other agents.
- If you add or change UI settings that affect behavior, update the roadmap checklist to match the implementation status.
- When borrowing ideas from external repos, prefer architecture patterns and UX behavior over direct code unless the license is explicitly compatible and the code is narrowly useful.
