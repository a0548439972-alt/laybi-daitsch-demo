(function () {
  const S = window.SITE;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const thumb = (id, hi) => `https://i.ytimg.com/vi/${id}/${hi ? "maxresdefault" : "hqdefault"}.jpg`;
  const embed = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  const PLAY = '<span class="play-orb" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg></span>';

  // maxres לא תמיד קיים: יוטיוב מחזיר תמונה אפורה של 120 פיקסלים. במקרה כזה יורדים ל-hq
  function smartThumb(img, id) {
    img.src = thumb(id, true);
    img.addEventListener("load", function f() {
      if (img.naturalWidth <= 120) { img.removeEventListener("load", f); img.src = thumb(id, false); }
    });
    img.addEventListener("error", () => { img.src = thumb(id, false); }, { once: true });
  }

  /* ---------- Hero video: השם נכתב כשהיד מגיעה לסנטר ---------- */
  const heroEl = $(".hero");
  const vid = $("#hero-video");
  let named = false;
  const nameIt = () => { if (!named) { named = true; heroEl.classList.add("is-named"); } };
  const replay = $("#hero-replay");
  const canReplay = (on) => heroEl.classList.toggle("can-replay", on);
  if (vid) {
    vid.addEventListener("timeupdate", () => { if (vid.currentTime > 1.9) nameIt(); });
    vid.addEventListener("ended", () => { nameIt(); canReplay(true); });
    vid.addEventListener("playing", () => canReplay(false));
    vid.addEventListener("error", () => { nameIt(); }, true);
    replay.addEventListener("click", () => { vid.currentTime = 0; vid.play().catch(() => {}); });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      vid.removeAttribute("autoplay"); vid.pause(); nameIt(); canReplay(true);
    } else {
      // ניגון אוטומטי חסום (למשל מצב חיסכון בסוללה באייפד): משאירים את הפריים הראשון וכפתור נגינה
      const p = vid.play();
      if (p && p.catch) p.catch(() => { nameIt(); canReplay(true); });
    }
  }
  setTimeout(nameIt, 3200); // גיבוי אם הסרטון לא נטען

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  const fab = $("#fab");
  const hero = $(".hero");
  const booking = $("#booking");
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle("is-solid", y > 40);
    const pastHero = y > hero.offsetHeight * 0.7;
    const r = booking.getBoundingClientRect();
    const inBooking = r.top < window.innerHeight && r.bottom > 0;
    fab.classList.toggle("is-on", pastHero && !inBooking);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Series ---------- */
  const series = $("#series");
  const list = $("#tracks");
  const player = $("#player");
  let current = 1;
  let playing = false;

  function isLight(hex) {
    const c = hex.replace("#", "").match(/../g).map((h) => {
      const v = parseInt(h, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    // בוחרים את הטקסט עם הניגודיות הגבוהה יותר: לבן חם או שזיף כהה
    return (L + 0.05) / 0.0625 > 1.0 / (L + 0.05);
  }

  list.innerHTML = S.tracks.map((t, i) => `
    <li class="track" data-i="${i}">
      <button type="button" aria-label="נגינת ${esc(t.title)}">
        <span class="track__n">${String(t.n).padStart(2, "0")}</span>
        <span class="track__t">${esc(t.title)}</span>
        <span class="track__d">${t.dur}</span>
        <span class="track__dot" style="background:${t.color}"></span>
        <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
    </li>`).join("");

  function select(i, play) {
    current = i;
    const t = S.tracks[i];
    series.style.setProperty("--tc", t.color);
    series.classList.toggle("is-light", isLight(t.color));
    $("#series-num").textContent = String(t.n).padStart(2, "0");
    $("#now-count").textContent = `שיר ${t.n} מתוך ${S.tracks.length}`;
    $("#now-title").textContent = t.title;
    $("#now-by").textContent = t.by;
    $("#now-blurb").textContent = t.blurb;
    list.querySelectorAll(".track").forEach((li, k) => {
      li.classList.toggle("is-active", k === i);
      li.classList.toggle("is-playing", k === i && play);
      li.querySelector("button").setAttribute("aria-current", k === i ? "true" : "false");
    });
    if (play) {
      playing = true;
      player.innerHTML = `<iframe src="${embed(t.yt)}" title="${esc(t.title)} - לייבי דייטש" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    } else {
      playing = false;
      player.innerHTML = `<button class="player__facade" type="button" aria-label="נגינת ${esc(t.title)}"><img alt="" decoding="async">${PLAY}</button>`;
      smartThumb(player.querySelector("img"), t.yt);
      player.querySelector("button").addEventListener("click", () => select(current, true));
    }
  }
  list.addEventListener("click", (e) => {
    const li = e.target.closest(".track");
    if (li) select(+li.dataset.i, true);
  });
  select(1, false);

  /* ---------- Clips ---------- */
  const grid = $("#clip-grid");
  const filters = $("#filters");
  const TAG = { clip: "קליפ", wedding: "מהחתונות", live: "הופעה" };
  let filter = "all";

  filters.innerHTML = S.filters.map((f) => {
    const n = f.id === "all" ? S.videos.length : S.videos.filter((v) => v.type === f.id).length;
    return `<button type="button" role="tab" data-f="${f.id}" aria-selected="${f.id === "all"}">${esc(f.label)}<span class="count">${n}</span></button>`;
  }).join("");

  function renderClips() {
    const items = S.videos.filter((v) => filter === "all" || v.type === filter);
    grid.innerHTML = items.map((v, k) => {
      const feat = k === 0 && (filter === "all" ? v.featured : true);
      return `
      <button class="clip${feat ? " is-featured" : ""}" type="button" data-yt="${v.yt}" data-title="${esc(v.title)}" style="animation-delay:${k * 60}ms">
        <span class="clip__media">
          <img alt="" loading="lazy" decoding="async" data-id="${v.yt}" data-hi="${feat ? 1 : 0}">
          <span class="clip__tag${v.type === "wedding" ? " clip__tag--wedding" : ""}">${TAG[v.type]}</span>
          ${PLAY}
        </span>
        <span class="clip__body">
          <span class="clip__t" style="display:block">${esc(v.title)}</span>
          <span class="clip__m" style="display:block">${esc(v.with)} · ${esc(v.date)}</span>
        </span>
      </button>`;
    }).join("");
    grid.querySelectorAll("img[data-id]").forEach((img) => {
      if (img.dataset.hi === "1") smartThumb(img, img.dataset.id);
      else img.src = thumb(img.dataset.id, false);
    });
  }
  filters.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-f]");
    if (!b) return;
    filter = b.dataset.f;
    filters.querySelectorAll("button").forEach((x) => x.setAttribute("aria-selected", x === b));
    renderClips();
  });
  renderClips();

  /* ---------- Modal ---------- */
  const modal = $("#modal");
  const frame = $("#modal-frame");
  function openVideo(id, title) {
    if (playing) select(current, false); // עוצרים את נגן הסדרה
    frame.innerHTML = `<iframe src="${embed(id)}" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    $("#modal-title").textContent = title;
    modal.showModal();
  }
  function closeVideo() { modal.close(); }
  modal.addEventListener("close", () => { frame.innerHTML = ""; });
  modal.addEventListener("click", (e) => { if (e.target === modal) closeVideo(); });
  $("#modal-x").addEventListener("click", closeVideo);
  grid.addEventListener("click", (e) => {
    const c = e.target.closest(".clip");
    if (c) openVideo(c.dataset.yt, c.dataset.title);
  });

  /* ---------- Releases ---------- */
  $("#releases").innerHTML = S.releases.map((r) => `
    <li class="rel reveal">
      <span class="rel__date">${esc(r.date)}</span>
      <div class="rel__head"><h3 class="rel__t">${esc(r.title)}</h3><span class="rel__type">${esc(r.type)}</span></div>
      <p class="rel__note">${esc(r.note)}</p>
      <div class="rel__links">${r.links.map(([l, u]) => `<a href="${u}"${u.startsWith("#") ? "" : ' target="_blank" rel="noopener"'}>${esc(l)}</a>`).join("")}</div>
    </li>`).join("");

  /* ---------- Booking → WhatsApp ---------- */
  const form = $("#booking-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const name = (d.name || "").trim();
    const field = $("#f-name").closest(".field");
    if (!name) {
      field.classList.add("has-err");
      $("#err-name").hidden = false;
      $("#f-name").focus();
      return;
    }
    field.classList.remove("has-err");
    $("#err-name").hidden = true;
    const lines = [
      `שלום, כאן ${name}.`,
      `אשמח לבדוק אם לייבי דייטש פנוי ל${d.type}${d.date ? ` בתאריך ${d.date.trim()}` : ""}${d.place ? `, ב${d.place.trim()}` : ""}.`,
    ];
    if (d.notes && d.notes.trim()) lines.push(d.notes.trim());
    const url = `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
    $("#form-note").textContent = "ההודעה נפתחה בוואטסאפ. לא נפתחה? אפשר להתקשר: 054-286-2777";
  });
  $("#f-name").addEventListener("input", () => {
    if ($("#f-name").value.trim()) {
      $("#f-name").closest(".field").classList.remove("has-err");
      $("#err-name").hidden = true;
    }
  });

  /* ---------- Reveal ---------- */
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();
