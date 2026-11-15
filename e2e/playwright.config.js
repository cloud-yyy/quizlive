const { defineConfig, devices } = require('@playwright/test');

/**
 * End-to-end tests run against the full docker-compose stack:
 *   RATE_LIMIT_AUTH_MAX=5000 RATE_LIMIT_MAX=100000 docker compose up -d --build
 * Uses the locally installed Google Chrome (no browser download needed).
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    channel: process.env.PW_CHANNEL || 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || 'chrome' } }],
});
