import { useEffect } from "react";

export default function useUnsavedChanges(isDirty) {
  useEffect(() => {
    if (!isDirty || typeof window === "undefined") return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);
}
