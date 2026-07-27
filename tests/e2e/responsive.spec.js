import { expect, test } from '@playwright/test';

const tree = {
  guildId: 'guild',
  categories: [{
    id: 'uncategorized',
    name: 'SEM CATEGORIA',
    type: 'category',
    virtual: true,
    channels: [
      { id: 'channel', name: 'qa-sem-categoria', type: 'text', messageable: true, allowed: true },
      { id: 'forum', name: 'forum-sem-categoria', type: 'forum', messageable: false, allowed: true },
    ],
  }],
  activeThreads: [{ id: 'thread', name: 'topico-ativo', type: 'thread', messageable: true, allowed: true }],
};

const completedAiQuery = {
  id: 'query-completed',
  prompt: 'Explique detalhadamente a reorganizacao',
  status: 'completed',
  resultJson: {
    answerType: 'narrative',
    responseDepth: 'detailed',
    title: 'Reorganizacao do servidor',
    summary: 'A administracao discutiu uma reorganizacao ampla baseada nas mensagens selecionadas.',
    sections: [
      {
        heading: 'Contexto',
        body: 'A decisao surgiu depois de uma revisao da estrutura atual.\n\nAs fontes registram preocupacoes operacionais.',
        evidenceIds: ['evidence-1'],
      },
      {
        heading: 'Consequencias',
        body: 'A mudanca exige preservar documentos importantes antes da limpeza.',
        evidenceIds: ['evidence-1'],
      },
    ],
    facts: [{
      statement: 'A reorganizacao foi discutida pela administracao.',
      evidenceIds: ['evidence-1'],
      confidence: 'high',
    }],
    interpretations: [],
    hypotheses: [],
    recommendations: [],
    affectedHouses: [],
    lawsAndTraditions: [],
    limitations: [],
  },
  evidence: [{
    id: 'evidence-1',
    sourceType: 'discord_message',
    excerpt: 'Precisamos reorganizar os canais.',
    metadataJson: { authorName: 'Operador', createdAt: '2026-07-26T12:00:00Z' },
  }],
};

async function mockApi(page, { withAiResult = false } = {}) {
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
    else if (url.pathname.endsWith('/ai/queries/query-completed')) {
      body = { query: completedAiQuery };
    } else if (url.pathname.endsWith('/ai/queries')) {
      body = { queries: withAiResult ? [completedAiQuery] : [] };
    }
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
    await expect(page.getByRole('heading', { name: 'Base de conhecimento' })).toHaveCount(0);
    const scope = page.getByRole('group', { name: 'Locais da pesquisa' });
    await expect(scope.getByText('qa-sem-categoria')).toBeVisible();
    await expect(scope.getByText('forum-sem-categoria')).toBeVisible();
    await expect(scope.getByText('topico-ativo')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/ai-${viewport.width}.png`, fullPage: true });
  }
});

test('IA apresenta explicacao detalhada antes dos dados em desktop e mobile', async ({ page }) => {
  await mockApi(page, { withAiResult: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('button:visible').filter({ hasText: /^IA$/ }).click();
    await page.getByRole('button', { name: /Explique detalhadamente/ }).click();
    await expect(page.getByRole('heading', { name: 'Reorganizacao do servidor' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contexto' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dados da analise' })).toBeVisible();
    await expect(page.getByText('Alta confianca')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
