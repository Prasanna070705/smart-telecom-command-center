// Full-page screenshots of every page with results on screen (default settings), into docs/screenshots/.
// Needs the API running and ui/dist built. Run: npm run screenshots   (THEME=dark for docs/screenshots/dark/)
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const B = process.env.API_URL || 'http://localhost:8787';
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const DIR = new URL(THEME === 'dark' ? '../docs/screenshots/dark/' : '../docs/screenshots/', import.meta.url);
await mkdir(DIR, { recursive: true });
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript((t) => localStorage.setItem('theme', t), THEME);   // before the page's own theme script runs
const nav = (name) => page.getByRole('button', { name, exact: true }).click();
// waits 900 ms first so entry animations have finished
// scrolls to the top first, so the sticky sidebar is drawn in place in a full-page shot
const shot = async (file) => { await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(900); await page.screenshot({ path: fileURLToPath(new URL(file, DIR)), fullPage: true }); console.log(`saved ${fileURLToPath(new URL(file, DIR))}`); };

await page.goto(B); await page.getByText('Engines ready').waitFor({ timeout: 60000 }); await page.getByText('7,043', { exact: true }).waitFor();
await shot('01-overview.png');
await nav('Pricing'); await page.getByRole('button', { name: 'Run Engine 1' }).click(); await page.getByText('$164,816').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Run sensitivity' }).click(); await page.getByText('Same pattern in all 4 cases').waitFor({ timeout: 60000 });
await shot('02-pricing.png');
await nav('Retention'); await page.getByRole('button', { name: 'Run Engine 2' }).click(); await page.getByText('expected · LP bound').filter({ visible: true }).first().waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Run robustness' }).click(); await page.getByRole('table', { name: 'Robustness of the call list' }).getByText('Acceptance 50%').waitFor({ timeout: 120000 });
await page.getByText('Finished', { exact: true }).filter({ visible: true }).waitFor({ timeout: 60000 });
await shot('03-retention.png');
await nav('Coupling'); await page.getByRole('button', { name: 'Run sweep' }).click(); await page.getByText('Finished', { exact: true }).filter({ visible: true }).waitFor({ timeout: 180000 });
await shot('04-coupling.png');
await nav('Index'); await page.getByText('76 total').waitFor();
await shot('05-index.png');
await browser.close();
