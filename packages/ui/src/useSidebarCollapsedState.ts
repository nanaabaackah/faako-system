import { useEffect, useState } from "react";

interface UseSidebarCollapsedStateOptions {
  storageKey: string;
  defaultCollapsed?: boolean;
}

export function useSidebarCollapsedState({
  storageKey,
  defaultCollapsed = false,
}: UseSidebarCollapsedStateOptions) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return defaultCollapsed;

    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (storedValue == null) return defaultCollapsed;
      return storedValue === "true";
    } catch {
      return defaultCollapsed;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(storageKey, collapsed ? "true" : "false");
    } catch {
      // keep the in-memory value when storage is unavailable
    }
  }, [collapsed, storageKey]);

  return [collapsed, setCollapsed] as const;
}
