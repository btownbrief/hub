# hub

**hub.btownbrief.com** — the front door. *Burlington, right now*, and everything
the BTown Brief has made for the people who live here, on one page.

Its own site on purpose: it points at all the properties (the newsletter, the
city guide, the arcade, the community tools, the merch), so it shouldn't live
inside any one of them.

## The page, in three layers

1. **The bento** — photographs carrying one live number each: open right now,
   air, lake, tonight, sunset, Steve's read, today's pick, the arcade, tonight
   on Btown TV, Out Loud, and the signup. `v2.js` reads the guide's own data
   files (`guide.btownbrief.com/data/...`) and the arcade's `games.json`. Every
   fetch fails soft — a tile keeps its static words if a feed is down.
2. **The questions** — twelve first-person pills ("I'm hungry.", "Who do I call
   for this?"…), one open panel at a time, each answer row with a live value
   where there is one. Hand-curated in `index.html`; keep them ≤ 4 links each.
3. **Everything we made, A–Z** — the guarantee. Built at load from three feeds:
   the guide's `data/catalog.json`, the arcade's `games.json`, and the arcade's
   `search-index.json` (the whole network, with keywords). The search box
   filters that list, matching titles *and* keywords. The static list in
   `index.html` is the no-JS / fetch-failure fallback.

**Launching a new page, game or project? Don't edit this site.** Add it to
`catalog.json` (guide repo), `games.json` (btownbrief.github.io), or
`search-index.json` (btownbrief.github.io) and it appears in the A–Z and the
search on its own. Give it a question pill here only if it deserves one.

## Photographs

`assets/img/ig/` — Stephen's own, pulled from @btownbrief, web-sized (≈1000px,
the `-s` variants ≈520px for the question panels). `sources.json` maps each file
to its Instagram post. To swap a tile's photo, drop a new JPEG in and change the
`<img src>` in `index.html`; keep them under ~350KB each.

## The cover's branch and moon

`assets/img/hero-fx/branch-lg.webp`, `branch-sm.webp` and `moon.webp` are baked
offline: checkerboard keyed out, blur/saturate/contrast applied, sized to what
the cover actually draws. Safari's canvas has no `ctx.filter`, so the runtime
never filters — `hero-live.js` only draws them and dims the branch at night with
a CSS `brightness()`. The originals (`perch-empty-source.png`, `moon-real.png`)
live in git history before Sept 2026; re-bake with a headless Chromium canvas
if the art changes.

## Files

- `index.html`, `v2.css`, `v2.js` — the front door.
- `start-here.html` + `start-here.css` + `style.css` — the two lists ("check
  daily / check once"), unchanged; still loads the shared `nav.js`.
- The front door does **not** load `play.btownbrief.com/nav.js`: it has its own
  header (Eat · Do · Play · Read · Subscribe · search) because the old tabs were
  property names, not what people come for.

Type is one family, Archivo (wide + black for display). Colour is the lake, the
maple, the sap and the ink, used as blocks. Dark mode follows the system.
