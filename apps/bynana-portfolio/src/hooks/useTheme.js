import { useEffect, useState } from 'react';

const STORAGE_KEY = 'bynana-theme';

export function useTheme() {
  // Keep the server and first browser render deterministic. The real browser
  // preference is applied immediately after hydration.
  const [systemTheme, setSystemTheme] = useState('light');
  const [preference, setPreference] = useState('system');
  const [hasHydrated, setHasHydrated] = useState(false);

  const resolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');
    let storedPreference = 'system';

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') storedPreference = stored;
    } catch {
      // System preference remains available when storage is restricted.
    }

    setPreference(storedPreference);
    handleChange(media);
    setHasHydrated(true);

    if (media.addEventListener) {
      media.addEventListener('change', handleChange);
    } else {
      media.addListener(handleChange);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = preference;
  }, [hasHydrated, preference, resolvedTheme]);

  useEffect(() => {
    if (!hasHydrated) return;
    try {
      if (preference === 'system') {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, preference);
      }
    } catch {
      // Theme switching should still work when storage is restricted.
    }
  }, [hasHydrated, preference]);

  const toggleTheme = () => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark');
  const resetToSystem = () => setPreference('system');

  return {
    theme: preference,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    usingSystem: preference === 'system',
    toggleTheme,
    setTheme: setPreference,
    resetToSystem,
  };
}
