export const AUTH_SESSION_INVALID_EVENT: string;

export function readStoredSessionUser(): unknown;
export function hasStoredSession(): boolean;
export function writeStoredSession(user: unknown): void;
export function clearStoredSession(options?: { notify?: boolean; reason?: string }): void;
export function addSessionInvalidListener(listener: (detail?: unknown) => void): () => void;
export function normalizeLegacySessionToken(): void;
