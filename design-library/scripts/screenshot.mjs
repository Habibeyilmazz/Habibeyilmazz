#!/usr/bin/env node
// Re-shoot mockups: designs-src/<id>/index.html -> assets/designs/<id>.png (1280x800, scale 1).
// Usage: node scripts/screenshot.mjs [id ...]     (no ids = every folder in designs-src/)
import { readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'designs-src');
const OUT = join(ROOT, 'assets', 'designs');

async function loadPlaywright() {
  try { return await import('playwright'); } catch {}
  const candidates = [process.env.PLAYWRIGHT_PATH, '/opt/node-tools/node_modules'];
  try { candidates.push(execSync('npm root -g', { encoding: 'utf8' }).trim()); } catch {}
  for (const base of candidates.filter(Boolean)) {
    try { return createRequire(join(base, 'noop.js'))('playwright'); } catch {}
  }
  console.error('playwright not found. Install it (npm i -D playwright) or set PLAYWRIGHT_PATH to a node_modules dir.');
  process.exit(1);
}

const pw = await loadPlaywright();
const chromium = pw.chromium || pw.default?.chromium;
const ids = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(SRC, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
let ok = 0;
for (const id of ids) {
  const html = join(SRC, id, 'index.html');
  if (!existsSync(html)) { console.warn(`skip ${id}: ${html} not found`); continue; }
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, id + '.png'), clip: { x: 0, y: 0, width: 1280, height: 800 } });
  console.log('shot', id); ok++;
}
await browser.close();
console.log(`${ok}/${ids.length} screenshots written to assets/designs/`);
