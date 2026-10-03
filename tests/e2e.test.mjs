// Browser end-to-end test: Chromium -> React UI -> Node API -> Python engines -> back to the screen.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const B = 'http://localhost:8787';
const waitUntil = Date.now() + Number(process.env.WAIT_MS || 60000);
for (;;) { try { const h = await (await fetch(B + '/api/health')).json(); if (h.ok) break; } catch {}
  if (Date.now() > waitUntil) { console.error('API not reachable on http://localhost:8787. Start it first with: npm run api'); process.exit(1); }
  await new Promise((r) => setTimeout(r, 300)); }
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const step = async (label, fn) => { const s = Date.now(); await fn(); console.log('PASS', label.padEnd(58), `${Date.now() - s} ms`); };
await step('Overview loads meta: 7,043 customers, R² 0.9988', async () => { await page.goto(B); await page.getByText('7,043', { exact: true }).waitFor(); await page.getByText('0.9988').waitFor(); await page.getByText('Engines ready').waitFor(); });
await step('Overview shows churn by contract 42.7%', () => page.getByText('42.7%').waitFor());
await step('No literal \\u escapes leaked into the page', async () => { const html = await page.content(); if (/\\u[0-9a-f]{4}/i.test(html)) throw new Error('escape leaked'); });
await step('Pricing: run Engine 1 → fibre −17.9%, churn ceiling', async () => {
  await page.getByRole('button', { name: 'Pricing' }).click(); await page.getByRole('button', { name: 'Run Engine 1' }).click();
  await page.getByText('−17.9%').waitFor({ timeout: 30000 }); await page.getByText('churn ceiling', { exact: true }).first().waitFor(); await page.getByText('+3.5%').waitFor(); });
await step('Pricing: value of 1% churn room = $164,816', () => page.getByText('$164,816').waitFor());
await step('Pricing: moving η slider and re-running changes fibre', async () => {
  const sl = page.getByLabel('Price sensitivity (η)'); await sl.focus(); for (let i = 0; i < 7; i++) await sl.press('ArrowRight');
  await page.getByText('1.5', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Run Engine 1' }).click(); await page.getByText('−18.3%').waitFor({ timeout: 30000 }); });
await step('Retention: run Engine 2 → $182,949, 901 called', async () => {
  await page.getByRole('button', { name: 'Retention' }).click(); await page.getByRole('button', { name: 'Run Engine 2' }).click();
  await page.getByText('$182,949').waitFor({ timeout: 60000 }); await page.getByText('901', { exact: true }).waitFor(); });
await step('Retention: call list paginates (page 1 of 61)', async () => { await page.getByText('Page 1 of 61').waitFor(); await page.getByRole('button', { name: 'Next' }).click(); await page.getByText('Page 2 of 61').waitFor(); });
await step('Retention: CSV export downloads 902 lines', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  const txt = await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'); if (txt.trim().split('\n').length !== 902) throw new Error('rows ' + txt.split('\n').length); });
await step('Coupling: background job for $0 and $15,000 finishes, curve drawn', async () => {
  await page.getByRole('button', { name: 'Coupling' }).click(); await page.getByLabel('Budgets in dollars, comma separated').fill('0, 15000');
  await page.getByRole('button', { name: 'Run sweep' }).click(); await page.getByText('Finished').waitFor({ timeout: 120000 });
  await page.getByText('$1.29M').waitFor(); await page.getByText('$2.34M').waitFor(); await page.locator('svg[aria-label="Net lifetime-profit gain by retention budget"] circle').nth(1).waitFor(); });
await step('Invalid input surfaces the API error message', async () => {
  const r = await page.evaluate(async () => (await fetch('/api/engine1', { method: 'POST', body: JSON.stringify({ eta: 99 }) })).status); if (r !== 400) throw new Error('status ' + r); });
await page.screenshot({ path: '/tmp/e2e_unstyled.png' });
console.log(errors.length ? 'BROWSER ERRORS: ' + errors.join(' | ') : 'no browser console errors');
await browser.close();
