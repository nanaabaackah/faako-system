/// <reference types="astro/client" />

// The demo imports only this pure, build-time renderer, never API runtime code.
declare module "*travel-with-ease-api/src/notifications/enquiry-template.js" {
  export function enquiryTemplate(input?: { name?: string; test?: boolean }): {
    subject: string;
    html: string;
    text: string;
  };
}

interface ImportMetaEnv {
  readonly PUBLIC_API_BASE_URL?: string;
  readonly PUBLIC_GA_MEASUREMENT_ID?: string;
  readonly PUBLIC_GOOGLE_SITE_VERIFICATION?: string;
}
