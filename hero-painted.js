/* The painted harbor. Instead of the photo, the cover becomes a slow living
   painting of the same view — the breakwater, the Adirondacks, the moored
   boats — that follows Burlington's actual sun: pink at golden hour, blue at
   midday, stars and the real moon phase after dark. Clouds drift, the water
   glimmers, and once in a while a gull or a sailboat crosses the frame.

   Three dots in the corner let you pick the hour yourself; the first one
   hands the sky back to the clock. The photo stays in the HTML as the
   fallback — if this file never runs, the page is exactly what it was.

   Force a mood for testing: ?sky=dawn|day|golden|dusk|night */
(function () {
  "use strict";

  var canvas = document.getElementById("sky-painted");
  var cover = canvas && canvas.closest(".cover");
  if (!canvas || !cover) return;

  var LAT = 44.4759, LON = -73.2121; // Burlington harbor
  var HORIZON = 0.60;                // where the lake meets the mountains

  /* ---------------------------------------------------------- sun & moon */
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
    if (cosH < -1 || cosH > 1) return null;
    var Jset = Jnoon + Math.acos(cosH) / (2 * Math.PI);
    var Jrise = Jnoon - (Jset - Jnoon);
    var fromJulian = function (j) { return new Date((j + 0.5 - J1970) * dayMs); };
    return { rise: fromJulian(Jrise), set: fromJulian(Jset) };
  }

  function moonPhase(date) { // 0 new → 0.5 full
    var synodic = 29.53058867;
    var days = (date.getTime() - 947182440000) / 864e5;
    return ((days % synodic) + synodic) % synodic / synodic;
  }

  /* ----------------------------------------------------------- palettes */
  // Every color the painting needs, per hour. All get blended smoothly when
  // the mood changes, so dawn slides into day without a jump cut.
  var P = {
    dawn: {
      skyTop: [86, 96, 148], skyMid: [196, 158, 178], skyLow: [244, 196, 170],
      waterTop: [212, 176, 172], waterBot: [104, 100, 136],
      ridgeFar: [128, 120, 158], ridgeNear: [66, 66, 96],
      cloud: [255, 224, 214], cloudA: 0.5,
      sun: { y: 0.92, r: 0.05, col: [255, 214, 170], glow: 0.5 },
      stars: 0.15, moon: 0, glitter: [255, 220, 190]
    },
    day: {
      skyTop: [96, 152, 214], skyMid: [148, 190, 232], skyLow: [214, 230, 242],
      waterTop: [150, 184, 212], waterBot: [72, 110, 152],
      ridgeFar: [118, 148, 184], ridgeNear: [58, 88, 84],
      cloud: [252, 252, 252], cloudA: 0.55,
      sun: { y: 2, r: 0, col: [255, 250, 230], glow: 0 }, // midday sun stays out of frame

      stars: 0, moon: 0, glitter: [255, 255, 245]
    },
    golden: {
      skyTop: [122, 116, 168], skyMid: [216, 148, 158], skyLow: [255, 186, 140],
      waterTop: [236, 168, 148], waterBot: [116, 92, 128],
      ridgeFar: [112, 96, 140], ridgeNear: [52, 52, 80],
      cloud: [255, 206, 186], cloudA: 0.55,
      sun: { y: 0.86, r: 0.055, col: [255, 200, 140], glow: 0.6 },
      stars: 0, moon: 0, glitter: [255, 196, 150]
    },
    dusk: {
      skyTop: [38, 40, 84], skyMid: [86, 66, 122], skyLow: [180, 110, 118],
      waterTop: [130, 92, 118], waterBot: [36, 38, 72],
      ridgeFar: [64, 58, 100], ridgeNear: [28, 28, 52],
      cloud: [150, 116, 150], cloudA: 0.42,
      sun: { y: 1.06, r: 0.05, col: [255, 170, 120], glow: 0.35 },
      stars: 0.55, moon: 0.6, glitter: [230, 200, 190]
    },
    night: {
      skyTop: [10, 16, 42], skyMid: [16, 26, 60], skyLow: [30, 44, 82],
      waterTop: [24, 34, 64], waterBot: [8, 12, 30],
      ridgeFar: [26, 32, 62], ridgeNear: [12, 16, 36],
      cloud: [46, 58, 96], cloudA: 0.3,
      sun: { y: 2, r: 0, col: [0, 0, 0], glow: 0 },
      stars: 1, moon: 1, glitter: [220, 228, 240]
    }
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
  var override = P[forced] ? forced : null; // the dots can set this too
  function currentMood() { return override || moodNow(new Date()); }

  /* ------------------------------------------------------------ canvas */
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1;
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var stars = [], cloudsFar = [], cloudsNear = [], shimmer = [], grain = null;

  function makeClouds(n, yLo, yHi, sLo, sHi) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var puffs = [];
      var pn = 4 + (Math.random() * 4 | 0);
      for (var j = 0; j < pn; j++) {
        puffs.push({ dx: (Math.random() - 0.5) * 2.2, dy: (Math.random() - 0.5) * 0.5,
                     r: 0.45 + Math.random() * 0.6 });
      }
      out.push({ x: Math.random(), y: yLo + Math.random() * (yHi - yLo),
                 s: sLo + Math.random() * (sHi - sLo),
                 v: 0.004 + Math.random() * 0.006, // screen-widths per minute
                 puffs: puffs });
    }
    return out;
  }

  function makeGrain() {
    var g = document.createElement("canvas");
    g.width = g.height = 160;
    var gc = g.getContext("2d");
    var img = gc.createImageData(160, 160);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = 118 + Math.random() * 20 | 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 14;
    }
    gc.putImageData(img, 0, 0);
    return g;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cover.clientWidth; H = cover.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stars = [];
    for (var i = 0, n = Math.round(W / 8); i < n; i++) {
      stars.push({ x: Math.random(), y: Math.random() * (HORIZON - 0.04),
                   r: 0.4 + Math.random() * 1.1,
                   tw: 1.5 + Math.random() * 3.5, ph: Math.random() * Math.PI * 2 });
    }
    shimmer = [];
    for (var k = 0, sn = Math.round(W / 12); k < sn; k++) {
      shimmer.push({ x: Math.random(), y: HORIZON + 0.02 + Math.random() * (1 - HORIZON - 0.06),
                     w: 0.01 + Math.random() * 0.035,
                     tw: 2 + Math.random() * 5, ph: Math.random() * Math.PI * 2 });
    }
    if (!cloudsFar.length) {
      cloudsFar = makeClouds(6, 0.06, 0.34, 0.05, 0.09);
      cloudsNear = makeClouds(4, 0.10, 0.42, 0.11, 0.19);
    }
    grain = grain || makeGrain();
  }

  /* ---------------------------------------------------------- blending */
  var blend = { from: currentMood(), to: currentMood(), t: 1 };
  function setMood(next) {
    if (next === blend.to) return;
    blend = { from: blend.to, to: next, t: 0 };
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function rgb(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + (a === undefined ? 1 : a.toFixed(3)) + ")"; }

  // Blend the two active palettes into one working palette each frame.
  function palette() {
    var a = P[blend.from], b = P[blend.to], t = blend.t, out = {};
    ["skyTop", "skyMid", "skyLow", "waterTop", "waterBot", "ridgeFar", "ridgeNear", "cloud", "glitter"]
      .forEach(function (k) { out[k] = mix3(a[k], b[k], t); });
    out.cloudA = lerp(a.cloudA, b.cloudA, t);
    out.stars = lerp(a.stars, b.stars, t);
    out.moon = lerp(a.moon, b.moon, t);
    out.sun = { y: lerp(a.sun.y, b.sun.y, t), r: lerp(a.sun.r, b.sun.r, t),
                col: mix3(a.sun.col, b.sun.col, t), glow: lerp(a.sun.glow, b.sun.glow, t) };
    return out;
  }

  /* ------------------------------------------------------- the painting */
  function ridgeY(x, seed, base, amp) {
    // A mountain line out of three sine waves — different seeds, different range.
    return base + amp * (Math.sin(x * 0.9 + seed) * 0.5 +
                         Math.sin(x * 2.3 + seed * 2.7) * 0.3 +
                         Math.sin(x * 5.1 + seed * 1.3) * 0.2);
  }

  function drawRidge(pal, col, seed, base, amp) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (var x = 0; x <= W; x += 6) {
      ctx.lineTo(x, H * ridgeY(x / W * Math.PI * 2, seed, base, amp));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawCloud(c, pal, now) {
    var cx = ((c.x + now / 60 * c.v) % 1.3 - 0.15) * W;
    var cy = c.y * H, s = c.s * W;
    // Squash the puffs to 40% height so they read as clouds, not bokeh.
    for (var i = 0; i < c.puffs.length; i++) {
      var p = c.puffs[i];
      var px = cx + p.dx * s, py = cy + p.dy * s * 0.4, pr = p.r * s * 0.55;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1, 0.4);
      var g = ctx.createRadialGradient(0, 0, pr * 0.1, 0, 0, pr);
      g.addColorStop(0, rgb(pal.cloud, pal.cloudA));
      g.addColorStop(1, rgb(pal.cloud, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawSun(pal) {
    var s = pal.sun;
    if (s.y > 1.2 || s.r <= 0) return;
    var sx = W * 0.63, sy = H * HORIZON * s.y, sr = W * s.r;
    var glow = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 6);
    glow.addColorStop(0, rgb(s.col, s.glow));
    glow.addColorStop(1, rgb(s.col, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(sx - sr * 6, sy - sr * 6, sr * 12, sr * 12);
    ctx.fillStyle = rgb(s.col, 0.95);
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
  }

  // The moon is composed on its own little canvas first — carving the shadow
  // out in place would punch a hole through the sky painted below it.
  var moonTile = null, moonTileR = 0;
  function moonSprite(r) {
    if (moonTile && moonTileR === r) return moonTile;
    var size = Math.ceil(r * 6.4);
    var m = document.createElement("canvas");
    m.width = m.height = size;
    var mc = m.getContext("2d");
    var c = size / 2;
    mc.fillStyle = "rgba(238,238,224,0.94)";
    mc.beginPath(); mc.arc(c, c, r, 0, Math.PI * 2); mc.fill();
    var phase = moonPhase(new Date());
    var lit = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    if (lit < 0.97) {
      mc.globalCompositeOperation = "destination-out";
      var dir = phase < 0.5 ? -1 : 1;
      mc.beginPath();
      mc.arc(c + dir * 2 * r * lit, c, r, 0, Math.PI * 2);
      mc.fill();
    }
    // Halo goes in last, underneath everything, so the phase bite above
    // can never punch a hole through it.
    mc.globalCompositeOperation = "destination-over";
    var halo = mc.createRadialGradient(c, c, r * 0.6, c, c, r * 3.2);
    halo.addColorStop(0, "rgba(240,240,225,0.22)");
    halo.addColorStop(1, "rgba(240,240,225,0)");
    mc.fillStyle = halo;
    mc.fillRect(0, 0, size, size);
    mc.globalCompositeOperation = "source-over";
    moonTile = m; moonTileR = r;
    return m;
  }

  function drawMoon(pal) {
    if (pal.moon <= 0.02) return;
    var mx = W * 0.76, my = H * 0.16, r = Math.max(13, Math.min(W, H) * 0.032);
    var tile = moonSprite(Math.round(r));
    ctx.save();
    ctx.globalAlpha = pal.moon;
    ctx.drawImage(tile, mx - tile.width / 2, my - tile.height / 2);
    ctx.restore();
  }

  function drawStars(pal, now) {
    if (pal.stars <= 0.02) return;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var tw = 0.55 + 0.45 * Math.sin(now * (Math.PI * 2) / s.tw + s.ph);
      ctx.fillStyle = "rgba(235,240,255," + (pal.stars * tw * 0.85).toFixed(3) + ")";
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawWater(pal, now) {
    var top = H * HORIZON;
    var g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, rgb(pal.waterTop));
    g.addColorStop(1, rgb(pal.waterBot));
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);

    // A column of glitter under the light, then loose flecks everywhere.
    var lx = W * 0.63;
    ctx.lineWidth = 1;
    for (var i = 0; i < shimmer.length; i++) {
      var s = shimmer[i];
      var pull = 1 - Math.min(1, Math.abs(s.x * W - lx) / (W * 0.16));
      var a = (0.05 + 0.30 * pull * pull) *
              (0.5 + 0.5 * Math.sin(now * (Math.PI * 2) / s.tw + s.ph));
      if (a < 0.02) continue;
      ctx.strokeStyle = rgb(pal.glitter, a);
      ctx.beginPath();
      ctx.moveTo(s.x * W - s.w * W / 2, s.y * H);
      ctx.lineTo(s.x * W + s.w * W / 2, s.y * H);
      ctx.stroke();
    }
  }

  // The wooded point on the left, sliding into the lake like Shelburne Point
  // does in the photo. Only the left half of the frame — the horizon stays
  // open on the right.
  function drawShorePoint(pal) {
    ctx.fillStyle = rgb(pal.ridgeNear, 0.9);
    ctx.beginPath();
    ctx.moveTo(0, H * (HORIZON - 0.014));
    ctx.quadraticCurveTo(W * 0.10, H * (HORIZON - 0.034), W * 0.20, H * (HORIZON - 0.012));
    ctx.quadraticCurveTo(W * 0.31, H * (HORIZON + 0.004), W * 0.42, H * (HORIZON + 0.016));
    ctx.lineTo(W * 0.42, H * (HORIZON + 0.022));
    ctx.lineTo(0, H * (HORIZON + 0.055));
    ctx.closePath();
    ctx.fill();
  }

  function drawBreakwater(pal) {
    // The low dark line the whole photo hangs on. Two segments, like life.
    // Kept high in the water so the fade into the page doesn't swallow it.
    var col = rgb(mix3(pal.ridgeNear, [0, 0, 0], 0.25), 0.85);
    ctx.strokeStyle = col;
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(2, H * 0.008);
    ctx.beginPath();
    ctx.moveTo(W * 0.20, H * 0.715);
    ctx.lineTo(W * 0.33, H * 0.685);
    ctx.moveTo(W * 0.38, H * 0.695);
    ctx.lineTo(W * 0.62, H * 0.72);
    ctx.stroke();
    // moored sailboats in the harbor, left edge — masts and hulls
    ctx.lineWidth = 1.2;
    var spots = [[0.055, 0.745], [0.09, 0.775], [0.13, 0.75], [0.045, 0.81]];
    for (var i = 0; i < spots.length; i++) {
      var x = W * spots[i][0], y = H * spots[i][1];
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x, y - H * 0.028);
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillRect(x - 3.5, y, 7, 2);
    }
  }

  /* ------------------------------------------------------------ movers */
  var mover = null;
  var nextMoverAt = performance.now() / 1000 + 12 + Math.random() * 18;
  var boatSeen = false;
  function scheduleNext(now) { nextMoverAt = now + 55 + Math.random() * 75; }

  function spawnMover(now, m) {
    var isNight = m === "night" || m === "dusk";
    if (isNight) {
      mover = { kind: "star", t0: now, dur: 0.9,
                x0: W * (0.15 + Math.random() * 0.5), y0: H * (0.05 + Math.random() * 0.18),
                dx: W * 0.22, dy: H * 0.12 };
    } else if (!boatSeen && Math.random() < 0.35) {
      boatSeen = true;
      mover = { kind: "boat", t0: now, dur: 70, ltr: Math.random() < 0.5, y: H * 0.76 };
    } else {
      mover = { kind: "gull", t0: now, dur: 13 + Math.random() * 6, ltr: Math.random() < 0.5,
                y: H * (0.10 + Math.random() * 0.25), amp: 6 + Math.random() * 10 };
    }
  }

  function drawGull(x, y, s, flap, pal) {
    var w = 9 * s, lift = flap * 4.5 * s;
    ctx.strokeStyle = rgb(mix3(pal.ridgeNear, [0, 0, 0], 0.3), 0.8);
    ctx.lineWidth = 1.6 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - w, y + 1 * s);
    ctx.quadraticCurveTo(x - w * 0.45, y - lift, x, y);
    ctx.quadraticCurveTo(x + w * 0.45, y - lift, x + w, y + 1 * s);
    ctx.stroke();
  }

  function drawBoat(x, y, s, pal) {
    ctx.fillStyle = rgb(mix3(pal.ridgeNear, [0, 0, 0], 0.2), 0.7);
    ctx.beginPath();
    ctx.moveTo(x - 7 * s, y); ctx.lineTo(x + 7 * s, y);
    ctx.lineTo(x + 4.5 * s, y + 2.4 * s); ctx.lineTo(x - 4.5 * s, y + 2.4 * s);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 0.5 * s, y - 1 * s); ctx.lineTo(x + 0.5 * s, y - 11 * s);
    ctx.lineTo(x - 5.5 * s, y - 1.5 * s);
    ctx.closePath(); ctx.fill();
  }

  function drawMover(now, pal) {
    if (!mover) return;
    var p = (now - mover.t0) / mover.dur;
    if (p >= 1) { mover = null; scheduleNext(now); return; }
    if (mover.kind === "gull") {
      var x = mover.ltr ? lerp(-30, W + 30, p) : lerp(W + 30, -30, p);
      var y = mover.y + Math.sin(p * Math.PI * 2 * 2.2) * mover.amp;
      var beat = Math.sin(now * 9 + mover.t0);
      var effort = 0.5 + 0.5 * Math.sin(p * Math.PI * 6);
      drawGull(x, y, 1, Math.max(0.15, beat * effort), pal);
    } else if (mover.kind === "boat") {
      var bx = mover.ltr ? lerp(-16, W * 0.55, p) : lerp(W + 16, W * 0.45, p);
      drawBoat(bx, mover.y, 1, pal);
    } else {
      var fade = Math.sin(p * Math.PI) * pal.stars;
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

  /* -------------------------------------------------------------- frame */
  var running = false, rafId = 0, lastMoodCheck = 0;

  function paint(now) {
    var pal = palette();

    // sky
    var g = ctx.createLinearGradient(0, 0, 0, H * HORIZON * 1.05);
    g.addColorStop(0, rgb(pal.skyTop));
    g.addColorStop(0.6, rgb(pal.skyMid));
    g.addColorStop(1, rgb(pal.skyLow));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * HORIZON + 1);

    drawStars(pal, now);
    drawSun(pal);
    drawMoon(pal);
    for (var i = 0; i < cloudsFar.length; i++) drawCloud(cloudsFar[i], pal, now);
    // Two ridge lines — a hazy far one half-dissolved into the sky, then the
    // Adirondacks proper, softened so the horizon isn't a hard stripe.
    drawRidge(pal, rgb(mix3(pal.ridgeFar, pal.skyLow, 0.55), 0.7), 5.3, HORIZON - 0.048, 0.02);
    drawRidge(pal, rgb(pal.ridgeFar, 0.6), 3.7, HORIZON - 0.026, 0.016);
    // haze where the mountains meet the sky
    var haze = ctx.createLinearGradient(0, H * (HORIZON - 0.08), 0, H * HORIZON);
    haze.addColorStop(0, rgb(pal.skyLow, 0));
    haze.addColorStop(1, rgb(pal.skyLow, 0.4));
    ctx.fillStyle = haze;
    ctx.fillRect(0, H * (HORIZON - 0.08), W, H * 0.08);
    for (var j = 0; j < cloudsNear.length; j++) drawCloud(cloudsNear[j], pal, now);
    drawWater(pal, now);
    drawShorePoint(pal);
    drawBreakwater(pal);
    drawMover(now, pal);

    // the painted-paper grain
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = ctx.createPattern(grain, "repeat");
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  function frame() {
    var now = performance.now() / 1000;
    if (now - lastMoodCheck > 30) { lastMoodCheck = now; setMood(currentMood()); }
    if (blend.t < 1) blend.t = Math.min(1, blend.t + 1 / (2.5 * 60));
    ctx.clearRect(0, 0, W, H);
    paint(now);
    if (!mover && now >= nextMoverAt) spawnMover(now, blend.to);
    if (running) rafId = requestAnimationFrame(frame);
  }

  function start() { if (!running) { running = true; rafId = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(rafId); }

  /* ------------------------------------------------------- the mood dots */
  // Three dots, like a paint sampler: follow the clock, golden hour, night.
  function makeDots() {
    var wrap = document.createElement("div");
    wrap.className = "sky-dots";
    wrap.setAttribute("aria-label", "Pick the sky");
    var dots = [
      { key: null, label: "Sky follows the Burlington clock", cls: "auto" },
      { key: "golden", label: "Golden hour", cls: "golden" },
      { key: "night", label: "Night", cls: "night" }
    ];
    dots.forEach(function (d, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sky-dot " + d.cls + (i === 0 && !override ? " on" : "");
      b.title = d.label;
      b.setAttribute("aria-label", d.label);
      b.addEventListener("click", function () {
        override = d.key;
        setMood(currentMood());
        wrap.querySelectorAll(".sky-dot").forEach(function (el) { el.classList.remove("on"); });
        b.classList.add("on");
        if (reduceMotion) stillFrame();
      });
      wrap.appendChild(b);
    });
    cover.appendChild(wrap);
  }

  /* --------------------------------------------------------------- boot */
  function stillFrame() {
    blend = { from: currentMood(), to: currentMood(), t: 1 };
    ctx.clearRect(0, 0, W, H);
    paint(0);
  }

  resize();
  addEventListener("resize", resize);
  makeDots();

  if (reduceMotion) {
    stillFrame();
  } else {
    start();
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });
  }
  canvas.classList.add("on"); // fades in over the photo
})();
