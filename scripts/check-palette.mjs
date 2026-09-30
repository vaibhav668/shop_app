#!/usr/bin/env node
/**
 * Guards the "Emerald Royal" identity (docs/UI_SYSTEM.md):
 *  1. Every hex colour in the frontends must come from the approved palette.
 *  2. Hex colours may only be written in the token files (plus config/assets that can't import tokens).
 *  3. Named blue/purple colours are never allowed.
 * Usage: node scripts/check-palette.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const PALETTE = new Set(
  [
    // Greens: brand, forest emerald, leaf and mint
    '#16A34A', '#15803D', '#166534', '#14532D', '#052E16', '#86EFAC', '#DCFCE7',
    // Neutrals
    '#FAFAF7', '#FFFFFF', '#FFF', '#F5F5F4',
    '#171717', '#737373', '#A3A3A3',
    '#E7E5E4', '#D6D3D1',
    // Gold and foil
    '#F59E0B', '#FBBF24', '#FDE68A', '#FEF3C7', '#92400E', '#B45309',
    // Soft tints behind product art
    '#E3F7E8', '#E8EFE2', '#FEF6D8', '#FFEEDC', '#F3EDE2', '#EEF7D6',
    // Danger
    '#DC2626', '#FEE2E2',
    // Produce illustrations only (components/art)
    '#EF4444', '#991B1B', '#F97316', '#4ADE80', '#FDF6E7',
  ].map((c) => c.toLowerCase()),
);

/** Files allowed to contain hex literals. */
const HEX_ALLOWED_FILES = new Set([
  'mobile/src/theme/tokens.ts',
  'mobile/app.config.ts',
  'admin/src/styles/tokens.css',
  'admin/public/favicon.svg',
]);

const SCAN = ['mobile/src', 'mobile/app.config.ts', 'admin/src', 'admin/index.html', 'admin/public'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.svg', '.json']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.expo']);

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const BANNED_NAMES =
  /['"`:\s](blue|navy|indigo|purple|violet|royalblue|dodgerblue|midnightblue|slateblue|darkblue)['"`;\s]/gi;

function* walk(path) {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (!stat) return;
  if (stat.isFile()) {
    if (EXTENSIONS.has(extname(path))) yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (!SKIP_DIRS.has(entry)) yield* walk(join(path, entry));
  }
}

const problems = [];
for (const target of SCAN) {
  for (const file of walk(join(ROOT, target))) {
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const [hex] of line.matchAll(HEX)) {
        if (!PALETTE.has(hex.toLowerCase())) {
          problems.push(`${rel}:${i + 1}  ${hex} is not in the Emerald Royal palette`);
        } else if (!HEX_ALLOWED_FILES.has(rel)) {
          problems.push(`${rel}:${i + 1}  ${hex} — use a theme token instead of a hex literal`);
        }
      }
      for (const [match] of line.matchAll(BANNED_NAMES)) {
        problems.push(`${rel}:${i + 1}  banned colour name ${match.trim()}`);
      }
    });
  }
}

if (problems.length) {
  console.error(`Palette check failed (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('Palette check passed.');
