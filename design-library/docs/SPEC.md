# Design Library — shared spec (all agents read this first)

Goal: a private, local, user-friendly **website design library**. Browse web design styles by
**category chips with counts**, see each design as an **image card** with a name, a one-line
descriptor, and **keyword tags** — easy to scan and trace. Visual reference: a dark-ink-on-warm-paper
gallery with mono category chips (`ALL 28`, `PRINT-TECH PAPER 4`, ...), cards with a screenshot on
top, a serif title + small mono descriptor on the right, keyword pills, a diamond category marker
at the bottom-left and `01 / 28` index at the bottom-right.

Repo root: `/home/user/design-library` (its own git repo, branch `main`). Everything is relative to it.

```
data/designs/<category-id>.json   # one file per category (written by research/design agents)
data/designs.json                 # merged output (written by scripts/build-data.mjs — builder owns)
assets/designs/<design-id>.png    # 1280x800 screenshot per design (deviceScaleFactor 1)
designs-src/<design-id>/index.html# self-contained mockup page that the screenshot is taken from
site/                             # the viewer app (builder agent owns)
scripts/                          # build-data.mjs, screenshot.mjs, serve (builder owns)
```

## Category file schema — `data/designs/<category-id>.json`

```json
{
  "category": {
    "id": "print-tech-paper",
    "name": "Print-Tech Paper",
    "tagline": "warm editorial x print DNA",
    "description": "2-3 sentences, plain English: what this style is and when to use it.",
    "vibes": ["editorial", "warm", "technology"],
    "accent": "#b4532a"
  },
  "designs": [
    {
      "id": "stillpage-halftone",
      "name": "Stillpage Halftone",
      "descriptor": "warm editorial x print DNA",
      "summary": "1-2 plain sentences describing the look & feel.",
      "keywords": ["halftone dot texture", "warm paper ground", "mono coordinate labels"],
      "vibes": ["creative", "editorial", "warm"],
      "best_for": ["AI tools", "writing apps", "portfolios"],
      "palette": ["#f4efe6", "#1d1b18", "#d2552a"],
      "fonts": { "display": "Fraunces", "body": "Inter", "mono": "JetBrains Mono" },
      "image": "assets/designs/stillpage-halftone.png",
      "mockup": "designs-src/stillpage-halftone/index.html",
      "references": [
        { "title": "short title", "url": "https://...", "source": "dribbble" }
      ],
      "how_to_build": "3-5 sentences: key CSS/layout/typography techniques so someone can recreate it."
    }
  ]
}
```

Rules
* `category.id` / design `id`: lowercase-kebab, globally unique. Category `name`: 2-3 evocative words,
  **unique and memorable** (e.g. "Dither Mono", "Vast Quiet Cinematic", "Glitched Antiquity"),
  never generic ("Modern Design").
* `descriptor` = short lowercase "x"-style phrase (e.g. "print-tech x data").
* `keywords` = 4-7 concrete visual traits (what you SEE). `vibes` = 2-4 words from this fixed
  plain-language vocabulary only (so the viewer can filter on them):
  `creative, modern, artistic, technology, minimal, bold, playful, elegant, luxury, retro,
  futuristic, editorial, experimental, friendly, serious, dark, light, warm, cool, organic,
  geometric, cinematic, handcrafted, data-driven, corporate, youthful`.
* `source` in references ∈ `pinterest | dribbble | twitter | behance | awwwards | other`.
* Each category: **4 designs** minimum, 5 max. Each design must be visually distinct from every other
  design in the whole library (different palette, type, layout idea) — impressive, not template-y.
* Images: every design has a real PNG screenshot (1280x800) of its mockup. Never leave a missing image.

## Mockups (the example images)

Each design is an ORIGINAL, high-craft hero-section (+ a hint of the next section) of a fictional
product/brand, hand-written HTML/CSS (+ tiny inline JS/SVG/canvas if useful), **inspired by** trends
researched on Pinterest / Dribbble / Twitter(X) — never a copy of a specific site, brand or artwork;
do not hotlink or download others' screenshots. Requirements:
* Self-contained single `index.html` (inline CSS/SVG). No external images. Web fonts from Google Fonts
  are OK **only if reachable** from the sandbox; otherwise pick a good system/local fallback stack —
  test with a screenshot and make sure it still looks intentional either way.
* Fixed 1280x800 composition, looks like a real site above the fold (nav, headline, CTA, visual).
* Use the `frontend-design` / UI-design craft: strong concept, deliberate type scale, spacing rhythm,
  considered color, texture, motif. Avoid generic gradients-on-white “AI slop”. Make it striking.
* Screenshot with Playwright (preinstalled; `require('playwright')`, `chromium.launch()` with no options):
  viewport 1280x800, deviceScaleFactor 1, wait ~600ms, write to `assets/designs/<id>.png`.
  Then LOOK at the PNG (Read tool) and iterate until it's genuinely good.

## Research

Use WebSearch / WebFetch to find real inspiration (queries like `site:dribbble.com brutalist saas
landing`, `pinterest web design editorial layout`, `twitter x web design inspiration <topic>`,
awwwards/godly/siteinspire for trend vocabulary). If a platform blocks fetching, rely on search
snippets/titles; record whatever real URLs you found in `references` (≥2 per design when possible,
never invent URLs — leave the array shorter instead). Spend research effort proportional; the main
output is the finished category files + images.

## Hygiene
* Do NOT run `git commit`/`git push` (final integrator commits). Do not touch files you don't own.
* Do not write outside `/home/user/design-library` (scratch → your scratchpad).
* When done, reply with a SHORT report (<=150 words): categories + design ids created, anything broken.
