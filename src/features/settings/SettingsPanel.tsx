import type { AppConfig, LocalModelStatusEntry } from "../../lib/types";

type SettingsPanelProps = {
  config: AppConfig;
  showWelcome: boolean;
  localModelStatus: string;
  localModelProgress: number | null;
  modelStatusLog: LocalModelStatusEntry[];
  onDismiss: () => void;
  onUpdateConfig: (patch: Partial<AppConfig>) => void;
  onResetAllLocalData: () => void;
};

export function SettingsPanel({
  config,
  showWelcome,
  localModelStatus,
  localModelProgress,
  modelStatusLog,
  onDismiss,
  onUpdateConfig,
  onResetAllLocalData,
}: SettingsPanelProps) {
  const progressValue =
    typeof localModelProgress === "number" && Number.isFinite(localModelProgress)
      ? Math.max(0, Math.min(100, localModelProgress))
      : null;

  return (
    <section className="panel settings-panel">
      <div className="panel-header">
        <h2>{showWelcome ? "Welcome" : "Settings"}</h2>
        <button type="button" onClick={onDismiss}>
          {showWelcome ? "Start using app" : "Done"}
        </button>
      </div>

      {showWelcome ? (
        <div className="empty-state">
          <strong>Everything stays local</strong>
          <p>
            Import files, create projects, and ask questions from this desktop app
            without a cloud sign-in.
          </p>
        </div>
      ) : null}

      <div className="settings-grid">
        <label className="inline-field">
          <span>Model provider</span>
          <select
            value={config.modelProvider}
            onChange={(event) =>
              onUpdateConfig({ modelProvider: event.target.value as AppConfig["modelProvider"] })
            }
          >
            <option value="ollama">Ollama</option>
            <option value="local-native">Native local model</option>
            <option value="manual">Manual / custom</option>
          </select>
          <small>The app starts and prepares the local model automatically.</small>
        </label>

        <label className="inline-field">
          <span>Model name</span>
          <input
            value={config.modelName}
            onChange={(event) => onUpdateConfig({ modelName: event.target.value })}
            placeholder="gemma3:1b"
          />
          <small>Default local model for this app: Gemma 3 1B.</small>
        </label>

        <label className="inline-field">
          <span>Chunk size</span>
          <input
            type="range"
            min="200"
            max="1200"
            step="50"
            value={config.chunkSize}
            onChange={(event) => onUpdateConfig({ chunkSize: Number(event.target.value) })}
          />
          <small>{config.chunkSize} characters</small>
        </label>

        <label className="inline-field">
          <span>OCR mode</span>
          <select
            value={config.ocrMode}
            onChange={(event) =>
              onUpdateConfig({ ocrMode: event.target.value as AppConfig["ocrMode"] })
            }
          >
            <option value="auto">Auto detect</option>
            <option value="enhanced">Enhanced when available</option>
            <option value="off">Off</option>
          </select>
          <small>OCR stays optional and only applies to scanned documents later.</small>
        </label>
      </div>

      <div className="empty-state settings-note">
        <strong>Local storage</strong>
        <p>
          Projects, imported documents, and chat history stay stored on this device.
        </p>
        <button type="button" onClick={onResetAllLocalData}>
          Reset all local data
        </button>
      </div>

      <div className="empty-state settings-note">
        <strong>Local AI status</strong>
        <p>{localModelStatus}</p>
        {progressValue !== null ? (
          <div className="local-model-progress">
            <progress value={progressValue} max={100} />
            <span>{Math.round(progressValue)}%</span>
          </div>
        ) : null}
        <ul className="status-log">
          {modelStatusLog.slice(-5).map((entry) => (
            <li key={`${entry.at}-${entry.message}`}>
              <span>{new Date(entry.at).toLocaleTimeString()}</span>
              <span>{entry.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
