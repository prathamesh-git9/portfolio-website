/*
 * Two behaviours, both progressive enhancements. Without JavaScript the page is
 * fully readable, every link works, and the colour scheme follows the operating
 * system via prefers-color-scheme.
 *
 *   1. Theme override — lets a visitor choose light or dark against their OS
 *      preference, and remembers it. The control is hidden until this file runs,
 *      so no-JS visitors are never shown a dead button.
 *   2. Contents highlighting — marks the section currently being read.
 */
(function () {
  "use strict";

  var root = document.documentElement;

  /* ---------------------------------------------------------------- theme */

  var toggle = document.getElementById("theme-toggle");

  function storedTheme() {
    try {
      var v = localStorage.getItem("theme");
      return v === "light" || v === "dark" ? v : null;
    } catch (e) {
      return null;
    }
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function activeTheme() {
    return root.getAttribute("data-theme") || systemTheme();
  }

  function describe(theme) {
    var next = theme === "dark" ? "light" : "dark";
    toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    toggle.setAttribute("aria-label", "Switch to " + next + " theme");
    toggle.title = "Switch to " + next + " theme";
    var label = toggle.querySelector(".theme-toggle__label");
    if (label) label.textContent = theme === "dark" ? "Dark" : "Light";
  }

  if (toggle) {
    toggle.hidden = false;
    describe(activeTheme());

    toggle.addEventListener("click", function () {
      var next = activeTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {
        /* Private mode; the choice simply does not persist. */
      }
      describe(next);
    });

    // Follow the OS while the visitor has not expressed a preference.
    if (window.matchMedia) {
      var query = window.matchMedia("(prefers-color-scheme: dark)");
      var onSystemChange = function () {
        if (!storedTheme()) describe(systemTheme());
      };
      if (query.addEventListener) query.addEventListener("change", onSystemChange);
      else if (query.addListener) query.addListener(onSystemChange);
    }
  }

  /* ------------------------------------------------------------- contents */

  var links = Array.prototype.slice.call(
    document.querySelectorAll('.toc a[href^="#"]')
  );
  if (!links.length || !("IntersectionObserver" in window)) return;

  var byId = {};
  var targets = [];

  links.forEach(function (link) {
    var id = decodeURIComponent(link.getAttribute("href").slice(1));
    var section = document.getElementById(id);
    if (!section) return;
    byId[id] = link;
    targets.push(section);
  });
  if (!targets.length) return;

  var visible = Object.create(null);
  var current = null;

  function refresh() {
    var best = null;
    for (var i = 0; i < targets.length; i++) {
      if (visible[targets[i].id]) {
        best = targets[i].id;
        break;
      }
    }
    if (!best || best === current) return;

    if (current && byId[current]) byId[current].classList.remove("is-active");
    current = best;

    var link = byId[current];
    link.classList.add("is-active");

    // On narrow screens the contents list scrolls sideways; keep the active
    // item in view without moving the page itself.
    var list = link.parentNode && link.parentNode.parentNode;
    if (list && list.scrollWidth > list.clientWidth + 4) {
      var offset = link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
      if (typeof list.scrollTo === "function") {
        list.scrollTo({ left: Math.max(offset, 0), behavior: "smooth" });
      } else {
        list.scrollLeft = Math.max(offset, 0);
      }
    }
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        visible[entry.target.id] = entry.isIntersecting;
      });
      refresh();
    },
    { rootMargin: "-25% 0px -60% 0px", threshold: 0 }
  );

  targets.forEach(function (section) {
    observer.observe(section);
  });
})();
