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
  var manualMood = null;
  function currentMood() {
    return manualMood || (MOODS[forced] ? forced : moodNow(new Date()));
  }

  /* ------------------------------------------------------------ canvas */
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = 1;
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // A second canvas ABOVE the headline (z-index 2 beats .cover-copy's 1).
  // Only the flocks draw here — specks small enough to cross the title
  // without costing readability, and easy to spot at night.
  var front = document.createElement("canvas");
  front.setAttribute("aria-hidden", "true");
  front.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;";
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
  // One visitor at a time, and the first is always the gull, within seconds
  // of arriving — day or night, everyone gets to see the bird. After that:
  // more gulls, a sailboat once per visit by day, and after dark a shooting
  // star takes some of the turns. Rare-ish is still the trick.

  // The gull is a real one — three photographic frames (glide, wings up,
  // wings down) keyed out to transparency. A moonlit copy of each frame is
  // pre-tinted on a small canvas, and the two are crossfaded by how dark the
  // sky is. Until the images arrive (or if they never do), the old two-stroke
  // pen gull flies instead.
  var gullImgs = {}, gullNight = {}, gullReady = false;
  (function loadGullSprites() {
    var srcs = { glide: "assets/img/gull/fly-glide.png", up: "assets/img/gull/fly-up.png", down: "assets/img/gull/fly-down.png" };
    var need = 3;
    Object.keys(srcs).forEach(function (k) {
      var img = new Image();
      img.onload = function () {
        gullImgs[k] = img;
        var c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        var cc = c.getContext("2d");
        cc.drawImage(img, 0, 0);
        cc.globalCompositeOperation = "source-atop";
        cc.fillStyle = "rgba(38,52,86,0.62)";
        cc.fillRect(0, 0, c.width, c.height);
        gullNight[k] = c;
        if (--need === 0) gullReady = true;
      };
      img.src = srcs[k];
    });
  })();

  var mover = null;
  var nextMoverAt = performance.now() / 1000 + 4 + Math.random() * 5;
  var boatSeen = false;
  var firstFlight = true;

  function scheduleNext(now) {
    nextMoverAt = now + 12 + Math.random() * 22;
  }

  var lastNightAlpha = 0;

  function spawnGull(now) {
    var dur = 13 + Math.random() * 6;
    // If the 3D bird (hero-bird3d.js) is ready, it takes the gull's turn —
    // a rigged model with a real wing animation. The mover entry just holds
    // the slot so nothing else flies at the same time.
    if (window.BtownBird && window.BtownBird.ready &&
        window.BtownBird.fly({ ltr: Math.random() < 0.5, y: 0.12 + Math.random() * 0.22,
                               dur: dur, night: function () { return lastNightAlpha; } })) {
      mover = { kind: "bird3d", t0: now, dur: dur };
      return;
    }
    mover = { kind: "gull", t0: now, dur: dur, ltr: Math.random() < 0.5,
              y: H * (0.12 + Math.random() * 0.22), amp: 6 + Math.random() * 10 };
  }

  /* ------------------------------------------------------------- flocks */
  // Flocks are their own channel, separate from the mover: they can overlap
  // the gull, and up to two can cross at once at different heights. They
  // draw on the front canvas — above the headline — so a line of birds can
  // cross the title the way credits get crossed in a film. First one shows
  // up within seconds. They fly at night too, as faint moonlit silhouettes.
  var flocks = [];
  var nextFlockAt = performance.now() / 1000 + 5 + Math.random() * 6;

  function spawnFlock(now) {
    // Far-off birds crossing slowly in a ragged V, with a straggler or two
    // chasing the line. Realism at this distance is all behavior, not size:
    // specks that change shape as the wings beat, dim when edge-on, and
    // wander inside a formation that never holds quite still.
    var n = 8 + (Math.random() * 5 | 0);
    var birds = [];
    for (var i = 0; i < n; i++) {
      var rank = Math.ceil(i / 2), side = i % 2 === 1 ? 1 : -1;
      var depth = 0.75 + Math.random() * 0.5;          // nearer birds: bigger, darker
      birds.push({
        dx: -rank * (14 + Math.random() * 6),
        dy: side * rank * (6 + Math.random() * 3) + (Math.random() - 0.5) * 5,
        ph: Math.random() * Math.PI * 2,
        tempo: 6 + Math.random() * 3,                  // wingbeats out of sync
        wander: Math.random() * Math.PI * 2,
        s: depth
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
    flocks.push({ t0: now, dur: 28 + Math.random() * 10, ltr: Math.random() < 0.5,
                  y: H * (0.06 + Math.random() * 0.24), amp: 5 + Math.random() * 5, birds: birds });
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
      var fx = f.ltr ? lerp(-160, W + 160, p) : lerp(W + 160, -160, p);
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

  function spawnBoat(now) {
    boatSeen = true;
    mover = { kind: "boat", t0: now, dur: 70, ltr: Math.random() < 0.5, y: H * 0.80 };
  }

  // ?mover=flock (or gull/boat/star) forces every turn to that animation —
  // handy for showing someone a specific one without waiting on the dice.
  var forcedMover = new URLSearchParams(location.search).get("mover");

  function spawnMover(now, m) {
    var isNight = m === "night" || m === "dusk";
    if (forcedMover === "gull") return spawnGull(now);
    if (forcedMover === "boat") return spawnBoat(now);
    if (forcedMover === "star") return spawnStar(now);
    if (firstFlight) {
      firstFlight = false;
      spawnGull(now);
    } else if (isNight) {
      Math.random() < 0.45 ? spawnStar(now) : spawnGull(now);
    } else {
      var r = Math.random();
      if (r < 0.25 && !boatSeen) spawnBoat(now);
      else spawnGull(now);
    }
  }

  function drawGullSprite(x, y, ltr, frame, tilt, nightAlpha) {
    var img = gullImgs[frame], nimg = gullNight[frame];
    if (!img) return;
    // Wingspan lands around 55–75px depending on cover width.
    var scale = Math.max(0.45, Math.min(0.62, W / 2100));
    var w = img.width * scale, h = img.height * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    if (ltr) ctx.scale(-1, 1); // the photographed bird faces left
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    if (nightAlpha > 0.02 && nimg) {
      // crossfade to the moonlit copy as the sky darkens
      ctx.globalAlpha = Math.min(1, nightAlpha);
      ctx.drawImage(nimg, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  function drawGull(x, y, s, flap, nightAlpha) {
    // Two strokes of the pen, like every gull ever drawn on a postcard.
    // By day it's ink against the sky; after dark the same bird goes pale,
    // like the moon is catching its wings — ink would vanish in the night.
    var w = 9 * s, lift = flap * 4.5 * s;
    var k = nightAlpha || 0;
    ctx.strokeStyle = "rgba(" + Math.round(30 + 175 * k) + "," + Math.round(34 + 181 * k) + "," +
                      Math.round(44 + 186 * k) + ",0.75)";
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
    if (mover.kind === "bird3d") return; // hero-bird3d.js renders this one
    if (mover.kind === "gull") {
      var x = mover.ltr ? lerp(-80, W + 80, p) : lerp(W + 80, -80, p);
      var bobPhase = p * Math.PI * 2 * 2.2;
      var y = mover.y + Math.sin(bobPhase) * mover.amp;
      if (gullReady) {
        // Mostly soaring, with a quick flap burst every couple of seconds.
        if (!mover.nextFlap) mover.nextFlap = mover.t0 + 1 + Math.random() * 1.5;
        var frame = "glide";
        if (now >= mover.nextFlap) {
          var seq = ["up", "down", "up", "down", "up"];
          var fi = Math.floor((now - mover.nextFlap) / 0.09);
          if (fi < seq.length) frame = seq[fi];
          else mover.nextFlap = now + 1.8 + Math.random() * 2.4;
        }
        // Lean into the bob: nose dips as it sinks, lifts as it rises.
        var tilt = Math.cos(bobPhase) * -0.07 * (mover.ltr ? 1 : -1);
        drawGullSprite(x, y, mover.ltr, frame, tilt, nightAlpha);
      } else {
        // Images not here (yet): the old two-stroke pen gull flies instead.
        var beat = Math.sin(now * 9 + mover.t0);
        var effort = 0.5 + 0.5 * Math.sin(p * Math.PI * 6);
        drawGull(x, y, 1, Math.max(0.15, beat * effort), nightAlpha);
      }
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
    lastNightAlpha = nightAlpha; // the 3D bird's lighting reads this
    drawNight(now, nightAlpha);

    if (!mover && now >= nextMoverAt) spawnMover(now, blend.to);
    drawMover(now, nightAlpha);

    fctx.clearRect(0, 0, W, H);
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
    drawNight(0, m.night);
  } else {
    start();
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });
  }
})();
