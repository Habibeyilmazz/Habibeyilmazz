/* Design Library viewer. Vanilla JS, no build step.
   URL hash:  #<all|category-id>[/<design-id>][?q=text&v=vibe,vibe&m=all]  */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const el = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
// Data and assets live one level above /site/.
const asset = p => '../' + String(p || '').replace(/^\/+/, '');

let DB = { categories: [], designs: [], vibes: [] };
let catById = new Map(), designById = new Map();
const S = { cat: 'all', design: null, q: '', vibes: new Set(), match: 'any' };
let visible = [];            // designs passing all filters, in library order
let lastFocus = null;

/* ---------- hash state ---------- */
function parseHash() {
  let raw = location.hash.replace(/^#/, '');
  try { raw = decodeURIComponent(raw); } catch {}
  const qi = raw.indexOf('?');
  const path = qi < 0 ? raw : raw.slice(0, qi), query = qi < 0 ? '' : raw.slice(qi + 1);
  const [cat, design] = path.split('/');
  const p = new URLSearchParams(query);
  S.cat = cat && (cat === 'all' || catById.has(cat)) ? cat : 'all';
  S.design = design && designById.has(design) ? design : null;
  S.q = p.get('q') || '';
  S.vibes = new Set((p.get('v') || '').split(',').filter(v => DB.vibes.some(x => x.id === v)));
  S.match = p.get('m') === 'all' ? 'all' : 'any';
}
function buildHash(over = {}) {
  const s = { ...S, ...over };
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.vibes.size) p.set('v', [...s.vibes].join(','));
  if (s.match === 'all' && s.vibes.size > 1) p.set('m', 'all');
  const qs = p.toString().replace(/%2C/g, ',').replace(/\+/g, '%20');
  return '#' + s.cat + (s.design ? '/' + s.design : '') + (qs ? '?' + qs : '');
}
function go(over, { replace = false } = {}) {
  const h = buildHash(over);
  if (h === (location.hash || '#all')) return;
  if (replace) { history.replaceState(null, '', h); route(); }
  else location.hash = h;                    // fires hashchange -> route()
}

/* ---------- filtering ---------- */
const haystack = new Map();
function hay(d) {
  if (!haystack.has(d.id)) haystack.set(d.id, [d.name, d.descriptor, d.summary, d.categoryName, d.id.replace(/-/g, ' '),
    ...d.keywords, ...d.vibes, ...d.best_for, ...Object.values(d.fonts || {})].join(' \n ').toLowerCase());
  return haystack.get(d.id);
}
function matches(d, { cat = true, vibes = true, q = true } = {}) {
  if (cat && S.cat !== 'all' && d.categoryId !== S.cat) return false;
  if (vibes && S.vibes.size) {
    const want = [...S.vibes];
    if (S.match === 'all' ? !want.every(v => d.vibes.includes(v)) : !want.some(v => d.vibes.includes(v))) return false;
  }
  if (q && S.q.trim()) {
    const h = hay(d);
    if (!S.q.toLowerCase().split(/\s+/).filter(Boolean).every(t => h.includes(t))) return false;
  }
  return true;
}

/* ---------- render: chips ---------- */
function chip(label, count, attrs, cls = '') {
  return `<li><button type="button" class="chip ${cls}${count === 0 ? ' is-zero' : ''}" ${attrs}>${esc(label)}${count == null ? '' : ` <b>${count}</b>`}</button></li>`;
}
function renderChips() {
  // Counts honour the other active filters, so a number always equals what you would see on click.
  const count = c => DB.designs.filter(d => d.categoryId === c.id && matches(d, { cat: false })).length;
  const all = DB.designs.filter(d => matches(d, { cat: false })).length;
  $('cats').innerHTML = chip('All', all, `data-cat="all" aria-current="${S.cat === 'all'}"`) +
    DB.categories.map(c => chip(c.name, count(c), `data-cat="${esc(c.id)}" aria-current="${S.cat === c.id}"`)).join('');
  const vc = v => DB.designs.filter(d => d.vibes.includes(v) && matches(d, { vibes: false })).length;
  $('vibes').innerHTML = DB.vibes.map(v => chip(v.id, vc(v.id), `data-vibe="${esc(v.id)}" aria-pressed="${S.vibes.has(v.id)}"`, 'chip--vibe')).join('');
  $('match').hidden = S.vibes.size < 2;
  $('match').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === S.match)));
}

/* ---------- render: intro, grid ---------- */
function renderIntro() {
  const box = $('intro'), c = catById.get(S.cat);
  if (!c) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.style.setProperty('--cat', c.accent);
  box.innerHTML = `<div><p class="mono dim">◆ Category · ${c.count} design${c.count === 1 ? '' : 's'}</p>
      <h2 class="display">${esc(c.name)}<span>.</span></h2></div>
    <div><p class="mono" style="margin-bottom:12px;color:var(--ink)">${esc(c.tagline)}</p><p>${esc(c.description)}</p>
      <ul class="pills pills--vibe">${c.vibes.map(v => `<li class="pill">${esc(v)}</li>`).join('')}</ul></div>`;
}
function cardHTML(d, i) {
  const c = catById.get(d.categoryId), shown = d.keywords.slice(0, 3), more = d.keywords.length - shown.length;
  return `<article class="card" style="--cat:${esc(c?.accent || '#1b1a17')};--i:${Math.min(i, 14)}">
  <a class="card__link" href="${buildHash({ design: d.id })}" data-id="${esc(d.id)}" aria-label="${esc(d.name)} — ${esc(d.descriptor)}">
    <div class="card__shot"><img src="${esc(asset(d.image))}" alt="${esc(d.name)} screenshot" loading="lazy" decoding="async" width="1280" height="800"></div>
    <div class="card__head"><h3 class="card__title">${esc(d.name)}</h3><span class="card__desc">${esc(d.descriptor)}</span></div>
    <ul class="pills">${shown.map(k => `<li class="pill">${esc(k)}</li>`).join('')}${more > 0 ? `<li class="pill pill--more" title="${esc(d.keywords.slice(3).join(', '))}">+${more}</li>` : ''}</ul>
    <div class="card__foot mono"><span class="card__cat"><span class="dia" aria-hidden="true">◆</span><span>${esc(d.categoryName)}</span></span><span class="dim">${pad(d.index)} / ${pad(d.total)}</span></div>
  </a></article>`;
}
function renderGrid() {
  visible = DB.designs.filter(d => matches(d));
  $('grid').innerHTML = visible.map(cardHTML).join('');
  $('grid').hidden = !visible.length;
  $('empty').hidden = !!visible.length;
  $('count').textContent = `${visible.length} of ${S.cat === 'all' ? DB.designs.length : catById.get(S.cat).count} designs`;
  $('clear').hidden = !(S.vibes.size || S.q.trim());
  document.title = (S.cat === 'all' ? '' : catById.get(S.cat).name + ' · ') + 'Design Library';
}

/* ---------- modal ---------- */
const modal = $('modal');
let live = false;
function fitFrame() {
  const wrap = $('frame-wrap'), f = el('iframe', wrap);
  if (f) f.style.transform = `scale(${wrap.clientWidth / 1280})`;
}
new ResizeObserver(fitFrame).observe($('stage'));

function setLive(on) {
  live = on;
  const wrap = $('frame-wrap'), d = designById.get(S.design);
  wrap.hidden = !on; wrap.innerHTML = '';
  if (on && d) {
    wrap.innerHTML = `<iframe title="Live mockup of ${esc(d.name)}" src="${esc(asset(d.mockup))}" sandbox="allow-scripts" tabindex="-1"></iframe>`;
    fitFrame();
  }
  $('m-live').setAttribute('aria-pressed', String(on));
  $('m-live').textContent = on ? 'Show screenshot' : 'Open live mockup';
}
function navList() { return visible.some(d => d.id === S.design) ? visible : DB.designs; }
function renderModal() {
  const d = designById.get(S.design);
  if (!d) { if (modal.open) modal.close(); document.body.classList.remove('lock'); return; }
  const c = catById.get(d.categoryId), list = navList(), at = list.findIndex(x => x.id === d.id);
  modal.style.setProperty('--cat', c?.accent || '#1b1a17');
  $('m-cat').textContent = d.categoryName;
  $('m-idx').textContent = `${pad(d.index)} / ${pad(d.total)}`;
  $('m-prev').disabled = at <= 0; $('m-next').disabled = at >= list.length - 1;
  $('m-img').src = asset(d.image); $('m-img').alt = d.name + ' screenshot';
  $('m-desc').textContent = d.descriptor; $('m-title').textContent = d.name;
  $('m-summary').textContent = d.summary;
  $('m-keys').innerHTML = d.keywords.map(k => `<li class="pill">${esc(k)}</li>`).join('');
  $('m-vibes').innerHTML = d.vibes.map(v => `<li class="pill">${esc(v)}</li>`).join('');
  $('m-pal').innerHTML = d.palette.map(h => `<li><button type="button" class="sw" data-hex="${esc(h)}" aria-label="Copy ${esc(h)}"><i style="background:${esc(h)}"></i><span>${esc(h)}</span></button></li>`).join('');
  const f = Object.entries(d.fonts || {});
  $('m-fonts').innerHTML = f.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('') || '<dd class="dim">—</dd>';
  $('m-best').innerHTML = d.best_for.map(b => `<li class="pill">${esc(b)}</li>`).join('');
  $('m-how').textContent = d.how_to_build;
  $('m-refs').innerHTML = d.references.map(r => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(r.title || r.url)} ↗</span><em>${esc(r.source || 'other')}</em></a></li>`).join('');
  $('m-refs-h').hidden = $('m-refs').hidden = !d.references.length;
  $('m-tab').href = asset(d.mockup); $('m-png').href = asset(d.image);
  setLive(false);
  if (!modal.open) {
    lastFocus = document.activeElement;
    modal.showModal(); document.body.classList.add('lock');
    $('m-close').focus({ preventScroll: true });
  }
  el('.m__body').scrollTop = 0;
}
function step(dir) {
  const list = navList(), at = list.findIndex(x => x.id === S.design), n = list[at + dir];
  if (n) go({ design: n.id }, { replace: true });
}
function closeModal() { if (S.design) go({ design: null }); }
modal.addEventListener('cancel', e => { e.preventDefault(); closeModal(); });
modal.addEventListener('close', () => {
  document.body.classList.remove('lock'); setLive(false);
  if (S.design) closeModal();
  lastFocus?.focus?.({ preventScroll: true });
});
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
$('m-close').onclick = closeModal;
$('m-prev').onclick = () => step(-1);
$('m-next').onclick = () => step(1);
$('m-live').onclick = () => setLive(!live);

let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1400); }
$('m-pal').addEventListener('click', async e => {
  const b = e.target.closest('[data-hex]'); if (!b) return;
  const hex = b.dataset.hex;
  try { await navigator.clipboard.writeText(hex); toast(`Copied ${hex}`); }
  catch {
    const ta = document.createElement('textarea'); ta.value = hex; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(`Copied ${hex}`); } catch { toast(hex); }
    ta.remove();
  }
});

/* ---------- events ---------- */
$('cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) go({ cat: b.dataset.cat, design: null }); });
$('vibes').addEventListener('click', e => {
  const b = e.target.closest('[data-vibe]'); if (!b) return;
  const id = b.dataset.vibe, v = new Set(S.vibes); v.has(id) ? v.delete(id) : v.add(id);
  go({ vibes: v }, { replace: true });
  el(`[data-vibe="${CSS.escape(id)}"]`)?.focus();
});
$('match').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) go({ match: b.dataset.m }, { replace: true }); });
$('q').addEventListener('input', e => go({ q: e.target.value }, { replace: true }));
const clearAll = () => { go({ q: '', vibes: new Set(), match: 'any' }, { replace: true }); $('q').value = ''; };
$('clear').onclick = clearAll; $('empty-clear').onclick = clearAll;
window.addEventListener('hashchange', route);
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
  if (e.key === '/' && !typing && !modal.open) { e.preventDefault(); $('q').focus(); $('q').select(); return; }
  if (e.key === 'Escape' && document.activeElement === $('q') && S.q) { clearAll(); return; }
  if (!modal.open || typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
});

/* ---------- route ---------- */
function route() {
  parseHash();
  if ($('q').value !== S.q) $('q').value = S.q;
  renderChips(); renderIntro(); renderGrid(); renderModal();
}

/* ---------- boot ---------- */
fetch('../data/designs.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(data => {
  DB = data;
  catById = new Map(DB.categories.map(c => [c.id, c]));
  designById = new Map(DB.designs.map(d => [d.id, d]));
  $('stat-line').textContent = `${DB.designs.length} designs · ${DB.categories.length} categories`;
  route();
}).catch(err => {
  $('grid').innerHTML = `<p class="mono" style="grid-column:1/-1;padding:40px 0">Could not load data/designs.json (${esc(err.message)}). Run <b>npm run build</b>, then <b>npm start</b>.</p>`;
});
})();
