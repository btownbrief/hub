/* The living photo. A transparent canvas sits over the harbor photo and keeps
   it honest with the sky outside: Burlington's real sun times pick the mood,
   night brings stars and the actual moon phase, and once in a while something
   small crosses the frame — a gull by day, a sailboat on the water, a shooting
   star after dark. Everything here is garnish: if this file never runs, the
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

  // 0 = new, 0.5 = full. Anchored to the new moon of Jan 6 2000, 18:14 UTC.
  function moonPhase(date) {
    var synodic = 29.53058867;
    var days = (date.getTime() - 947182440000) / 864e5;
    return ((days % synodic) + synodic) % synodic / synodic;
  }

  /* ------------------------------------------------------------- moods */
  // Each mood is a tint painted over the photo plus how strongly the night
  // layer (stars + moon) shows through. Tints stay gentle on purpose: the
  // photo is the hero, the canvas just nudges it toward the hour.
  var MOODS = {
    dawn:   { top: [255, 178, 158, 0.16], mid: [140, 150, 200, 0.10], bot: [70, 80, 120, 0.06],  night: 0.25 },
    day:    { top: [150, 190, 235, 0.18], mid: [180, 205, 235, 0.10], bot: [200, 215, 235, 0.05], night: 0 },
    golden: { top: [255, 160, 110, 0.10], mid: [255, 140, 120, 0.07], bot: [255, 150, 110, 0.05], night: 0 },
    dusk:   { top: [60, 55, 110, 0.34],   mid: [90, 70, 120, 0.22],   bot: [40, 45, 90, 0.18],    night: 0.55 },
    night:  { top: [8, 14, 38, 0.62],     mid: [10, 18, 46, 0.52],    bot: [6, 12, 34, 0.46],     night: 1 }
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
  function currentMood() {
    return MOODS[forced] ? forced : moodNow(new Date());
  }

  /* ------------------------------------------------------------ canvas */
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1;
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var stars = [];
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cover.clientWidth; H = cover.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixTint(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
  }
  function rgba(c) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + c[3].toFixed(3) + ")"; }

  /* ------------------------------------------------------------ movers */
  // One visitor at a time. Gulls by day, a sailboat on the water once in a
  // while, a shooting star after dark. Rare is the whole trick.
  var mover = null;
  var nextMoverAt = performance.now() / 1000 + 14 + Math.random() * 20; // first one fairly soon
  var boatSeen = false;

  function scheduleNext(now) {
    nextMoverAt = now + 55 + Math.random() * 75;
  }

  function spawnMover(now, m) {
    var isNight = m === "night" || m === "dusk";
    if (isNight) {
      mover = { kind: "star", t0: now, dur: 0.9,
                x0: W * (0.15 + Math.random() * 0.5), y0: H * (0.06 + Math.random() * 0.2),
                dx: W * 0.22, dy: H * 0.12 };
    } else if (!boatSeen && Math.random() < 0.35) {
      boatSeen = true;
      var ltr = Math.random() < 0.5;
      mover = { kind: "boat", t0: now, dur: 70, ltr: ltr, y: H * 0.80 };
    } else {
      var ltr2 = Math.random() < 0.5;
      mover = { kind: "gull", t0: now, dur: 13 + Math.random() * 6, ltr: ltr2,
                y: H * (0.12 + Math.random() * 0.22), amp: 6 + Math.random() * 10 };
    }
  }

  function drawGull(x, y, s, flap) {
    // Two strokes of the pen, like every gull ever drawn on a postcard.
    var w = 9 * s, lift = flap * 4.5 * s;
    ctx.strokeStyle = "rgba(30,34,44,0.78)";
    ctx.lineWidth = 1.6 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - w, y + 1 * s);
    ctx.quadraticCurveTo(x - w * 0.45, y - lift, x, y);
    ctx.quadraticCurveTo(x + w * 0.45, y - lift, x + w, y + 1 * s);
    ctx.stroke();
  }

  function drawBoat(x, y, s) {
    ctx.fillStyle = "rgba(28,30,40,0.62)";
    ctx.beginPath(); // hull
    ctx.moveTo(x - 7 * s, y); ctx.lineTo(x + 7 * s, y);
    ctx.lineTo(x + 4.5 * s, y + 2.4 * s); ctx.lineTo(x - 4.5 * s, y + 2.4 * s);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); // sail
    ctx.moveTo(x + 0.5 * s, y - 1 * s); ctx.lineTo(x + 0.5 * s, y - 11 * s);
    ctx.lineTo(x - 5.5 * s, y - 1.5 * s);
    ctx.closePath(); ctx.fill();
  }

  function drawMover(now, nightAlpha) {
    if (!mover) return;
    var p = (now - mover.t0) / mover.dur;
    if (p >= 1) { mover = null; scheduleNext(now); return; }
    if (mover.kind === "gull") {
      var x = mover.ltr ? lerp(-30, W + 30, p) : lerp(W + 30, -30, p);
      var y = mover.y + Math.sin(p * Math.PI * 2 * 2.2) * mover.amp;
      // Glide, flap-flap, glide: flap strength comes and goes.
      var beat = Math.sin(now * 9 + mover.t0);
      var effort = 0.5 + 0.5 * Math.sin(p * Math.PI * 6);
      drawGull(x, y, 1, Math.max(0.15, beat * effort));
    } else if (mover.kind === "boat") {
      var bx = mover.ltr ? lerp(-16, W * 0.55, p) : lerp(W + 16, W * 0.45, p);
      drawBoat(bx, mover.y, 1);
    } else { // shooting star
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

  /* ---------------------------------------------------------- night sky */
  function drawNight(now, alpha) {
    if (alpha <= 0.01) return;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.55 + 0.45 * Math.sin(now * (Math.PI * 2) / s.tw + s.ph);
      ctx.fillStyle = "rgba(235,240,255," + (alpha * tw * 0.85).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    drawMoon(alpha);
  }

  // The moon is composed on its own little canvas first — carving the shadow
  // out in place would punch a hole through the night tint below it.
  var moonTile = null, moonTileR = 0;
  function moonSprite(r) {
    if (moonTile && moonTileR === r) return moonTile;
    var size = Math.ceil(r * 6.4);
    var m = document.createElement("canvas");
    m.width = m.height = size;
    var mc = m.getContext("2d");
    var c = size / 2;
    // Lit disc, then bite the shadow out of it: a same-size disc slid
    // sideways by how full the moon is. Not textbook astronomy, but it
    // reads right at postcard size.
    mc.fillStyle = "rgba(238,238,224,0.92)";
    mc.beginPath(); mc.arc(c, c, r, 0, Math.PI * 2); mc.fill();
    var phase = moonPhase(new Date());
    var lit = (1 - Math.cos(phase * Math.PI * 2)) / 2; // 0 new → 1 full
    if (lit < 0.97) {
      mc.globalCompositeOperation = "destination-out";
      var dir = phase < 0.5 ? -1 : 1; // waxing lights the right side first
      mc.beginPath();
      mc.arc(c + dir * 2 * r * lit, c, r, 0, Math.PI * 2);
      mc.fill();
    }
    // Halo goes in last, underneath everything, so the phase bite above
    // can never punch a hole through it.
    mc.globalCompositeOperation = "destination-over";
    var halo = mc.createRadialGradient(c, c, r * 0.6, c, c, r * 3.2);
    halo.addColorStop(0, "rgba(240,240,225,0.20)");
    halo.addColorStop(1, "rgba(240,240,225,0)");
    mc.fillStyle = halo;
    mc.fillRect(0, 0, size, size);
    mc.globalCompositeOperation = "source-over";
    moonTile = m; moonTileR = r;
    return m;
  }

  function drawMoon(alpha) {
    var mx = W * 0.78, my = H * 0.20, r = Math.max(14, Math.min(W, H) * 0.035);
    var tile = moonSprite(Math.round(r));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(tile, mx - tile.width / 2, my - tile.height / 2);
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
    drawNight(now, nightAlpha);

    if (!mover && now >= nextMoverAt) spawnMover(now, blend.to);
    drawMover(now, nightAlpha);

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
    drawNight(0, m.night);
  } else {
    start();
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });
  }
})();
