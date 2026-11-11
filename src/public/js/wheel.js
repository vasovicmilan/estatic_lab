// Prize wheel (/tocak). The SERVER decides the prize, the number of turns and the stop position
// (POST /tocak/vrti); this file only draws the wheel and plays that result.
(function () {
  "use strict";

  var dataEl = document.getElementById("wheelData");
  var rotor = document.getElementById("wheelRotor");
  var form = document.getElementById("wheelForm");
  if (!dataEl || !rotor || !form) return;

  var cfg = JSON.parse(dataEl.getAttribute("data-config"));
  var prizes = cfg.prizes || [];
  var SVG_NS = "http://www.w3.org/2000/svg";
  var SIZE = 400, C = SIZE / 2, R = C - 6;

  function el(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  // angle in degrees, 0 = 12 o'clock, clockwise
  function pt(angleDeg, radius) {
    var a = (angleDeg * Math.PI) / 180;
    return [C + radius * Math.sin(a), C - radius * Math.cos(a)];
  }
  function readableOn(hex) {
    var h = hex.replace("#", "");
    var n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
    var lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.62 ? "#2d2a26" : "#ffffff";
  }

  var seg = prizes.length ? 360 / prizes.length : 360;

  function draw() {
    var svg = el("svg", { viewBox: "0 0 " + SIZE + " " + SIZE, role: "img", "aria-label": "Točak sreće" });
    svg.appendChild(el("circle", { cx: C, cy: C, r: R + 4, fill: "#2d2a26" }));
    prizes.forEach(function (p, i) {
      var a0 = i * seg, a1 = (i + 1) * seg, s = pt(a0, R), e = pt(a1, R);
      var large = seg > 180 ? 1 : 0;
      svg.appendChild(el("path", {
        d: "M" + C + " " + C + " L" + s[0] + " " + s[1] + " A" + R + " " + R + " 0 " + large + " 1 " + e[0] + " " + e[1] + " Z",
        fill: p.color, stroke: "#fff", "stroke-width": 2
      }));
      var mid = a0 + seg / 2;
      var g = el("g", { transform: "rotate(" + (mid - 90) + " " + C + " " + C + ")" });
      var avail = R * 0.93 - R * 0.3;
      var size = Math.max(10, Math.min(16, avail / (p.shortLabel.length * 0.6)));
      var t = el("text", {
        x: C + R * 0.93, y: C, "text-anchor": "end", "dominant-baseline": "middle",
        "font-size": size, "font-weight": 700, fill: readableOn(p.color), "font-family": "Inter, Arial, sans-serif"
      });
      t.textContent = p.shortLabel;
      g.appendChild(t);
      svg.appendChild(g);
    });
    rotor.appendChild(svg);
  }
  draw();

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var spinning = false;

  function indexOfPrize(key) {
    for (var i = 0; i < prizes.length; i++) if (prizes[i].key === key) return i;
    return -1;
  }

  function playSpin(result, done) {
    var idx = indexOfPrize(result.prize.key);
    if (idx < 0) idx = 0; // the prize ran out between page load and spin - the text below still shows the real one
    var turns = reduce ? 1 : result.turns;
    var duration = reduce ? 1200 : result.durationMs;
    var target = turns * 360 + (360 - (idx * seg + result.offset * seg));
    rotor.style.transition = "transform " + duration + "ms cubic-bezier(.17,.67,.12,1)";
    void rotor.offsetWidth; // flush so the transition starts from the current angle
    rotor.style.transform = "rotate(" + target + "deg)";
    var finished = false;
    function finish() { if (finished) return; finished = true; done(); }
    rotor.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, duration + 400); // safety net if the event never fires
  }

  var btn = document.getElementById("wheelSubmit");
  var generalErr = document.getElementById("wheelError");

  function showErrors(errors, message) {
    form.querySelectorAll("[data-error-for]").forEach(function (n) { n.textContent = ""; });
    var shown = false;
    Object.keys(errors || {}).forEach(function (field) {
      var n = form.querySelector('[data-error-for="' + field + '"]');
      var msg = [].concat(errors[field])[0];
      if (n) { n.textContent = msg; shown = true; }
    });
    generalErr.textContent = shown ? "" : (message || "");
    generalErr.classList.toggle("d-none", shown || !message);
  }

  function showResult(result) {
    document.getElementById("wheelFormWrap").classList.add("d-none");
    document.getElementById("resultPrize").textContent = result.prize.label;
    document.getElementById("resultCode").textContent = result.couponCode;
    document.getElementById("resultUntil").textContent = new Date(result.validUntil).toLocaleDateString("sr-Latn-RS").replace(/\.$/, "");
    var box = document.getElementById("wheelResult");
    box.classList.remove("d-none");
    box.scrollIntoView({ behavior: "smooth", block: "center" });
    try { if (navigator.vibrate) navigator.vibrate([80, 60, 120]); } catch (e) {}
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (spinning) return;
    showErrors({}, "");
    var consentBox = document.getElementById("w-consentContact");
    // in-app browsers sometimes skip the native "required" check, so the consent is verified here too
    if (!consentBox || !consentBox.checked) {
      showErrors({ consentContact: "Morate prihvatiti da vas kontaktiramo u vezi nagrade" }, "");
      return;
    }
    var fd = new FormData(form);
    var body = {
      firstName: fd.get("firstName"), lastName: fd.get("lastName"), email: fd.get("email"), phone: fd.get("phone"),
      segment: fd.get("segment"), source: cfg.source || "", nickname: fd.get("nickname") || "",
      consentContact: consentBox.checked, consentMarketing: !!(document.getElementById("w-consentMarketing") || {}).checked
    };
    spinning = true;
    btn.disabled = true;
    btn.querySelector(".label").textContent = "Točak se vrti...";
    var token = (document.querySelector('meta[name="csrf-token"]') || {}).content || "";

    fetch("/tocak/vrti", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": token },
      body: JSON.stringify(body),
      credentials: "same-origin"
    })
      .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, json: j }; }); })
      .then(function (r) {
        if (!r.ok || !r.json.success) {
          showErrors(r.json.errors, r.json.message || "Došlo je do greške. Pokušajte ponovo.");
          spinning = false; btn.disabled = false; btn.querySelector(".label").textContent = "Zavrti točak";
          return;
        }
        playSpin(r.json, function () { showResult(r.json); });
      })
      .catch(function () {
        showErrors({}, "Nema veze sa serverom. Proverite internet i pokušajte ponovo.");
        spinning = false; btn.disabled = false; btn.querySelector(".label").textContent = "Zavrti točak";
      });
  });

  var copy = document.getElementById("copyCode");
  if (copy) copy.addEventListener("click", function () {
    var code = document.getElementById("resultCode").textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(function () { copy.textContent = "Kopirano"; });
  });
})();
