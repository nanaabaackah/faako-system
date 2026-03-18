import { useEffect, useState } from 'react';

const STORAGE_KEY = 'bynana-theme';

const getSystemTheme = () => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function useTheme() {
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);
  const [preference, setPreference] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'system';
  });

  const resolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light');

    handleChange(media);
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
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themePreference = preference;
  }, [preference, resolvedTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (preference === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
  }, [preference]);

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
