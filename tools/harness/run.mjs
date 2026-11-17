#!/usr/bin/env node
// Renders the panel in headless Chromium against a stub of the tracker's API and writes screenshots to
// tools/harness/out/. Fails on any page error or console error. Needs Playwright with Chromium installed.
//   node tools/harness/run.mjs
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// Resolved with require() so a globally installed Playwright (NODE_PATH) works as well as a local one.
const { chromium } = createRequire(import.meta.url)('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const out = join(here, 'out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/data/data-centers')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(await readFile(join(here, 'fixture.json')));
      return;
    }
    const path = url.pathname === '/' ? '/tools/harness/index.html' : url.pathname;
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/arcgisonline|net::ERR|Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`); });
// Esri imagery is not the point here; answer with an empty image so nothing waits on the network.
await page.route(/arcgisonline\.com/, (route) => route.fulfill({ status: 204 }));

await page.goto(`${base}/`);
await page.waitForFunction(() => typeof window.__dcfSearch === 'function');
await page.evaluate(() => window.__dcfSearch('18503'));
const inDrawer = (sel) => page.locator('#dcf-root').locator(sel);
await inDrawer('.hero h2').waitFor({ timeout: 15000 });
await inDrawer('.leaders li').first().waitFor({ timeout: 15000 });
await page.waitForTimeout(1200); // count-up animation and portraits
await page.screenshot({ path: join(out, 'tour.png') });
await inDrawer('.tour button').click(); // the first-open tutorial card
const text = await inDrawer('.body').innerText();
const expect = (cond, what) => { if (!cond) problems.push(`missing: ${what}`); };
expect(text.includes('Harness Campus'), 'project title');
expect(text.includes('Lackawanna County'), 'county tier');
expect(/Start here/.test(text), 'Start here box');
expect(/could instead/.test(text), 'comparison decks');
expect(/did you know/i.test(text), 'Did you know box'); // the heading is uppercased by CSS
await page.screenshot({ path: join(out, 'panel-en.png') });

// The composer, for the first starred official, then the three tones.
await inDrawer('[data-act="write-top"]').click();
await inDrawer('textarea.letter').waitFor();
const letter = await inDrawer('textarea.letter').inputValue();
expect(/^Dear /m.test(letter), 'salutation');
expect(/I urge you to:/.test(letter), 'asks list');
expect(/Harness Campus/.test(letter), 'project named in letter');
expect(/Sincerely,/.test(letter), 'sign-off');
await page.screenshot({ path: join(out, 'composer-en.png') });

// Language switch: the shell, the result and the composer are redrawn in place.
for (const lang of ['es', 'zh_CN']) {
  await inDrawer('select.lang').selectOption(lang);
  await page.waitForTimeout(600);
  const t = await inDrawer('.composer .ctop .t').innerText();
  expect(t && !/Write to/.test(t), `composer title translated to ${lang}`);
  const translated = await inDrawer('.translated .tx').count();
  expect(translated === 1, `translated copy shown in ${lang}`);
  await page.screenshot({ path: join(out, `composer-${lang}.png`) });
}
await inDrawer('select.lang').selectOption('en');
await inDrawer('.composer .x').click();

// Dark theme follows the tracker's data-theme attribute.
await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, 'panel-dark.png') });

await browser.close();
server.close();
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`ok: screenshots in ${out}`);
