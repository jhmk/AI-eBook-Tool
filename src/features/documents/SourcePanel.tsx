import type { ImportJobRecord, ProjectDocument, ProjectRecord } from "../../lib/types";

type SourcePanelProps = {
  activeProject: ProjectRecord | null;
  visibleDocuments: ProjectDocument[];
  importJobs: ImportJobRecord[];
  activeImportJob: ImportJobRecord | null;
  sourceFilter: string;
  onSourceFilterChange: (value: string) => void;
};

export function SourcePanel({
  activeProject,
  visibleDocuments,
  importJobs,
  activeImportJob,
  sourceFilter,
  onSourceFilterChange,
}: SourcePanelProps) {
  const activeImportProgress =
    activeImportJob && Number.isFinite(activeImportJob.progress)
      ? Math.max(0, Math.min(100, activeImportJob.progress))
      : null;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Sources</h2>
        <span>{activeProject?.documents.length ?? 0} indexed</span>
      </div>
      <label className="inline-field">
        <span>Search sources</span>
        <input
          value={sourceFilter}
          onChange={(event) => onSourceFilterChange(event.target.value)}
          placeholder="Filter by document name or note"
          disabled={!activeProject}
        />
      </label>
      <ul className="sources">
        {visibleDocuments.length ? (
          visibleDocuments.map((document) => (
            <li key={document.id}>
              <strong>{document.name}</strong>
              <p>
                {document.kind.toUpperCase()} - {document.status}
              </p>
              <p>{document.chunkCount ?? 0} chunks</p>
              <span>{document.note}</span>
            </li>
          ))
        ) : (
          <li className="empty-state">
            <strong>
              {activeProject?.documents.length ? "No matching sources" : "No imported sources yet"}
            </strong>
            <p>
              {activeProject?.documents.length
                ? "Try a different source search term."
                : "Upload a PDF or choose a folder to start indexing."}
            </p>
          </li>
        )}
      </ul>

      <div className="panel-header" style={{ marginTop: "1.25rem" }}>
        <h3>Import jobs</h3>
        <span>{importJobs.length} queued or finished</span>
      </div>
      <ul className="sources">
        {importJobs.length ? (
          importJobs.map((job) => (
            <li key={job.id}>
              <strong>{job.sourceLabel}</strong>
              <p>
                {job.stage.toUpperCase()} - {job.progress}%
              </p>
              <span>{job.message ?? job.sourcePath}</span>
            </li>
          ))
        ) : (
          <li className="empty-state">
            <strong>No import jobs yet</strong>
            <p>Import a PDF, EPUB, or folder to create a resumable job.</p>
          </li>
        )}
      </ul>

      {activeImportJob ? (
        <div className="import-progress-panel">
          <div className="hero-progress-label">
            <span>{activeImportJob.sourceLabel}</span>
            <strong>{Math.round(activeImportProgress ?? 0)}%</strong>
          </div>
          <progress value={activeImportProgress ?? 0} max={100} />
          <p>{activeImportJob.message ?? "Analyzing uploaded document..."}</p>
        </div>
      ) : null}
    </div>
  );
}
