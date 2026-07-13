import * as Sentry from "@sentry/nextjs";

// Server-side error monitoring. Inert unless SENTRY_DSN is set —
// safe to ship before the Sentry project exists.
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Never attach request bodies — they can contain gateway payloads/PII
    sendDefaultPii: false,
  });
}

export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
  if (!process.env.SENTRY_DSN) return;
  return Sentry.captureRequestError(...args);
};
