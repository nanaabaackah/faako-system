interface ImportMetaEnv {
  readonly DEV?: boolean;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BACKEND_BASE_URL?: string;
}

interface ImportMeta {
  readonly env?: ImportMetaEnv;
}
