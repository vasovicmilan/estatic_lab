// /uputstva - device + language choice and lazy video loading (no video bytes are requested
// until someone presses play; every URL goes through the role-checked /uputstva/* routes).
(function () {
  var state = { device: "desktop", lang: "sr" };
  try {
    var saved = JSON.parse(localStorage.getItem("tutorialsPrefs") || "{}");
    if (saved.device === "mobile" || saved.device === "desktop") state.device = saved.device;
    else if (window.matchMedia && window.matchMedia("(max-width: 767px)").matches) state.device = "mobile";
    if (saved.lang === "en" || saved.lang === "sr") state.lang = saved.lang;
  } catch (e) {}

  function cards() { return Array.prototype.slice.call(document.querySelectorAll(".tutorial-card")); }

  function save() { try { localStorage.setItem("tutorialsPrefs", JSON.stringify(state)); } catch (e) {} }

  var posterObserver = null;
  function loadPoster(btn) {
    var url = btn.getAttribute("data-poster-url");
    if (url) { btn.style.backgroundImage = "url(" + url + ")"; btn.removeAttribute("data-poster-url"); }
  }
  function watchPoster(btn) {
    if (!("IntersectionObserver" in window)) { loadPoster(btn); return; }
    if (!posterObserver) {
      posterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { posterObserver.unobserve(en.target); loadPoster(en.target); }
        });
      }, { rootMargin: "200px 0px" });
    }
    posterObserver.observe(btn);
  }

  function render() {
    document.querySelectorAll("[data-device-choice]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-device-choice") === state.device); });
    document.querySelectorAll("[data-lang-choice]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-lang-choice") === state.lang); });
    cards().forEach(function (card) {
      var id = card.getAttribute("data-tutorial-id");
      var available = card.getAttribute("data-variants").split(",").filter(Boolean);
      // not every tutorial exists in both versions: if the chosen one is missing, show the other
      // (a phone video still teaches the same clicks) and say so, instead of an empty card
      var device = available.indexOf(state.device) !== -1 ? state.device : (available[0] || state.device);
      var fallback = device !== state.device;
      var hasDevice = available.indexOf(device) !== -1;
      var langs = (card.getAttribute("data-langs-" + device) || "").split(",").filter(Boolean);
      var lang = langs.indexOf(state.lang) !== -1 ? state.lang : (langs[0] || null);
      var box = card.querySelector(".tutorial-player-box");
      var title = card.querySelector("[data-title-sr]");
      var intro = card.querySelector("[data-intro-sr]");
      title.textContent = title.getAttribute("data-title-" + state.lang) || title.getAttribute("data-title-sr");
      intro.textContent = intro.getAttribute("data-intro-" + state.lang) || intro.getAttribute("data-intro-sr");
      // changing device/language drops a running player; the next press loads the right file
      box.innerHTML = "";
      box.classList.toggle("ratio-16x9", device === "desktop");
      box.classList.toggle("tutorial-phone", device === "mobile");
      var note = card.querySelector(".tutorial-note");
      if (!note) {
        note = document.createElement("p");
        note.className = "tutorial-note small text-muted px-3 pt-2 mb-0";
        card.insertBefore(note, card.querySelector(".card-body"));
      }
      var notes = [];
      if (fallback) notes.push(device === "desktop" ? "Postoji samo verzija za računar." : "Postoji samo verzija za telefon.");
      if (lang && lang !== state.lang) notes.push("Titlovi su samo na jeziku: " + (lang === "sr" ? "srpski" : "English") + ".");
      note.textContent = notes.join(" ");
      note.hidden = notes.length === 0;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-dark border-0 rounded-0 tutorial-play";
      if (!hasDevice || !lang) {
        btn.disabled = true;
        btn.textContent = "Video još nije dostupan";
      } else {
        btn.setAttribute("aria-label", "Pusti video");
        btn.innerHTML = '<i class="bi bi-play-circle fs-1" aria-hidden="true"></i>';
        if (card.getAttribute("data-poster-" + device)) {
          btn.style.backgroundSize = "contain";
          btn.style.backgroundRepeat = "no-repeat";
          btn.style.backgroundPosition = "center";
          // the poster is fetched only when its card scrolls near the screen (24 cards must not
          // fire 24 image requests at once - that trips the Cloudflare rate-limit rule)
          btn.setAttribute("data-poster-url", "/uputstva/poster/" + encodeURIComponent(id) + "/" + device);
          watchPoster(btn);
        }
        btn.addEventListener("click", function () {
          var v = document.createElement("video");
          v.controls = true;
          v.autoplay = true;
          v.playsInline = true;
          v.preload = "metadata";
          v.className = "w-100 h-100";
          v.src = "/uputstva/video/" + encodeURIComponent(id) + "/" + device + "/" + lang;
          box.innerHTML = "";
          box.appendChild(v);
        });
      }
      box.appendChild(btn);
    });
  }

  document.addEventListener("click", function (e) {
    var d = e.target.closest("[data-device-choice]");
    var l = e.target.closest("[data-lang-choice]");
    if (d) { state.device = d.getAttribute("data-device-choice"); save(); render(); }
    if (l) { state.lang = l.getAttribute("data-lang-choice"); save(); render(); }
  });

  render();
})();
