# hub

**hub.btownbrief.com** — the front door. Every free thing the BTown Brief has made
for Burlington: the newsletter, the city guide, the arcade, the merch.

Its own site on purpose: it points at all four properties, so it shouldn't live
inside any one of them.

Photographs are Stephen's own, graded identically (`.shot-img` in `style.css`) so
they read as one family. The dark between them isn't dead space — it's the room
the links live in.

## The grids feed themselves

`grids.js` re-renders the two big sections at load from the network's own
catalogs — **Use the city** from `guide.btownbrief.com/data/catalog.json`
(maintained in the guide repo) and **The arcade** from
`play.btownbrief.com/games.json` (the same file the arcade homepage uses).
The static grids in `index.html` are only the no-JS / fetch-failure fallback.

**Launching a new guide page or game? Don't edit this site.** Add the entry
to `catalog.json` (guide repo) or `games.json` (btownbrief.github.io) and the
hub picks it up on its own.
