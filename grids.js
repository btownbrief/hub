/* Renders the two big grids from the network's own catalogs, so this page
   stays complete without hand-editing:
     - "Use the city"  <- https://guide.btownbrief.com/data/catalog.json
                          (lives in the guide repo, updated when pages launch)
     - "The arcade"    <- https://play.btownbrief.com/games.json
                          (the same file that renders the arcade's own homepage)
   The static grids in index.html are the fallback: no JS, a failed fetch, or
   a malformed file leaves them exactly as they are. They may lag; they never
   break. Launching a new page or game should touch the JSON, not this site. */
(function () {
  if (!window.fetch) return;
  var SRC = window.GRIDS_SOURCES || {
    catalog: 'https://guide.btownbrief.com/data/catalog.json',
    games: 'https://play.btownbrief.com/games.json'
  };

  function subhead(text) {
    var p = document.createElement('p');
    p.className = 'subhead';
    p.textContent = text;
    return p;
  }

  function card(emoji, title, blurb, href) {
    var a = document.createElement('a');
    a.className = 'card';
    a.href = href;
    var h = document.createElement('h3');
    if (emoji) {
      var s = document.createElement('span');
      s.className = 'icon';
      s.textContent = emoji;
      h.appendChild(s);
      h.appendChild(document.createTextNode(' '));
    }
    h.appendChild(document.createTextNode(title));
    var p = document.createElement('p');
    p.textContent = blurb;
    a.appendChild(h);
    a.appendChild(p);
    return a;
  }

  /* Only swap a grid when the feed produced a believable amount of content —
     a half-broken feed should lose to the static fallback, not replace it. */
  function swap(gridId, nodes, minCards) {
    var grid = document.getElementById(gridId);
    var cards = nodes.filter(function (n) { return n.className === 'card'; });
    if (!grid || cards.length < minCards) return;
    grid.innerHTML = '';
    for (var i = 0; i < nodes.length; i++) grid.appendChild(nodes[i]);
  }

  fetch(SRC.catalog)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var nodes = [];
      (data.groups || []).forEach(function (g) {
        if (!g.title || !(g.cards || []).length) return;
        nodes.push(subhead(g.title));
        g.cards.forEach(function (c) {
          if (c.title && c.href) nodes.push(card(c.emoji, c.title, c.blurb || '', c.href));
        });
      });
      swap('city-grid', nodes, 15);
    })
    .catch(function () { /* static grid stands */ });

  fetch(SRC.games)
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var games = (data.games || []).filter(function (g) {
        return g.live && g.slug && g.name;
      });
      var nodes = [];
      (data.sections || []).forEach(function (s) {
        var inSection = games.filter(function (g) { return g.section === s.id; });
        if (!inSection.length) return;
        nodes.push(subhead(s.description ? s.title + ' — ' + s.description : s.title));
        inSection.forEach(function (g) {
          nodes.push(card(g.emoji, g.name, g.pitch || '',
            'https://play.btownbrief.com/' + encodeURIComponent(g.slug) + '/'));
        });
      });
      swap('arcade-grid', nodes, 15);
    })
    .catch(function () { /* static grid stands */ });
})();
