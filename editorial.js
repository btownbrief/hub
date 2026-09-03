(function () {
  "use strict";

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

  var swatches = document.querySelectorAll("[data-sky]");
  function chooseSky(button) {
    var mood = button.getAttribute("data-sky");
    if (!window.BtownSky || !window.BtownSky.setMood(mood)) return;
    for (var i = 0; i < swatches.length; i++) {
      swatches[i].setAttribute("aria-pressed", String(swatches[i] === button));
    }
  }
  for (var s = 0; s < swatches.length; s++) {
    swatches[s].addEventListener("click", function () { chooseSky(this); });
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
