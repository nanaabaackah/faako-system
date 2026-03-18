import type { ReactNode } from "react";

export interface ErpNavItem {
  id: string;
  label: string;
  path: string;
  iconKey?: string;
  matchPaths?: string[];
  description?: string;
  external?: boolean;
  roles?: string[];
}

export interface ErpQuickAction {
  label: string;
  path: string;
  roles?: string[];
}

export interface ErpBranding {
  name: string;
  shortName?: string;
  sidebarTitle?: string;
  homePath?: string;
  topbarLabel?: string;
  publicUrl?: string;
  shellVars?: Record<string, string>;
}

export interface ErpShellConfig {
  brand: ErpBranding;
  sidebarItems?: ErpNavItem[];
  bottomNavItems?: ErpNavItem[];
  quickActions?: ErpQuickAction[];
  pageTitles?: Record<string, string>;
}

export type RoleValue = string | null | undefined;

export type IconRenderer = (iconKey: string | undefined, label: string) => ReactNode;
