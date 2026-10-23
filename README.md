# AI eBook Tool

Local-first desktop app for asking questions about PDFs and ebooks.

This is a personal AI-assisted prototype built to explore private document workflows: import documents, extract text, split it into searchable chunks, retrieve relevant context, and answer questions without turning a private reading library into a cloud product.

## Goals

- Local-first project folders with metadata, indexes and conversation history
- PDF/eBook import pipeline with text extraction and chunking
- Project-scoped retrieval for question answering with citations
- Local model runtime first, with Ollama as the primary target
- Desktop UX via Tauri, React, TypeScript and Vite

## Current status

Prototype / work in progress. The repository contains the app scaffold, import and retrieval building blocks, UI components, tests for core processing, and runtime integration experiments. It is not packaged as a finished end-user product yet.

## Stack

- Desktop shell: Tauri
- Frontend: React + TypeScript + Vite
- Local AI runtime: Ollama-first architecture
- Storage: local project folders
- Tests: Vitest

## Development

```bash
npm install
npm test
npm run dev
```

Tauri packaging requires the usual Rust/Tauri toolchain.

## Privacy / publication notes

Imported books, PDFs, indexes, local conversations, bundled runtimes and model artifacts are intentionally ignored. Do not commit copyrighted books, personal reading material, model downloads or API keys.
