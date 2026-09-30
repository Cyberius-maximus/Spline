/* ============================================================================
   Spline — site behaviour.
   Three small things: reveal-on-scroll, the scroll-linked spline spine, and a
   hairline under the nav once the page has scrolled. All of it no-ops cleanly
   when the visitor prefers reduced motion or the browser lacks the APIs.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Reveal on scroll ---------------- */
  var revealables = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- Nav hairline ---------------- */
  var nav = document.getElementById("nav") || document.querySelector("nav");
  function navState() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 8);
  }

  /* ---------------- The spline spine ----------------
     One continuous curve down the page, generated from control points anchored to
     each [data-anchor] section, so it genuinely passes through the content. Draw
     progress follows scroll. Decorative only: aria-hidden, pointer-events none. */
  var svg = document.getElementById("spine");
  var path = svg && svg.querySelector("path:not(.spine-glow)");
  var glow = svg && svg.querySelector(".spine-glow");
  var page = document.querySelector(".page");

  /** Catmull-Rom through the points, emitted as cubic Béziers. */
  function splinePath(pts) {
    if (pts.length < 2) return "";
    var p = [pts[0]].concat(pts, [pts[pts.length - 1]]);
    var d = "M " + pts[0].x + " " + pts[0].y;
    for (var i = 1; i < p.length - 2; i++) {
      var p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
      d +=
        " C " + (p1.x + (p2.x - p0.x) / 6) + " " + (p1.y + (p2.y - p0.y) / 6) +
        ", " + (p2.x - (p3.x - p1.x) / 6) + " " + (p2.y - (p3.y - p1.y) / 6) +
        ", " + p2.x + " " + p2.y;
    }
    return d;
  }

  var W = 1000; // viewBox width; height follows the content

  function build() {
    if (!svg || !path) return;
    // Measure the CONTENT wrapper, never document.scrollHeight: the spine is absolutely
    // positioned, so its own height feeds back into the scrollable overflow and every
    // rebuild would grow the page (observed 5990 → 11578 px before this rule).
    var docH = page ? page.offsetHeight : window.innerHeight;
    svg.setAttribute("viewBox", "0 0 " + W + " " + docH);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.height = docH + "px";

    var sections = document.querySelectorAll("[data-anchor]");
    var anchors = [{ x: W * 0.1, y: 0 }];
    sections.forEach(function (el, i) {
      var r = el.getBoundingClientRect();
      var y = r.top + window.scrollY + r.height / 2;
      anchors.push({ x: i % 2 === 0 ? W * 0.84 : W * 0.16, y: y });
    });
    anchors.push({ x: W * 0.6, y: docH });

    var d = splinePath(anchors);
    path.setAttribute("d", d);
    if (glow) glow.setAttribute("d", d);

    var len = path.getTotalLength();
    [path, glow].forEach(function (p) {
      if (!p) return;
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = reduced ? 0 : len;
    });
    path.__len = len;
    draw();
  }

  function draw() {
    if (reduced || !path) return;
    var len = path.__len || 0;
    var max = (page ? page.offsetHeight : 0) - window.innerHeight;
    var progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    // Lead the scroll slightly so the line is always a step ahead of the reader.
    var drawn = Math.min(1, progress * 1.1 + 0.05);
    [path, glow].forEach(function (p) {
      if (p) p.style.strokeDashoffset = String(len * (1 - drawn));
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      draw();
      navState();
      ticking = false;
    });
  }

  var resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 140);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("load", build);
  navState();
  build();

  // Lazy images change the page height as they arrive; re-anchor once they settle.
  document.querySelectorAll("img[loading='lazy']").forEach(function (img) {
    if (!img.complete) img.addEventListener("load", onResize, { once: true });
  });
})();
