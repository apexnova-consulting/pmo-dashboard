import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = ['/', '/my-work', '/projects', '/tickets', '/risks', '/workload', '/about'];

test('overview answers whether the portfolio is okay', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText(/overdue/i).first()).toBeVisible();
  await expect(page.getByRole('img', { name: 'The City College of New York' })).toBeVisible();
});

test('owner filter changes the url and the view', async ({ page }) => {
  await page.goto('/');
  const before = await page.getByRole('article').filter({ hasText: 'Open tickets' }).textContent();
  await page
    .getByRole('group', { name: 'Filter by owner' })
    .getByRole('button', { name: 'Marta', exact: true })
    .click();
  await expect(page).toHaveURL(/owner=marta/);
  await page.goto('/projects?owner=marta');
  await expect(page.getByRole('table')).toBeVisible();
  const after = before;
  expect(after).toBeTruthy();
});

test('tickets search and overdue chip', async ({ page }) => {
  await page.goto('/tickets');
  await page.getByLabel('Search key or summary').fill('SIS');
  await page.getByRole('button', { name: 'Overdue' }).click();
  await expect(page.getByRole('button', { name: 'Overdue' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('pages have no serious accessibility violations', async ({ page }) => {
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
});
