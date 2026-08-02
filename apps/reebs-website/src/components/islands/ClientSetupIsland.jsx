import { useEffect } from "react";
import { patchOrganizationFetch } from "@faako/core";
import { syncMobileBrowserChrome } from "@faako/utils";

export default function ClientSetupIsland() {
  useEffect(() => {
    patchOrganizationFetch();
    syncMobileBrowserChrome({ fallbackColor: "#f6f7f9" });
  }, []);

  return null;
}
