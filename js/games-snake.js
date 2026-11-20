/* ===== Snake: classic game with a realistic, smoothly sliding snake (no network needed) ===== */
(function snakeGame() {
  const ov = document.getElementById("snakeOverlay"), cv = document.getElementById("snakeCanvas");
  if (!ov || !cv) return;
  const g = cv.getContext("2d"), $ = id => document.getElementById(id);
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
               set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  let level = Math.min(9, Math.max(1, parseInt(ls.get("snakeLevel", "5"), 10) || 5));
  let walls = ls.get("snakeWalls", "0") === "1", sound = ls.get("snakeSound", "0") === "1";
  let COLS = 15, ROWS = 22, cell = 20, offX = 0, offY = 0, view = { w: 360, h: 520, dpr: 1 };
  let snake, prev, dir, queue, food, bonus, eaten, score, state = "menu", raf = null, acc = 0, lastT = 0, lastTick = 0, frame = 0, parts = [], grow = 0, deadT = 0;
  const hiKey = () => "snakeHi" + (walls ? "W" : "") + level;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const speed = () => 250 - level * 21;   // L1 229 ms ... L9 61 ms per step

  let actx = null;
  function beep(f, ms) {
    if (!sound) return;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), v = actx.createGain(); o.type = "square"; o.frequency.value = f; v.gain.value = 0.05;
      o.connect(v); v.connect(actx.destination); o.start(); o.stop(actx.currentTime + ms / 1000); } catch (e) {}
  }
  const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

  function resize(regrid) {
    const f = window.__gmFS.fit(cv);
    view = { w: f.w, h: f.h, dpr: f.dpr };
    if (regrid) {
      if (f.w > f.h) { ROWS = 13; cell = f.h / ROWS; COLS = Math.max(15, Math.floor(f.w / cell)); }   // landscape: wide board
      else { COLS = 15; cell = f.w / COLS; ROWS = Math.max(12, Math.floor(f.h / cell)); }
    }
    cell = Math.min(f.w / COLS, f.h / ROWS);
    offX = (f.w - COLS * cell) / 2; offY = (f.h - ROWS * cell) / 2;
  }
  function freeCell() {
    const busy = new Set(snake.map(p => p[0] + "," + p[1]));
    if (bonus) busy.add(bonus.x + "," + bonus.y);
    if (food) busy.add(food[0] + "," + food[1]);
    for (let i = 0; i < 800; i++) { const x = Math.floor(Math.random() * COLS), y = Math.floor(Math.random() * ROWS); if (!busy.has(x + "," + y)) return [x, y]; }
    return null;
  }
  function labels() {
    $("snakeScore").textContent = "★ " + (score || 0);
    $("snakeLvl").textContent = "L" + level;
    $("snakeHi").textContent = "HI " + (parseInt(ls.get(hiKey(), "0"), 10) || 0);
    $("snakeLvlTxt").textContent = "Level " + level;
    $("snakeWallsBtn").textContent = "Walls: " + (walls ? "ON" : "OFF");
    $("snakeSoundBtn").textContent = "Sound: " + (sound ? "ON" : "OFF");
    $("snakePause").textContent = $("snakePause2").textContent = state === "pause" ? "▶" : "II";
  }
  function reset() {
    resize(true);
    const y = Math.floor(ROWS / 2);
    snake = [[6, y], [5, y], [4, y], [3, y], [2, y]]; prev = snake.map(p => p.slice());
    dir = DIRS.right; queue = []; bonus = null; eaten = 0; score = 0; food = null; grow = 0; parts = []; deadT = 0;
    food = freeCell();
  }
  function msg(title, text, btn) {
    $("snakeMsgTitle").textContent = title; $("snakeMsgText").textContent = text; $("snakeStart").textContent = btn;
    $("snakeMsg").classList.remove("hidden"); labels();
  }
  function start() { reset(); state = "run"; $("snakeMsg").classList.add("hidden"); labels(); acc = 0; lastTick = performance.now(); kick(); }
  function over() {
    state = "dying"; deadT = 28; buzz([90, 50, 90]); beep(160, 300);
    const hk = hiKey(), hi = parseInt(ls.get(hk, "0"), 10) || 0, best = score > hi;
    if (best) ls.set(hk, String(score));
    setTimeout(() => { state = "over"; labels(); msg("GAME OVER", (best ? "New high score! " : "") + "Score " + score, "PLAY AGAIN"); }, 700);
  }
  function burst(x, y, n, col) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 0.03 + Math.random() * 0.06;
      parts.push({ x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 20 + Math.random() * 15, col, r: 0.06 + Math.random() * 0.06 }); }
  }
  function tick() {
    if (state !== "run") return;
    prev = snake.map(p => p.slice());
    if (queue.length) dir = queue.shift();
    let nx = snake[0][0] + dir[0], ny = snake[0][1] + dir[1];
    if (walls) { if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return over(); }
    else { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
    const eat = food && nx === food[0] && ny === food[1];
    const body = (eat || grow > 0) ? snake : snake.slice(0, -1);
    if (grow > 0 && !eat) grow--;
    if (body.some(p => p[0] === nx && p[1] === ny)) return over();
    snake = [[nx, ny]].concat(body);
    if (snake.length > prev.length) prev.push(prev[prev.length - 1].slice());   // new tail piece starts where the old tail was
    if (eat) {
      score += level; eaten++; buzz(15); beep(880, 40); burst(nx, ny, 12, "#ff5a4f");
      food = freeCell();
      if (eaten % 5 === 0 && !bonus) { const c = freeCell(); if (c) bonus = { x: c[0], y: c[1], t: 45 }; }
    }
    if (bonus) {
      if (nx === bonus.x && ny === bonus.y) { score += Math.max(level, (bonus.t * level / 4) | 0); grow += 2; bonus = null; buzz([20, 30, 20]); beep(1200, 80); burst(nx, ny, 18, "#ffd23f"); }
      else if (--bonus.t <= 0) bonus = null;
    }
    if (!food) return over();
    labels();
  }
  // ---------- drawing ----------
  const P = (x, y) => [offX + (x + 0.5) * cell, offY + (y + 0.5) * cell];
  // ---- pictures taken from the snake photo supplied for the game: ground, skin scales, head ----
  const SN_IMG = { ground: "img/d4cf85c431c5.webp", skin: "data:image/webp;base64,UklGRh4GAABXRUJQVlA4IBIGAAAwHACdASowADAAPikQhkIhoQqrVAwBQlmAJ0yhILO1X2IrH0xAgVg31GbZbzAeTx6jPQP/rX+j9YD1OvQO8tr2U/299KPABNgXw38c/MHvCeVfaLccdQL5B9ffvP5cf0f2g7wfdJqBfjP8W/we8EgA+bTvYtQLtn/qvUf/Kf9L9pvv53sPcHsAfxT+x/9X2S/5r/r+VP6B/4nuF/y3+xf8D+3fj9yKv7Moj2jjjK8MB3uGJg72ipCOwzPI2unXnjJoCX5xxS9jld29AP3+WFhIfssl7ZNHhMpAPdVVhLrpXFI7fTvqfl+dtAQA/v8Gl74C3Zon3u4gpZbb0A+wnhx0kGQqURxllB/MhiWGEedZAN1ySFhSyHGW7zH5HonTXHLQBifmSL8nIN9TL2H4cz+nlgLHZMW8dIQO+faEOiO+xYJiIYF52yoIKsJikenESfnpA8Q6j4rL9Q8lf/7msQpOH4gT++GDttJh+T95V/cZk//dNMmTjjf/1iqjv86Oofht3ayflG2BvIaExzj2rSo48IFTjKrS3uSwqRYrWUFGff7eKXJ8AQqevxh0etnNGVWVqIsHLT2Yd2JqQOUyvn44e2Rr9D2IHiexgk2gfaaacnO3VXz7psPSfPjxMcscVkR3tSXJt7YP1kUW5KA69Jur8JrNJHwsRwyxT4TGxdvS8ac6QPZxZSYISkVGe83YaHsZZ0xVn/DA+fpKOCfLXvvF+IbZKP4wFX8V+ZLRJTxaFU0x0+7NqUsK/c7VXsgA9IifxpcGSHvLvga/H1Hl8lSlZ7fbauPTC/6Qe+ulrgAHWKJNcgMGQPzwlboKSe2LCF87vn+48b47/rDudXbwVQ5f9Q4XCUCsWTTHboG7JMZT9olpf8M/X/RwTZPsulZVP3XAb40lI6EJ+c5G2lAY4CyAriJW3R7ObYnKItn6M03lfSCda3nmPkQct8IhKMwR45/JJBT27Q+d1RW5B7PdsDL3+YW0pFYJjSQj/FlUk7ckXi4jlwNj9vFOZQD4quB9s/vIENSReEVd+4lpH+AOnZEfnX29hh/oFdPynCT/PxzlzqTBtj84vuT9S3XEcIW2KPq8DzlanKiiPUgHncHb6ml2M6CdDV7CzRJSj9o0EF7SWrHTOi1sPaedSFEoUyPpP0bIw6ca1mOgViugiIkfwS9PamhCv4h6c1aqDqA++rBDtOJF/Y9/PNAwKx5Z8luVyusva7K1ayzByxYx9WMxKCZrYKv7B8w+m7AcQxGFWv9Ui/x9rD7twPLpN1yk5dc9Upas/7NSHvsrwlsa6ihzqtwafB6LpdWVicoTiYlj8pIqgsXfgRSql+gk+HjoN7zLizxN+iFafA4ffb47U5VGgbqI86cQ1g01U7n/NAzSb22cTgm3QLsVfQpeou0hHuIi4JF1b0yHjVZea+uRuyxRTe/fZFLCoJEF/cIr7h8me62w3nxEcrJcfkR2//6APjc0VovNuQkrsoB37in2ztAIPgCL8LJCFAfjxZcdBvA4ujASud5AXPTw+v2Rx12GgUOO4nepX3d8uidvEPfwJWYOX5OG0i+Q7Ly70lcyIw6QhqNbeyXo2Asgi6SRsL08xvCOIl+mM+lM/lywbzSLyL0VWkBNe/oCYur1+CiG0IpxqBFVVsad2vEP5XmSmr7sKHzgwHsAqwhf5ov/FVs2TfLGOzBI4kBu2G3lgjte8GHJPmQUmwfbdbjerpdEaux2Ubu+GqRjlYZVAXk2LRT+JAOQHhy/ZSDf1hkKnd72xtuMs47fnjTW+e//kKs2ba5PTjkyr+uEr4KjR0GivxKOi1paqGBQwPBb8KaQZ2fEWL+/oEUJuD+IkxnpTjP3aIfTbM8AMN7wJw+kuHt/TJsfyd8OpRd4mFHs+ZD/S7GQGr/nTKTE7MPD/+/kuzr1VnQXanFXG6y9gQZb4xJ6Q070ZH5bBC/cd3WNho9BioyqPHdpu2/lE/l/l+Al/uU4dAdYpo+LlJdeziVJg5epWlppgIFzfqken+CD0K42Zukb/+QOb3Jy857cX6v2imYsJL4wv/VYw75z2OC3qGfotruoGhiRtJiqAAA=", head: "img/b87de1e68b22.webp" };
  const snImg = {}; let snReady = 0;
  Object.keys(SN_IMG).forEach(k => { const im = new Image(); im.onload = () => { snReady++; groundKey = ""; }; im.src = SN_IMG[k]; snImg[k] = im; });
  const HEAD_ANCHOR = 0.5467, HEAD_WH = 0.9167;   // head centre (fraction of sprite width) and head width / sprite height
  const PHOTO_BODY = 95;                                // snake width in the photo, px - keeps the ground and scales in the same proportion
  let groundCv = null, groundKey = "";
  function photoScale() { return (cell * 0.92) / PHOTO_BODY; }
  function drawGrass() {
    const key = [view.w, view.h, view.dpr, COLS, ROWS, walls, snReady].join("|");
    if (key !== groundKey) {
      groundKey = key; groundCv = document.createElement("canvas");
      groundCv.width = Math.round(view.w * view.dpr); groundCv.height = Math.round(view.h * view.dpr);
      const t = groundCv.getContext("2d"); t.scale(view.dpr, view.dpr);
      t.fillStyle = "#3d2a1b"; t.fillRect(0, 0, view.w, view.h);
      const gw = COLS * cell, gh = ROWS * cell;
      if (snImg.ground && snImg.ground.complete && snImg.ground.naturalWidth) {
        // one picture of the ground (the photo with the snake taken out), covering the whole field
        const iw = snImg.ground.naturalWidth, ih = snImg.ground.naturalHeight, sc = Math.max(gw / iw, gh / ih);
        t.save(); t.beginPath(); t.rect(offX, offY, gw, gh); t.clip();
        t.drawImage(snImg.ground, offX + (gw - iw * sc) / 2, offY + (gh - ih * sc) / 2, iw * sc, ih * sc); t.restore();
      } else { t.fillStyle = "#8a6440"; t.fillRect(offX, offY, gw, gh); }
      if (walls) { t.strokeStyle = "#3e2a1a"; t.lineWidth = Math.max(4, cell * 0.25); t.strokeRect(offX, offY, gw, gh); }
    }
    g.drawImage(groundCv, 0, 0, view.w, view.h);
  }
  function drawApple(x, y) {
    const [cx, cy] = P(x, y), r = cell * 0.36, bob = Math.sin(frame / 10) * cell * 0.03;
    g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(cx, cy + r * 0.95, r * 0.8, r * 0.25, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.35 + bob, r * 0.1, cx, cy + bob, r); gr.addColorStop(0, "#ff8a80"); gr.addColorStop(0.5, "#e53935"); gr.addColorStop(1, "#8e1414");
    g.fillStyle = gr; g.beginPath(); g.arc(cx - r * 0.25, cy + bob, r * 0.8, 0, Math.PI * 2); g.arc(cx + r * 0.25, cy + bob, r * 0.8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#5d4037"; g.lineWidth = Math.max(1.5, cell * 0.06); g.beginPath(); g.moveTo(cx, cy - r * 0.6 + bob); g.lineTo(cx + r * 0.1, cy - r * 1.05 + bob); g.stroke();
    g.fillStyle = "#66bb6a"; g.beginPath(); g.ellipse(cx + r * 0.35, cy - r * 0.9 + bob, r * 0.32, r * 0.16, -0.5, 0, Math.PI * 2); g.fill();
  }
  function drawEgg(b) {
    const [cx, cy] = P(b.x, b.y), r = cell * 0.4, blink = b.t < 12 && frame % 6 < 3;
    if (blink) return;
    g.shadowColor = "#ffe082"; g.shadowBlur = cell * 0.5;
    const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1); gr.addColorStop(0, "#fffde7"); gr.addColorStop(0.6, "#ffd54f"); gr.addColorStop(1, "#c79100");
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, r * 0.75, r, 0, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
  }
  function bodyPoints(t) {   // smooth positions of every piece between the last step and this one
    const pts = [];
    for (let i = 0; i < snake.length; i++) {
      const a = prev[i] || snake[i], b = snake[i];
      if (Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1) pts.push({ x: b[0], y: b[1], jump: true });   // went through a side edge
      else pts.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t });
    }
    return pts;
  }
  let skinPat = null, skinKey = "";
  function drawSnake(t) {
    const pts = bodyPoints(t), n = pts.length, dead = state === "dying";
    const rad = i => cell * (0.3 - 0.17 * Math.pow(i / Math.max(1, n - 1), 1.35));
    const cont = i => { const a = pts[i], b = pts[i + 1]; return b && !b.jump && !(a.jump && i > 0) && Math.abs(a.x - b.x) < 1.5 && Math.abs(a.y - b.y) < 1.5; };
    const XY = p => P(p.x, p.y), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    function piece(i, col, wmul, ox, oy) {
      const c = XY(pts[i]);
      const s = i > 0 && cont(i - 1) ? mid(XY(pts[i - 1]), c) : c, e = i < n - 1 && cont(i) ? mid(c, XY(pts[i + 1])) : c;
      if (s === c && e === c) return;
      g.strokeStyle = col; g.lineWidth = rad(i) * 2 * wmul; g.beginPath();
      g.moveTo(s[0] + ox, s[1] + oy); g.quadraticCurveTo(c[0] + ox, c[1] + oy, e[0] + ox, e[1] + oy); g.stroke();
    }
    const layer = (col, wmul, ox, oy) => { for (let i = n - 1; i >= 1; i--) piece(i, col, wmul, ox || 0, oy || 0); };
    // skin pattern from the photo, scaled to the same scale size as the photo
    const sk = snImg.skin && snImg.skin.complete && snImg.skin.naturalWidth;
    if (sk && skinKey !== cell + "|" + view.dpr) { skinPat = g.createPattern(snImg.skin, "repeat"); skinKey = cell + "|" + view.dpr; }
    if (skinPat) skinPat.setTransform(new DOMMatrix().scale(photoScale() * 1.15));
    g.lineCap = "round"; g.lineJoin = "round";
    if (dead) g.filter = "grayscale(1) brightness(.75)";
    layer("rgba(0,0,0,.35)", 1.08, cell * 0.08, cell * 0.16);   // shadow on the ground
    layer("#06320a", 1.1);                                       // thin dark outline, as in the photo
    layer(skinPat || "#2fd422", 0.99);                           // scaly skin
    layer("rgba(0,90,0,.35)", 0.99);                             // deepen the colour towards the sides...
    layer(skinPat || "#3be02a", 0.7);                            // ...brighter middle
    layer("rgba(170,255,60,.18)", 0.55);
    layer("rgba(214,255,110,.55)", 0.1);                         // light line along the spine
    layer("rgba(255,255,255,.18)", 0.08, -cell * 0.05, -cell * 0.11);
    // pointed tail
    if (n > 2 && cont(n - 2)) {
      const a = XY(pts[n - 2]), b = XY(pts[n - 1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), r = rad(n - 1);
      g.save(); g.translate(b[0], b[1]); g.rotate(ang);
      g.fillStyle = "#06320a"; g.beginPath(); g.moveTo(0, -r * 1.1); g.quadraticCurveTo(cell * 0.4, -r * 0.5, cell * 0.85, 0); g.quadraticCurveTo(cell * 0.4, r * 0.5, 0, r * 1.1); g.fill();
      g.fillStyle = skinPat || "#2fd422"; g.beginPath(); g.moveTo(0, -r * 0.95); g.quadraticCurveTo(cell * 0.38, -r * 0.4, cell * 0.78, 0); g.quadraticCurveTo(cell * 0.38, r * 0.4, 0, r * 0.95); g.fill();
      g.restore();
    }
    // head: the real head from the photo, turned to the moving direction; black forked tongue
    const h = pts[0], [hx, hy] = P(h.x, h.y), ang = Math.atan2(dir[1], dir[0]);
    g.save(); g.translate(hx, hy); g.rotate(ang);
    const hw = rad(0) * 2 * 1.55, sh = hw / HEAD_WH, sw = sh * (snImg.head.naturalWidth || 212) / (snImg.head.naturalHeight || 120);
    const fx = -sw * HEAD_ANCHOR + cell * 0.18;   // head centre slightly ahead of the body point
    if (!dead && frame % 45 < 12) {
      g.strokeStyle = "#111"; g.lineWidth = Math.max(1.3, cell * 0.055); const tip = fx + sw - cell * 0.02, L = cell * (0.4 + 0.18 * Math.sin(frame * 0.9));
      g.beginPath(); g.moveTo(tip, 0); g.lineTo(tip + L, 0); g.lineTo(tip + L + cell * 0.16, -cell * 0.1); g.moveTo(tip + L, 0); g.lineTo(tip + L + cell * 0.16, cell * 0.1); g.stroke();
    }
    if (snImg.head.complete && snImg.head.naturalWidth) {
      g.save(); g.globalAlpha = 0.35; g.filter = (dead ? "grayscale(1) " : "") + "brightness(0)"; g.drawImage(snImg.head, fx + cell * 0.06, -sh / 2 + cell * 0.14, sw, sh); g.restore();   // shadow
      g.drawImage(snImg.head, fx, -sh / 2, sw, sh);
    } else { g.fillStyle = "#2fd422"; g.beginPath(); g.ellipse(cell * 0.15, 0, cell * 0.5, cell * 0.36, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
    g.filter = "none";
  }
  function draw() {
    if (!snake) return;
    const t = state === "run" ? Math.min(1, (performance.now() - lastTick) / speed()) : 1;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    drawGrass();
    if (food) drawApple(food[0], food[1]);
    if (bonus) drawEgg(bonus);
    drawSnake(t);
    parts.forEach(p => { g.globalAlpha = Math.min(1, p.life / 15); g.fillStyle = p.col; const [x, y] = [offX + p.x * cell, offY + p.y * cell]; g.beginPath(); g.arc(x, y, p.r * cell, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1;
    if (state === "dying" && deadT > 0) { g.fillStyle = `rgba(255,0,0,${deadT / 90})`; g.fillRect(0, 0, view.w, view.h); }
  }
  function loop(now) {
    raf = null;
    if (ov.classList.contains("hidden")) return;
    frame++;
    if (state === "run") {
      acc += Math.min(250, now - (lastT || now));
      const sp = speed();
      while (acc >= sp) { acc -= sp; tick(); lastTick = now - acc; if (state !== "run") break; }
    }
    lastT = now;
    if (deadT > 0) deadT--;
    parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.life--; }); parts = parts.filter(p => p.life > 0);
    draw();
    raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); } }
  function turn(name) {
    const d = DIRS[name]; if (!d) return;
    if (state === "menu" || state === "over" || state === "dying") return;
    if (state === "pause") togglePause();
    const last = queue.length ? queue[queue.length - 1] : dir;
    if ((d[0] === -last[0] && d[1] === -last[1]) || (d[0] === last[0] && d[1] === last[1])) return;
    if (queue.length < 2) queue.push(d);
  }
  function togglePause() {
    if (state === "run") { state = "pause"; msg("PAUSED", "Score " + score, "CONTINUE"); }
    else if (state === "pause") { state = "run"; $("snakeMsg").classList.add("hidden"); acc = 0; lastTick = performance.now(); kick(); }
    labels();
  }
  function open() {
    ov.classList.remove("hidden"); window.__gmFS.enter();
    window.__gmFS.ready(() => {
      if (state === "run") togglePause();
      if (!snake) { reset(); state = "menu"; msg("🐍 SNAKE", "Swipe or use the arrows. Eat 🍎 to grow, catch the golden egg for bonus.", "START"); }
      else resize(false);
      labels(); kick();
    });
  }
  function close() { if (state === "run") togglePause(); ov.classList.add("hidden"); window.__gmFS.exit(); }
  window.openSnakeGame = open;

  $("snakeClose").addEventListener("click", close);
  $("snakeStart").addEventListener("click", () => { if (state === "pause") togglePause(); else start(); });
  const pz = () => { if (state === "run" || state === "pause") togglePause(); else if (state !== "dying") start(); };
  $("snakePause").addEventListener("click", pz); $("snakePause2").addEventListener("click", pz);
  $("snakeLvlDown").addEventListener("click", () => { level = Math.max(1, level - 1); ls.set("snakeLevel", level); labels(); });
  $("snakeLvlUp").addEventListener("click", () => { level = Math.min(9, level + 1); ls.set("snakeLevel", level); labels(); });
  $("snakeWallsBtn").addEventListener("click", () => { walls = !walls; ls.set("snakeWalls", walls ? "1" : "0"); labels(); });
  $("snakeSoundBtn").addEventListener("click", () => { sound = !sound; ls.set("snakeSound", sound ? "1" : "0"); labels(); if (sound) beep(660, 60); });
  ov.querySelectorAll(".gmCtl button[data-d]").forEach(b => {
    b.addEventListener("pointerdown", e => { e.preventDefault(); turn(b.dataset.d); b.classList.add("on"); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(t => b.addEventListener(t, () => b.classList.remove("on")));
    b.addEventListener("contextmenu", e => e.preventDefault());
  });
  let sw = null;
  const stage = $("snakeStage");
  stage.addEventListener("pointerdown", e => { if (e.target.closest("button")) return; sw = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener("pointermove", e => {
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    sw = { x: e.clientX, y: e.clientY };
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => stage.addEventListener(t, () => { sw = null; }));
  document.addEventListener("keydown", e => {
    if (ov.classList.contains("hidden")) return;
    const k = e.key, map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", w: "up", s: "down", a: "left", d: "right", "2": "up", "8": "down", "4": "left", "6": "right" };
    if (map[k] || map[String(k).toLowerCase()]) { e.preventDefault(); turn(map[k] || map[String(k).toLowerCase()]); }
    else if (k === " " || k === "5" || k === "Enter") { e.preventDefault(); pz(); }
    else if (k === "Escape") close();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "run") togglePause(); });
  window.addEventListener("resize", () => { if (!ov.classList.contains("hidden") && snake) { if (state === "menu") reset(); else resize(false); } });
  document.addEventListener("fullscreenchange", () => { if (!ov.classList.contains("hidden") && snake) setTimeout(() => resize(state === "menu"), 60); });

  // offline: the red banner offers the games
  const ban = document.getElementById("offlineBanner");
  if (ban && !ban.querySelector(".snkOfflineBtn")) {
    const b = document.createElement("button"); b.type = "button"; b.className = "snkOfflineBtn"; b.textContent = "🐍 Play Snake";
    b.addEventListener("click", open); ban.appendChild(b);
  }
  window.__snTest = { get state() { return state; }, get score() { return score; }, get snake() { return snake; }, get grid() { return [COLS, ROWS]; }, setFood: (x, y) => { food = [x, y]; } };
})();
