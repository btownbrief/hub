/* The living photo. A transparent canvas sits over the harbor photo and keeps
   it honest with the sky outside: Burlington's real sun times pick the mood,
   night brings stars, a photographed moon stays faintly visible by day, and
   a small flock crosses the frame, and a shooting star can pass after dark.
   Everything here is garnish: if this file never runs, the
   page is exactly what it was before.

   Force a mood for testing: ?sky=dawn|day|golden|dusk|night */
(function () {
  "use strict";

  var canvas = document.getElementById("sky-live");
  var cover = canvas && canvas.closest(".cover");
  if (!canvas || !cover) return;

  var LAT = 44.4759, LON = -73.2121; // Burlington harbor

  /* ---------------------------------------------------------- sun & moon */
  // Sunrise/sunset the way the suncalc library does it — good to a minute
  // or two, which is plenty for picking a mood.
  function sunTimes(date) {
    var rad = Math.PI / 180, dayMs = 864e5, J1970 = 2440588, J2000 = 2451545;
    var lw = rad * -LON, phi = rad * LAT;
    var d = date.getTime() / dayMs - 0.5 + J1970 - J2000;
    var n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
    var ds = 0.0009 + lw / (2 * Math.PI) + n;
    var M = rad * (357.5291 + 0.98560028 * ds);
    var C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    var L = M + C + rad * 102.9372 + Math.PI;
    var dec = Math.asin(Math.sin(L) * Math.sin(rad * 23.4397));
    var Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    var cosH = (Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) /
               (Math.cos(phi) * Math.cos(dec));
    if (cosH < -1 || cosH > 1) return null; // never happens in Burlington
    var Jset = Jnoon + Math.acos(cosH) / (2 * Math.PI);
    var Jrise = Jnoon - (Jset - Jnoon);
    var fromJulian = function (j) { return new Date((j + 0.5 - J1970) * dayMs); };
    return { rise: fromJulian(Jrise), set: fromJulian(Jset) };
  }

  /* ------------------------------------------------------------- moods */
  // Each mood is a tint painted over the photo plus how strongly the night
  // layer (stars + moon) shows through. Tints stay gentle on purpose: the
  // photo is the hero, the canvas just nudges it toward the hour.
  var MOODS = {
    dawn:   { top: [255, 178, 158, 0.16], mid: [140, 150, 200, 0.10], bot: [70, 80, 120, 0.06],  night: 0.25, moon: 0.46 },
    day:    { top: [150, 190, 235, 0.18], mid: [180, 205, 235, 0.10], bot: [200, 215, 235, 0.05], night: 0,    moon: 0.40 },
    golden: { top: [255, 160, 110, 0.10], mid: [255, 140, 120, 0.07], bot: [255, 150, 110, 0.05], night: 0,    moon: 0.30 },
    dusk:   { top: [60, 55, 110, 0.34],   mid: [90, 70, 120, 0.22],   bot: [40, 45, 90, 0.18],    night: 0.55, moon: 0.72 },
    night:  { top: [8, 14, 38, 0.62],     mid: [10, 18, 46, 0.52],    bot: [6, 12, 34, 0.46],     night: 1,    moon: 0.92 }
  };

  function moodNow(now) {
    var t = sunTimes(now);
    if (!t) return "day";
    var m = now.getTime(), rise = t.rise.getTime(), set = t.set.getTime();
    var MIN = 6e4;
    if (m < rise - 40 * MIN) return "night";
    if (m < rise + 50 * MIN) return "dawn";
    if (m < set - 75 * MIN) return "day";
    if (m < set) return "golden";
    if (m < set + 55 * MIN) return "dusk";
    return "night";
  }

  var forced = new URLSearchParams(location.search).get("sky");
  var manualMood = null;
  function currentMood() {
    return manualMood || (MOODS[forced] ? forced : moodNow(new Date()));
  }

  /* ------------------------------------------------------------ canvas */
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1;
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // A second canvas ABOVE the headline lets the flock physically cross the
  // words instead of hiding behind them.
  var front = document.createElement("canvas");
  front.setAttribute("aria-hidden", "true");
  front.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;";
  cover.appendChild(front);
  var fctx = front.getContext("2d");

  var stars = [];
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cover.clientWidth; H = cover.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    front.width = W * dpr; front.height = H * dpr;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Stars live in the top ~55% — the sky part of the photo.
    stars = [];
    var n = Math.round(W / 9);
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.55,
        r: 0.4 + Math.random() * 1.0,
        tw: 1.5 + Math.random() * 3.5,     // twinkle period, seconds
        ph: Math.random() * Math.PI * 2
      });
    }
  }

  /* ------------------------------------------------- the mood crossfade */
  var mood = currentMood();
  var blend = { from: mood, to: mood, t: 1 }; // t: 0→1 over the fade
  function setMood(next) {
    if (next === blend.to) return;
    blend = { from: blend.to, to: next, t: 0 };
  }

  /* The small cover swatches can preview the same three moods as the
     reference page without reloading or changing the visitor's URL. */
  window.BtownSky = {
    setMood: function (next) {
      if (!MOODS[next]) return false;
      manualMood = next;
      setMood(next);
      return true;
    },
    currentMood: currentMood
  };

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixTint(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
  }
  function rgba(c) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + c[3].toFixed(3) + ")"; }

  /* ------------------------------------------------------------ movers */
  // The flock owns the daytime sky. The only independent mover left is a
  // rare shooting star after dark.

  var moonImg = new Image();
  var moonReady = false;
  moonImg.onload = function () { moonReady = true; };
  moonImg.src = "assets/img/hero-fx/moon-real.png";

  /* The supplied branch artwork has a baked checkerboard. Key only its nearly
     neutral white/grey cells to alpha after loading; the photographed branch
     remains untouched. */
  var perchFrame = null;

  function keyCheckerboard(img) {
    var c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    var cc = c.getContext("2d", { willReadFrequently: true });
    cc.drawImage(img, 0, 0);
    var pixels = cc.getImageData(0, 0, c.width, c.height);
    var d = pixels.data;
    for (var i = 0; i < d.length; i += 4) {
      var hi = Math.max(d[i], d[i + 1], d[i + 2]);
      var lo = Math.min(d[i], d[i + 1], d[i + 2]);
      var neutral = hi - lo;
      if (lo > 235 && neutral < 7) d[i + 3] = 0;
      else if (lo > 222 && neutral < 9) d[i + 3] = Math.round(255 * (240 - lo) / 18);
    }
    cc.putImageData(pixels, 0, 0);
    return c;
  }

  function loadPerchFrame(src) {
    var img = new Image();
    img.onload = function () { perchFrame = keyCheckerboard(img); };
    img.src = src;
  }
  loadPerchFrame("assets/img/hero-fx/perch-empty-source.png");

  var mover = null;
  var nextMoverAt = performance.now() / 1000 + 12;

  function scheduleNext(now) {
    nextMoverAt = now + 12 + Math.random() * 22;
  }

  /* ------------------------------------------------------------- flocks */
  // The first flock enters from the left at two seconds and crosses the title
  // in a readable, shallow V. Later flocks can overlap at different heights.
  // They fly at night too, as faint moonlit silhouettes.
  var flocks = [];
  var nextFlockAt = performance.now() / 1000 + 2;

  function spawnFlock(now) {
    // Far-off birds crossing slowly in a ragged V, with a straggler or two
    // chasing the line. Realism at this distance is all behavior, not size:
    // specks that change shape as the wings beat, dim when edge-on, and
    // wander inside a formation that never holds quite still.
    var n = 12 + (Math.random() * 4 | 0);
    var birds = [];
    for (var i = 0; i < n; i++) {
      var rank = Math.ceil(i / 2), side = i % 2 === 1 ? 1 : -1;
      var depth = 0.75 + Math.random() * 0.5;          // nearer birds: bigger, darker
      birds.push({
        dx: -rank * (12 + Math.random() * 4),
        dy: side * rank * (5 + Math.random() * 2) + (Math.random() - 0.5) * 3,
        ph: Math.random() * Math.PI * 2,
        tempo: 6 + Math.random() * 3,                  // wingbeats out of sync
        wander: Math.random() * Math.PI * 2,
        s: depth * 1.08
      });
    }
    // one or two stragglers, well behind the line and slightly off-course
    var extras = 1 + (Math.random() * 2 | 0);
    for (var e = 0; e < extras; e++) {
      birds.push({
        dx: -(n / 2) * 18 - 25 - Math.random() * 35,
        dy: (Math.random() - 0.5) * 26,
        ph: Math.random() * Math.PI * 2,
        tempo: 6 + Math.random() * 3,
        wander: Math.random() * Math.PI * 2,
        s: 0.7 + Math.random() * 0.4
      });
    }
    flocks.push({ t0: now, dur: 32 + Math.random() * 8, ltr: true,
                  y: H * (0.10 + Math.random() * 0.10), amp: 6 + Math.random() * 4, birds: birds });
  }

  function updateFlocks(now, nightAlpha) {
    if (flocks.length < 2 && now >= nextFlockAt) {
      spawnFlock(now);
      var wait = forcedMover === "flock" ? 4 + Math.random() * 5 : 18 + Math.random() * 42;
      nextFlockAt = now + wait;
    }
    for (var i = flocks.length - 1; i >= 0; i--) {
      var f = flocks[i];
      var p = (now - f.t0) / f.dur;
      if (p >= 1) { flocks.splice(i, 1); continue; }
      // The lead bird touches the frame as soon as the flock is spawned, so
      // the first sighting is genuinely two seconds after the hero begins.
      var fx = f.ltr ? lerp(8, W + 160, p) : lerp(W - 8, -160, p);
      var fy = f.y + Math.sin(p * Math.PI * 2 * 1.1) * f.amp;
      var dir = f.ltr ? 1 : -1;
      for (var bi = 0; bi < f.birds.length; bi++) {
        var bd = f.birds[bi];
        var wx = Math.sin(now * 0.35 + bd.wander) * 3;
        var wy = Math.sin(now * 0.5 + bd.wander * 1.7) * 2.5;
        drawSpeck(fx + dir * bd.dx + wx, fy + bd.dy + wy, bd.s,
                  now * bd.tempo + bd.ph, nightAlpha);
      }
    }
  }

  // One distant bird: a body speck and two wing strokes whose angle sweeps
  // through the beat. When the wings pass level they're edge-on to us, so
  // the whole bird thins out and dims — that flicker is what reads as real.
  // Ink by day; after dark it lightens to a faint moonlit grey, the way a
  // night flock only shows where the sky still glows. Drawn on the FRONT
  // canvas, above the headline.
  function drawSpeck(x, y, s, phase, nightK) {
    var f = Math.sin(phase);                    // -1 wings down … +1 wings up
    var ang = 0.15 - 0.75 * f;                  // wing angle from horizontal
    var wing = 2.6 * s;
    var lift = Math.sin(ang) * wing, run = Math.cos(ang) * wing;
    var edge = 1 - Math.abs(f);                 // 1 = wings level (edge-on)
    var a = (lerp(0.55, 0.7, nightK) + 0.35 * Math.abs(f)) * (0.9 - 0.25 * edge);
    var r = Math.round(lerp(14, 216, nightK));
    var g = Math.round(lerp(17, 223, nightK));
    var b = Math.round(lerp(22, 240, nightK));
    fctx.strokeStyle = "rgba(" + r + "," + g + "," + b + "," + a.toFixed(3) + ")";
    fctx.lineWidth = Math.max(0.8, 1.05 * s * (1 + 0.3 * nightK));
    fctx.lineCap = "round";
    fctx.beginPath();
    fctx.moveTo(x - run, y - lift);
    fctx.quadraticCurveTo(x - run * 0.35, y - lift * 0.2, x, y);
    fctx.quadraticCurveTo(x + run * 0.35, y - lift * 0.2, x + run, y - lift);
    fctx.stroke();
  }

  function spawnStar(now) {
    mover = { kind: "star", t0: now, dur: 0.9,
              x0: W * (0.15 + Math.random() * 0.5), y0: H * (0.06 + Math.random() * 0.2),
              dx: W * 0.22, dy: H * 0.12 };
  }

  // ?mover=flock (or star) forces every turn to that animation —
  // handy for showing someone a specific one without waiting on the dice.
  var forcedMover = new URLSearchParams(location.search).get("mover");

  function spawnMover(now, m) {
    var isNight = m === "night" || m === "dusk";
    if (forcedMover === "star") return spawnStar(now);
    if (isNight) spawnStar(now);
    else scheduleNext(now);
  }

  function drawMover(now, nightAlpha) {
    if (!mover) return;
    var p = (now - mover.t0) / mover.dur;
    if (p >= 1) { mover = null; scheduleNext(now); return; }
    if (mover.kind === "star") {
      var fade = Math.sin(p * Math.PI) * nightAlpha;
      if (fade <= 0) return;
      var sx = mover.x0 + mover.dx * p, sy = mover.y0 + mover.dy * p;
      var grad = ctx.createLinearGradient(sx - mover.dx * 0.16, sy - mover.dy * 0.16, sx, sy);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(255,255,240," + (0.85 * fade).toFixed(3) + ")");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx - mover.dx * 0.16, sy - mover.dy * 0.16);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }
  }

  function drawPerch(now, nightAlpha) {
    if (!perchFrame) return;
    var sceneAlpha = 0.70;

    // Keep the branch's rooted end nearly still while the long tips travel in
    // the breeze. Two slow, offset waves create an occasional gentle gust.
    var targetW = W * (W < 720 ? 1.42 : 0.98);
    var targetH = targetW * 941 / 1672;
    var x = W * (W < 720 ? 0.05 : 0.34);
    var y = H * (W < 720 ? 0.33 : 0.21);
    var wind = Math.sin(now * 0.58) * 0.009 + Math.sin(now * 0.21 + 1.7) * 0.0045;
    var pivotX = x + targetW * 0.96;
    var pivotY = y + targetH * 0.55;

    fctx.save();
    fctx.filter = "blur(" + (W < 720 ? 9 : 12) + "px) saturate(.48) contrast(.90) brightness(" +
      (0.68 - nightAlpha * 0.16).toFixed(2) + ")";
    fctx.globalAlpha = sceneAlpha;
    fctx.translate(pivotX, pivotY);
    fctx.rotate(wind);
    fctx.translate(-pivotX, -pivotY);
    fctx.drawImage(perchFrame, x, y, targetW, targetH);
    fctx.restore();
  }

  /* ---------------------------------------------------------- night sky */
  function drawNight(now, starAlpha, moonAlpha) {
    if (starAlpha > 0.01) {
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var tw = 0.55 + 0.45 * Math.sin(now * (Math.PI * 2) / s.tw + s.ph);
        ctx.fillStyle = "rgba(235,240,255," + (starAlpha * tw * 0.85).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawMoon(moonAlpha);
  }

  function drawMoon(alpha) {
    if (!moonReady || alpha <= 0.01) return;
    var mx = W * (W < 720 ? 0.80 : 0.79);
    var my = H * (W < 720 ? 0.17 : 0.19);
    var size = Math.max(105, Math.min(205, Math.min(W, H) * 0.19));
    var halo = ctx.createRadialGradient(mx, my, size * 0.22, mx, my, size * 0.8);
    halo.addColorStop(0, "rgba(236,240,235," + (alpha * 0.10).toFixed(3) + ")");
    halo.addColorStop(1, "rgba(236,240,235,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(mx - size, my - size, size * 2, size * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "screen";
    ctx.filter = "blur(1.7px) saturate(.36) contrast(.72) brightness(1.14)";
    ctx.drawImage(moonImg, mx - size / 2, my - size / 2, size, size);
    ctx.restore();
  }

  /* -------------------------------------------------------------- frame */
  var running = false, rafId = 0, lastMoodCheck = 0;

  function frame() {
    var now = performance.now() / 1000;

    // Re-ask the clock every 30s; the mood crossfades over ~2.5s.
    if (now - lastMoodCheck > 30) { lastMoodCheck = now; setMood(currentMood()); }
    if (blend.t < 1) blend.t = Math.min(1, blend.t + 1 / (2.5 * 60));

    var a = MOODS[blend.from], b = MOODS[blend.to], t = blend.t;
    ctx.clearRect(0, 0, W, H);

    // the tint
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgba(mixTint(a.top, b.top, t)));
    g.addColorStop(0.55, rgba(mixTint(a.mid, b.mid, t)));
    g.addColorStop(1, rgba(mixTint(a.bot, b.bot, t)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var nightAlpha = lerp(a.night, b.night, t);
    var moonAlpha = lerp(a.moon, b.moon, t);
    drawNight(now, nightAlpha, moonAlpha);

    fctx.clearRect(0, 0, W, H);
    drawPerch(now, nightAlpha);
    if (!mover && now >= nextMoverAt) spawnMover(now, blend.to);
    drawMover(now, nightAlpha);

    updateFlocks(now, nightAlpha);

    if (running) rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  /* --------------------------------------------------------------- boot */
  resize();
  addEventListener("resize", resize);

  if (reduceMotion) {
    // One honest still frame: the right tint for the hour, no movement.
    blend.t = 1;
    var m = MOODS[currentMood()];
    var g2 = ctx.createLinearGradient(0, 0, 0, H);
    g2.addColorStop(0, rgba(m.top)); g2.addColorStop(0.55, rgba(m.mid)); g2.addColorStop(1, rgba(m.bot));
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    drawNight(0, m.night, m.moon);
  } else {
    start();
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });
  }
})();
