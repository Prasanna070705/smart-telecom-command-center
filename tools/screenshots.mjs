// Full-page screenshots of every page with results on screen (default settings), into docs/screenshots/.
// Needs the API running and ui/dist built. Run: npm run screenshots
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const B = 'http://localhost:8787';
const DIR = new URL('../docs/screenshots/', import.meta.url);
await mkdir(DIR, { recursive: true });
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const nav = (name) => page.getByRole('button', { name, exact: true }).click();
const shot = async (file) => { await page.waitForTimeout(300); await page.screenshot({ path: new URL(file, DIR).pathname, fullPage: true }); console.log('saved docs/screenshots/' + file); };

await page.goto(B); await page.getByText('Engines ready').waitFor({ timeout: 60000 }); await page.getByText('7,043', { exact: true }).waitFor();
await shot('01-overview.png');
await nav('Pricing'); await page.getByRole('button', { name: 'Run Engine 1' }).click(); await page.getByText('$164,816').waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Run sensitivity' }).click(); await page.getByText('Same pattern in all 4 cases').waitFor({ timeout: 60000 });
await shot('02-pricing.png');
await nav('Retention'); await page.getByRole('button', { name: 'Run Engine 2' }).click(); await page.getByText('$182,949').first().waitFor({ timeout: 60000 });
await page.getByRole('button', { name: 'Run robustness' }).click(); await page.getByRole('table', { name: 'Robustness of the call list' }).getByText('Acceptance 50%').waitFor({ timeout: 120000 });
await page.getByText('Finished · 4 of 4 cases solved').waitFor({ timeout: 60000 });
await shot('03-retention.png');
await nav('Coupling'); await page.getByRole('button', { name: 'Run sweep' }).click(); await page.getByText('Finished', { exact: true }).waitFor({ timeout: 180000 });
await shot('04-coupling.png');
await nav('Data & checks'); await page.getByText('76 total').waitFor();
await shot('05-checks.png');
await browser.close();
