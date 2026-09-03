(function () {
  "use strict";

  /* Start the photo and foreground together, with final font metrics ready. */
  var revealed = false;
  function revealOpening() {
    if (revealed) return;
    revealed = true;
    requestAnimationFrame(function () {
      document.documentElement.classList.add("motion-ready");
    });
  }
  Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    window.BtownSky && window.BtownSky.ready ? window.BtownSky.ready : Promise.resolve()
  ]).then(revealOpening, revealOpening);
  setTimeout(revealOpening, 2500);

  var menu = document.getElementById("site-menu");
  if (menu) {
    document.addEventListener("click", function (event) {
      if (menu.open && !menu.contains(event.target)) menu.removeAttribute("open");
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menu.open) {
        menu.removeAttribute("open");
        menu.querySelector("summary").focus();
      }
    });
    var menuLinks = menu.querySelectorAll("a");
    for (var i = 0; i < menuLinks.length; i++) {
      menuLinks[i].addEventListener("click", function () { menu.removeAttribute("open"); });
    }
  }

  /* One explicit control changes both the photograph's sky and the whole
     page, so "Night" never leaves a bright page underneath it. */
  var themeSkyToggle = document.getElementById("theme-sky-toggle");
  function applyTheme(theme, persist) {
    var night = theme === "dark";
    document.documentElement.setAttribute("data-theme", night ? "dark" : "light");
    if (window.BtownSky) window.BtownSky.setMood(night ? "night" : "day");
    if (themeSkyToggle) {
      themeSkyToggle.setAttribute("aria-pressed", String(night));
      themeSkyToggle.setAttribute("aria-label", night ? "Switch to day mode" : "Switch to night mode");
    }
    if (persist) {
      try { localStorage.setItem("btown-theme", night ? "dark" : "light"); } catch (e) {}
    }
  }
  window.BtownTheme = { set: function (theme) { applyTheme(theme, true); } };
  var initialTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  applyTheme(initialTheme, false);
  if (themeSkyToggle) {
    themeSkyToggle.addEventListener("click", function () {
      applyTheme(this.getAttribute("aria-pressed") === "true" ? "light" : "dark", true);
    });
  }

  /* The small reading index mirrors the reference's persistent contents rail.
     IntersectionObserver only annotates it; anchors remain useful without JS. */
  var readingLinks = document.querySelectorAll(".reading-nav a");
  if ("IntersectionObserver" in window && readingLinks.length) {
    var targets = [];
    for (var r = 0; r < readingLinks.length; r++) {
      var id = readingLinks[r].getAttribute("href");
      var target = id && id.charAt(0) === "#" ? document.querySelector(id) : null;
      if (target) targets.push(target);
    }
    var observer = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (entry) { return entry.isIntersecting; })
        .sort(function (a, b) { return Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top); });
      if (!visible.length) return;
      var hash = "#" + visible[0].target.id;
      for (var i = 0; i < readingLinks.length; i++) {
        if (readingLinks[i].getAttribute("href") === hash) readingLinks[i].setAttribute("aria-current", "location");
        else readingLinks[i].removeAttribute("aria-current");
      }
    }, { rootMargin: "-25% 0px -55% 0px", threshold: [0, .1] });
    for (var t = 0; t < targets.length; t++) observer.observe(targets[t]);
  }
})();
