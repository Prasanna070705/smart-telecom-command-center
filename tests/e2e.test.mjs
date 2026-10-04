// Browser end-to-end test: Chromium -> React UI -> Node API -> Python engines -> back to the screen.
import { createRequire } from 'node:module';
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
// BROWSER=chromium (default) | chrome (installed Google Chrome) | webkit | firefox
const BROWSER = process.env.BROWSER || 'chromium';
const launch = () => (BROWSER === 'chrome' ? pw.chromium.launch({ channel: 'chrome' }) : pw[BROWSER].launch());
const B = process.env.API_URL || 'http://localhost:8787';   // API_URL=... to test another server
const waitUntil = Date.now() + Number(process.env.WAIT_MS || 60000);
for (;;) { try { const h = await (await fetch(B + '/api/health')).json(); if (h.ok) break; } catch {}
  if (Date.now() > waitUntil) { console.error(`API not reachable on ${B}. Start it first with: npm run api`); process.exit(1); }
  await new Promise((r) => setTimeout(r, 300)); }
const browser = await launch(); console.log('browser:', BROWSER, browser.version()); const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const step = async (label, fn) => { const s = Date.now(); await fn(); console.log('PASS', label.padEnd(58), `${Date.now() - s} ms`); };
await step('Overview loads meta: 7,043 customers, R² 0.9988', async () => { await page.goto(B); await page.getByText('7,043', { exact: true }).waitFor(); await page.getByText('0.9988', { exact: true }).waitFor(); await page.getByText('Engines ready').waitFor(); });
await step('Overview shows churn by contract 42.7%', () => page.getByText('42.7%').waitFor());
await step('No literal \\u escapes leaked into the page', async () => { const html = await page.content(); if (/\\u[0-9a-f]{4}/i.test(html)) throw new Error('escape leaked'); });
await step('Pricing: run Engine 1 → fibre −17.9%, churn ceiling', async () => {
  await page.getByRole('button', { name: 'Pricing' }).click(); await page.getByRole('button', { name: 'Run Engine 1' }).click();
  await page.getByText('−17.9%').waitFor({ timeout: 30000 }); await page.getByText('churn ceiling', { exact: true }).first().waitFor(); await page.getByText('+3.5%').waitFor(); });
await step('No stray backslash-quotes in visible text (pages with the shared settings)', async () => {
  const bad = await page.evaluate(() => document.body.innerText.includes("\\'")); if (bad) throw new Error("a literal \\' is visible"); });
await step('Pricing: value of 1% churn room = $164,816', () => page.getByText('$164,816').waitFor());
await step('Pricing: moving η slider and re-running changes fibre', async () => {
  const sl = page.getByLabel('Price sensitivity (η)', { exact: true }); await sl.focus(); for (let i = 0; i < 7; i++) await sl.press('ArrowRight');
  await page.getByText('1.5', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Run Engine 1' }).click(); await page.getByText('−18.3%').waitFor({ timeout: 30000 }); });
await step('Pricing: sensitivity panel shows the same pattern for eta 0.4-1.5', async () => {
  await page.getByRole('button', { name: 'Run sensitivity' }).click(); await page.getByText('Same pattern in all 4 cases').waitFor({ timeout: 60000 });
  await page.getByRole('table', { name: 'Price change by price sensitivity' }).getByText('η 1.5').waitFor(); });
await step('Retention: run Engine 2 → $149,869, 740 current customers called', async () => {
  await page.getByRole('button', { name: 'Retention' }).click(); await page.getByRole('button', { name: 'Run Engine 2' }).click();
  await page.getByText('$149,869').waitFor({ timeout: 60000 }); await page.getByText('740', { exact: true }).filter({ visible: true }).first().waitFor(); });
await step('Retention: the budget is typed; an invalid amount disables Run', async () => {
  await page.getByText('each call takes 30-60 minutes').waitFor(); await page.getByText('published studies average 30%').waitFor();   // help text from /api/meta
  const b = page.getByLabel('Retention budget', { exact: true }); await b.fill(''); await page.getByText('Enter a whole number of dollars').waitFor();
  if (await page.getByRole('button', { name: 'Run Engine 2' }).isEnabled()) throw new Error('Run enabled with no budget');
  await b.fill('45000'); await page.getByRole('button', { name: 'Run Engine 2' }).click(); await page.getByText('expected · LP bound').waitFor();
  await page.getByText('$149,869').waitFor({ state: 'detached', timeout: 60000 });
  await b.fill('30000'); await page.getByRole('button', { name: 'Run Engine 2' }).click(); await page.getByText('$149,869').first().waitFor({ timeout: 60000 }); });
await step('Retention: call list paginates (page 1 of 50)', async () => { await page.getByText('Page 1 of 50').waitFor(); await page.getByRole('button', { name: 'Next' }).click(); await page.getByText('Page 2 of 50').waitFor(); });
await step('Retention: CSV export downloads 741 lines (740 customers + header)', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  const txt = await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'); if (txt.trim().split('\n').length !== 741) throw new Error('rows ' + txt.split('\n').length); });
await step('Retention: a solve that stopped at the time limit says so', async () => {
  await page.route('**/api/engine2', async (route) => { const r = await route.fetch(); const body = await r.json(); route.fulfill({ response: r, json: { ...body, timeLimitHit: true, timeLimitS: 30 } }); });
  await page.getByRole('button', { name: 'Run Engine 2' }).click(); await page.getByText(/Stopped at the 30 s solver time limit/).waitFor();
  await page.unroute('**/api/engine2'); await page.getByRole('button', { name: 'Run Engine 2' }).click();
  await page.getByText(/Stopped at the 30 s solver time limit/).waitFor({ state: 'detached' }); });
await step('Retention: Engine 2 shows a clock, and warns when a background run shares the server', async () => {
  await page.route('**/api/health', (r) => r.fulfill({ json: { ok: true, workers: { fast: true, jobs: true }, jobsRunning: ['coupling'] } }));
  await page.route('**/api/engine2', async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.continue(); });
  await page.getByRole('button', { name: 'Run Engine 2' }).click(); await page.getByText('Solving Engine 2', { exact: true }).waitFor();
  await page.getByText('A background run (coupling sweep) is using the server at the same time').waitFor();
  await page.getByText('Solving Engine 2', { exact: true }).waitFor({ state: 'detached' }); await page.unroute('**/api/health'); await page.unroute('**/api/engine2'); });
await step('Retention: robustness panel solves four cases (background job)', async () => {
  await page.getByRole('button', { name: 'Run robustness' }).click(); const tb = page.getByRole('table', { name: 'Robustness of the call list' });
  await tb.getByText('Base (these settings)').waitFor({ timeout: 120000 }); await tb.getByText('Contract effects ×0.5').waitFor();
  await tb.getByText(/^\$123,\d{3}$/).waitFor(); await tb.getByText('Acceptance 50%').waitFor(); await tb.getByText(/^\$201,\d{3}$/).waitFor(); });
await step('Shared settings: changing margin marks the call list stale; reset clears it', async () => {
  const stale = page.getByText('Settings changed since this run. Run again to update.').filter({ visible: true });
  const m = page.getByLabel('Profit margin', { exact: true }); await m.focus(); await m.press('ArrowRight'); await page.getByText('75%', { exact: true }).waitFor();
  await stale.first().waitFor(); await page.getByRole('button', { name: 'Reset to defaults' }).click();
  await page.getByText('70%', { exact: true }).waitFor(); if (await stale.count()) throw new Error('still stale after reset'); });
await step('Coupling: background job for $0 and $15,000 finishes, curve drawn', async () => {
  await page.getByRole('button', { name: 'Coupling' }).click(); await page.getByLabel('Budgets in dollars, comma separated').fill('0, 15000');
  await page.getByRole('button', { name: 'Run sweep' }).click(); await page.getByText('Finished', { exact: true }).filter({ visible: true }).waitFor({ timeout: 120000 });
  const sweep = page.locator('table', { hasText: 'Net gain' });   // the chart's axis labels can show the same amounts
  await sweep.getByText('$1.29M', { exact: true }).waitFor(); await sweep.getByText(/^\$2\.2\dM$/).waitFor(); await page.locator('svg[aria-label="Net lifetime-profit gain by retention budget"] circle').nth(1).waitFor(); });
await step('Coupling: the same sweep again reuses the finished run', async () => {
  await page.getByRole('button', { name: 'Run sweep' }).click(); await page.getByText('Reused a finished run with the same settings.').filter({ visible: true }).waitFor(); });
await step('Coupling: a sweep the server lost says so', async () => {
  await page.route('**/api/jobs/*', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 404, json: { error: 'no such job' } }) : r.continue()));
  await page.getByLabel('Budgets in dollars, comma separated').fill('0, 45000'); await page.getByRole('button', { name: 'Run sweep' }).click();
  await page.getByText('The server restarted and this run was lost. Start it again.').waitFor(); await page.getByText('Interrupted', { exact: true }).filter({ visible: true }).waitFor();
  await page.unroute('**/api/jobs/*'); });
await step('Coupling: a running sweep can be cancelled', async () => {
  await page.getByLabel('Budgets in dollars, comma separated').fill('0, 15000, 30000, 60000');
  await page.getByRole('button', { name: 'Run sweep' }).click(); await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByText('Cancelled', { exact: true }).filter({ visible: true }).waitFor({ timeout: 10000 }); });
await step('Index: agent time and cost per offer from the API; verification counts', async () => {
  await page.getByRole('button', { name: 'Index', exact: true }).click(); const t = page.getByRole('table', { name: 'Agent time and cost per offer' });
  await t.getByRole('row', { name: /Two-year contract 0\.75 h \(45 min\)/ }).waitFor(); await t.getByText('$23.35').waitFor(); await page.getByText('76 total').waitFor(); });
await step('Index: a "?" next to a label opens that term', async () => {
  await page.getByRole('button', { name: 'Retention', exact: true }).click(); await page.getByRole('button', { name: 'Acceptance rate: explain in the Index' }).click();
  await page.waitForFunction(() => location.hash === '#term-acceptance' && !document.querySelector('#term-acceptance').closest('[hidden]'), null, { timeout: 5000 });
  await page.evaluate(() => history.replaceState(null, '', location.pathname)); });
await step('Sidebar and logo stay in view when the page scrolls', async () => {
  await page.getByRole('button', { name: 'Retention', exact: true }).click(); await page.mouse.wheel(0, 1500); await page.waitForTimeout(300);
  const top = await page.evaluate(() => [scrollY, document.querySelector('aside').getBoundingClientRect().top]);
  if (top[0] < 500) throw new Error('page did not scroll: ' + top[0]); if (Math.abs(top[1]) > 1) throw new Error('sidebar moved to ' + top[1]);
  await page.evaluate(() => scrollTo(0, 0)); });
await step('Ambient background animates, and stands still under reduced motion', async () => {
  const frame = () => page.evaluate(() => document.querySelector('canvas[data-ambient]').toDataURL());
  const a = await frame(); await page.waitForTimeout(600); if ((await frame()) === a) throw new Error('background not moving');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100);
  const b = await frame(); await page.waitForTimeout(600); const c = await frame();
  await page.emulateMedia({ reducedMotion: 'no-preference' }); if (b !== c) throw new Error('background moves under reduced motion'); });
await step('Invalid input surfaces the API error message', async () => {
  const r = await page.evaluate(async () => (await fetch('/api/engine1', { method: 'POST', body: JSON.stringify({ eta: 99 }) })).status); if (r !== 400) throw new Error('status ' + r); });
await step('Theme: dark mode applies, survives a reload, and light mode returns', async () => {
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole('button', { name: 'Dark', exact: true }).click(); if (!(await isDark())) throw new Error('no .dark after Dark');
  const dark = await bodyBg(); await page.reload(); await page.getByText('7,043', { exact: true }).waitFor({ timeout: 30000 });
  if (!(await isDark())) throw new Error('dark not kept after reload');
  await page.getByRole('button', { name: 'Light', exact: true }).click(); if (await isDark()) throw new Error('.dark still set after Light');
  if ((await bodyBg()) === dark) throw new Error('background did not change: ' + dark); });
await page.screenshot({ path: (await import('node:path')).join((await import('node:os')).tmpdir(), 'e2e_last_page.png') });
console.log(errors.length ? 'BROWSER ERRORS: ' + errors.join(' | ') : 'no browser console errors');
await browser.close();
