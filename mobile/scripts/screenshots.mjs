#!/usr/bin/env node
/**
 * Screenshots of the running web preview at phone size, signed in as a local test customer.
 * LOCAL DEVELOPMENT ONLY: it uses the backend's dev-only login (DEV_LOGIN_ENABLED in local/test).
 *
 * Needs: the backend on :8000, `npx expo start` on :8081, and Chrome or Edge installed.
 *
 *   npm run screenshots                     # every main screen → screenshots/
 *   npm run screenshots -- / /cart          # just these routes
 *
 * With CHECK=1 it also reports anything that sticks out past the screen edge.
 * Env: OUT (folder), W/H (viewport), DPR (pixel ratio), CHROME (browser path), CART=1 (put 3 items in the cart
 * first), SCROLL=<px> (scroll the main list before the shot), WAIT=<ms> (settle time).
 */
import { existsSync, mkdirSync } from 'node:fs';

import puppeteer from 'puppeteer-core';

const API = process.env.API ?? 'http://localhost:8000/api/v1';
const APP = process.env.APP ?? 'http://localhost:8081';
const OUT = process.env.OUT ?? 'screenshots';
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const WAIT = Number(process.env.WAIT ?? 3500);
const DPR = Number(process.env.DPR ?? 2);
const DEFAULT_ROUTES = ['/', '/categories', '/search', '/cart', '/orders', '/account'];

const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

async function call(path, init = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!r.ok && r.status !== 404) throw new Error(`${init.method ?? 'GET'} ${path} → ${r.status}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome/Edge found; set CHROME=<path to the browser>.');

// A throwaway local customer with a phone number, so onboarding is already done.
const auth = await call('/auth/dev-login', {
  method: 'POST',
  body: JSON.stringify({ email: 'ui-check@example.com', name: 'Poonam Sharma', client: 'mobile' }),
});
const bearer = { Authorization: `Bearer ${auth.access_token}` };
await call('/me', {
  method: 'PATCH',
  headers: bearer,
  body: JSON.stringify({ name: 'Poonam Sharma', phone: '9876543210' }),
});
if (process.env.CART) {
  const page = await call('/products?limit=6&offset=0&in_stock_only=true', { headers: bearer });
  for (const p of page.items.slice(0, 3)) {
    await call(`/cart/items/${p.id}`, {
      method: 'PUT',
      headers: bearer,
      body: JSON.stringify({ quantity: 2 }),
    });
  }
}

const routes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES;
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-first-run'],
});
const page = await browser.newPage();
await page.setViewport({
  width: W,
  height: H,
  deviceScaleFactor: DPR,
  isMobile: true,
  hasTouch: true,
});
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('GSI_LOGGER')) {
    console.log('CONSOLE', m.text().slice(0, 300));
  }
});

// Let the first load settle (it tries a refresh with no token and clears storage), then sign in.
await page.goto(APP, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));
await page.evaluate((token) => {
  localStorage.setItem('bada-bazar.refresh-token', token);
  localStorage.setItem('bada-bazar.intro-seen', '1');
}, auth.refresh_token);

for (const route of routes) {
  await page.goto(APP + route, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, WAIT));
  if (process.env.SCROLL) {
    await page.evaluate((y) => {
      const scroller = [...document.querySelectorAll('div')].find(
        (d) => d.scrollHeight > d.clientHeight + 50 && getComputedStyle(d).overflowY !== 'visible',
      );
      if (scroller) scroller.scrollTop = y;
    }, Number(process.env.SCROLL));
    await new Promise((r) => setTimeout(r, 900));
  }
  if (process.env.CHECK) {
    const found = await page.evaluate((vw) => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || st.visibility === 'hidden' || st.display === 'none')
          continue;
        if (r.right <= vw + 1 && r.left >= -1) continue;
        // Content inside its own sideways scroller (rails, tab rows) may extend past the edge.
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
        if (!scrolled)
          out.push(
            `${el.tagName.toLowerCase()} ends at ${Math.round(r.right)}px: "${(el.textContent ?? '').trim().slice(0, 40)}"`,
          );
      }
      return [...new Set(out)].slice(0, 6);
    }, W);
    console.log(found.length ? `OVERFLOW ${route}` : `ok       ${route}`);
    found.forEach((f) => console.log(`           ${f}`));
  }
  const name = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
  await page.screenshot({ path: `${OUT}/${name}${process.env.SCROLL ? '_scrolled' : ''}.png` });
  console.log('shot', route);
}
await browser.close();
