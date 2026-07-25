import { expect, test } from '@playwright/test';

const tree = {
  guildId: 'guild',
  categories: [{ id: 'cat', name: 'Categoria', type: 'category', channels: [{ id: 'channel', name: 'qa', type: 'text', messageable: true, allowed: true }] }],
  activeThreads: [],
};

async function mockApi(page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let body = { ok: true };
    if (url.pathname.endsWith('/auth/me')) body = { authenticated: true, operator: { id: 'operator', role: 'admin' } };
    else if (url.pathname.endsWith('/status')) body = { bot: { username: 'QA Bot' }, guild: { name: 'QA' } };
    else if (url.pathname.endsWith('/channels')) body = tree;
    else if (url.pathname.includes('/messages')) body = { channelId: 'channel', messages: [], hasMore: false };
    else if (url.pathname.endsWith('/automations')) body = { automations: [] };
    else if (url.pathname.endsWith('/exports')) body = { exports: [] };
    else if (url.pathname.endsWith('/ai/queries')) body = { queries: [] };
    else if (url.pathname.endsWith('/knowledge/documents')) body = { documents: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('console nao cria overflow horizontal nos viewports principais', async ({ page }) => {
  await mockApi(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 901, height: 768 }, { width: 980, height: 768 }, { width: 1440, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.app-shell')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/viewport-${viewport.width}.png`, fullPage: true });
  }
});

test('IA permanece utilizavel sem overflow em desktop e mobile', async ({ page }) => {
  await mockApi(page);
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('button:visible').filter({ hasText: /^IA$/ }).click();
    await expect(page.getByRole('heading', { name: 'Assistente de IA' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/ai-${viewport.width}.png`, fullPage: true });
  }
});
