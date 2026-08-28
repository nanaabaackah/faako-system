import { createBrowserApiClient } from "@faako/api-client";
import type { Role, User } from "@faako/types";
import { buildApiUrl } from "../api-url";

export interface DevAccessRole extends Role<number> {
  modules?: string[];
  userCount?: number;
}

export interface DevAccessUser extends User<number, number, number> {
  fullName?: string;
  role?: DevAccessRole;
}

export interface DevAccessUsersResponse {
  users: DevAccessUser[];
}

export interface DevAccessRolesResponse {
  modules: string[];
  roles: DevAccessRole[];
}

const client = createBrowserApiClient({
  credentials: "include",
  // The installed Dev ERP interceptor remains responsible for CSRF and its
  // proven single-flight session refresh. Resolving fetch at call time keeps
  // that behavior while the shared client adds request IDs and safe parsing.
  fetch: (input, init) => globalThis.fetch(input, init),
});

const path = (value: string) => buildApiUrl(value);

export const accessApi = {
  listUsers: () =>
    client.get<DevAccessUsersResponse>(path("/api/access/users"), {
      fallbackMessage: "Unable to load user access",
    }),
  listRoles: () =>
    client.get<DevAccessRolesResponse>(path("/api/access/roles"), {
      fallbackMessage: "Unable to load role access",
    }),
  updateRole: (id: number, payload: unknown) =>
    client.patch(path(`/api/access/roles/${id}`), {
      json: payload,
      fallbackMessage: "Unable to save role access",
    }),
  createUser: (payload: unknown) =>
    client.post<Record<string, unknown>>(path("/api/access/users"), {
      json: payload,
      fallbackMessage: "Unable to create user",
    }),
  updateUser: (id: number, payload: unknown) =>
    client.patch(path(`/api/access/users/${id}`), {
      json: payload,
      fallbackMessage: "Unable to update user",
    }),
  resendInvitation: (id: number) =>
    client.post<Record<string, unknown>>(path(`/api/access/users/${id}/resend-invitation`), {
      fallbackMessage: "Unable to resend setup link",
    }),
  removeUser: (id: number) =>
    client.delete<Record<string, unknown>>(path(`/api/access/users/${id}`), {
      fallbackMessage: "Unable to remove user",
    }),
};
