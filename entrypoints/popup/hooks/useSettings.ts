import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { settingsStorage } from "@/utils/storage";
import {
  getSettingsStatus,
  normalizeSettings,
  toggleSettingsEnabled,
  type Settings,
} from "@/utils/settings";

type UseSettingsResult = {
  errorMessage: string | null;
  isLoaded: boolean;
  isPending: boolean;
  settings: Settings;
  status: ReturnType<typeof getSettingsStatus>;
  toggle: () => Promise<void>;
};

const FALLBACK_ERROR_MESSAGE = "設定保存失敗。再試行して";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return FALLBACK_ERROR_MESSAGE;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(normalizeSettings());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const commitSettings = useEffectEvent((nextSettings: Settings) => {
    startTransition(() => {
      setSettings(nextSettings);
    });
  });

  useEffect(() => {
    let isDisposed = false;

    void settingsStorage
      .getValue()
      .then((storedSettings) => {
        if (isDisposed) {
          return;
        }

        commitSettings(normalizeSettings(storedSettings));
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

  const toggle = async () => {
    const previousSettings = settings;
    const nextSettings = toggleSettingsEnabled(previousSettings);

    commitSettings(nextSettings);
    setErrorMessage(null);

    try {
      await settingsStorage.setValue(nextSettings);
    } catch (error: unknown) {
      commitSettings(previousSettings);
      setErrorMessage(toErrorMessage(error));
    }
  };

  return {
    errorMessage,
    isLoaded,
    isPending,
    settings,
    status: getSettingsStatus(settings.enabled),
    toggle,
  };
}
