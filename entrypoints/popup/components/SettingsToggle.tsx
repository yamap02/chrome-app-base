type SettingsToggleProps = {
  description: string;
  disabled: boolean;
  isEnabled: boolean;
  label: string;
  onToggle: () => void;
  title: string;
};

export function SettingsToggle({
  description,
  disabled,
  isEnabled,
  label,
  onToggle,
  title,
}: SettingsToggleProps) {
  return (
    <section className="setting-card" aria-live="polite">
      <div className="setting-copy">
        <p className="setting-eyebrow">Runtime</p>
        <h2 className="setting-title">{title}</h2>
        <p className="setting-description">{description}</p>
      </div>
      <button
        aria-label="拡張機能有効状態切替"
        aria-pressed={isEnabled}
        className={`toggle-button ${isEnabled ? "is-enabled" : "is-disabled"}`}
        disabled={disabled}
        onClick={onToggle}
        type="button"
      >
        {label}
      </button>
    </section>
  );
}
