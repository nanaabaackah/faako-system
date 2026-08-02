/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BACKEND_BASE_URL?: string;
  readonly VITE_REEBS_PORTAL_URL?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_GA_ID?: string;
  readonly VITE_ENABLE_GA_IN_DEV?: string;
  readonly VITE_ENABLE_APP_UPDATE_NOTICE?: string;
  readonly VITE_GOOGLE_MAPS_KEY?: string;
  readonly VITE_CURRENCY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
