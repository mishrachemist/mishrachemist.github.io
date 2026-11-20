/* ===================== HOME EFFECTS: festival themes, weather, furnace sparks ===================== */
(function homeFx() {
  const LS = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const on = k => LS(k, "true") !== "false";
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Festival dates (checked against the CAG holiday list 2026 and hindupad.com 2027 list).
  // Fixed-date days (1 Jan, 26 Jan, 15 Aug, 25 Dec, 31 Dec) repeat every year.
  // [from, to, kind, Hindi greeting, English greeting]
  const FEST = [
    ["2026-10-19", "2026-10-20", "petals",   "शुभ दशहरा 🏹", "Happy Dussehra 🏹"],
    ["2026-11-07", "2026-11-11", "diwali",   "शुभ दीपावली 🪔", "Happy Diwali 🪔"],
    ["2026-11-24", "2026-11-24", "petals",   "गुरु नानक जयंती 🙏", "Guru Nanak Jayanti 🙏"],
    ["2027-01-14", "2027-01-15", "kites",    "मकर संक्रांति की शुभकामनाएँ 🪁", "Happy Makar Sankranti 🪁"],
    ["2027-03-06", "2027-03-06", "petals",   "महाशिवरात्रि 🔱", "Maha Shivratri 🔱"],
    ["2027-03-21", "2027-03-22", "holi",     "होली की शुभकामनाएँ 🎨", "Happy Holi 🎨"],
    ["2027-04-15", "2027-04-15", "petals",   "राम नवमी 🙏", "Ram Navami 🙏"],
    ["2027-08-17", "2027-08-17", "petals",   "रक्षा बंधन 🪢", "Happy Raksha Bandhan 🪢"],
    ["2027-08-25", "2027-08-25", "petals",   "जन्माष्टमी 🦚", "Happy Janmashtami 🦚"],
    ["2027-09-04", "2027-09-04", "petals",   "गणेश चतुर्थी 🙏", "Happy Ganesh Chaturthi 🙏"],
    ["2027-09-30", "2027-10-08", "diwali",   "शुभ नवरात्रि 🪔", "Happy Navratri 🪔"],
    ["2027-10-09", "2027-10-09", "petals",   "शुभ दशहरा 🏹", "Happy Dussehra 🏹"],
    ["2027-10-28", "2027-10-31", "diwali",   "शुभ दीपावली 🪔", "Happy Diwali 🪔"],
    ["2027-11-04", "2027-11-04", "petals",   "छठ पूजा 🌅", "Chhath Puja 🌅"]
  ];
  const FIXED = [
    ["01-01", "01-01", "fireworks", "नव वर्ष की शुभकामनाएँ 🎆", "Happy New Year 🎆"],
    ["12-31", "12-31", "fireworks", "नव वर्ष की शुभकामनाएँ 🎆", "Happy New Year 🎆"],
    ["01-26", "01-26", "tricolor",  "गणतंत्र दिवस 🇮🇳", "Happy Republic Day 🇮🇳"],
    ["08-15", "08-15", "tricolor",  "स्वतंत्रता दिवस 🇮🇳", "Happy Independence Day 🇮🇳"],
    ["12-24", "12-25", "snow",      "क्रिसमस की शुभकामनाएँ 🎄", "Merry Christmas 🎄"]
  ];
  function festToday() {
    const d = new Date(), pad = n => String(n).padStart(2, "0");
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, md = iso.slice(5);
    const f = FEST.find(x => iso >= x[0] && iso <= x[1]) || FIXED.find(x => md >= x[0] && md <= x[1]);
    return f ? { kind: f[2], hi: f[3], en: f[4] } : null;
  }

  // ---- weather (Open-Meteo, free, no key) ----
  let wx = null;   // { kind, temp, isDay, label }
  function wxKind(code) {
    if (code === 0 || code === 1) return "clear";
    if (code === 2 || code === 3) return "cloudy";
    if (code === 45 || code === 48) return "fog";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 95) return "storm";
    return "cloudy";
  }
  const WX_LABEL = { clear: ["☀️", "🌙", "Clear", "साफ़"], cloudy: ["⛅", "☁️", "Cloudy", "बादल"], fog: ["🌫️", "🌫️", "Fog", "कोहरा"],
    rain: ["🌧️", "🌧️", "Rain", "बारिश"], snow: ["❄️", "❄️", "Snow", "बर्फ़"], storm: ["⛈️", "⛈️", "Thunderstorm", "आँधी-तूफ़ान"] };
  // sunrise / sunset for the real sun & moon on the greeting card (once a day)
  const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
  function saveSun(j) {
    try {
      const d = j && j.daily, r = d && d.sunrise && String(d.sunrise[0] || ""), st = d && d.sunset && String(d.sunset[0] || "");
      if (!/T\d\d:\d\d/.test(r) || !/T\d\d:\d\d/.test(st)) return;
      localStorage.setItem("fxSun", JSON.stringify({ d: todayKey(), rise: r.slice(11, 16), set: st.slice(11, 16) }));
      if (window.smsSkyRefresh) window.smsSkyRefresh();
    } catch (e) {}
  }
  function loadSun() {
    try { const v = JSON.parse(LS("fxSun", "null")); if (v && v.d === todayKey()) return; } catch (e) {}
    if (!navigator.geolocation || LS("fxWxDenied", "") === "1") return;
    navigator.geolocation.getCurrentPosition(pos => {
      const la = pos.coords.latitude.toFixed(3), lo = pos.coords.longitude.toFixed(3);
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=sunrise,sunset&timezone=auto&forecast_days=1`)
        .then(r => r.ok ? r.json() : null).then(saveSun).catch(() => {});
    }, () => {}, { maximumAge: 3600000, timeout: 15000 });
  }
  function loadWeather() {
    if (!on("fxWeather")) { wx = null; loadSun(); return; }
    try { const c = JSON.parse(LS("fxWxCache", "null")); if (c && Date.now() - c.t < 30 * 60000) { wx = c.w; updateChips(); loadSun(); return; } } catch (e) {}
    if (!navigator.geolocation || LS("fxWxDenied", "") === "1") return;
    navigator.geolocation.getCurrentPosition(pos => {
      const la = pos.coords.latitude.toFixed(3), lo = pos.coords.longitude.toFixed(3);
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1`)
        .then(r => r.ok ? r.json() : null).then(j => {
          saveSun(j);
          if (!j || !j.current) return;
          wx = { kind: wxKind(j.current.weather_code), temp: Math.round(j.current.temperature_2m), isDay: j.current.is_day === 1 };
          try { localStorage.setItem("fxWxCache", JSON.stringify({ t: Date.now(), w: wx })); } catch (e) {}
          updateChips(); reset();
        }).catch(() => {});
    }, err => { if (err && err.code === 1) { try { localStorage.setItem("fxWxDenied", "1"); } catch (e) {} } }, { maximumAge: 3600000, timeout: 15000 });
  }

  // ---- chips on the home screen (greeting + weather) ----
  function updateChips() {
    const sb = document.getElementById("mainSidebar"); if (!sb) return;
    let box = document.getElementById("fxChips");
    if (!box) { box = document.createElement("div"); box.id = "fxChips"; box.className = "fxChips"; }
    const hero = document.getElementById("homeHeroRow");
    if (hero && box.previousElementSibling !== hero) hero.after(box);
    else if (!hero && !box.parentNode) sb.prepend(box);
    const hi = (typeof uiLang === "function" && uiLang() === "hi");
    const parts = [];
    const f = on("fxFestival") ? festToday() : null;
    if (f) parts.push(`<span class="fxChip fest">${hi ? f.hi : f.en}</span>`);
    // weather sits inside the day box (top right on date cards, at the bottom on the sticker picture)
    const day = document.getElementById("dayStickerWrap");
    let dw = document.getElementById("dayWx");
    if (wx && on("fxWeather")) {
      const L = WX_LABEL[wx.kind] || WX_LABEL.cloudy, txt = `${wx.isDay ? L[0] : L[1]} ${wx.temp}°C · ${hi ? L[3] : L[2]}`;
      if (day) {
        if (!dw) { dw = document.createElement("span"); dw.id = "dayWx"; dw.className = "dayWx"; }
        if (dw.parentNode !== day) day.appendChild(dw);
        dw.innerHTML = `${wx.isDay ? L[0] : L[1]} ${wx.temp}°C<span class="wxLbl"> · ${hi ? L[3] : L[2]}</span>`;
      } else parts.push(`<span class="fxChip">${txt}</span>`);
    } else if (dw) dw.remove();
    box.innerHTML = parts.join("");
  }

  // ---- canvas ----
  const cv = document.createElement("canvas"); cv.id = "homeFx"; cv.setAttribute("aria-hidden", "true");
  document.body.insertBefore(cv, document.body.firstChild);
  const g = cv.getContext("2d");
  let W = 0, H = 0, DPR = 1, parts = [], flash = 0, raf = 0, last = 0, mode = null;
  function size() { DPR = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; g.setTransform(DPR, 0, 0, DPR, 0, 0); }
  size(); addEventListener("resize", () => { size(); reset(); });
  const rnd = (a, b) => a + Math.random() * (b - a);
  function homeVisible() {
    const sb = document.getElementById("mainSidebar"), app = document.getElementById("app");
    return document.visibilityState === "visible" && sb && !sb.classList.contains("hidden") && app && !app.classList.contains("hidden") && !document.body.classList.contains("vmShield");
  }
  function sparkLevel() {
    const t = parseFloat(LS("monthProdTarget", "0")), p = (window._homeLive || {}).monthProd;
    if (!(t > 0) || typeof p !== "number") return 1;
    const d = new Date(), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const expected = t * d.getDate() / dim;
    return Math.max(0.5, Math.min(2.2, p / expected));   // behind plan = calm, ahead = lively
  }
  function reset() {
    parts = [];
    const f = on("fxFestival") ? festToday() : null;
    mode = { fest: f ? f.kind : null, wx: (on("fxWeather") && wx) ? wx : null, sparks: on("fxSparks") };
    // fill the screen at once (falling things start spread over the whole height)
    const w = want();
    Object.keys(w).forEach(k => { for (let i = 0; i < w[k]; i++) { const p = spawn(k); if (!p || Array.isArray(p)) continue;
      if (k === "spark") p.y = rnd(H * .3, H); else if ("vy" in p && p.vy > 0) p.y = rnd(0, H); parts.push(p); } });
  }
  const COLORS = { holi: ["#ff3b7f", "#ffd400", "#21c46b", "#2f8cff", "#a64dff", "#ff8a00"], tri: ["#ff9933", "#ffffff", "#138808"],
    petals: ["#ff9f1a", "#ffc300", "#ff7b00"], fire: ["#ffd27a", "#ffb347", "#ff7a1a"] };
  function spawn(kind) {
    switch (kind) {
      case "spark": return { k: kind, x: rnd(0, W), y: H + 5, vx: rnd(-.3, .3), vy: -rnd(.8, 2.2) * sparkLevel(), life: rnd(60, 160), r: rnd(.8, 2), c: COLORS.fire[(Math.random() * 3) | 0] };
      case "rain": return { k: kind, x: rnd(-50, W), y: rnd(-H, 0), vx: 1.2, vy: rnd(9, 14), len: rnd(10, 18) };
      case "snow": return { k: kind, x: rnd(0, W), y: rnd(-H, 0), vx: rnd(-.4, .4), vy: rnd(.5, 1.4), r: rnd(1.2, 3) };
      case "petal": return { k: kind, x: rnd(0, W), y: rnd(-H, 0), vx: rnd(-.5, .5), vy: rnd(.6, 1.4), r: rnd(3, 6), a: rnd(0, 6.28), c: COLORS.petals[(Math.random() * 3) | 0] };
      case "tri": return { k: kind, x: rnd(0, W), y: rnd(-H, 0), vx: rnd(-.4, .4), vy: rnd(.8, 1.8), r: rnd(2, 4), a: rnd(0, 6.28), c: COLORS.tri[(Math.random() * 3) | 0] };
      case "holi": return { k: kind, x: rnd(0, W), y: rnd(H * .2, H), vx: rnd(-.3, .3), vy: -rnd(.1, .4), r: rnd(18, 46), life: rnd(120, 260), c: COLORS.holi[(Math.random() * 6) | 0] };
      case "glitter": return { k: kind, x: rnd(0, W), y: rnd(0, H * .9), life: rnd(40, 120), r: rnd(.8, 2.2) };
      case "star": return { k: kind, x: rnd(0, W), y: rnd(0, H * .45), r: rnd(.6, 1.6), ph: rnd(0, 6.28) };
      case "kite": return { k: kind, x: rnd(-60, -20), y: rnd(H * .08, H * .4), vx: rnd(.4, .9), ph: rnd(0, 6.28), s: rnd(14, 22), c: COLORS.holi[(Math.random() * 6) | 0] };
      case "boom": { const x = rnd(W * .15, W * .85), y = rnd(H * .1, H * .4), c = COLORS.holi[(Math.random() * 6) | 0], out = [];
        for (let i = 0; i < 28; i++) { const a = i / 28 * 6.28, v = rnd(1.2, 2.6); out.push({ k: "fw", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(50, 80), c }); } return out; }
    }
  }
  function want() {
    const w = { spark: 0, rain: 0, snow: 0, petal: 0, tri: 0, holi: 0, glitter: 0, star: 0, kite: 0 };
    if (mode.sparks) w.spark = Math.round(26 * sparkLevel());
    if (mode.wx) { if (mode.wx.kind === "rain" || mode.wx.kind === "storm") w.rain = 90; if (mode.wx.kind === "snow") w.snow = 70; if (mode.wx.kind === "clear" && !mode.wx.isDay) w.star = 50; }
    switch (mode.fest) {
      case "diwali": w.glitter = 30; break; case "petals": w.petal = 34; break; case "tricolor": w.tri = 60; break;
      case "holi": w.holi = 14; break; case "snow": w.snow = Math.max(w.snow, 70); break; case "kites": w.kite = 6; break;
    }
    return w;
  }
  function drawStatic(t) {
    // furnace glow at the bottom
    if (mode.sparks) {
      const lv = sparkLevel(), pulse = .55 + .15 * Math.sin(t / 700) * lv;
      const gr = g.createRadialGradient(W / 2, H + H * .1, 10, W / 2, H + H * .1, H * .5);
      gr.addColorStop(0, `rgba(255,140,40,${.32 * pulse})`); gr.addColorStop(1, "rgba(255,90,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    if (mode.wx) {
      if (mode.wx.kind === "clear" && mode.wx.isDay) {
        const gr = g.createRadialGradient(W * .9, H * .06, 5, W * .9, H * .06, Math.max(W, H) * .5);
        gr.addColorStop(0, "rgba(255,230,140,.35)"); gr.addColorStop(1, "rgba(255,220,120,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      if (mode.wx.kind === "fog") { g.fillStyle = `rgba(220,225,230,${.18 + .04 * Math.sin(t / 2000)})`; g.fillRect(0, 0, W, H); }
      if (mode.wx.kind === "cloudy") {
        for (let i = 0; i < 4; i++) { const x = ((t / 60 + i * W / 3) % (W + 300)) - 150, y = H * (.08 + i * .07);
          const gr = g.createRadialGradient(x, y, 5, x, y, 120); gr.addColorStop(0, "rgba(255,255,255,.16)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(x - 130, y - 130, 260, 260); }
      }
    }
    if (mode.fest === "diwali") {              // row of diyas at the bottom
      const n = Math.max(5, Math.floor(W / 70));
      for (let i = 0; i < n; i++) {
        const x = (i + .5) * W / n, y = H - 96;
        g.fillStyle = "#b5541b"; g.beginPath(); g.ellipse(x, y, 13, 6, 0, 0, Math.PI); g.fill();
        const fl = 1 + .18 * Math.sin(t / 120 + i * 1.7);
        const gr = g.createRadialGradient(x, y - 9, 1, x, y - 9, 22 * fl); gr.addColorStop(0, "rgba(255,210,90,.9)"); gr.addColorStop(1, "rgba(255,160,30,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y - 9, 22 * fl, 0, 6.28); g.fill();
        g.fillStyle = "#ffe08a"; g.beginPath(); g.ellipse(x, y - 8, 3, 7 * fl, 0, 0, 6.28); g.fill();
      }
    }
    if (mode.fest === "tricolor") {
      const hd = document.querySelector("header"), top = hd ? Math.max(0, hd.getBoundingClientRect().bottom) : 0, h = 5;
      ["#ff9933", "#ffffff", "#138808"].forEach((c, i) => { g.fillStyle = c; g.globalAlpha = .85; g.fillRect(0, top + i * h, W, h); }); g.globalAlpha = 1;
    }
  }
  function step(t) {
    raf = 0;
    if (!homeVisible() || !mode) { cv.style.display = "none"; return; }
    cv.style.display = "";
    if (t - last < 30) { raf = requestAnimationFrame(step); return; }   // ~30 fps is plenty
    last = t;
    g.clearRect(0, 0, W, H);
    drawStatic(t);
    const w = want(), count = {};
    parts.forEach(p => { count[p.k] = (count[p.k] || 0) + 1; });
    Object.keys(w).forEach(k => { for (let i = count[k] || 0; i < w[k]; i++) { if (Math.random() < .15) parts.push(spawn(k)); } });
    if (mode.fest === "fireworks" && Math.random() < .03) parts.push(...spawn("boom"));
    if (mode.wx && mode.wx.kind === "storm" && Math.random() < .004) flash = 1;
    const keep = [];
    for (const p of parts) {
      let alive = true;
      switch (p.k) {
        case "spark": p.x += p.vx + Math.sin((p.y + t / 9) / 40) * .3; p.y += p.vy; p.life--; alive = p.life > 0 && p.y > -10;
          g.globalAlpha = Math.min(1, p.life / 60); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); break;
        case "rain": p.x += p.vx; p.y += p.vy; alive = p.y < H + 20;
          g.globalAlpha = .45; g.strokeStyle = document.body.classList.contains("theme-light") ? "#5f86b3" : "#cfe3ff"; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2, p.y - p.len); g.stroke(); break;
        case "snow": p.x += p.vx + Math.sin((p.y + t / 20) / 30) * .3; p.y += p.vy; alive = p.y < H + 10;
          g.globalAlpha = .85; g.fillStyle = document.body.classList.contains("theme-light") ? "#9fb6d4" : "#fff"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); break;
        case "petal": case "tri": p.x += p.vx + Math.sin((p.y + t / 15) / 35) * .4; p.y += p.vy; p.a += .03; alive = p.y < H + 10;
          g.globalAlpha = .9; g.fillStyle = p.c; g.save(); g.translate(p.x, p.y); g.rotate(p.a);
          if (p.k === "petal") { g.beginPath(); g.ellipse(0, 0, p.r, p.r * .55, 0, 0, 6.28); g.fill(); }
          else { g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); if (p.c === "#ffffff") { g.strokeStyle = "rgba(0,0,80,.35)"; g.lineWidth = .6; g.strokeRect(-p.r, -p.r / 2, p.r * 2, p.r); } }
          g.restore(); break;
        case "holi": p.x += p.vx; p.y += p.vy; p.life--; alive = p.life > 0;
          { const gr = g.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r); gr.addColorStop(0, p.c); gr.addColorStop(1, "rgba(255,255,255,0)");
            g.globalAlpha = .35 * Math.min(1, p.life / 60); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); } break;
        case "glitter": p.life--; alive = p.life > 0;
          g.globalAlpha = Math.sin(p.life / 120 * Math.PI) * .9; g.fillStyle = "#ffd76a"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); break;
        case "star": g.globalAlpha = .4 + .4 * Math.sin(t / 500 + p.ph); g.fillStyle = "#fff"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.28); g.fill(); break;
        case "kite": p.x += p.vx; alive = p.x < W + 60;
          { const y = p.y + Math.sin(t / 700 + p.ph) * 14; g.globalAlpha = .9; g.fillStyle = p.c; g.beginPath();
            g.moveTo(p.x, y - p.s); g.lineTo(p.x + p.s * .7, y); g.lineTo(p.x, y + p.s); g.lineTo(p.x - p.s * .7, y); g.closePath(); g.fill();
            g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x, y + p.s); g.quadraticCurveTo(p.x - 20, y + p.s + 40, p.x - 50, H); g.stroke(); } break;
        case "fw": p.x += p.vx; p.y += p.vy; p.vy += .03; p.life--; alive = p.life > 0;
          g.globalAlpha = Math.min(1, p.life / 40); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 1.8, 0, 6.28); g.fill(); break;
      }
      if (alive) keep.push(p);
    }
    parts = keep;
    if (flash > 0) { g.globalAlpha = flash * .35; g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); flash -= .08; }
    g.globalAlpha = 1;
    raf = requestAnimationFrame(step);
  }
  function kick() { if (!raf && !reduced) raf = requestAnimationFrame(step); }
  setInterval(kick, 1000);
  document.addEventListener("visibilitychange", kick);
  addEventListener("homeLive", () => { reset(); prodMeter(); });

  // ---- production meter: this month's production against the target, around today's date ----
  function prodMeter() {
    const wrap = document.getElementById("dayStickerWrap"); if (!wrap) return;
    const t = parseFloat(LS("monthProdTarget", "0")), p = (window._homeLive || {}).monthProd;
    if (!(t > 0) || typeof p !== "number") { wrap.querySelectorAll(".prodRing, .prodBadge, .dcProd").forEach(e => e.remove()); return; }
    const pct = Math.round(p / t * 100), fill = Math.min(100, Math.max(0, p / t * 100));
    const cls = pct >= 100 ? "done" : pct >= 90 ? "near" : "";
    const hi = typeof uiLang === "function" && uiLang() === "hi";
    const fmt = n => Math.round(n).toLocaleString("en-IN");
    const tip = `${hi ? "इस माह का उत्पादन" : "This month's production"}: ${fmt(p)} / ${fmt(t)} MT (${pct}%)`;
    const setP = el => setTimeout(() => el.style.setProperty("--p", fill.toFixed(1)), 60);
    const num = wrap.querySelector(".dcNum");
    if (num) {
      let r = num.querySelector(".prodRing");
      if (!r) { r = document.createElement("i"); num.appendChild(r); }
      r.className = "prodRing " + cls; setP(r);
    }
    const tx = wrap.querySelector(".dcText");
    if (tx) {
      let l = tx.querySelector(".dcProd");
      if (!l) { l = document.createElement("div"); tx.appendChild(l); }
      l.className = "dcProd " + cls; l.title = tip;
      l.innerHTML = `<b>${hi ? "उत्पादन" : "Prod"} ${pct}%${pct >= 100 ? " ✓" : ""}</b><span>${fmt(p)} / ${fmt(t)} MT</span>`;
    }
    let b = wrap.querySelector(":scope > .prodBadge");
    if (!b) { b = document.createElement("span"); wrap.appendChild(b); }
    b.className = "prodBadge " + cls; b.title = tip; b.innerHTML = `<b>${pct}%</b>`; setP(b);
  }
  window.homeProdMeter = prodMeter;

  // ---- settings (inside the Theme Colour popup) ----
  function initSettings() {
    [["fxFestival", "fxFestival"], ["fxWeather", "fxWeather"], ["fxSparks", "fxSparks"]].forEach(([id, key]) => {
      const el = document.getElementById(id); if (!el) return;
      el.checked = on(key);
      el.addEventListener("change", () => {
        try { localStorage.setItem(key, el.checked ? "true" : "false"); if (key === "fxWeather" && el.checked) localStorage.removeItem("fxWxDenied"); } catch (e) {}
        if (key === "fxWeather") loadWeather();
        reset(); updateChips();
      });
    });
    const tg = document.getElementById("fxTarget");
    if (tg) {
      tg.value = LS("monthProdTarget", "") || "";
      tg.addEventListener("change", () => {
        try { localStorage.setItem("monthProdTarget", String(parseFloat(tg.value) || "")); } catch (e) {}
        if (typeof loadHomeMonthProd === "function") loadHomeMonthProd();
        reset(); prodMeter();
      });
    }
  }
  initSettings();
  reset(); updateChips(); loadWeather(); kick();
  setInterval(() => { loadWeather(); updateChips(); reset(); }, 30 * 60000);
  window.homeFxRefresh = () => { reset(); updateChips(); prodMeter(); };
  prodMeter();
  const langBtn = document.getElementById("langToggle"); if (langBtn) langBtn.addEventListener("click", () => setTimeout(() => { updateChips(); prodMeter(); }, 50));
})();

/* ===================== HOME EDIT: move & resize tiles ===================== */
(function homeEdit() {
  const sb = document.getElementById("mainSidebar"); if (!sb) return;
  const getSizes = () => { try { return JSON.parse(localStorage.getItem("homeTileSize") || "{}"); } catch (e) { return {}; } };
  function applySizes() {
    const sz = getSizes();
    sb.querySelectorAll(":scope > .navItem").forEach(b => {
      b.classList.toggle("tileWide", sz[b.dataset.section] === "wide");
      if (!b.querySelector(".tileSizeBtn")) {
        const t = document.createElement("span"); t.className = "tileSizeBtn"; t.setAttribute("role", "button"); t.title = "Bigger / smaller";
        t.textContent = "⤢"; b.appendChild(t);
      }
    });
    if (sb.querySelector(":scope > .navItem.tileWide") && typeof loadHomeMonthProd === "function") loadHomeMonthProd();
  }
  applySizes();
  let editing = false, drag = null;
  function saveOrder() {
    const pinned = (typeof getPinnedSections === "function") ? getPinnedSections() : [];
    const order = Array.from(sb.querySelectorAll(":scope > .navItem")).map(b => b.dataset.section).filter(s => !pinned.includes(s));
    try { localStorage.setItem("homeTileOrder", JSON.stringify(order)); } catch (e) {}
  }
  function start(noScroll) {
    const ov = document.getElementById("iconStyleOverlay"); if (ov) ov.classList.add("hidden");
    const back = document.getElementById("backToMenuBtn");
    if (sb.classList.contains("hidden") && back) back.click();
    editing = true; sb.classList.add("homeEditing");
    let bar = document.getElementById("homeEditBar");
    if (!bar) {
      bar = document.createElement("div"); bar.id = "homeEditBar";
      bar.innerHTML = `<span class="hint">Drag to move · ⤢ = bigger</span><button type="button" class="secondary" id="homeEditReset">↺ Reset</button><button type="button" class="primary" id="homeEditDone">✅ Done</button>`;
      document.body.appendChild(bar);
      bar.querySelector("#homeEditDone").addEventListener("click", stop);
      bar.querySelector("#homeEditReset").addEventListener("click", () => {
        if (!confirm("Put all home tiles back in the original order and size?")) return;
        try { localStorage.removeItem("homeTileOrder"); localStorage.removeItem("homeTileSize"); } catch (e) {}
        applySizes(); if (typeof applyPinnedOrder === "function") applyPinnedOrder();
      });
    }
    bar.style.display = "";
    if (noScroll !== true) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function stop() {
    editing = false; sb.classList.remove("homeEditing");
    const bar = document.getElementById("homeEditBar"); if (bar) bar.style.display = "none";
    saveOrder();
  }
  const sbtn = document.getElementById("homeEditStartBtn"); if (sbtn) sbtn.addEventListener("click", start);
  // in edit mode a tap never opens the page
  sb.addEventListener("click", e => {
    if (!editing) return;
    const sz = e.target.closest(".tileSizeBtn");
    e.preventDefault(); e.stopImmediatePropagation();
    if (sz) {
      const b = sz.closest(".navItem"), s = getSizes();
      if (s[b.dataset.section] === "wide") delete s[b.dataset.section]; else s[b.dataset.section] = "wide";
      try { localStorage.setItem("homeTileSize", JSON.stringify(s)); } catch (e2) {}
      applySizes(); if (typeof updateNavSubs === "function") updateNavSubs();
    }
  }, true);
  sb.addEventListener("pointerdown", e => {
    if (!editing) return;
    const b = e.target.closest("#mainSidebar > .navItem"); if (!b || e.target.closest(".tileSizeBtn") || e.target.closest(".navPin")) return;
    drag = { b, x: e.clientX, y: e.clientY, moved: false };
    try { b.setPointerCapture(e.pointerId); } catch (x) {}
  });
  sb.addEventListener("pointermove", e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6 && !drag.b.classList.contains("dragging")) return;
    if (!drag.moved) {   // the tile is "lifted": remember where the finger holds it
      drag.moved = true; drag.b.classList.add("dragging");
      const r = drag.b.getBoundingClientRect(); drag.ox = drag.x - r.left; drag.oy = drag.y - r.top;
      drag.b.style.transition = "none";
    }
    // which tile is under the finger?
    drag.b.style.pointerEvents = "none";
    const over = document.elementFromPoint(e.clientX, e.clientY);
    drag.b.style.pointerEvents = "";
    const tgt = over && over.closest && over.closest("#mainSidebar > .navItem");
    if (tgt && tgt !== drag.b) {
      const r = tgt.getBoundingClientRect();
      const sameRow = e.clientY >= r.top && e.clientY <= r.bottom;
      const after = sameRow ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
      if (after ? tgt.nextElementSibling !== drag.b : tgt.previousElementSibling !== drag.b) {
        // FLIP: the other tiles glide to their new places instead of jumping
        const others = Array.from(sb.querySelectorAll(":scope > .navItem")).filter(x => x !== drag.b);
        const before = new Map(others.map(x => [x, x.getBoundingClientRect()]));
        tgt[after ? "after" : "before"](drag.b);
        others.forEach(x => {
          const a = before.get(x), c = x.getBoundingClientRect();
          const dx = a.left - c.left, dy = a.top - c.top;
          if (!dx && !dy) return;
          x.style.transition = "none"; x.style.translate = `${dx}px ${dy}px`;
          x.getBoundingClientRect();
          x.style.transition = "translate .22s cubic-bezier(.2,.8,.2,1)"; x.style.translate = "0px 0px";
        });
      }
    }
    // the lifted tile stays exactly under the finger
    drag.b.style.translate = "0px 0px";
    const n = drag.b.getBoundingClientRect();
    drag.b.style.translate = `${e.clientX - drag.ox - n.left}px ${e.clientY - drag.oy - n.top}px`;
    if (e.clientY < 70) window.scrollBy(0, -8); else if (e.clientY > innerHeight - 140) window.scrollBy(0, 8);
  });
  const end = () => {
    if (!drag) return;
    const b = drag.b; drag = null;
    // drop: the tile glides into its slot
    b.style.transition = "translate .2s ease"; b.style.translate = "0px 0px";
    setTimeout(() => { b.classList.remove("dragging"); b.style.transition = ""; b.style.translate = ""; }, 210);
    saveOrder();
  };
  sb.addEventListener("pointerup", end); sb.addEventListener("pointercancel", end);
  // pinning a tile (★) keeps it at the top, as before
  window.homeEditIsOn = () => editing;

  // ---- long-press a tile (like a phone home screen): move mode starts and the tile follows the finger ----
  let lp = null;
  const lpCancel = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
  sb.addEventListener("pointerdown", e => {
    if (editing || (e.pointerType === "mouse" && e.button !== 0)) return;
    const b = e.target.closest("#mainSidebar > .navItem"); if (!b || e.target.closest(".navPin")) return;
    lpCancel();
    lp = { b, x: e.clientX, y: e.clientY, id: e.pointerId, t: setTimeout(() => {
      const L = lp; lp = null; if (!L) return;
      start(true);
      if (navigator.vibrate) { try { navigator.vibrate(30); } catch (x) {} }
      drag = { b: L.b, x: L.x, y: L.y, moved: false };
      try { L.b.setPointerCapture(L.id); } catch (x) {}
      L.b.classList.add("dragging");   // lifted at once; it follows the finger from the first move
    }, 480) };
  });
  sb.addEventListener("pointermove", e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) lpCancel(); });
  ["pointerup", "pointercancel", "scroll"].forEach(ev => (ev === "scroll" ? window : sb).addEventListener(ev, lpCancel, { passive: true }));
  // while a tile is being dragged the page must not scroll under the finger
  sb.addEventListener("touchmove", e => { if (drag && e.cancelable) e.preventDefault(); }, { passive: false });
  // no "open image / download image" menu on a long press
  sb.addEventListener("contextmenu", e => { if (e.target.closest("#mainSidebar > .navItem")) e.preventDefault(); });
  sb.querySelectorAll("img").forEach(im => im.setAttribute("draggable", "false"));
})();

/* ===================== PAGE OPEN ANIMATION: tile order + tap ripple ===================== */
(function pageAnim() {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function number(sb) { let i = 0; sb.querySelectorAll(":scope > .navItem").forEach(b => { b.style.setProperty("--ti", Math.min(i++, 20)); }); }
  document.querySelectorAll("#mainSidebar, .sidebar.subNav").forEach(sb => {
    number(sb);
    new MutationObserver(() => number(sb)).observe(sb, { childList: true });
  });
  if (reduce) return;
  document.addEventListener("pointerdown", e => {
    const item = e.target.closest && e.target.closest(".sidebar .navItem");
    if (!item || item.closest(".homeEditing")) return;
    // ripple inside the visible tile: the item itself when it has its own background, else its icon box
    const ic = getComputedStyle(item), icon = item.querySelector(":scope > .navIcon");
    const tile = (ic.backgroundImage !== "none" || !/rgba\(0, 0, 0, 0\)|transparent/.test(ic.backgroundColor) || !icon) ? item : icon;
    if (getComputedStyle(tile).position === "static") tile.style.position = "relative";
    let box = tile.querySelector(":scope > .rippleBox");
    if (!box) { box = document.createElement("span"); box.className = "rippleBox"; tile.appendChild(box); }
    const r = tile.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
    const c = document.createElement("span"); c.className = "tapRipple";
    c.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;width:${d}px;height:${d}px;`;
    box.appendChild(c); setTimeout(() => c.remove(), 650);
  }, { passive: true });
})();
