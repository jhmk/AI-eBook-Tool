type ImportActionsProps = {
  disabled: boolean;
  onUploadFiles: () => void;
  onAddFolder: () => void;
};

export function ImportActions({
  disabled,
  onUploadFiles,
  onAddFolder,
}: ImportActionsProps) {
  return (
    <div className="import-actions">
      <button
        type="button"
        className="primary import-action-btn"
        onClick={onUploadFiles}
        disabled={disabled}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        Upload files
      </button>
      <button type="button" className="import-action-btn" onClick={onAddFolder} disabled={disabled}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          <line x1="12" y1="11" x2="12" y2="17"/>
          <line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
        Add folder
      </button>
    </div>
  );
}
