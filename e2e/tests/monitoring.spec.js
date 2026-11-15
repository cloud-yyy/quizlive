const { test, expect } = require('@playwright/test');
const { adminHeaders } = require('./helpers');

test.describe('Monitoring endpoints', () => {
  test('/health and /metrics respond through the web proxy', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok', db: 'up' });
    const metrics = await (await request.get('/api/metrics')).json();
    expect(metrics.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(metrics.requests.total).toBeGreaterThan(0);
  });

  test('status dashboard page renders live metrics', async ({ page }) => {
    await page.goto('/api/status');
    await expect(page.locator('#state')).toContainText('API: ok');
    await expect(page.locator('#state')).toContainText('database: up');
    await expect(page.locator('#t')).toContainText('Requests handled');
  });

  test('test error endpoint is admin-only', async ({ request }) => {
    expect((await request.get('/api/debug/error')).status()).toBe(401);
    const res = await request.get('/api/debug/error', { headers: await adminHeaders(request) });
    expect(res.status()).toBe(500);
  });
});
