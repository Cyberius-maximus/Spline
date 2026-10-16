/* ============================================================================
   The app switch, shared by Spline and Tilde.
   Both apps live on this one domain, and the switch at the top-left of every page
   moves between them. Picking the other app slides the thumb across, raises a tide
   in that app's colours over the page with its icon in the middle, then loads the
   other site underneath. Its first paint is the same colour as the tide, so the
   hand-off is seamless. Hovering prefetches the other site so the load is instant.
   Each site styles its own switch; only the tide's look lives here. Modified clicks,
   reduced motion and no JS all fall back to a plain link.
   ========================================================================== */
(function () {
  "use strict";

  var dark = window.matchMedia("(prefers-color-scheme: dark)");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  // The water each app rises in, from its own theme. Spline is always dark; Tilde follows
  // the system appearance, as both its site and its app do.
  var tides = {
    spline: function () {
      return { water: "#070a08", glow: "#16270f", ink: "#eaf0e6", edge: "#8fd14f" };
    },
    tilde: function () {
      return dark.matches
        ? { water: "#1a1512", glow: "#3a2219", ink: "#f3ebe3", edge: "#e58a6c" }
        : { water: "#f6f0e8", glow: "#efd6c8", ink: "#2a1f1b", edge: "#a8462e" };
    }
  };

  // Two waves per screen width: the crest is twice the screen wide and holds four, so
  // sliding it -50% lands on the same shape and the roll loops seamlessly. The edge line,
  // in the app's accent, keeps the crest visible when both sites are dark.
  var WAVE = "M0 50 Q 90 0 180 50 T 360 50 T 540 50 T 720 50 T 900 50 T 1080 50 T 1260 50 T 1440 50";
  var CREST =
    '<svg viewBox="0 0 1440 80" preserveAspectRatio="none">' +
    '<path class="water" d="' + WAVE + ' V 80 H 0 Z"/>' +
    '<path class="edge" d="' + WAVE + '"/></svg>';

  var STYLE =
    ".switch-tide{position:fixed;inset:0;z-index:2147483000;overflow:hidden}" +
    ".switch-tide-water{position:absolute;inset:0;transform:translateY(calc(100% + 80px));" +
    "background:radial-gradient(130% 75% at 50% 115%,var(--glow),var(--water) 72%);" +
    "transition:transform .72s cubic-bezier(.7,0,.25,1)}" +
    ".switch-tide.is-rising .switch-tide-water{transform:none}" +
    ".switch-tide-crest{position:absolute;left:0;bottom:calc(100% - 1px);width:200%;height:72px;" +
    "animation:switch-roll 1.2s linear infinite}" +
    ".switch-tide-crest svg{display:block;width:100%;height:100%;overflow:visible}" +
    ".switch-tide-crest .water{fill:var(--water)}" +
    ".switch-tide-crest .edge{fill:none;stroke:var(--edge);stroke-width:3;vector-effect:non-scaling-stroke;" +
    "filter:drop-shadow(0 0 6px var(--edge))}" +
    ".switch-tide-crest.back{height:96px;opacity:.35;animation-duration:1.9s;animation-direction:reverse}" +
    ".switch-tide-crest.back .edge{display:none}" +
    "@keyframes switch-roll{to{transform:translateX(-50%)}}" +
    ".switch-tide-brand{position:absolute;left:50%;top:50%;display:grid;justify-items:center;gap:16px;" +
    "opacity:0;transform:translate(-50%,-38%) scale(.6);" +
    "transition:opacity .25s ease .45s,transform .55s cubic-bezier(.34,1.56,.64,1) .45s}" +
    ".switch-tide.is-rising .switch-tide-brand{opacity:1;transform:translate(-50%,-50%)}" +
    ".switch-tide-brand img{width:104px;height:104px;border-radius:24px;" +
    "box-shadow:0 20px 50px rgba(0,0,0,.35)}" +
    ".switch-tide-brand span{color:var(--ink);font-size:30px;line-height:1;letter-spacing:-.01em}";

  function injectStyle() {
    if (document.getElementById("switch-tide-style")) return;
    var style = document.createElement("style");
    style.id = "switch-tide-style";
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  /** Raises the other app's tide over the page; resolves once the screen is covered. */
  function raiseTide(link) {
    injectStyle();
    var look = tides[link.getAttribute("data-app")]();
    var label = link.querySelector("span");
    var font = window.getComputedStyle(label);

    var tide = document.createElement("div");
    tide.className = "switch-tide";
    tide.setAttribute("aria-hidden", "true");
    tide.style.setProperty("--water", look.water);
    tide.style.setProperty("--glow", look.glow);
    tide.style.setProperty("--ink", look.ink);
    tide.style.setProperty("--edge", look.edge);
    tide.innerHTML =
      '<div class="switch-tide-water">' +
      '<div class="switch-tide-crest back">' + CREST + "</div>" +
      '<div class="switch-tide-crest">' + CREST + "</div>" +
      "</div>" +
      '<div class="switch-tide-brand"><img alt=""><span></span></div>';
    tide.querySelector("img").src = link.querySelector("img").src;
    var name = tide.querySelector(".switch-tide-brand span");
    name.textContent = label.textContent;
    name.style.fontFamily = font.fontFamily;
    name.style.fontWeight = font.fontWeight;
    document.body.appendChild(tide);

    return new Promise(function (resolve) {
      // Two frames, so the off-screen start state paints before the rise begins.
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { tide.classList.add("is-rising"); });
      });
      window.setTimeout(resolve, 980);
    });
  }

  document.querySelectorAll(".app-switch").forEach(function (sw) {
    var current = sw.querySelector("[aria-current]");
    if (!current) return;

    var thumb = document.createElement("span");
    thumb.className = "app-switch-thumb";
    thumb.setAttribute("aria-hidden", "true");
    sw.insertBefore(thumb, sw.firstChild);

    function place(link, animate) {
      thumb.style.transition = animate ? "" : "none";
      thumb.style.width = link.offsetWidth + "px";
      thumb.style.transform = "translateX(" + link.offsetLeft + "px)";
    }
    place(current, false);
    sw.classList.add("has-thumb");
    // Labels collapse on narrow screens, so the thumb re-measures when the layout does.
    window.addEventListener("resize", function () {
      if (!sw.classList.contains("is-switching")) place(current, false);
    });

    sw.querySelectorAll("a[data-app]").forEach(function (link) {
      if (link === current) return;

      var prefetched = false;
      function prefetch() {
        if (prefetched) return;
        prefetched = true;
        var hint = document.createElement("link");
        hint.rel = "prefetch";
        hint.href = link.href;
        document.head.appendChild(hint);
      }
      link.addEventListener("pointerenter", prefetch);
      link.addEventListener("focus", prefetch);
      link.addEventListener("touchstart", prefetch, { passive: true });

      link.addEventListener("click", function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey ||
            e.altKey || reduced.matches || sw.classList.contains("is-switching")) return;
        e.preventDefault();
        prefetch();
        sw.classList.add("is-switching");
        link.classList.add("is-target");
        place(link, true);
        raiseTide(link).then(function () { window.location.href = link.href; });
      });
    });

    // Coming back with the browser's Back button restores this page from the back-forward
    // cache exactly as it was left, tide and all, so undo the switch.
    window.addEventListener("pageshow", function (e) {
      if (!e.persisted) return;
      var tide = document.querySelector(".switch-tide");
      if (tide) tide.parentNode.removeChild(tide);
      sw.classList.remove("is-switching");
      sw.querySelectorAll(".is-target").forEach(function (l) { l.classList.remove("is-target"); });
      place(current, false);
    });
  });
})();
