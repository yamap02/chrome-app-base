import "./App.css";
import { SettingsToggle } from "./components/SettingsToggle";
import { useSettings } from "./hooks/useSettings";

function App() {
  const { errorMessage, isLoaded, isPending, settings, status, toggle } = useSettings();
  const isActionDisabled = !isLoaded || isPending;

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="hero-badge">Chrome Extension Base</p>
        <h1 className="hero-title">拡張状態管理</h1>
        <p className="hero-description">popup から永続設定制御。React 状態と WXT storage 同期。</p>
      </header>

      <SettingsToggle
        description={status.description}
        disabled={isActionDisabled}
        isEnabled={settings.enabled}
        label={status.actionLabel}
        onToggle={() => {
          void toggle();
        }}
        title={status.title}
      />

      <footer className="app-footer">
        <span className="footer-status">{isLoaded ? "Storage ready" : "Loading settings"}</span>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </footer>
    </main>
  );
}

export default App;
