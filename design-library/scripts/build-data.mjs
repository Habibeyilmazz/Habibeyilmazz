#!/usr/bin/env node
// Merge data/designs/*.json -> data/designs.json and validate. Warnings never fail the build.
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.DESIGNS_DIR ? resolve(process.env.DESIGNS_DIR) : join(ROOT, 'data', 'designs');
const OUT = process.env.DESIGNS_OUT ? resolve(process.env.DESIGNS_OUT) : join(ROOT, 'data', 'designs.json');

export const VIBES = ('creative, modern, artistic, technology, minimal, bold, playful, elegant, luxury, retro, ' +
  'futuristic, editorial, experimental, friendly, serious, dark, light, warm, cool, organic, ' +
  'geometric, cinematic, handcrafted, data-driven, corporate, youthful').split(/,\s*/);
const SOURCES = new Set(['pinterest', 'dribbble', 'twitter', 'behance', 'awwwards', 'other']);
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const warnings = [];
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

if (!existsSync(SRC)) mkdirSync(SRC, { recursive: true });
const files = readdirSync(SRC).filter(f => f.endsWith('.json')).sort();

const categories = [];
const designs = [];
const catIds = new Set();
const designIds = new Set();

const isStr = v => typeof v === 'string' && v.trim() !== '';
const strArr = v => Array.isArray(v) ? v.filter(isStr) : [];

for (const file of files) {
  let data;
  try { data = JSON.parse(readFileSync(join(SRC, file), 'utf8')); }
  catch (e) { warn(file, `invalid JSON, skipped (${e.message})`); continue; }

  const c = data && data.category;
  if (!c || !isStr(c.id) || !isStr(c.name)) { warn(file, 'missing category.id / category.name, skipped'); continue; }
  if (!KEBAB.test(c.id)) warn(file, `category id "${c.id}" is not lowercase-kebab`);
  if (catIds.has(c.id)) { warn(file, `duplicate category id "${c.id}", skipped`); continue; }
  if (c.id !== file.replace(/\.json$/, '')) warn(file, `category id "${c.id}" differs from filename`);
  catIds.add(c.id);
  for (const k of ['tagline', 'description', 'accent']) if (!isStr(c[k])) warn(file, `category.${k} missing`);
  if (isStr(c.accent) && !HEX.test(c.accent)) warn(file, `category.accent "${c.accent}" is not a hex colour`);
  for (const v of strArr(c.vibes)) if (!VIBES.includes(v)) warn(file, `category vibe "${v}" not in vocabulary`);

  const list = Array.isArray(data.designs) ? data.designs : [];
  if (list.length < 4) warn(file, `only ${list.length} designs (spec wants 4-5)`);
  if (list.length > 5) warn(file, `${list.length} designs (spec max is 5)`);

  const cat = {
    id: c.id, name: c.name, tagline: c.tagline || '', description: c.description || '',
    vibes: strArr(c.vibes), accent: HEX.test(c.accent || '') ? c.accent : '#1d1b18', count: 0,
  };

  for (const d of list) {
    const where = `${file} › ${d && d.id}`;
    if (!d || !isStr(d.id) || !isStr(d.name)) { warn(file, 'design without id/name, skipped'); continue; }
    if (!KEBAB.test(d.id)) warn(where, 'id is not lowercase-kebab');
    if (designIds.has(d.id)) { warn(where, 'duplicate design id, skipped'); continue; }
    designIds.add(d.id);

    if (!isStr(d.image)) warn(where, 'image missing');
    else if (!existsSync(join(ROOT, d.image))) warn(where, `image file not found: ${d.image}`);
    if (!isStr(d.mockup)) warn(where, 'mockup missing');
    else if (!existsSync(join(ROOT, d.mockup))) warn(where, `mockup file not found: ${d.mockup}`);

    const vibes = strArr(d.vibes);
    for (const v of vibes) if (!VIBES.includes(v)) warn(where, `vibe "${v}" not in vocabulary`);
    if (vibes.length < 2 || vibes.length > 4) warn(where, `${vibes.length} vibes (spec wants 2-4)`);
    const keywords = strArr(d.keywords);
    if (keywords.length < 4 || keywords.length > 7) warn(where, `${keywords.length} keywords (spec wants 4-7)`);
    for (const k of ['descriptor', 'summary', 'how_to_build']) if (!isStr(d[k])) warn(where, `${k} missing`);
    const palette = strArr(d.palette);
    if (!palette.length) warn(where, 'palette empty');
    for (const p of palette) if (!HEX.test(p)) warn(where, `palette "${p}" is not a hex colour`);
    const references = (Array.isArray(d.references) ? d.references : []).filter(r => r && isStr(r.url));
    for (const r of references) {
      if (!/^https?:\/\//.test(r.url)) warn(where, `reference url "${r.url}" is not http(s)`);
      if (!SOURCES.has(r.source)) warn(where, `reference source "${r.source}" not in enum`);
    }
    if (references.length < 2) warn(where, `${references.length} references (spec wants >=2)`);

    cat.count++;
    designs.push({
      id: d.id, name: d.name, descriptor: d.descriptor || '', summary: d.summary || '',
      keywords, vibes: vibes.filter(v => VIBES.includes(v)), best_for: strArr(d.best_for), palette,
      fonts: d.fonts && typeof d.fonts === 'object' ? d.fonts : {},
      image: d.image || '', mockup: d.mockup || '', references,
      how_to_build: d.how_to_build || '',
      categoryId: c.id, categoryName: c.name,
    });
  }
  categories.push(cat);
}

// Global running index so cards read "01 / 48" and stay traceable under any filter.
designs.forEach((d, i) => { d.index = i + 1; d.total = designs.length; });

// Vibe facets, in vocabulary order, only those in use.
const vibeCount = Object.fromEntries(VIBES.map(v => [v, 0]));
for (const d of designs) for (const v of d.vibes) vibeCount[v]++;
const vibes = VIBES.filter(v => vibeCount[v] > 0).map(id => ({ id, count: vibeCount[id] }));

writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), categories, vibes, designs }, null, 1) + '\n');

console.log(`built ${OUT.replace(ROOT + '/', '')}: ${categories.length} categories, ${designs.length} designs`);
if (warnings.length) {
  console.warn(`\n${warnings.length} warning${warnings.length > 1 ? 's' : ''}:`);
  for (const w of warnings) console.warn('  ! ' + w);
}
