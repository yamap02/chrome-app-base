import { useEffect, useState } from "react";
import { getSettings, settingsStorage, setSettings as persistSettings } from "@/utils/storage";
import {
  getSettingsStatus,
  normalizeSettings,
  toggleSettingsEnabled,
  type Settings,
} from "@/utils/settings";

type UseSettingsResult = {
  errorMessage: string | null;
  isLoaded: boolean;
  isSaving: boolean;
  settings: Settings;
  status: ReturnType<typeof getSettingsStatus>;
  toggle: () => Promise<void>;
};

const FALLBACK_ERROR_MESSAGE = "設定保存失敗。再試行して";

function toErrorMessage(error: unknown): string {
  void error;
  return FALLBACK_ERROR_MESSAGE;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(normalizeSettings());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isDisposed = false;

    void getSettings()
      .then((storedSettings) => {
        if (isDisposed) {
          return;
        }

        setSettings(normalizeSettings(storedSettings));
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (isDisposed) {
          return;
        }

        setErrorMessage(toErrorMessage(error));
      })
      .finally(() => {
        if (!isDisposed) {
          setIsLoaded(true);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    let isDisposed = false;
    const unwatch = settingsStorage.watch((nextSettings) => {
      if (!isDisposed) {
        setSettings(normalizeSettings(nextSettings));
        setErrorMessage(null);
      }
    });
    return () => {
      isDisposed = true;
      unwatch();
    };
  }, []);

  const toggle = async () => {
    if (isSaving) return;
    const previousSettings = settings;
    const nextSettings = toggleSettingsEnabled(previousSettings);

    setIsSaving(true);
    setSettings(nextSettings);
    setErrorMessage(null);

    try {
      await persistSettings(nextSettings);
    } catch (error: unknown) {
      setSettings(previousSettings);
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return {
    errorMessage,
    isLoaded,
    isSaving,
    settings,
    status: getSettingsStatus(settings.enabled),
    toggle,
  };
}
