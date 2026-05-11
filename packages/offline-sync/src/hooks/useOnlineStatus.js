import { useEffect, useState } from "react";
import { getOnlineStatus, subscribeOnlineStatus } from "../status/onlineStatus.js";

export const useOnlineStatus = (initialOnline) => {
  const [online, setOnline] = useState(() =>
    typeof initialOnline === "boolean" ? initialOnline : getOnlineStatus()
  );

  useEffect(() => {
    if (typeof initialOnline === "boolean") {
      setOnline(initialOnline);
      return undefined;
    }

    return subscribeOnlineStatus(setOnline);
  }, [initialOnline]);

  return online;
};
