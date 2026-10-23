import type { ChangeEvent } from "react";
import type { ChatCitation, ChatMessage, ProjectRecord } from "../../lib/types";

type ChatPanelProps = {
  activeProject: ProjectRecord | null;
  question: string;
  isImporting: boolean;
  isGeneratingAnswer: boolean;
  onQuestionChange: (value: string) => void;
  onGenerateAnswer: () => void;
  onRenameProject: (projectId: string, nextName: string) => void;
  onDeleteProject: (projectId: string) => void;
  onSaveAnswer: (message: ChatMessage) => void;
  onCreateNote: (message: ChatMessage) => void;
  onBookmarkCitation: (citation: ChatCitation) => void;
  onHighlightCitation: (citation: ChatCitation) => void;
};

export function ChatPanel({
  activeProject,
  question,
  isImporting,
  isGeneratingAnswer,
  onQuestionChange,
  onGenerateAnswer,
  onRenameProject,
  onDeleteProject,
  onSaveAnswer,
  onCreateNote,
  onBookmarkCitation,
  onHighlightCitation,
}: ChatPanelProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Ask</h2>
        <span>
          Project: {activeProject ? activeProject.name : "Create a project"}
        </span>
      </div>
      {activeProject ? (
        <>
          <div className="project-toolbar">
            <label className="inline-field">
              <span>Project title</span>
              <input
                value={activeProject.name}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onRenameProject(activeProject.id, event.target.value)
                }
              />
            </label>
            <button type="button" onClick={() => onDeleteProject(activeProject.id)}>
              Delete project
            </button>
          </div>
          <div className="status-pill">
            <strong>{activeProject.indexingState === "indexing" ? "Indexing" : "Ready"}</strong>
            <span>{activeProject.documents.length} imported items</span>
          </div>
          {isImporting ? (
            <div className="empty-state">
              <strong>Importing content</strong>
              <p>The local import pipeline is processing the selected files.</p>
            </div>
          ) : null}
          {isGeneratingAnswer ? (
            <div className="empty-state">
              <strong>Generating answer</strong>
              <p>The local model is writing a grounded response from the retrieved passages.</p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-state">
          <strong>No active project</strong>
          <p>Create a project to enable imports and asking questions.</p>
        </div>
      )}
      <label className="prompt">
        <span>Question</span>
        <textarea
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          placeholder="Ask something about your imported books"
        />
      </label>
      <button
        type="button"
        className="primary"
        onClick={onGenerateAnswer}
        disabled={!activeProject || isImporting || isGeneratingAnswer}
      >
        {isGeneratingAnswer ? "Generating..." : "Generate answer"}
      </button>

      <div className="conversation">
        <div className="panel-header conversation-header">
          <h3>Conversation</h3>
          <span>{activeProject?.chat.length ?? 0} messages</span>
        </div>
        <div className="conversation-feed">
          {activeProject?.chat.length ? (
            activeProject.chat.map((message) => (
              <ChatMessageCard
                key={message.id}
                message={message}
                onSaveAnswer={onSaveAnswer}
                onCreateNote={onCreateNote}
                onBookmarkCitation={onBookmarkCitation}
                onHighlightCitation={onHighlightCitation}
              />
            ))
          ) : (
            <div className="empty-state">
              <strong>No conversation yet</strong>
              <p>Ask a question after importing some documents.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatMessageCard({
  message,
  onSaveAnswer,
  onCreateNote,
  onBookmarkCitation,
  onHighlightCitation,
}: {
  message: ChatMessage;
  onSaveAnswer: (message: ChatMessage) => void;
  onCreateNote: (message: ChatMessage) => void;
  onBookmarkCitation: (citation: ChatCitation) => void;
  onHighlightCitation: (citation: ChatCitation) => void;
}) {
  return (
    <article className={`message ${message.role}`}>
      <div className="message-meta">
        <strong>{message.role === "user" ? "You" : "Assistant"}</strong>
        <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
      </div>
      <p>{message.content}</p>
      {message.citations?.length ? (
        <ul className="citations">
          {message.citations.map((citation) => (
              <li key={citation.chunkId} className="citation-card">
                <div>
                  <strong>{citation.documentName}</strong>
                  {citation.sourceRef ? <span>{citation.sourceRef}</span> : null}
                  <span>{citation.snippet}</span>
                </div>
                <div className="study-actions">
                <button type="button" onClick={() => onBookmarkCitation(citation)}>
                  Bookmark
                </button>
                <button type="button" onClick={() => onHighlightCitation(citation)}>
                  Highlight
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {message.role === "assistant" ? (
        <div className="study-actions">
          <button type="button" onClick={() => onSaveAnswer(message)}>
            Save answer
          </button>
          <button type="button" onClick={() => onCreateNote(message)}>
            Add note
          </button>
        </div>
      ) : null}
    </article>
  );
}
