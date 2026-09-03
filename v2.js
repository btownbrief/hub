/* Burlington, right now — the front door's live layer.
   Everything here reads the guide's own data files (the same ones the guide's
   front page reads) and the arcade's games.json. Every fetch fails soft: the
   tile keeps its static words, the A–Z keeps its static list. Nothing blocks. */
(function () {
  'use strict';

  var GUIDE = 'https://guide.btownbrief.com/';
  var PLAY  = 'https://play.btownbrief.com/';
  var TZ = 'America/New_York';

  function $(id) { return document.getElementById(id); }
  function txt(id, s) { var el = $(id); if (el && s != null) el.textContent = s; }

  // Try-on flag: ?serif=1 sets the big section titles in the cover's serif
  // instead of the poster caps. Inert without the param — it exists so the
  // two voices can be compared on the live page before committing to one.
  try {
    if (new URLSearchParams(location.search).has('serif')) document.documentElement.classList.add('serif-heads');
  } catch (e) {}
  function live(key, s) {
    if (s == null) return;
    var els = document.querySelectorAll('[data-live="' + key + '"]');
    for (var i = 0; i < els.length; i++) els[i].textContent = s;
  }
  function getJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }
  function noop() {}

  /* Burlington calendar parts for any instant. */
  function btParts(d) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' });
    var o = {};
    f.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return { ymd: o.year + '-' + o.month + '-' + o.day, h: +o.hour % 24, m: +o.minute, wd: o.weekday };
  }
  function clock(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).toLowerCase().replace(' ', ' ');
  }
  function shortClock(iso) { return clock(iso).replace(/ (am|pm)$/, '<small>$1</small>'); }

  /* ---------- the date line + live clock on the cover ---------- */
  function dateLine() {
    txt('date-line', new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ }));
    txt('now-clock', new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).toLowerCase());
  }
  dateLine();
  setInterval(dateLine, 30 * 1000);

  /* ---------- weather: air, sky, lake, sunset, as-of ---------- */
  function weather() {
    return getJSON(GUIDE + 'data/weather/latest.json').then(function (d) {
      var now = d.now || {}, lake = d.lake_gage || {}, sun = d.sun || {};
      if (now.temp_f != null) txt('temp', Math.round(now.temp_f) + '°');
      if (now.description) {
        txt('sky', String(now.description).toLowerCase() + ' · full forecast');
        live('weather', Math.round(now.temp_f) + '° ' + String(now.description).toLowerCase() + (lake.water_temp_f != null ? ' · lake ' + Math.round(lake.water_temp_f) + '°' : ''));
      }
      if (lake.water_temp_f != null) txt('lake', Math.round(lake.water_temp_f) + '°');
      var sunset = sun.sunset;
      if (sunset) {
        var t = new Date(sunset), nowMs = Date.now();
        if (t.getTime() < nowMs && sun.sunset_tomorrow) { sunset = sun.sunset_tomorrow; }
        var el = $('sunset'); if (el) el.innerHTML = shortClock(sunset);
        live('sunset', clock(sunset) + (sunset === sun.sunset_tomorrow ? ' tomorrow' : ''));
      }
    });
  }

  /* ---------- beaches ---------- */
  function beaches() {
    return getJSON(GUIDE + 'data/weather/beaches.json').then(function (d) {
      var list = (d.beaches || []).filter(function (b) { return b && (b.status === 'green' || b.status === 'yellow' || b.status === 'red'); });
      if (!list.length) return;
      var green = list.filter(function (b) { return b.status === 'green'; }).length;
      var s = green === list.length ? 'all ' + list.length + ' beaches open' : green + ' of ' + list.length + ' beaches open';
      txt('beaches', s);
      live('beaches', s);
    });
  }

  /* ---------- open right now (needs the guide's food-lib, loaded in the page) ---------- */
  function openNow() {
    return getJSON(GUIDE + 'data/restaurants.json').then(function (d) {
      var list = d.restaurants || [];
      if (!window.BTFood || !list.length) throw new Error('food-lib missing');
      var t = window.BTFood.now(), open = 0;
      list.forEach(function (r) {
        var hours = r.hours;
        if (typeof hours === 'string') { try { hours = JSON.parse(hours); } catch (e) { return; } }
        if (hours && window.BTFood.isOpenAt(hours, t.day, t.minutes)) open++;
      });
      txt('open-n', String(open));
      txt('open-of', ' of ' + list.length);
      live('open', open + ' of ' + list.length + ' open now');
    });
  }
  function deals() {
    return getJSON(GUIDE + 'data/deals.json').then(function (d) {
      var list = d.deals || [];
      if (!window.BTFood || !list.length) return;
      var t = window.BTFood.now();
      var today = list.filter(function (x) { try { return window.BTFood.dealAppliesToday(x, t); } catch (e) { return false; } }).length;
      if (today) {
        live('deals', today + ' today · happy hours, specials');
        var sub = $('open-sub'); if (sub) sub.textContent = 'Live hours, patios, late-night kitchens · ' + today + ' deals today';
      }
    });
  }
  function openings() {
    return getJSON(GUIDE + 'data/openings.json').then(function (d) {
      var n = (d.entries || []).length; if (n) live('openings', n + ' changes · every entry sourced');
    });
  }
  function jobs() {
    return getJSON(GUIDE + 'data/jobs.json').then(function (d) {
      var DAY = 86400000;
      function dayNum(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY) : NaN; }
      var today = dayNum(btParts(new Date()).ymd);
      var fresh = (d.jobs || []).filter(function (j) { return j && today - dayNum(j.posted) <= 14; }).length;
      if (fresh) live('jobs', fresh + ' fresh · 13 boards, one list');
    });
  }

  /* ---------- events: tonight, today, this weekend, free this weekend ---------- */
  function ymdPlus(ymd, days) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd); if (!m) return ymd;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
    return d.toISOString().slice(0, 10);
  }
  function events() {
    return getJSON(GUIDE + 'data/events/events.json').then(function (d) {
      var evs = d.events || [];
      var nowD = new Date(), nowMs = nowD.getTime(), today = btParts(nowD);
      var todayAll = 0, tonight = 0;
      // the coming Saturday + Sunday (or the current weekend, if we're in it) — by calendar date, DST-proof
      var dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(today.wd);
      var toSat = dow === 0 ? -1 : (6 - dow);            // Sunday counts as still-this-weekend
      var satKey = ymdPlus(today.ymd, toSat), sunKey = ymdPlus(today.ymd, toSat + 1);
      var wk = 0, wkFree = 0;
      evs.forEach(function (e) {
        if (!e.start) return;
        var startMs = new Date(e.start).getTime(); if (isNaN(startMs)) return;
        var p = btParts(new Date(startMs));
        var endMs = e.end ? new Date(e.end).getTime() : startMs + 7200000;
        if (p.ymd === today.ymd) {
          todayAll++;
          if (endMs >= nowMs) tonight++;
        } else if (startMs < nowMs && endMs >= nowMs) {
          tonight++;                                     // started yesterday, still going (a late show past midnight)
        }
        if (p.ymd === satKey || p.ymd === sunKey) { wk++; if (e.free === true) wkFree++; }
      });
      txt('tonight-n', String(tonight));
      // Before 4pm the honest word is "today"; after, "tonight".
      var lab = document.getElementById('tonight-lab'); if (lab) lab.textContent = today.h >= 16 ? 'Tonight' : 'Today';
      txt('tonight-sub', tonight ? 'of ' + todayAll + ' today · still to come' : 'all ' + todayAll + ' wrapped for today');
      live('events', todayAll + ' today · ' + tonight + ' tonight');
      if (wk) {
        live('free-weekend', wkFree + ' free of ' + wk + ' this weekend');
        var wl = $('weekend-line'); if (wl) wl.textContent = wk + ' things on Saturday and Sunday from 26 sources — ' + wkFree + ' of them free.';
      }
    });
  }

  /* ---------- tonight's pick (the events rail's top line for today) ---------- */
  function pick() {
    return getJSON(GUIDE + 'data/events/rail.json').then(function (d) {
      var todayKey = btParts(new Date()).ymd;
      var days = d.days || [];
      var day = null;
      for (var i = 0; i < days.length; i++) if (days[i].date === todayKey) { day = days[i]; break; }
      if (!day) return;
      var picks = day.picks || [];
      var nowMs = Date.now();
      function isAllDay(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }
      // prefer a timed pick still ahead of us this evening; then any timed pick still ahead; then an all-day one
      var timed = picks.filter(function (p) { return p.s && !isAllDay(p.s) && new Date(p.s).getTime() > nowMs; });
      var evening = timed.filter(function (p) { return btParts(new Date(p.s)).h >= 16; });
      var allday = picks.filter(function (p) { return isAllDay(p.s); });
      var p = evening[0] || timed[0] || allday[0] || null;
      var a = $('pick'); if (!a) return;
      var pl = document.querySelector('#pick .lab'); if (pl) pl.textContent = btParts(new Date()).h >= 16 ? "Tonight's pick" : "Today's pick";
      if (p) {
        txt('pick-t', p.t);
        txt('pick-v', (p.v ? p.v + ' · ' : '') + (isAllDay(p.s) ? 'all day' : clock(p.s)));
        if (p.u) a.href = p.u;
      } else if (day.t) {
        txt('pick-t', day.t);
        txt('pick-v', day.s && !isAllDay(day.s) ? clock(day.s) + ' · see everything tonight' : 'see everything tonight');
      }
    });
  }

  /* ---------- Steve's read ---------- */
  function read() {
    return getJSON(GUIDE + 'data/weather/read.json').then(function (d) {
      if (!d.text) return;
      // two sentences here; the full read lives on the weather page
      var sents = String(d.text).match(/[^.!?]+[.!?]+/g) || [d.text];
      var short = sents.slice(0, 2).join(' ').trim();
      if (short.length > 340) short = short.slice(0, 337).replace(/\s+\S*$/, '') + '…';
      txt('read-text', short);
      var when = d.approved_at ? clock(d.approved_at) : (d.edition ? d.edition : '');
      txt('read-when', when ? '· ' + when : '');
    });
  }

  /* ---------- Btown TV: tonight's pick, from the TV edition file ---------- */
  function tv() {
    return getJSON(GUIDE + 'data/btown-tv.json').then(function (d) {
      var p = d.pick; if (!p || !p.t) return;
      txt('tv-t', p.t);
      txt('tv-sub', (p.ch ? p.ch + ' · ' : '') + (p.dur ? p.dur + ' · ' : '') + "tonight's pick, plus shelves and a Vermont shelf → Btown TV");
    });
  }

  /* ---------- Stay Awhile count ---------- */
  function stay() {
    return getJSON(PLAY + 'stay-awhile/data/questions.json').then(function (d) {
      var n = (d.questions || []).length; if (n >= 100) live('stay', n + ' questions · spin, land, ask');
    });
  }

  /* ---------- Everything, by shelf: catalog.json + games.json + search-index.json ----------
     The shelves and their tiles are curated in the HTML (grouping, photos, the
     "(Battleship)" names). The three feeds still guarantee completeness: a feed
     item whose link already has a tile folds its name + keywords into that tile's
     search terms; one we've never shelved is appended to the right shelf — games
     by their arcade section, guide cards by their catalog group, everything else
     under More. Launch something new by adding it to one of those three files;
     this page still needs no edit. */
  var AZ_SHELF_FOR_SECTION = { 'arcade-action': 'arcade', 'daily-puzzles': 'daily', 'board-card': 'board', 'party-community': 'table', 'party-night': 'table', 'local-more': 'go' };
  var AZ_SHELF_FOR_GROUP = { 'Right now': 'now', 'Go and do something': 'go', 'Live here': 'live', 'Join in': 'people' };
  /* Canonical link key: drop the fragment and utm_* noise, keep meaningful queries
     (restaurants.html?view=deals is its own tile). A couple of known second names
     for the same destination map onto the tile we shelve. */
  var AZ_ALIAS = { 'https://guide.btownbrief.com/restaurants.html?view=deals': 'https://guide.btownbrief.com/deals.html' };
  function azKey(u) {
    var s = String(u).split('#')[0];
    var q = s.split('?'), path = q[0].replace(/\/$/, '');
    var keep = (q[1] || '').split('&').filter(function (p) { return p && p.slice(0, 4) !== 'utm_'; }).join('&');
    var k = keep ? path + '?' + keep : path;
    return AZ_ALIAS[k] || k;
  }
  function az() {
    return Promise.all([
      getJSON(GUIDE + 'data/catalog.json').catch(function () { return null; }),
      getJSON(PLAY + 'games.json').catch(function () { return null; }),
      getJSON(PLAY + 'search-index.json').catch(function () { return null; })
    ]).then(function (res) {
      var cat = res[0], games = res[1], index = res[2];
      var wrap = $('az-shelves'); if (!wrap) return;
      var tiles = {};
      var existing = wrap.querySelectorAll('.tile');
      for (var i = 0; i < existing.length; i++) {
        var el = existing[i];
        tiles[azKey(el.href)] = el;
        // data-kw holds extra search words a tile's visible text doesn't
        // contain (e.g. "groupchat" on Community Chat).
        if (!el.getAttribute('data-n')) el.setAttribute('data-n',
          (el.textContent + ' ' + (el.getAttribute('data-kw') || '')).toLowerCase().replace(/\s+/g, ' ').trim());
      }
      function fold(key, name, kw) {
        var t = tiles[key]; if (!t) return false;
        var n = t.getAttribute('data-n') || '';
        t.setAttribute('data-n', (n + ' ' + ((name || '') + ' ' + (kw || '')).toLowerCase()).replace(/\s+/g, ' ').trim());
        return true;
      }
      // Photographs for the tiles this merge appends at runtime (the More
      // shelf and friends), keyed by azKey. Unmapped tiles keep emoji / ↗ —
      // the city histories stay that way on purpose.
      var APPEND_THUMBS = {};
      [['https://www.btownbrief.com/subscribe', 'calmlake'],
       ['https://www.btownbrief.com/community', 'shorefolk'],
       ['https://www.btownbrief.com/upgrade', 'dogtreat'],
       ['https://hub.btownbrief.com/start-here.html', 'brickpath'],
       ['https://play.btownbrief.com/', 'stadium'],
       ['https://guide.btownbrief.com/', 'brickrow'],
       ['https://guide.btownbrief.com/history-full.html', 'lighthouse']
      ].forEach(function (p) { APPEND_THUMBS[azKey(p[0])] = 'assets/img/ig/thumb/' + p[1] + '.jpg'; });
      function append(shelfId, name, url, emoji) {
        var grp = wrap.querySelector('.grp[data-shelf="' + shelfId + '"]') || wrap.querySelector('.grp[data-shelf="more"]');
        if (!grp) return;
        grp.hidden = false;
        var a = document.createElement('a');
        a.className = 'tile'; a.href = url;
        var icon, th = APPEND_THUMBS[azKey(url)];
        if (th) {
          icon = document.createElement('img');
          icon.src = th; icon.alt = ''; icon.loading = 'lazy';
        } else {
          icon = document.createElement('i'); icon.className = 'mo'; icon.textContent = emoji || '↗';
        }
        var tt = document.createElement('span'); tt.className = 'tt';
        var b = document.createElement('b'); b.textContent = name;
        tt.appendChild(b); a.appendChild(icon); a.appendChild(tt);
        a.setAttribute('data-n', String(name).toLowerCase());
        grp.appendChild(a);
        tiles[azKey(url)] = a;
      }
      if (cat && cat.groups) cat.groups.forEach(function (g) {
        (g.cards || []).forEach(function (c) {
          if (!c.title || !c.href) return;
          if (!fold(azKey(c.href), c.title, c.blurb || '')) append(AZ_SHELF_FOR_GROUP[g.title] || 'more', c.title, c.href, c.emoji);
        });
      });
      if (games && games.games) {
        var liveGames = games.games.filter(function (g) { return g.live && g.slug && g.name; });
        liveGames.forEach(function (g) {
          var u = PLAY + encodeURIComponent(g.slug) + '/';
          if (!fold(azKey(u), g.name, g.pitch || '')) append(AZ_SHELF_FOR_SECTION[g.section] || 'more', g.name, u, g.emoji);
        });
        txt('games-n', String(liveGames.length));
        live('games', liveGames.length + ' games · free, no accounts');
      }
      if (index && index.pages) index.pages.forEach(function (p) {
        if (!p.title || !p.url) return;
        var k = azKey(p.url);
        if (k === 'https://hub.btownbrief.com') return;   // this page itself
        if (!fold(k, p.title, p.keywords || '')) append('more', p.title, p.url, '');
      });
      var total = 0, grps = wrap.querySelectorAll('.grp');
      for (var j = 0; j < grps.length; j++) {
        var n = grps[j].querySelectorAll('.tile').length;
        total += n;
        var s = grps[j].querySelector('.gh small'); if (s) s.textContent = String(n);
        // the same count feeds the shelf's line in the table of contents
        var chipN = document.querySelector('.azchip[data-shelf="' + grps[j].getAttribute('data-shelf') + '"] .n');
        if (chipN) chipN.textContent = String(n);
        if (!n) grps[j].hidden = true;
      }
      var allN = document.querySelector('.azchip[data-shelf=""] .n');
      if (allN) allN.textContent = String(total);
      txt('az-count', total + ' pages and games, by shelf. If it isn’t in a question above, it’s here.');
      var f = $('find'); if (f && f.value) f.dispatchEvent(new Event('input'));
    });
  }

  /* ---------- the pills ---------- */
  (function () {
    var pills = document.querySelectorAll('.pill'), panels = document.querySelectorAll('.qp');
    function show(q) {
      for (var i = 0; i < pills.length; i++) { var on = pills[i].getAttribute('data-q') === q; pills[i].classList.toggle('on', on); pills[i].setAttribute('aria-pressed', on ? 'true' : 'false'); }
      for (var j = 0; j < panels.length; j++) panels[j].classList.toggle('on', panels[j].getAttribute('data-q') === q);
    }
    for (var i = 0; i < pills.length; i++) {
      pills[i].addEventListener('click', function () {
        var q = this.getAttribute('data-q'); show(q);
        try { history.replaceState(null, '', '#' + q); } catch (e) {}
      });
    }
    var h = (location.hash || '').slice(1);
    var deep = !!(h && document.querySelector('.qp[data-q="' + h + '"]'));
    if (deep) show(h);

    /* auto-tour: once the section is actually on screen, step to the next
       question every 5s so the panels answer themselves. The clock only runs
       while the section is visible (and starts fresh each time it enters),
       and the visitor's first touch or focus ends the tour for good. */
    var ask = document.querySelector('.ask');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (ask && !deep && !reduce && pills.length > 1) {
      var idx = 0, timer = null, dead = false;
      for (var k = 0; k < pills.length; k++) if (pills[k].classList.contains('on')) idx = k;
      function tick() {
        if (document.hidden) return;
        idx = (idx + 1) % pills.length;
        show(pills[idx].getAttribute('data-q'));
      }
      function halt() {
        if (timer) { clearInterval(timer); timer = null; }
        ask.classList.remove('touring');
      }
      function begin() {
        if (timer) return;
        ask.classList.add('touring');
        timer = setInterval(tick, 5000);
      }
      function stop() { dead = true; halt(); }
      ask.addEventListener('pointerdown', stop, { once: true });
      ask.addEventListener('focusin', stop, { once: true });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) {
          if (dead) return;
          if (es[0].isIntersecting) begin();
          else halt();
        }, { threshold: 0.25 }).observe(ask);
      } else {
        begin();
      }
    }
  })();

  /* ---------- light / dark toggle ---------- */
  (function () {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var root = document.documentElement;
      var dark = root.getAttribute('data-theme') === 'dark' ||
        (!root.getAttribute('data-theme') && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
      var next = dark ? 'light' : 'dark';
      if (window.BtownTheme && window.BtownTheme.set) window.BtownTheme.set(next);
      else {
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('btown-theme', next); } catch (e) {}
      }
    });
  })();

  /* ---------- favorites shelf: IG-style page dots ---------- */
  (function () {
    var shelf = document.getElementById('favshelf'), dots = document.getElementById('favdots');
    if (!shelf || !dots) return;
    var cards = shelf.querySelectorAll('.fav');
    function maxScroll() { return Math.max(0, shelf.scrollWidth - shelf.clientWidth); }
    function mark() {
      var max = maxScroll();
      var i = max ? Math.round((shelf.scrollLeft / max) * (dots.childElementCount - 1)) : 0;
      for (var k = 0; k < dots.childElementCount; k++) dots.children[k].classList.toggle('on', k === i);
    }
    function build() {
      var n = cards.length;
      if (dots.childElementCount !== n) {
        dots.innerHTML = '';
        for (var i = 0; i < n; i++) (function (i) {
          var b = document.createElement('button');
          b.type = 'button';
          b.setAttribute('aria-label', 'Favorite ' + (i + 1) + ' of ' + n);
          b.addEventListener('click', function () {
            var max = maxScroll();
            shelf.scrollTo({ left: n > 1 ? max * i / (n - 1) : 0, behavior: 'smooth' });
          });
          dots.appendChild(b);
        })(i);
      }
      mark();
    }
    build();
    shelf.addEventListener('scroll', mark, { passive: true });
    window.addEventListener('resize', build);
  })();

  /* ---------- search + shelf chips: filter the shelves in place ---------- */
  (function () {
    var input = $('find'), wrap = $('az-shelves'), open = $('search-open');
    if (!input || !wrap) return;
    var shelf = '';
    var chips = document.querySelectorAll('.azchip');
    /* Everyday words → the site's own vocabulary, so the phrasing never has
       to be exact. Each query word hits if it — or any synonym — appears
       anywhere in a tile's terms; words match independently, in any order. */
    var SYN = {
      food: ['eat', 'restaurant'], dinner: ['restaurant', 'eat'], lunch: ['restaurant', 'eat'],
      brunch: ['restaurant', 'eat'], hungry: ['restaurant', 'eat'], cheap: ['deal', 'free'],
      drink: ['bar', 'brewer'], drinks: ['bar', 'brewer'], beer: ['brewer'],
      concert: ['music', 'show'], gig: ['music', 'show'], band: ['music'],
      apartment: ['housing', 'rent'], rent: ['housing'], home: ['housing'],
      job: ['jobs', 'work'], hiring: ['jobs'], work: ['jobs'],
      swim: ['beach', 'lake'], swimming: ['beach', 'lake'], hike: ['trail', 'outdoor'],
      kids: ['family', 'kid'], dog: ['dog', 'pup'], news: ['pulse', 'headline', 'brief'],
      chat: ['groupchat', 'telegram'], talk: ['chat', 'table'],
      tonight: ['event', 'tonight'], weekend: ['event'], bored: ['what now', 'things to do', 'game'],
      video: ['tv', 'watch'], podcast: ['listen'], radio: ['listen'],
      weather: ['weather', 'forecast'], sunset: ['sunset']
    };
    /* Words match at word starts only — "eat" finds "eat, eating" but not
       "wEATher". Terms are padded with a leading space for the check. */
    function hitTerm(n, w) {
      if (n.indexOf(' ' + w) !== -1) return true;
      var alts = SYN[w] || [];
      for (var a = 0; a < alts.length; a++) if (n.indexOf(' ' + alts[a]) !== -1) return true;
      return false;
    }
    function filter() {
      var q = input.value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      var words = q ? q.split(/\s+/) : [];
      var grps = wrap.querySelectorAll('.grp');
      for (var i = 0; i < grps.length; i++) {
        var g = grps[i], off = shelf && g.getAttribute('data-shelf') !== shelf;
        var ts = g.querySelectorAll('.tile'), shown = 0;
        for (var j = 0; j < ts.length; j++) {
          var n = ' ' + (ts[j].getAttribute('data-n') || ts[j].textContent).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
          var hit = !off;
          for (var w = 0; hit && w < words.length; w++) hit = hitTerm(n, words[w]);
          ts[j].classList.toggle('hide', !hit); if (hit) shown++;
        }
        g.hidden = !shown;
      }
    }
    for (var c = 0; c < chips.length; c++) {
      chips[c].addEventListener('click', function () {
        shelf = this.getAttribute('data-shelf') || '';
        for (var k = 0; k < chips.length; k++) chips[k].classList.toggle('on', chips[k] === this);
        filter();
      });
    }
    input.addEventListener('input', filter);
    if (open) open.addEventListener('click', function () {
      $('everything').scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () { input.focus(); }, 350);
    });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); open && open.click(); }
      if (e.key === '/' && document.activeElement !== input && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); open && open.click(); }
    });
  })();

  /* ---------- scroll cue: nudge first-timers below the cover ---------- */
  (function () {
    var cue = $('scroll-cue');
    var bento = document.querySelector('.bento');
    if (!cue || !bento) return;
    cue.addEventListener('click', function () {
      bento.scrollIntoView({ behavior: 'smooth', block: 'start' });
      cue.classList.add('gone');
    });
    // Once they've moved at all, the nudge has done its job — fade it out.
    window.addEventListener('scroll', function () {
      cue.classList.toggle('gone', window.scrollY > 80);
    }, { passive: true });
  })();

  /* ---------- go ---------- */
  function start() {
    weather().catch(noop);
    beaches().catch(noop);
    events().catch(noop);
    pick().catch(noop);
    read().catch(noop);
    openings().catch(noop);
    jobs().catch(noop);
    stay().catch(noop);
    tv().catch(noop);
    az().catch(noop);
    // food-lib is a deferred script too; it may land after us.
    var tries = 0;
    (function foodWhenReady() {
      if (window.BTFood) { openNow().catch(noop); deals().catch(noop); return; }
      if (++tries < 40) setTimeout(foodWhenReady, 150);
    })();
    // Keep the numbers honest on a tab left open: refetch every 15 minutes.
    setInterval(function () {
      dateLine(); weather().catch(noop); events().catch(noop); pick().catch(noop); tv().catch(noop);
      if (window.BTFood) { openNow().catch(noop); deals().catch(noop); }
    }, 15 * 60 * 1000);
  }
  /* The fade at the end of the verb run means "there is more this way", so it
     may only be there when there is. Measured rather than assumed: the run's
     width depends on the loaded font, which arrives after first paint. */
  function measureVerbs() {
    var bar = document.querySelector('.bar');
    var verbs = document.querySelector('.verbs');
    if (!bar || !verbs) return;
    bar.classList.toggle('is-over', verbs.scrollWidth > verbs.clientWidth + 2);
  }
  window.addEventListener('resize', measureVerbs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureVerbs);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { start(); measureVerbs(); });
  } else { start(); measureVerbs(); }
})();
