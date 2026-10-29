import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = ['/', '/my-work', '/projects', '/updates', '/risks', '/workload', '/about'];

test('portfolio overview has no ticket KPIs and names No data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'The City College of New York' })).toBeVisible();
  await expect(page.getByText('Open tickets')).toHaveCount(0);
  await expect(page.getByText(/no data/i).first()).toBeVisible();
  await expect(page.getByText(/Data as of/i).first()).toBeVisible();
  await expect(page.getByText(/Oct 28/i).first()).toBeVisible();
});

test('email updates show a badge and a link', async ({ page }) => {
  await page.goto('/updates?source=email');
  await expect(page.getByRole('link', { name: /Email source/i }).first()).toBeVisible();
});

test('owner filter changes the url and the project list', async ({ page }) => {
  await page.goto('/projects');
  await page
    .getByRole('group', { name: 'Filter by owner' })
    .getByRole('button', { name: 'Marta', exact: true })
    .click();
  await expect(page).toHaveURL(/owner=marta/);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('rowheader', { name: /Learning Management Upgrade/ })).toBeVisible();
});

test('ticket scenario still shows tickets', async ({ page }) => {
  await page.goto('/tickets?scenario=tickets');
  await expect(page.getByRole('heading', { name: 'Tickets & Tasks' })).toBeVisible();
});

test('portfolio hides the ticket table', async ({ page }) => {
  await page.goto('/tickets');
  await expect(page.getByRole('heading', { name: 'No tickets in this snapshot' })).toBeVisible();
});

test('malformed snapshot keeps the last good data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.goto('/?scenario=malformed');
  await expect(page.getByText(/last good snapshot/i)).toBeVisible();
});

test('refresh reload and unchanged runs announce the outcome', async ({ page }) => {
  await page.goto('/?scenario=refresh-reload');
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText(/Reloaded the latest data/i)).toBeVisible({ timeout: 15_000 });

  await page.goto('/?scenario=refresh-unchanged');
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText(/did not change/i)).toBeVisible({ timeout: 15_000 });
});

test('a second refresh attaches to the run already going', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem(
      'pmo-mock-refresh:portfolio',
      JSON.stringify({
        generatedAt: null,
        active: {
          runId: 'run-existing',
          startedAtMs: Date.now(),
          fail: false,
          triggeredBy: 'test',
        },
        history: [],
      }),
    );
  });
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText(/already in progress/i)).toBeVisible();
});

test('pages have no serious accessibility violations', async ({ page }) => {
  test.slow();
  for (const route of routes) {
    await page.goto(route);
    await page.getByRole('heading', { level: 1 }).waitFor();
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    );
    expect(serious, `${route} ${serious.map((item) => item.id).join(',')}`).toEqual([]);
  }
});

test('mobile width still shows the overview', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Updates' })).toBeVisible();
});
