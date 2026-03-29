import { useEffect, useState } from 'react';
import './App.css';
import { settingsStorage } from '@/utils/storage';

function App() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    settingsStorage.getValue().then((settings) => {
      setEnabled(settings.enabled);
    });
  }, []);

  const handleToggle = async () => {
    const newValue = !enabled;
    setEnabled(newValue);
    await settingsStorage.setValue({ enabled: newValue });
  };

  return (
    <div className="container">
      <h1>My Extension</h1>
      <p className="description">Configure your extension settings.</p>

      <div className="setting-row">
        <div className="setting-info">
          <span className="setting-label">Extension</span>
          <span className="setting-desc">{enabled ? 'Active' : 'Disabled'}</span>
        </div>
        <button
          className={`toggle ${enabled ? 'active' : ''}`}
          onClick={handleToggle}
          aria-pressed={enabled}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}

export default App;
