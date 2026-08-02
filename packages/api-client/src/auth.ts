import type { ApiClient, ApiRequestOptions } from "./request.ts";

export interface AuthRoutes {
  login: string;
  logout: string;
  session: string;
  forgotPassword: string;
  resetPassword: string;
}

export const DEFAULT_AUTH_ROUTES: AuthRoutes = Object.freeze({
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  session: "/api/auth/me",
  forgotPassword: "/api/auth/forgot-password",
  resetPassword: "/api/auth/reset-password",
});

export const createAuthApi = <
  LoginBody = unknown,
  LoginResponse = unknown,
  SessionResponse = unknown,
  ForgotPasswordBody = unknown,
  ForgotPasswordResponse = unknown,
  ResetPasswordBody = unknown,
  ResetPasswordResponse = unknown,
  LogoutResponse = unknown,
>(
  client: ApiClient,
  routes: AuthRoutes = DEFAULT_AUTH_ROUTES,
) => ({
  login: (body: LoginBody, options: ApiRequestOptions = {}) =>
    client.post<LoginResponse>(routes.login, { ...options, json: body }),
  logout: (options: ApiRequestOptions = {}) =>
    client.post<LogoutResponse>(routes.logout, options),
  session: (options: ApiRequestOptions = {}) =>
    client.get<SessionResponse>(routes.session, options),
  forgotPassword: (
    body: ForgotPasswordBody,
    options: ApiRequestOptions = {},
  ) =>
    client.post<ForgotPasswordResponse>(routes.forgotPassword, {
      ...options,
      json: body,
    }),
  resetPassword: (
    body: ResetPasswordBody,
    options: ApiRequestOptions = {},
  ) =>
    client.post<ResetPasswordResponse>(routes.resetPassword, {
      ...options,
      json: body,
    }),
});
