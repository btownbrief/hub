/* The 3D bird. This is how the Fable 5.1 page does its bird — a rigged model
   with a real wing animation, rendered in WebGL — so the motion comes from an
   animator's clip, not from math pretending to be one. The model is the
   white stork that ships with three.js (by mirada, from ro.me; MIT), which
   over a lake at sixty pixels reads perfectly well as a gull.

   Everything loads lazily two seconds after the page settles: three.js, the
   loader, then the model — about 260KB gzipped, only ever fetched for the
   cover. Until it's ready (or on any failure), hero-live.js keeps flying its
   photographic sprite gull, and below that its pen-stroke one. Garnish all
   the way down. */
(function () {
  "use strict";

  var cover = document.querySelector(".cover");
  if (!cover) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try { if (!window.WebGLRenderingContext) return; } catch (e) { return; }

  var API = window.BtownBird = { ready: false, fly: fly };

  var renderer, scene, camera, mixer, action, bird;
  var canvas3d, W = 0, H = 0;
  var ambLight, dirLight;
  var flight = null;    // { t0, dur, ltr, y, amp, night }
  var rafId = 0, lastT = 0, running = false;

  /* ------------------------------------------------------------- loading */
  function loadScript(src, ok, fail) {
    var s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = fail || function () {};
    document.head.appendChild(s);
  }

  function boot() {
    loadScript("assets/vendor/three-0.128.min.js", function () {
      loadScript("assets/vendor/GLTFLoader-0.128.js", init);
    });
  }

  // Wait for the page to be genuinely settled before spending bandwidth.
  if (document.readyState === "complete") setTimeout(boot, 2000);
  else addEventListener("load", function () { setTimeout(boot, 2000); });

  /* ---------------------------------------------------------------- init */
  function init() {
    try {
      canvas3d = document.createElement("canvas");
      canvas3d.setAttribute("aria-hidden", "true");
      canvas3d.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
      // In front of the sky canvas, behind the cover's own scrim and copy.
      var sky = document.getElementById("sky-live");
      (sky && sky.nextSibling) ? cover.insertBefore(canvas3d, sky.nextSibling) : cover.appendChild(canvas3d);

      renderer = new THREE.WebGLRenderer({ canvas: canvas3d, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;

      scene = new THREE.Scene();
      // Pixel-space orthographic camera. Y stays up in world space (flipping
      // the camera would mirror the bird); screen y is converted at draw time.
      camera = new THREE.OrthographicCamera(0, 1, 1, 0, -500, 500);
      ambLight = new THREE.AmbientLight(0xffffff, 0.85);
      dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(-0.4, 1, 0.7);
      scene.add(ambLight, dirLight);

      resize();
      addEventListener("resize", resize);

      new THREE.GLTFLoader().load("assets/models/stork.glb", function (g) {
        bird = g.scene;
        // Remember the model's own size so scale can be set in pixels later.
        var box = new THREE.Box3().setFromObject(bird);
        var size = box.getSize(new THREE.Vector3());
        bird.userData.norm = 1 / (Math.max(size.x, size.y, size.z) || 1);
        mixer = new THREE.AnimationMixer(bird);
        action = mixer.clipAction(g.animations[0]);
        action.play();
        bird.visible = false;
        scene.add(bird);
        API.ready = true;
      }, undefined, function () { /* stay unready; the sprite gull flies */ });
    } catch (e) { /* stay unready */ }
  }

  function resize() {
    if (!renderer) return;
    W = cover.clientWidth; H = cover.clientHeight;
    renderer.setSize(W, H, false);
    camera.left = 0; camera.right = W; camera.top = H; camera.bottom = 0;
    camera.updateProjectionMatrix();
  }

  /* -------------------------------------------------------------- flight */
  // hero-live.js calls this instead of drawing its sprite. `night` is a
  // getter for the current sky darkness so the lighting follows the hour.
  function fly(opts) {
    if (!API.ready || flight) return false;
    flight = {
      t0: performance.now() / 1000,
      dur: opts.dur || 16,
      ltr: !!opts.ltr,
      y: (opts.y || 0.2) * H,
      amp: 8 + Math.random() * 8,
      night: opts.night || function () { return 0; },
      wob: Math.random() * Math.PI * 2
    };
    bird.visible = true;
    lastT = flight.t0;
    start();
    return true;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function frame() {
    var now = performance.now() / 1000;
    var dt = Math.min(0.1, now - lastT);
    lastT = now;

    if (!flight) { stop(); return; }
    var p = (now - flight.t0) / flight.dur;
    if (p >= 1) {
      flight = null;
      bird.visible = false;
      renderer.clear();
      stop();
      return;
    }

    // The path: edge to edge with a lazy sine bob and a touch of wander.
    var span = 78;
    var x = flight.ltr ? lerp(-span, W + span, p) : lerp(W + span, -span, p);
    var bob = Math.sin(p * Math.PI * 2 * 2.0 + flight.wob);
    var y = flight.y + bob * flight.amp + Math.sin(p * Math.PI * 2 * 0.5) * flight.amp * 0.6;

    // Wingbeats come and go: cruising flaps, then near-glides. The clip's
    // own animation does the organic part; we only vary its speed.
    var easeFlap = 0.55 + 0.45 * Math.sin(p * Math.PI * 2 * 0.9 + flight.wob * 2);
    mixer.timeScale = 0.35 + 0.75 * easeFlap;
    mixer.update(dt);

    bird.position.set(x, H - y, 0); // screen y → world y (y is up in world)
    // Heading down the path, pitched a little toward the viewer so the
    // profile reads (straight-on it looks like a dash), banking into the bob.
    bird.rotation.set(0.55, flight.ltr ? Math.PI / 2 : -Math.PI / 2, bob * 0.12 * (flight.ltr ? -1 : 1), "YXZ");
    bird.scale.setScalar(bird.userData.norm * Math.max(52, Math.min(74, W * 0.052)));

    // Light follows the sky: white by day, dim blue-grey after dark.
    var k = Math.max(0, Math.min(1, flight.night() || 0));
    ambLight.intensity = lerp(0.85, 0.3, k);
    dirLight.intensity = lerp(1.0, 0.35, k);
    dirLight.color.setRGB(lerp(1, 0.62, k), lerp(1, 0.68, k), lerp(1, 0.85, k));
    ambLight.color.copy(dirLight.color);

    renderer.render(scene, camera);
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

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (flight) { lastT = performance.now() / 1000; start(); }
  });
})();
