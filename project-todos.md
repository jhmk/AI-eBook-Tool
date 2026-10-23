# AI eBook Tool

Local-first app for searching and asking questions about the content of ebooks and PDFs.

## Primary Use Case

- A student uploads multiple PDFs and ebooks for a course or study topic into one project.
- The app indexes all uploaded documents locally and lets the student ask questions in plain language.
- The app answers using only the uploaded documents, synthesizing across sources when needed.
- Example: an engineering student uploads a PDF about airplane construction and an ebook about airplane design, then asks why the wings are designed that way.
- The answer must cite the passages that support it so the student can verify the result.

## Product Goals

- Works locally on macOS first, then Windows as a second step.
- Everything needed to import, search, and answer questions should run inside the app, without requiring users to manage technical setup.
- The app should automatically prepare its local AI runtime and default model on first launch.
- The app should later work natively on both macOS and Windows.
- The experience must stay simple enough for non-technical users.
- Lets users create multiple projects, each with its own books, folders, and settings.
- Supports uploading individual ebooks/PDFs or indexing a whole folder.
- Answers questions based on the selected content using a local LLM or AI model, with answers grounded in the user’s uploaded documents.
- Targets students and scientists who need grounded answers from books and papers.

## Student Requirements

### Must Have

- Answer questions only from the uploaded documents by default.
- Show citations for every answer with source name and page or chunk reference.
- Support multiple documents in the same project.
- Keep projects isolated so different classes, topics, or research areas do not mix.
- Work locally on the user’s device without requiring terminal usage for normal operation.
- Show clear indexing and import progress.
- Tell the user when there is not enough evidence in the sources.

### Should Have

- Search across all uploaded books and PDFs in a project.
- Support follow-up questions in the same conversation.
- Support folder import for course or research folders.
- Support OCR for scanned PDFs and lecture notes.
- Let the user highlight, bookmark, and save answers or excerpts.
- Let the user export notes, highlights, citations, and answers for studying.
- Let the user reopen the cited source passage from an answer.
- Show live progress for local AI startup and for active PDF/ebook analysis.

### Later

- Flashcard generation from notes and highlights.
- Quiz mode based on uploaded documents.
- Topic maps or concept graphs for a project.
- Smart tags for documents such as lecture, paper, reference, or exam.
- Compare two documents on the same topic.
- Voice input for asking questions.

### Not In Scope For MVP

- Cloud sync.
- Social sharing or collaboration.
- General web search answers mixed into source-grounded answers.
- Complex authoring or publishing workflows.

## Useful Features To Include

- Source citations with page numbers or passage references.
- Full-text and semantic search across all imported documents.
- Project-specific knowledge bases so content stays isolated.
- OCR for scanned PDFs and image-based pages.
- Document metadata extraction and filtering by author, title, year, tag, or topic.
- Highlighting, notes, bookmarks, and saved Q&A for study workflows.
- Export of answers, notes, and citations to Markdown, PDF, or DOCX.
- Folder watch/import sync so new files can be indexed automatically.
- Confidence indicators and "I could not find this in the sources" behavior.
- Conversation history per project.
- Offline mode and privacy-first storage.
- Optional cloud sync later, but not part of the first version.

## Roadmap

### Stack Decision

- Desktop shell: Tauri
- UI: React + TypeScript + Vite
- Local model runtime: app-managed Ollama first, with `gemma3:1b` as the default model
- Retrieval and file processing: local-first, project-scoped, and offline-capable
- The app should remain fully usable without requiring the user to touch terminal commands or external developer tools.
- The app should automatically start and prepare the local model for first-run use.
- The runtime bootstrap should prefer a bundled Ollama binary when the installer ships one, and fall back to the cached app-managed runtime only when needed.
- The same product should be packaged as a native desktop app for macOS and Windows.

### Product Principles

- Local-first by default.
- Simple enough for non-technical users.
- Project-based organization over global settings.
- Answers must be grounded in user-provided sources.
- macOS comes first, Windows follows without a redesign.

### Milestone 0: Product Definition

- Finalize the MVP scope.
- Decide which file formats are supported first.
- Decide how the local model is launched and configured inside the app.
- Define the core data model for projects, documents, chunks, and chat history.

Success criteria:

- A clear MVP spec exists.
- The app can be built without unresolved product or architecture decisions.

## MVP Spec

### MVP Scope

- Local desktop app for macOS first.
- Native Windows support later without changing the workflow.
- Import PDFs and common ebook formats into a project.
- Support adding a folder as a source.
- Index imported content locally.
- Ask questions against one selected project.
- Return answers with citations to source passages.
- Keep the experience simple enough for non-technical users.

### Screen Flow

#### 1. First Launch

- Show a short welcome screen.
- Explain that everything stays local on the user’s device.
- Offer two main actions: create a project or open an existing one.
- If no projects exist, guide the user into the first project setup.

#### 2. Project List

- Show all projects in a simple list.
- Display the project name, number of documents, and last updated status.
- Let the user create, rename, duplicate, or delete a project.
- Let the user search projects if the list becomes large.

#### 3. Project Workspace

- Show a left sidebar with documents, folders, and saved items.
- Show the main chat and answer area on the right.
- Show indexing status clearly so users know whether content is ready.
- Keep the layout focused on one project at a time.

#### 4. Import / Add Source

- Let the user upload one or more files.
- Let the user pick a folder to watch or index.
- Show supported file types and an error message if a file cannot be read.
- Show progress while files are being imported and indexed.

#### 5. Ask / Answer

- Let the user type a question in plain language.
- Search the selected project content automatically.
- Generate an answer only from retrieved sources.
- Show citations next to answer paragraphs or bullet points.
- Show a warning when the app cannot find enough evidence.

#### 6. Settings

- Let the user choose the local model runtime, but keep the default path automatic.
- Let the user adjust indexing behavior and storage location.
- Let the user view app version, privacy notes, and data cleanup options.

### Core Data Model

- `AppConfig`: global app settings such as language, model runtime, storage path, and privacy preferences.
- `Project`: user workspace with name, description, created date, and last opened date.
- `ProjectSource`: a file or folder connected to a project.
- `Document`: a parsed ebook or PDF with filename, source path, type, title, author, and page count.
- `DocumentChunk`: a searchable passage with chunk text, page reference, order, and optional section title.
- `EmbeddingRecord`: vector data for a chunk plus embedding metadata.
- `ChatThread`: a project-scoped conversation.
- `ChatMessage`: a user or assistant message within a thread.
- `Citation`: a link from an answer to one or more source chunks.
- `Note`: user annotation tied to a document, chunk, or answer.
- `JobStatus`: indexing, OCR, or export job state with progress and error details.

### First Implementation Tasks

1. Create the app shell and routing structure.
2. Build project creation and project selection.
3. Add local storage for app config and project metadata.
4. Add file import for PDFs.
5. Add folder selection for project sources.
6. Parse text and metadata from imported documents.
7. Split text into chunks and store them locally.
8. Add an initial retrieval layer for search.
9. Add a basic chat UI for asking questions.
10. Connect answers to retrieved chunks with citations.
11. Add indexing status and error handling.
12. Add packaging and launch flow for macOS.

### MVP Acceptance Criteria

- A user can create a project without reading documentation.
- A user can import a PDF and ask a question about it.
- The answer references the imported content with citations.
- The app works entirely from the desktop UI.
- The same product can later be packaged for Windows.

### Concrete MVP Acceptance Tests

- A new user can launch the app, create a project, and reach the workspace without using the terminal.
- A user can add at least two PDFs or ebooks to the same project.
- A user can ask a question that requires combining evidence from both documents.
- The answer includes citations that point back to the imported sources.
- If the answer cannot be supported by the uploaded documents, the app says so clearly instead of guessing.
- Two separate projects keep their documents and answers isolated from each other.
- The app shows import and indexing progress while documents are being processed.
- The app can handle the airplane example from the primary use case using only the uploaded documents.

### Test Plan

#### Manual QA

- Start the app and create a new project without terminal setup.
- Import at least two files of different types into the same project.
- Ask a question that depends on evidence from multiple sources.
- Confirm the answer shows citations and stays inside the active project.
- Switch to a second project and confirm the documents do not mix.
- Use the study view to save, edit, and export an answer or note.

#### Automated Tests

- Chunking and text-preparation tests for imported content.
- Retrieval tests that rank the relevant chunk highest for a question.
- Answer-grounding tests that ensure unsupported questions produce a refusal instead of a guess.
- Import pipeline tests for supported file formats and metadata handling.

#### Remaining Verification Gaps

- Page-level citations for PDF and EPUB sources need coverage.
- Folder watching and automatic reindexing still need test coverage.
- The local AI progress flow should be validated on a real packaged macOS app launch.
- The active document-analysis progress bar should be validated on a large PDF import.
- Packaging and install flows still need end-to-end verification on macOS and Windows.

### Student Workflow Acceptance Checklist

- A student can create one project per course or study topic.
- A student can upload multiple PDFs and ebooks into the same project.
- The app can answer a question by combining evidence from multiple uploaded documents.
- The app shows citations so the student can verify the answer against the books.
- The app can handle a question like "why are the wings designed the way they are?" using only the uploaded airplane documents.
- The app keeps project content isolated so one course does not mix with another.

### Remaining Gaps For This Use Case

- Vector embeddings and hybrid semantic search are implemented, but should still be tuned on larger book sets.
- The runtime bootstrap now supports a bundled Ollama binary path, including the macOS `Ollama.app` executable layout, and the Tauri bundle config is wired to ship a `runtime/ollama` resource folder, but the installer still needs the actual platform binary payload for a fully install-free experience.
- A staging helper script can now copy a pre-downloaded Ollama runtime folder into `src-tauri/runtime/ollama` before packaging.
- macOS packaging is still missing.
- Windows packaging is still missing.
- The main shell now shows progress bars for local AI startup and active import analysis, and the Sources panel mirrors active import progress.
- Native folder watching and automatic reindexing are implemented for native folder paths, but should still be validated on larger source folders.
- Native page-level citations and richer passage references are implemented, and now have mixed-source regression coverage, but still need stress testing on larger source sets.
- Automated tests now cover retrieval, answer grounding, folder watch signatures, and mixed PDF/ebook citations; large-source validation is still needed.
- The native folder refresh path still needs polish for very large projects and repeated reindex cycles.
- Retrieval now uses coverage-aware hybrid scoring and a per-document cap, but it still needs to be checked against realistic student and scientist libraries.

## Technical Architecture Plan

### App Layers

- UI layer: React screens, navigation, forms, state, and presentation.
- App services layer: project management, import orchestration, retrieval workflows, and chat coordination.
- Desktop layer: Tauri commands for filesystem access, background jobs, and native packaging.
- Storage layer: local project folders with metadata, document text, chunks, embeddings, and chat history.
- AI layer: local model provider interface, starting with Ollama and later supporting alternatives.

### Core Workflow

1. User creates or opens a project.
2. User adds PDFs, ebooks, or a folder.
3. The app extracts metadata and text.
4. The app chunks the text and stores it locally.
5. The app generates embeddings and index data.
6. The user asks a question inside that project.
7. The app retrieves relevant passages.
8. The local model writes an answer using those passages.
9. The app shows the answer with citations and source references.

### Native Desktop Boundary

- Use Tauri commands for persistent app state, config, and native file access.
- Keep browser fallback support during development, but treat native storage as the long-term path.
- Store app config and state in a native app-data folder so macOS and Windows builds behave consistently.
- Keep import jobs resumable so large books or scanned PDFs can continue after interruption.
- Persist native import-job records even before the full extraction pipeline moves out of React.

### Data Storage Approach

- Store app and project data locally under a predictable app data directory.
- Keep project metadata separate from raw imported files.
- Keep derived data such as text chunks, embeddings, and search indexes in project-specific storage.
- Preserve source paths and import status so projects can be reindexed later.
- Store chat history per project so conversations remain scoped.

### Search And Answering Approach

- Use keyword search and semantic retrieval together.
- Keep retrieval scoped to the active project.
- Rank passages before sending them to the model.
- Return citations from the retrieved source chunks, not from the model output alone.
- If the app cannot find support in the sources, it should say so clearly.

## Reference Learnings

### From pdf-craft

- Use a resumable conversion pipeline with clear intermediate and final outputs.
- Treat OCR as a specialized backend for scanned PDFs, not the default path.
- Preserve document structure when possible, especially headers, tables, footnotes, and formula-like content.
- Prefer local conversion that can run offline once the model/runtime is available.

### From DeepSeek-OCR

- Keep OCR as a separate adapter so it can be swapped or disabled.
- Use high-quality OCR only when the source is image-based or heavily scanned.
- Avoid making the entire app depend on a GPU-heavy runtime for normal use.

### From Readest

- Make the library/reader UX polished and calm for non-technical users.
- Provide highlights, notes, bookmarks, search, and split-reading later in the flow.
- Show the source library clearly, not just a flat file list.

### From Basic-Rag

- Keep the RAG pipeline simple and explicit: upload, chunk, retrieve, answer.
- Persist chunk metadata so citations are stable and inspectable.
- Use a lightweight retrieval chain for the first version, then improve ranking later.

## Next Code Modules

### Priority 1: App Infrastructure

- `src/lib/storage.ts`: separate app config, project state, and reset/migration helpers.
- `src/lib/types.ts`: shared data contracts for projects, chunks, citations, messages, and settings.
- `src/lib/importPipeline.ts`: local text extraction, PDF handling, chunking, and import status.
- `src/lib/retrieval.ts`: hybrid lexical plus semantic retrieval and answer synthesis.
- `src/lib/nativeBridge.ts`: frontend access to native persistence commands with local fallback.

### Priority 2: UI Modules

- `src/features/projects/ProjectSidebar.tsx`: project list, onboarding entry, project actions, and filters.
- `src/features/import/ImportActions.tsx`: file picker and folder picker triggers.
- `src/features/chat/ChatPanel.tsx`: question entry, answer rendering, and citations.
- `src/features/documents/SourcePanel.tsx`: imported source list and source filters.
- `src/features/settings/SettingsPanel.tsx`: model runtime, storage, OCR, and indexing controls.

### Priority 3: Native Backend Modules

- `src-tauri/src/lib.rs`: Tauri app bootstrap.
- `src-tauri/src/commands/mod.rs`: filesystem, storage, and model-provider command grouping.
- `src-tauri/src/commands/import.rs`: native import job persistence commands.
- `src-tauri/src/commands/files.rs`: import-source types and file access helpers.
- `src-tauri/src/commands/storage.rs`: app state/config persistence commands.
- `src-tauri/src/commands/index.rs`: project index persistence commands.
- `src-tauri/src/services/mod.rs`: import orchestration, OCR backend, and job queue grouping.
- `src-tauri/src/services/import.rs`: import stage/state definitions, native import extraction, chunking, and batch completion.
- `src-tauri/src/services/import_jobs.rs`: native import-job persistence service.
- `src-tauri/src/services/index.rs`: native project index persistence.
- `src-tauri/src/services/ocr.rs`: OCR backend selection.
- `src-tauri/src/services/storage.rs`: native app-data persistence helpers.
- `src-tauri/src/models/mod.rs`: provider adapters for Ollama and future local runtimes.
- `src-tauri/src/models/imports.rs`: native import payload and result records.
- `src-tauri/src/models/index.rs`: native project index record.
- `src-tauri/src/models/files.rs`: native directory entry records.
- `src-tauri/src/models/ollama.rs`: Ollama model adapter placeholder.
- `src-tauri/src/models/storage.rs`: native app state/config record types.

## Proposed Repo Structure

### Current Top-Level Files

- `src/`: React frontend entry point and UI code.
- `src-tauri/`: Rust desktop backend and Tauri configuration.
- `project-todos.md`: product roadmap, MVP spec, and delivery checklist.
- `README.md`: short project overview and stack summary.

### Suggested Next Structure

- `src/app/`: app shell, routes, and top-level layout.
- `src/features/projects/`: project list, creation, rename, delete, and project settings.
- `src/features/import/`: file picker, folder picker, and import progress UI.
- `src/features/documents/`: document library, metadata display, and document detail views.
- `src/features/chat/`: question input, answer view, citations, and conversation history.
- `src/features/settings/`: local model, storage, indexing, and privacy settings.
- `src/components/`: reusable UI components shared across features.
- `src/lib/storage/`: local persistence helpers and project data access.
- `src/lib/indexing/`: text extraction, OCR orchestration, chunking, and embedding preparation.
- `src/lib/retrieval/`: search, ranking, and citation mapping helpers.
- `src/lib/ai/`: local model provider adapter and prompt assembly.
- `src/lib/types/`: shared TypeScript types and data contracts.
- `src-tauri/src/`: Rust commands, filesystem access, and native integrations.

## Implementation Checklist

### Phase A: Product And Data Foundation

- [x] Finalize supported file formats for the first release.
- [x] Define the project data model in TypeScript and Rust.
- [x] Define local storage paths and file naming conventions.
- [x] Define how import status, indexing status, and errors are stored.
- [x] Define the local model provider interface in the UI/config layer.
- [x] Connect the local model provider interface to the native backend.
- [x] Scaffold UI feature modules for projects, import, chat, sources, and settings.
- [x] Scaffold Rust backend modules for commands, services, and models.
- [x] Split the local project/document state into dedicated data contracts and persisted settings.
- [x] Add a native storage bridge for app state and config.

### Phase B: App Shell

- [x] Build the app shell and navigation structure.
- [x] Build first-launch onboarding.
- [x] Build project list, create, rename, delete, and open flows.
- [x] Add a clean empty-state experience for new users.
- [x] Add settings for model runtime, storage, and indexing behavior.
- [x] Add loading screen during app hydration.

### Phase C: Import And Indexing

- [x] Add PDF import.
- [x] Add EPUB import for the initial supported formats.
- [x] Add MOBI/AZW3 import support or conversion.
- [x] Add folder selection and folder-based indexing.
- [x] Add text extraction and metadata parsing for text-based sources and simple PDFs.
- [x] Add chunking and local storage of derived data.
- [x] Persist derived project index data separately from the React app shell state.
- [x] Add background job progress and error reporting.
- [x] Add native import-job records and directory listing helpers.
- [x] Move import execution into native resumable jobs.
- [x] Fix import progress stuck at 15% by adding event emission.
- [x] Add cancel button for import jobs.

### Phase D: Search And Question Answering

- [x] Add keyword search across imported sources.
- [x] Add semantic retrieval over document chunks.
- [x] Add question answering with source citations.
- [x] Add local LLM answer generation using Ollama.
- [x] Add conversation history scoped to each project.
- [x] Add fallback behavior when no evidence is found.
- [x] Fix "Preparing local AI" progress stuck at 15%.

### Phase E: Quality And Platform Release

- [x] Add OCR backend wiring for scanned PDFs.
- [x] Add notes, highlights, bookmarks, and saved answers.
- [x] Add export and backup flows.
- [x] Add automated tests for chunking, retrieval, and answer grounding.
- [x] Add import pipeline tests for supported file formats and metadata handling.
- [x] Add UI/UX improvements with modern styling, animations, and polish.
- [x] Add caching for text processing (tokenization, embeddings).
- [ ] Add macOS packaging and release verification.
- [ ] Add Windows packaging and compatibility verification.

## Open Steps

- Expand notes, highlights, bookmarks, and saved answers with richer item editing and search.
- Stage the bundled runtime into `src-tauri/runtime/ollama` and package it into the macOS and Windows installers so the app ships the local AI engine without a separate system install.
- Add macOS packaging and release verification.
- Add Windows packaging and compatibility verification.
- Tune retrieval and citation ranking on larger source collections, including the document-diversity cap.
- Run larger-scale folder reindexing validation on large native folder imports.
- Run larger-scale page-level citation validation on mixed PDF and ebook projects.
- Add toast notifications for user feedback (project created, files imported, etc.).
- Add custom modals for delete confirmations instead of browser dialogs.

## Recent Improvements

### Bug Fixes
- Fixed "Preparing local AI" progress bar stuck at 15% by adding the missing `prepareLocalModel` call in App.tsx.
- Fixed import progress stuck at 15% by adding event emission in Rust backend and frontend event listener.

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
- Added LRU caching for `tokenize()`, `buildTermWeights()`, and `buildEmbeddingVector()` functions.
- Added chunk metadata cache in retrieval module to avoid re-computing embeddings.
- Added loading state to prevent flash of empty content.

## Collaboration Notes For Future AI Agents

- Read `AGENTS.md` first for handoff and conflict-avoidance rules.
- Check `git status` before editing.
- Do not overwrite unrelated user changes.
- Keep changes in one feature area when possible.
- Update `project-todos.md` when product scope or architecture changes.
- Use the existing scaffold instead of replacing it wholesale.
- If another agent is already working in a file, coordinate rather than reverting work.

### Milestone 1: Desktop Foundation

- Create the desktop shell and application layout.
- Build project creation, selection, rename, and delete flows.
- Create a simple onboarding experience for first-time users.
- Store app state locally in a reliable format.
- Add settings for language, model provider, and indexing behavior.

Success criteria:

- A user can open the app, create a project, and see an empty workspace.
- The app feels like a native desktop product, not a developer tool.

Status:

- Complete: project list, create/open/delete, persistent state, local import pipeline, chunking, cited answers, onboarding, settings, notes/highlights/bookmarks, export/backup.
- Remaining: macOS packaging, Windows packaging, toast notifications, custom modals, privacy controls.

### Phase 1: Foundation

- Wire up the desktop shell and app entry points.
- Design the UI for non-technical users first.
- Keep the app self-contained so import, indexing, search, and Q&A all happen from the app UI.
- Define local storage format for projects, documents, embeddings, and chat history.
- Create the basic app shell and project management flow.
- Add document import for PDFs and ebooks.
- Build text extraction and metadata parsing.

Success criteria:

- Users can import files or folders from the app.
- Imported items appear in a project library.
- Basic metadata and extracted text are available for each document.

### Milestone 2: Retrieval Engine

- Chunk document text into searchable passages.
- Generate embeddings locally or through a configurable local provider.
- Build full-text and semantic search across project content.
- Add source matching so every answer can point to the relevant passages.

Success criteria:

- A user can search by topic and retrieve relevant passages.
- The app can identify source snippets for later citations.

### Phase 2: Retrieval

- Split documents into chunks.
- Generate embeddings locally or through a configurable provider.
- Build search over chunks and document metadata.
- Add citations that map answers back to source passages.

Success criteria:

- Search returns relevant results quickly.
- Source pointers are available for every retrieved chunk.

### Milestone 3: Answering Workflow

- Add a project-scoped chat interface.
- Ground answers in retrieved sources only.
- Show citations inline and in a source panel.
- Add follow-up questions and conversation memory.

Success criteria:

- A user can ask a question and receive an answer with citations.
- The app refuses to answer when it cannot find support in the sources.

### Phase 3: Question Answering

- Add project-scoped chat.
- Ground responses in retrieved sources only.
- Show citations inline and in a source panel.
- Add follow-up question support and conversation memory.

Success criteria:

- Users can have an ongoing research conversation inside a project.
- Answers remain tied to the selected document set.

### Milestone 4: Document Power Features

- Add OCR for scanned PDFs and image-based pages.
- Add notes, highlights, bookmarks, and saved answers.
- Validate folder watching and re-indexing on native folder paths.
- Add export and backup tools.

Success criteria:

- The app handles scanned documents and long-term study workflows.
- Users can preserve work outside the app through export and backup.

### Phase 4: Usability

- Add OCR support for scanned documents.
- Add notes, highlights, bookmarks, and saved answers.
- Add folder monitoring and re-indexing.
- Add export and backup tools.

Success criteria:

- The app is practical for repeated daily use.
- Users can keep collections up to date without manual re-imports.

### Milestone 5: macOS Release

- Stabilize the macOS build.
- Test file handling, app permissions, and performance.
- Polish startup, onboarding, and first-run behavior.
- Package a distributable native macOS app.

Success criteria:

- A non-technical macOS user can install and use the app end to end.

### Phase 5: Platform Expansion

- Stabilize macOS release.
- Package and test Windows build.
- Verify file path handling, indexing, and model integration on Windows.

Success criteria:

- Windows support matches the macOS workflow.
- The same app concepts work without platform-specific user friction.

### Later Enhancements

- Shared or team projects.
- Sync between devices.
- Browser or file-system integrations.
- Citation formatting presets for academic workflows.
- Rich annotation tools and reading modes.
- Optional cloud backup for users who want it.

## Open Todo List

- [x] Pick the desktop framework and local AI stack.
- [x] Create the repository structure for app, indexing, and AI services.
- [x] Add the native, self-contained, non-technical-user requirement to the product plan.
- [x] Create a fuller roadmap plan with milestones and success criteria.
- [x] Define the project data model.
- [x] Wire up the desktop shell and app entry points.
- [x] Implement project creation, rename, delete, and open flows.
- [x] Add local persistence for projects and active project selection.
- [x] Implement a local import pipeline for text files and simple PDFs.
- [x] Add folder selection and folder-based indexing.
- [x] Add chunking for imported text.
- [x] Add source-cited question answering.
- [x] Add local LLM answer generation from retrieved sources.
- [x] Add basic source list and project status display.
- [x] Implement ebook import for common formats.
- [x] Add robust PDF/ebook extraction and metadata parsing.
- [x] Add embedding generation and vector search.
- [x] Add search and filtering across projects.
- [x] Add OCR backend wiring for scanned documents.
- [x] Add notes, highlights, bookmarks, and saved answers.
- [x] Add edit/search/filter flows for study items.
- [x] Add export for notes, bookmarks, highlights, and saved answers.
- [x] Add export of answers and citations.
- [x] Add test coverage for import, retrieval, and answer grounding.
- [x] Add a backup and restore flow for projects.
- [x] Fix import progress stuck at 15%.
- [x] Fix "Preparing local AI" progress stuck at 15%.
- [x] Add UI/UX improvements with modern styling.
- [x] Add performance optimizations with caching.
- [ ] Add packaging for macOS.
- [ ] Add Windows support after the macOS path is stable.
- [ ] Add privacy and data retention controls.

## Nice-To-Have Later

- Team or shared project mode.
- Sync between devices.
- Mobile companion viewer.
- Browser extension for sending PDFs or passages to a project.
- Citation style formatting for academic work.
