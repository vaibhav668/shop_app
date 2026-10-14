#!/usr/bin/env node
/**
 * Phone-width layout check for the admin dashboard (LOCAL DEVELOPMENT ONLY).
 *
 * Signs in as the local test admin (ui-check@example.com, promoted in the local database),
 * visits every page at 390 px wide, and reports anything that sticks out past the screen.
 * With OUT=<folder> it also saves a screenshot of each page.
 *
 * Needs: backend on :8000 with dev login, `npm run dev` on :5173, Chrome or Edge.
 *   npm run check:phone
 */
import { existsSync, mkdirSync } from 'node:fs';

import puppeteer from 'puppeteer-core';

const API = process.env.API ?? 'http://localhost:8000/api/v1';
const APP = process.env.APP ?? 'http://localhost:5173';
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const OUT = process.env.OUT;
const PAGES = [
  '/',
  '/orders',
  '/orders?status=all',
  '/products',
  '/products/new',
  '/inventory',
  '/inventory/quick',
  '/customers',
  '/categories',
  '/banners',
  '/settings',
];

const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome/Edge found; set CHROME=<path>.');

// Admin sessions are an httpOnly cookie set by the API.
const res = await fetch(`${API}/auth/dev-login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'ui-check@example.com', name: 'Poonam Sharma', client: 'admin' }),
});
if (!res.ok) throw new Error(`dev-login failed: ${res.status}`);
const cookies = res.headers.getSetCookie().map((c) => {
  const [pair, ...attrs] = c.split(';').map((s) => s.trim());
  const i = pair.indexOf('=');
  const path = attrs.find((a) => a.toLowerCase().startsWith('path='))?.slice(5) ?? '/';
  return { name: pair.slice(0, i), value: pair.slice(i + 1), domain: 'localhost', path };
});

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-first-run'],
});
const page = await browser.newPage();
await page.setViewport({
  width: W,
  height: H,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await page.setCookie(...cookies);
if (OUT) mkdirSync(OUT, { recursive: true });

/** Everything that sticks out past the viewport's right edge, or makes the page scroll sideways. */
async function overflowing() {
  return page.evaluate((vw) => {
    const out = [];
    const root = document.documentElement;
    if (root.scrollWidth > vw + 1)
      out.push(`page scrolls sideways (${root.scrollWidth}px > ${vw}px)`);
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (r.right > vw + 1 || r.left < -1) {
        // Ignore content inside its own horizontal scroller (tables, tab rows).
        let p = el.parentElement;
        let scrolled = false;
        while (p && p !== document.body) {
          const o = getComputedStyle(p).overflowX;
          if (
            (o === 'auto' || o === 'scroll' || o === 'hidden') &&
            p.getBoundingClientRect().right <= vw + 1
          ) {
            scrolled = true;
            break;
          }
          p = p.parentElement;
        }
        if (!scrolled) {
          const label = `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`;
          out.push(
            `${label} ends at ${Math.round(r.right)}px: "${(el.textContent ?? '').trim().slice(0, 40)}"`,
          );
        }
      }
    }
    return [...new Set(out)].slice(0, 8);
  }, W);
}

let problems = 0;
async function check(name, action) {
  await action?.();
  await new Promise((r) => setTimeout(r, 1200));
  const found = await overflowing();
  if (found.length) problems += 1;
  console.log(`${found.length ? 'OVERFLOW' : 'ok      '} ${name}`);
  for (const f of found) console.log(`           ${f}`);
  if (OUT) {
    const file = name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
    await page.screenshot({ path: `${OUT}/${file}.png` });
  }
}

for (const path of PAGES) {
  await page.goto(APP + path, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await check(path);
}

// The order panel (the one that overflowed), opened from the orders list.
await page.goto(`${APP}/orders?status=all`, { waitUntil: 'networkidle2' }).catch(() => {});
await check('order panel', async () => {
  await page.evaluate(() => document.querySelector('tbody tr:not([class*="loading"])')?.click());
});

await browser.close();
console.log(problems ? `\n${problems} page(s) with overflow` : '\nNo overflow at phone width.');
process.exit(problems ? 1 : 0);
