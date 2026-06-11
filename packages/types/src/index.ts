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
  group?: string;
  status?: string;
  statusLabel?: string;
  state?: string;
  visibility?: string;
  enabled?: boolean;
  core?: boolean;
  badges?: Array<{
    key: string;
    label: string;
  }>;
}

export interface ErpQuickAction {
  label: string;
  path: string;
  roles?: string[];
}

export interface ErpBranding {
  name: string;
  shortName?: string;
  sidebarMarkUrl?: string;
  sidebarTitle?: string;
  homePath?: string;
  topbarLabel?: string;
  publicUrl?: string;
  shellVars?: Record<string, string>;
}

export type ErpShellLayoutMode = "overlay" | "split";

export interface ErpShellPlaceholders {
  offlineIndicator?: boolean;
  syncStatus?: boolean;
  notificationArea?: boolean;
  organizationSwitcher?: boolean;
}

export interface ErpShellFoundation {
  layout?: ErpShellLayoutMode;
  placeholders?: ErpShellPlaceholders;
}

export interface ErpShellConfig {
  brand: ErpBranding;
  sidebarItems?: ErpNavItem[];
  bottomNavItems?: ErpNavItem[];
  quickActions?: ErpQuickAction[];
  pageTitles?: Record<string, string>;
  shell?: ErpShellFoundation;
}

export type RoleValue = string | null | undefined;

export type IconRenderer = (iconKey: string | undefined, label: string) => ReactNode;

export type AuthMode = "none" | "cookie" | "bearer";

export type SecurityProfileId =
  | "public-static"
  | "public-interactive"
  | "authenticated-workspace"
  | "api-service";

export interface UiThemePreset {
  id: string;
  label?: string;
  description?: string;
  tokens: Record<string, string>;
}

export interface UiThemeConfig {
  presetId: string;
  tokenOverrides?: Record<string, string>;
}

export interface SecurityPolicyConfig {
  profileId: SecurityProfileId;
  authMode: AuthMode;
  allowedOrigins?: string[];
  notes?: string;
}

export interface AppSystemBranding {
  name: string;
  businessName?: string;
  shortName?: string;
  browserChromeColor?: string;
}

export interface AppSystemConfig {
  appId: string;
  brand: AppSystemBranding;
  theme: UiThemeConfig;
  security: SecurityPolicyConfig;
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export type FeedbackTone = "success" | "error" | "warning" | "info" | "loading";

export interface FeedbackItem {
  id?: string;
  tone?: FeedbackTone;
  title?: string;
  message?: string;
  durationMs?: number;
}

export type SecurityStateId =
  | "session-expired"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "blocked-action"
  | "verification-sent"
  | "password-reset-required"
  | "secure-download-failed";

export interface DataTableColumn<Row> {
  id: string;
  header: ReactNode;
  accessor?: keyof Row;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  width?: string;
  render?: (row: Row, rowIndex: number) => ReactNode;
  sortValue?: (row: Row) => string | number;
}

export interface DataTableSummaryCell {
  id: string;
  align?: "left" | "center" | "right";
  content: ReactNode;
  empty?: boolean;
}
