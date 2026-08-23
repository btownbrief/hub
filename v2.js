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

  /* ---------- the date line ---------- */
  function dateLine() {
    txt('date-line', new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ }));
  }
  dateLine();

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
      if (d.updated) txt('asof', 'as of ' + clock(d.updated));
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

  /* ---------- Everything, A–Z: catalog.json + games.json + search-index.json ----------
     Three feeds, one list. The guide's catalog.json is the city-guide shelf, the
     arcade's games.json is every live game, and the arcade's search-index.json is
     the whole network — newsletter, community, leaderboards, the histories. Launch
     something new by adding it to one of those three files; this site needs no edit.
     Same destination under two names keeps the catalog/games name and folds the
     other name (and its keywords) into what the search will match. */
  var AZ = [];
  function az() {
    return Promise.all([
      getJSON(GUIDE + 'data/catalog.json').catch(function () { return null; }),
      getJSON(PLAY + 'games.json').catch(function () { return null; }),
      getJSON(PLAY + 'search-index.json').catch(function () { return null; })
    ]).then(function (res) {
      var cat = res[0], games = res[1], index = res[2], items = [], seen = {};
      function add(n, u, kind, kw) {
        if (!n || !u) return;
        var k = u.split('?')[0].split('#')[0].replace(/\/$/, '');
        var had = seen[k];
        if (had) {
          if (kw) had.kw += ' ' + kw;
          if (n.toLowerCase() !== had.n.toLowerCase()) had.kw += ' ' + n;
          return;
        }
        var it = { n: n, u: u, k: kind, kw: kw || '' };
        seen[k] = it; items.push(it);
      }
      if (cat && cat.groups) cat.groups.forEach(function (g) { (g.cards || []).forEach(function (c) { add(c.title, c.href, 'page', ''); }); });
      if (games && games.games) {
        var liveGames = games.games.filter(function (g) { return g.live && g.slug && g.name; });
        liveGames.forEach(function (g) { add(g.name, PLAY + encodeURIComponent(g.slug) + '/', 'game', ''); });
        txt('games-n', String(liveGames.length));
        live('games', liveGames.length + ' games · free, no accounts');
      }
      if (index && index.pages) index.pages.forEach(function (p) { add(p.title, p.url, 'page', p.keywords || ''); });
      if (items.length < 30) return;   // a half-broken feed loses to the static list
      items.sort(function (a, b) {
        var ka = a.n.toLowerCase().replace(/^(?:(?:the|a|an)\s+|r\/)/, ''), kb = b.n.toLowerCase().replace(/^(?:(?:the|a|an)\s+|r\/)/, '');
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
      AZ = items;
      var ul = $('az-list'); if (!ul) return;
      ul.innerHTML = '';
      items.forEach(function (it) {
        var li = document.createElement('li'), a = document.createElement('a');
        a.href = it.u; a.textContent = it.n;
        if (it.k === 'game') { var s = document.createElement('small'); s.textContent = 'game'; a.appendChild(s); }
        li.appendChild(a);
        li.setAttribute('data-n', (it.n + ' ' + it.kw).toLowerCase().replace(/\s+/g, ' ').trim());
        ul.appendChild(li);
      });
      txt('az-count', items.length + ' pages and games, A–Z. If it isn’t in a question above, it’s here.');
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
    if (h && document.querySelector('.qp[data-q="' + h + '"]')) show(h);
  })();

  /* ---------- search: filters the A–Z in place ---------- */
  (function () {
    var input = $('find'), ul = $('az-list'), open = $('search-open');
    if (!input || !ul) return;
    function filter() {
      var q = input.value.trim().toLowerCase();
      var lis = ul.children, shown = 0;
      for (var i = 0; i < lis.length; i++) {
        var n = (lis[i].getAttribute('data-n') || lis[i].textContent).toLowerCase();
        var hit = !q || n.indexOf(q) !== -1;
        lis[i].classList.toggle('hide', !hit); if (hit) shown++;
      }
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
