/**
 * Error tracking via the Sentry SDK, reporting to self-hosted GlitchTip
 * (Sentry-compatible API). Enabled only when SENTRY_DSN is present, so local runs
 * and tests work without any external service.
 */
const config = require('../config');

let sentry = null;

function initSentry() {
  if (!process.env.SENTRY_DSN) return null;
  sentry = require('@sentry/node');
  sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: config.nodeEnv,
    release: process.env.APP_VERSION,
    tracesSampleRate: 0.1,
    // Do not leak credentials into error reports.
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        if (event.request.data) event.request.data = '[Filtered]';
      }
      return event;
    },
  });
  return sentry;
}

function captureException(err) {
  if (sentry) sentry.captureException(err);
}

module.exports = { initSentry, captureException, isEnabled: () => !!sentry };
