/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ENABLE_APP_UPDATE_NOTICE?: string;
  readonly VITE_ENABLE_GA_IN_DEV?: string;
  readonly VITE_ERP_DEMO_URL?: string;
  readonly VITE_GA_ID?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_KPI_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
