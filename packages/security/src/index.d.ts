export type AuthMode = "none" | "cookie" | "bearer";
export type SecurityProfileId =
  | "public-static"
  | "public-interactive"
  | "authenticated-workspace"
  | "api-service";

export const AUTHORIZATION_APPLICATION_IDS: Readonly<{
  DEV_ERP: "dev-erp";
  FAAKO_ERP: "faako-erp";
  REEBS_PORTAL: "reebs-portal";
  STROANE_ADMIN: "stroane-admin";
}>;

export const AUTHORIZATION_SCOPES: Readonly<{
  APPLICATION: "application";
  MODULE: "module";
  ACTION: "action";
}>;

export type AuthorizationScope =
  (typeof AUTHORIZATION_SCOPES)[keyof typeof AUTHORIZATION_SCOPES];

export const STANDARD_PERMISSION_ACTIONS: readonly string[];
export const DEV_ERP_MODULE_IDS: readonly [
  "dashboard",
  "projects",
  "proposals",
  "faako-onboarding",
  "rent",
  "accounting",
  "invoicing",
  "bookings",
  "organizations",
  "system-health",
  "reports",
  "audit-logs",
  "profile",
  "settings",
  "user-control",
];
export const STROANE_ADMIN_MODULE_IDS: readonly [
  "dashboard",
  "orders",
  "receipts",
  "accounting",
  "crm",
  "inventory",
  "team",
  "profile",
];
export const STROANE_ADMIN_ACTION_IDS: readonly [
  "view",
  "create",
  "edit",
  "delete",
  "archive",
  "manage",
];
export const REEBS_PERMISSION_IDS: readonly string[];

export interface PermissionDefinition {
  readonly id: string;
  readonly applicationId: string;
  readonly scope: AuthorizationScope;
  readonly moduleId?: string;
  readonly action?: string;
  readonly description?: string;
  readonly legacyIds: readonly string[];
}

export function buildPermissionIdentifier(
  moduleId: unknown,
  actionId: unknown,
): string;

export function definePermission(input?: {
  id?: unknown;
  applicationId?: unknown;
  moduleId?: unknown;
  action?: unknown;
  description?: unknown;
  legacyIds?: readonly unknown[];
}): PermissionDefinition;

export function hasPermissionIdentifier(
  grantedPermissionIds: readonly unknown[] | unknown,
  requiredPermissionId: unknown,
): boolean;

export function hasPermissionDefinition(
  grantedPermissionIds: readonly unknown[] | unknown,
  permissionDefinition?: PermissionDefinition | null,
): boolean;

export function hasApplicationAccess(
  applicationIds: readonly unknown[] | unknown,
  requiredApplicationId: unknown,
  options?: { unrestricted?: boolean },
): boolean;

export function hasModuleAccess(
  moduleIds: readonly unknown[] | unknown,
  requiredModuleId: unknown,
  options?: { unrestricted?: boolean },
): boolean;

export function isOrganisationAssignmentAllowed(input?: {
  assignedOrganisationIds?: readonly unknown[];
  authenticatedOrganisationId?: unknown;
  requestedOrganisationId?: unknown;
  unrestricted?: boolean;
}): boolean;

export const isOrganizationAssignmentAllowed:
  typeof isOrganisationAssignmentAllowed;

export function normalizeAuthMode(
  value: unknown,
  fallback?: AuthMode | "",
): AuthMode | "";

export function normalizeSecurityProfileId(
  value: unknown,
  fallback?: SecurityProfileId | "",
): SecurityProfileId | "";
