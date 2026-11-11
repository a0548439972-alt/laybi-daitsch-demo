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

  /* ---------- Reel: הקליפים המושקעים, זזים הצידה בגלילה ---------- */
  const reelSec = $("#clips");
  const reelVp = $("#reel-viewport");
  const reel = $("#reel");
  const reelBar = $("#reel-progress");
  let num = 0;
  reel.innerHTML = S.reel.map((v) => {
    if (v.intro) return `
      <div class="reel-intro">
        <p class="reel-intro__k">סדרה</p>
        <h3 class="reel-intro__t">${esc(v.title)}</h3>
        <p class="reel-intro__p">${esc(v.text)}</p>
        <span class="reel-intro__arrow" aria-hidden="true">←</span>
      </div>`;
    num++;
    return `
      <button class="reel-card" type="button" data-yt="${v.yt}" data-title="${esc(v.title)}">
        <span class="reel-card__media"><img alt="" loading="lazy" decoding="async" data-id="${v.yt}">${PLAY}</span>
        <span class="reel-card__body">
          <span class="reel-card__n">${String(num).padStart(2, "0")}</span>
          <span class="reel-card__txt">
            ${v.series ? `<span class="reel-card__s">${esc(v.series)}</span>` : ""}
            <span class="reel-card__t">${esc(v.title)}</span>
            <span class="reel-card__m">${esc(v.with)} · ${esc(v.date)}</span>
          </span>
        </span>
      </button>`;
  }).join("");
  reel.querySelectorAll("img[data-id]").forEach((img) => smartThumb(img, img.dataset.id));

  // מסך נמוך (למשל טאבלט לרוחב) לא נועצים: מחליקים, כדי שהכותרות לא ייחתכו
  const pinMQ = window.matchMedia("(min-width: 901px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)");
  let reelMax = 0;
  function sizeReel() {
    if (pinMQ.matches) {
      reelMax = Math.max(0, reel.scrollWidth - reelVp.clientWidth);
      reelSec.style.height = (window.innerHeight + reelMax) + "px";
      reelSec.classList.add("is-pinned");
    } else {
      reelMax = 0; reelSec.style.height = ""; reel.style.transform = ""; reelSec.classList.remove("is-pinned");
    }
    moveReel();
  }
  function moveReel() {
    if (!reelMax) { reelBar.style.transform = ""; return; }
    const r = reelSec.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (reelSec.offsetHeight - window.innerHeight)));
    reel.style.transform = `translate3d(${(p * reelMax).toFixed(1)}px,0,0)`; // RTL: התוכן ממשיך שמאלה, אז מזיזים ימינה
    reelBar.style.transform = `scaleX(${p.toFixed(3)})`;
  }
  window.addEventListener("scroll", moveReel, { passive: true });
  window.addEventListener("resize", sizeReel);
  window.addEventListener("load", sizeReel);
  sizeReel();
  reelVp.addEventListener("scroll", () => {
    if (reelMax) return;
    const max = reelVp.scrollWidth - reelVp.clientWidth;
    reelBar.style.transform = `scaleX(${max ? Math.abs(reelVp.scrollLeft) / max : 0})`;
  }, { passive: true });

  /* ---------- Casual: מהחתונות ומהבמה ---------- */
  const casual = $("#casual");
  casual.innerHTML = S.casual.map((v) => `
    <button class="cas cas--${v.shape}" type="button" data-yt="${v.yt}" data-title="${esc(v.title)}" data-shape="${v.shape}">
      <img alt="" loading="lazy" decoding="async" src="${thumb(v.yt, false)}">
      <span class="cas__tag">${esc(v.tag)}</span>
      ${PLAY}
      <span class="cas__cap"><span class="cas__t">${esc(v.title)}</span>${v.with ? `<span class="cas__m">${esc(v.with)}</span>` : ""}</span>
    </button>`).join("");

  /* ---------- Modal ---------- */
  const modal = $("#modal");
  const frame = $("#modal-frame");
  function openVideo(id, title, tall) {
    if (playing) select(current, false); // עוצרים את נגן הסדרה
    modal.classList.toggle("is-tall", !!tall);
    frame.innerHTML = `<iframe src="${embed(id)}" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    $("#modal-title").textContent = title;
    modal.showModal();
  }
  function closeVideo() { modal.close(); }
  modal.addEventListener("close", () => { frame.innerHTML = ""; });
  modal.addEventListener("click", (e) => { if (e.target === modal) closeVideo(); });
  $("#modal-x").addEventListener("click", closeVideo);
  document.addEventListener("click", (e) => {
    const c = e.target.closest(".reel-card, .cas");
    if (c) openVideo(c.dataset.yt, c.dataset.title, c.dataset.shape === "tall");
  });

  /* ---------- Booking → WhatsApp (הטופס בנוי כמו שיחה) ---------- */
  const form = $("#booking-form");
  const nameBubble = $("#name-bubble");
  const showErr = (on) => { nameBubble.classList.toggle("has-err", on); $("#err-name").hidden = !on; };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    const name = (d.name || "").trim();
    if (!name) { showErr(true); $("#f-name").focus(); return; }
    showErr(false);
    const lines = [
      `שלום, כאן ${name}.`,
      `אשמח לבדוק אם לייבי דייטש פנוי ל${d.type}${d.date ? ` בתאריך ${d.date.trim()}` : ""}${d.place ? `, ב${d.place.trim()}` : ""}.`,
    ];
    if (d.notes && d.notes.trim()) lines.push(d.notes.trim());
    const url = `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener");
    $("#form-note").textContent = "נפתח בוואטסאפ. לא נפתח? 054-286-2777";
  });
  $("#f-name").addEventListener("input", () => { if ($("#f-name").value.trim()) showErr(false); });
  // תיבת ההערות גדלה עם הטקסט, כמו בוואטסאפ
  $("#f-notes").addEventListener("input", (e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; });

  /* ---------- רקע שמתחלף בין סקשנים, בצבעי העטיפות של א נייע יאר ---------- */
  const fx = document.querySelectorAll(".bgfx i");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let bgNow = "#241d23", bgTimer;
  fx[0].style.background = bgNow;
  function setBg(c) {
    if (!c || c === bgNow) return;
    bgNow = c;
    if (calm) { fx[0].style.background = c; return; }
    clearTimeout(bgTimer);
    fx[1].classList.remove("go");
    fx[1].style.background = c;
    void fx[1].offsetWidth; // מאפס את האנימציה
    fx[1].classList.add("go");
    bgTimer = setTimeout(() => { fx[0].style.background = c; fx[1].classList.remove("go"); }, 1150);
  }
  const bgIO = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) setBg(en.target.dataset.bg); });
  }, { rootMargin: "-48% 0px -48% 0px" });
  document.querySelectorAll("[data-bg]").forEach((el) => bgIO.observe(el));

  /* ---------- Reveal ---------- */
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();
