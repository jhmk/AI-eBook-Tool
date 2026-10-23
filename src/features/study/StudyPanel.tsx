import { useMemo, useState, type ReactElement } from "react";
import type {
  ProjectRecord,
  SavedAnswer,
  StudyBookmark,
  StudyHighlight,
  StudyNote,
} from "../../lib/types";

type StudyPanelProps = {
  activeProject: ProjectRecord | null;
  onDeleteNote: (noteId: string) => void;
  onUpdateNote: (noteId: string, patch: Partial<Pick<StudyNote, "title" | "body">>) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onDeleteSavedAnswer: (answerId: string) => void;
  onExportStudy: () => void;
  onBackupProject: () => void;
};

export function StudyPanel({
  activeProject,
  onDeleteNote,
  onUpdateNote,
  onDeleteBookmark,
  onDeleteHighlight,
  onDeleteSavedAnswer,
  onExportStudy,
  onBackupProject,
}: StudyPanelProps) {
  const [studyFilter, setStudyFilter] = useState("");
  const normalizedFilter = studyFilter.trim().toLowerCase();

  const filteredSavedAnswers = useMemo(
    () => filterSavedAnswers(activeProject?.savedAnswers ?? [], normalizedFilter),
    [activeProject?.savedAnswers, normalizedFilter],
  );
  const filteredNotes = useMemo(
    () => filterNotes(activeProject?.notes ?? [], normalizedFilter),
    [activeProject?.notes, normalizedFilter],
  );
  const filteredBookmarks = useMemo(
    () => filterBookmarks(activeProject?.bookmarks ?? [], normalizedFilter),
    [activeProject?.bookmarks, normalizedFilter],
  );
  const filteredHighlights = useMemo(
    () => filterHighlights(activeProject?.highlights ?? [], normalizedFilter),
    [activeProject?.highlights, normalizedFilter],
  );

  return (
    <section className="panel study-panel">
      <div className="panel-header">
        <h2>Study</h2>
        <span>{activeProject ? "Project-scoped notes and saves" : "No active project"}</span>
      </div>

      {!activeProject ? (
        <div className="empty-state">
          <strong>Create or open a project</strong>
          <p>Saved answers, highlights, bookmarks, and notes are stored per project.</p>
        </div>
      ) : (
        <>
          <div className="study-toolbar">
            <label className="inline-field">
              <span>Search study items</span>
              <input
                value={studyFilter}
                onChange={(event) => setStudyFilter(event.target.value)}
                placeholder="Search notes, answers, citations, or bookmarks"
              />
            </label>
            <div className="study-actions">
              <button type="button" onClick={onExportStudy}>
                Export study notes
              </button>
              <button type="button" onClick={onBackupProject}>
                Backup project
              </button>
            </div>
          </div>

          <div className="study-grid">
            <StudyColumn
              title="Saved answers"
              emptyMessage="Save an answer from the chat panel."
              items={filteredSavedAnswers}
              renderItem={(item) => (
                <StudyAnswerCard key={item.id} answer={item} onDelete={onDeleteSavedAnswer} />
              )}
            />
            <StudyColumn
              title="Notes"
              emptyMessage="Add a note from a chat answer."
              items={filteredNotes}
              renderItem={(item) => (
                <StudyNoteCard
                  key={item.id}
                  note={item}
                  onDelete={onDeleteNote}
                  onUpdate={onUpdateNote}
                />
              )}
            />
            <StudyColumn
              title="Bookmarks"
              emptyMessage="Bookmark a cited passage."
              items={filteredBookmarks}
              renderItem={(item) => (
                <StudyBookmarkCard
                  key={item.id}
                  bookmark={item}
                  onDelete={onDeleteBookmark}
                />
              )}
            />
            <StudyColumn
              title="Highlights"
              emptyMessage="Highlight a cited passage."
              items={filteredHighlights}
              renderItem={(item) => (
                <StudyHighlightCard
                  key={item.id}
                  highlight={item}
                  onDelete={onDeleteHighlight}
                />
              )}
            />
          </div>
        </>
      )}
    </section>
  );
}

function StudyColumn<T>({
  title,
  emptyMessage,
  items,
  renderItem,
}: {
  title: string;
  emptyMessage: string;
  items: T[];
  renderItem: (item: T) => ReactElement;
}) {
  return (
    <div className="study-column">
      <div className="panel-header study-column-header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>
      <div className="study-items">
        {items.length > 0 ? (
          items.map((item) => renderItem(item))
        ) : (
          <div className="empty-state">
            <strong>{title}</strong>
            <p>{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StudyAnswerCard({
  answer,
  onDelete,
}: {
  answer: SavedAnswer;
  onDelete: (answerId: string) => void;
}) {
  return (
    <article className="study-card">
      <div className="study-card-header">
        <strong>{answer.question}</strong>
        <button type="button" onClick={() => onDelete(answer.id)}>
          Delete
        </button>
      </div>
      <p>{answer.answer}</p>
      <span>{new Date(answer.createdAt).toLocaleString()}</span>
      {answer.citations.length ? (
        <ul className="study-citation-list">
          {answer.citations.map((citation) => (
            <li key={`${answer.id}-${citation.chunkId}`}>
              {citation.documentName}
              {citation.sourceRef ? ` · ${citation.sourceRef}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function StudyNoteCard({
  note,
  onDelete,
  onUpdate,
}: {
  note: StudyNote;
  onDelete: (noteId: string) => void;
  onUpdate: (noteId: string, patch: Partial<Pick<StudyNote, "title" | "body">>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(note.title);
  const [draftBody, setDraftBody] = useState(note.body);

  return (
    <article className="study-card">
      <div className="study-card-header">
        <strong>{editing ? "Edit note" : note.title}</strong>
        <div className="study-actions">
          <button
            type="button"
            onClick={() => {
              if (editing) {
                onUpdate(note.id, { title: draftTitle, body: draftBody });
              }
              setEditing((value) => !value);
            }}
          >
            {editing ? "Save" : "Edit"}
          </button>
          <button type="button" onClick={() => onDelete(note.id)}>
            Delete
          </button>
        </div>
      </div>
      {editing ? (
        <>
          <label className="inline-field">
            <span>Title</span>
            <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
          </label>
          <label className="prompt">
            <span>Body</span>
            <textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} />
          </label>
        </>
      ) : (
        <p>{note.body}</p>
      )}
      <span>{new Date(note.updatedAt).toLocaleString()}</span>
    </article>
  );
}

function StudyBookmarkCard({
  bookmark,
  onDelete,
}: {
  bookmark: StudyBookmark;
  onDelete: (bookmarkId: string) => void;
}) {
  return (
    <article className="study-card">
      <div className="study-card-header">
        <strong>{bookmark.documentName}</strong>
        <button type="button" onClick={() => onDelete(bookmark.id)}>
          Delete
        </button>
      </div>
      <p>{bookmark.label}</p>
      <span>{new Date(bookmark.createdAt).toLocaleString()}</span>
    </article>
  );
}

function StudyHighlightCard({
  highlight,
  onDelete,
}: {
  highlight: StudyHighlight;
  onDelete: (highlightId: string) => void;
}) {
  return (
    <article className="study-card">
      <div className="study-card-header">
        <strong>{highlight.documentName}</strong>
        <button type="button" onClick={() => onDelete(highlight.id)}>
          Delete
        </button>
      </div>
      <p>{highlight.snippet}</p>
      <span>
        {highlight.color} highlight · {new Date(highlight.createdAt).toLocaleString()}
      </span>
    </article>
  );
}

function matchesText(values: Array<string | undefined>, filter: string) {
  if (!filter) {
    return true;
  }

  return values.some((value) => (value ?? "").toLowerCase().includes(filter));
}

function filterSavedAnswers(items: SavedAnswer[], filter: string) {
  return items.filter((item) =>
    matchesText(
      [
        item.question,
        item.answer,
        item.citations
          .map((citation) => `${citation.documentName} ${citation.sourceRef ?? ""} ${citation.snippet}`)
          .join(" "),
      ],
      filter,
    ),
  );
}

function filterNotes(items: StudyNote[], filter: string) {
  return items.filter((item) => matchesText([item.title, item.body], filter));
}

function filterBookmarks(items: StudyBookmark[], filter: string) {
  return items.filter((item) => matchesText([item.documentName, item.label], filter));
}

function filterHighlights(items: StudyHighlight[], filter: string) {
  return items.filter((item) => matchesText([item.documentName, item.snippet, item.color], filter));
}
