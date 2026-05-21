import type { ErpBranding, ErpShellConfig } from "@faako/types";

export const defineErpBranding = <T extends ErpBranding>(branding: T) => branding;

export const defineErpShellConfig = <T extends ErpShellConfig>(config: T) => config;

export * from "./erpModules/moduleGroups.js";
export * from "./erpModules/moduleStatuses.js";
export * from "./erpModules/moduleStates.js";
export * from "./erpModules/registryHelpers.js";
export * from "./erpShell/shellFoundation.js";
export * from "./appModes/appModes.js";
export * from "./monorepoApps/appRegistry.js";
export * from "./projectRegistry/projectRegistry.js";
