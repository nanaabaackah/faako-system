import type { ErpNavItem, RoleValue } from "@faako/types";

export const normalizeRole = (value: RoleValue) => String(value || "").trim().toLowerCase();

export const normalizePath = (pathname = "", fallbackPath = "/") => {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || fallbackPath;
};

export const hasRoleAccess = (role: RoleValue, allowedRoles?: string[]) => {
  if (!allowedRoles?.length) return true;
  const normalizedRole = normalizeRole(role);
  return allowedRoles.some((allowedRole) => normalizeRole(allowedRole) === normalizedRole);
};

export const filterItemsByRole = <T extends { roles?: string[] }>(items: T[] = [], role: RoleValue) =>
  items.filter((item) => hasRoleAccess(role, item.roles));

export const isPathActive = (
  pathname: string,
  item: Pick<ErpNavItem, "path" | "matchPaths">,
  fallbackPath = "/",
) => {
  const currentPath = normalizePath(pathname, fallbackPath);
  const matchPaths = item.matchPaths?.length ? item.matchPaths : [item.path];

  return matchPaths.some((matchPath) => {
    const targetPath = normalizePath(matchPath, fallbackPath);
    return (
      currentPath === targetPath
      || (targetPath !== fallbackPath && currentPath.startsWith(`${targetPath}/`))
    );
  });
};

export const toTitleCase = (value = "") =>
  value
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getErpPageTitle = (
  pathname: string,
  brandName: string,
  pageTitles: Record<string, string> = {},
  fallbackPath = "/",
) => {
  const currentPath = normalizePath(pathname, fallbackPath);

  if (pageTitles[currentPath]) {
    return `${brandName} — ${pageTitles[currentPath]}`;
  }

  if (currentPath === fallbackPath) {
    return `${brandName} — Dashboard`;
  }

  const normalizedLabel = currentPath
    .replace(/^\/admin\/?/, "")
    .replace(/^\/+/, "");
  const label = toTitleCase(normalizedLabel) || "Dashboard";

  return `${brandName} — ${label}`;
};

export * from "./mobileBrowserChrome";
