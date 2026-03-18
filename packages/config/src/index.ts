import type { ErpBranding, ErpShellConfig } from "@faako/types";

export const defineErpBranding = <T extends ErpBranding>(branding: T) => branding;

export const defineErpShellConfig = <T extends ErpShellConfig>(config: T) => config;
