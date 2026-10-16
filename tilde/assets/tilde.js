/* ============================================================================
   Tilde — site behaviour.
   Reveal on scroll (which also draws the strike through each myth), and the cycle
   explorer: drag through a 28-day cycle and the tide, the phase, the next-period range
   and a tip from the app follow along. The page is complete without any of it: the
   explorer's markup is day 19, and reduced motion skips the opening sweep.
   ========================================================================== */
(function () {
  "use strict";

  document.documentElement.classList.add("js");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Reveal on scroll ---------------- */
  var revealables = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- The cycle explorer ----------------
     Same geometry as the app's TideView: low at the period, high mid-cycle, ink up to
     today and dashed after it. Phase copy and tips are the app's own. */
  var ex = document.querySelector("[data-explorer]");
  if (!ex) return;

  var W = 640, AMP = 50, MID = 78, LEN = 28;
  var PHASES = [
    { key: "men", last: 5, color: "--menstrual", name: "Period",
      summary: "Oestrogen and progesterone are at their lowest. The uterine lining sheds.",
      tip: "Take an NSAID early for cramps", tipNote: "About half of women get good relief.", grade: 3 },
    { key: "fol", last: 10, color: "--follicular", name: "Follicular phase",
      summary: "Oestrogen climbs as a follicle matures. Temperature sits on its lower plateau.",
      tip: "Train to your plan", tipNote: "Muscle builds just as well in every phase.", grade: 2 },
    { key: "fer", last: 16, color: "--fertile", name: "Fertile window",
      summary: "Oestrogen peaks, LH surges and an egg is released. These are your likeliest fertile days.",
      tip: "Your fertile window is a range, not a date", tipNote: "It can fall anywhere from day 6 to 21.", grade: 3 },
    { key: "lut", last: 23, color: "--luteal", name: "Luteal phase",
      summary: "Progesterone rises. Resting temperature and heart rate run a little higher. That is expected, not strain.",
      tip: "Hungrier? That’s expected", tipNote: "About 168 kcal a day more after ovulation.", grade: 2 },
    { key: "pre", last: 28, color: "--premenstrual", name: "Pre-period",
      summary: "Both hormones fall before your period. HRV is typically at its lowest and PMS symptoms cluster here.",
      tip: "Calcium, daily, for PMS", tipNote: "1200 mg a day cut symptoms by 48% vs 30% on placebo.", grade: 2 }
  ];
  var GRADES = { 3: ["g-strong", "Strong"], 2: ["g-moderate", "Moderate"], 1: ["g-limited", "Limited"] };

  var input = ex.querySelector("input[type=range]");
  var ink = ex.querySelector(".ink");
  var ahead = ex.querySelector(".ahead");
  var line = ex.querySelector(".now-line");
  var dot = ex.querySelector(".now");
  var water = ex.querySelectorAll(".w");
  var labels = ex.querySelectorAll(".tide-labels span");
  var out = {
    day: ex.querySelector("[data-out=day]"),
    phase: ex.querySelector("[data-out=phase]"),
    summary: ex.querySelector("[data-out=summary]"),
    next: ex.querySelector("[data-out=next]"),
    tip: ex.querySelector("[data-out=tip]"),
    tipNote: ex.querySelector("[data-out=tip-note]"),
    grade: ex.querySelector("[data-out=grade]")
  };

  function y(x) { return MID + AMP * Math.cos(2 * Math.PI * x / W); }
  function points(a, b) {
    var n = Math.max(2, Math.round((b - a) * 60)), s = [];
    for (var i = 0; i <= n; i++) {
      var x = W * (a + (b - a) * i / n);
      s.push(x.toFixed(1) + "," + y(x).toFixed(1));
    }
    return s.join(" ");
  }
  function phaseOf(day) {
    for (var i = 0; i < PHASES.length; i++) if (day <= PHASES[i].last) return i;
    return PHASES.length - 1;
  }

  function render(day) {
    var t = (day - 0.5) / LEN, x = W * t, i = phaseOf(day), p = PHASES[i];
    ink.setAttribute("points", points(0, t));
    ahead.setAttribute("points", points(t, 1));
    line.setAttribute("x1", x.toFixed(1)); line.setAttribute("x2", x.toFixed(1));
    line.setAttribute("y1", y(x).toFixed(1));
    dot.setAttribute("cx", x.toFixed(1)); dot.setAttribute("cy", y(x).toFixed(1));
    water.forEach(function (w, k) { w.classList.toggle("later", k > i); });
    labels.forEach(function (l, k) { l.classList.toggle("is-now", k === i); });
    ex.style.setProperty("--phase", "var(" + p.color + ")");

    // A 29-day average with a ±2-day spread, as the app shows for these demo cycles.
    var lo = Math.max(1, 27 - day), hi = 31 - day;
    out.day.textContent = day;
    out.phase.textContent = p.name;
    out.summary.textContent = p.summary;
    out.next.textContent = "in " + lo + "–" + hi + " days";
    out.tip.textContent = p.tip;
    out.tipNote.textContent = p.tipNote;
    var g = GRADES[p.grade];
    out.grade.className = "grade " + g[0];
    out.grade.innerHTML = '<span class="meter">' +
      [1, 2, 3].map(function (n) { return n <= p.grade ? '<i class="on"></i>' : "<i></i>"; }).join("") +
      "</span> " + g[1];
    input.setAttribute("aria-valuetext", "Day " + day + ", " + p.name);
  }

  input.addEventListener("input", function () { sweeping = false; render(+input.value); });
  render(+input.value);

  // The first time the explorer comes into view, the marker rides the wave from day 1
  // to day 19, so it's obvious the whole thing moves. Any touch of the slider stops it.
  var sweeping = false;
  if (!reduced && "IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      seen.disconnect();
      var target = +input.value, start = null;
      sweeping = true;
      function step(ts) {
        if (!sweeping) return;
        if (start === null) start = ts;
        var k = Math.min(1, (ts - start) / 2200);
        var eased = 1 - Math.pow(1 - k, 3);
        var day = Math.max(1, Math.round(1 + (target - 1) * eased));
        input.value = day;
        render(day);
        if (k < 1) window.requestAnimationFrame(step);
        else sweeping = false;
      }
      window.requestAnimationFrame(step);
    }, { threshold: 0.5 });
    seen.observe(ex);
  }
})();
