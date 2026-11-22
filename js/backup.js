/* ===================== BACKUP & RESTORE (☰ → Backup & Restore) =====================
   The app keeps its settings on the device (localStorage). A backup = those settings, locked with a backup password
   (PBKDF2-SHA256 → AES-256-GCM, done in the browser), either in the OneDrive app folder (moltrix_settings_backup.json)
   or as a file. The password itself is never stored or sent; the key made from it stays on this device so the
   automatic daily OneDrive backup can run without asking again.
   Never in a backup: Microsoft sign-in data, fingerprint-lock keys of this device, ERP login details, caches. ===== */
(function settingsBackup() {
  const G_FILE = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/moltrix_settings_backup.json:/content";
  const K_KEY = "mzBackupKey", K_SALT = "mzBackupSalt", K_AT = "mzBackupAt", K_HASH = "mzBackupHash", K_WHERE = "mzBackupWhere";
  const DAY = 24 * 3600 * 1000, ITER = 250000;
  // device-only / sign-in / caches: never backed up, never overwritten by a restore
  const SKIP_EXACT = new Set([K_KEY, K_SALT, K_AT, K_HASH, K_WHERE, "mzLockCred", "mzLockLog", "fpSignInCredId", "fpLocallyLocked",
    "lastSignedInAccountId", "shellRefreshAt", "waPushEndpoint", "bxCache", "fxWxCache", "fxWxDenied", "homeMonthProdCache",
    "teamMapCache", "calDirty", "waAutoLastTry", "waInboxRetry", "autoSyncPending", "waStateTs"]);
  const SKIP_RE = [/^msal[.\-]/i, /msal/i, /^roleCache:/, /erp.*(pass|pwd|user ?id|login|cred)/i, /(password|passwd|secret)/i, /^server-telemetry/i];
  const skip = k => SKIP_EXACT.has(k) || SKIP_RE.some(r => r.test(k));

  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } } };
  const b64 = u8 => { let s = ""; const a = new Uint8Array(u8); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const enc = new TextEncoder(), dec = new TextDecoder();
  const fmtAt = iso => { try { const d = new Date(iso); return d.toLocaleDateString("en-GB").replace(/\//g, "-") + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }); } catch (e) { return iso; } };
  const signedOwner = () => { try { return typeof account !== "undefined" && !!account && !isViewer(); } catch (e) { return false; } };

  function collect() {
    const keys = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && !skip(k)) keys[k] = localStorage.getItem(k); }
    return keys;
  }
  async function digest(obj) {
    const sorted = JSON.stringify(Object.keys(obj).sort().map(k => [k, obj[k]]));
    return b64(await crypto.subtle.digest("SHA-256", enc.encode(sorted)));
  }
  async function keyFrom(password, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, base, 256));
  }
  async function seal(raw, salt, keys) {
    const k = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify({ keys })));
    return { v: 1, app: "Moltrix", at: new Date().toISOString(), device: window.MZ_NATIVE ? "Android app" : (/Android|iPhone|iPad/i.test(navigator.userAgent) ? "Phone" : "PC"),
      n: Object.keys(keys).length, kdf: { name: "PBKDF2-SHA256", iter: ITER, salt: b64(salt) }, iv: b64(iv), data: b64(ct) };
  }
  async function open(box, password) {
    if (!box || box.app !== "Moltrix" || !box.data || !box.kdf) throw new Error("This is not a Moltrix backup.");
    const salt = unb64(box.kdf.salt), raw = await keyFrom(password, salt);
    const k = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    let plain;
    try { plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, k, unb64(box.data)); }
    catch (e) { throw new Error("Wrong backup password."); }
    return { keys: JSON.parse(dec.decode(plain)).keys || {}, raw, salt };
  }
  const haveKey = () => !!(ls.get(K_KEY) && ls.get(K_SALT));
  const remember = (raw, salt) => { ls.set(K_KEY, b64(raw)); ls.set(K_SALT, b64(salt)); };

  // ---------- small themed dialogs ----------
  function shell(title, inner) {
    const d = document.createElement("div");
    d.className = "mzBkOv";
    d.style.cssText = "position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;";
    d.innerHTML = `<div style="background:var(--card,#fffaf2);color:var(--ink,#16233d);width:100%;max-width:380px;max-height:88vh;overflow:auto;border-radius:16px;padding:18px 18px 16px;box-shadow:0 12px 34px rgba(0,0,0,.35);">
      <div style="font-weight:800;font-size:17px;margin-bottom:12px;">${title}</div>${inner}</div>`;
    document.body.appendChild(d);
    return d;
  }
  function askPassword(mode) {   // mode "set" = new password (typed twice); "open" = existing password
    return new Promise(res => {
      const d = shell("🔑 Backup password", `
        <input type="password" id="mzBkPw1" autocomplete="new-password" placeholder="Password" style="margin:0 0 10px;">
        ${mode === "set" ? `<input type="password" id="mzBkPw2" autocomplete="new-password" placeholder="Password again" style="margin:0 0 10px;">` : ""}
        <div id="mzBkPwMsg" style="font-size:12.5px;color:#c0392b;min-height:16px;margin-bottom:8px;"></div>
        <div style="display:flex;gap:10px;"><button type="button" class="secondary" id="mzBkPwNo" style="flex:1;margin:0;">Cancel</button>
        <button type="button" class="primary" id="mzBkPwOk" style="flex:1;margin:0;">OK</button></div>`);
      const p1 = d.querySelector("#mzBkPw1"), p2 = d.querySelector("#mzBkPw2"), msg = d.querySelector("#mzBkPwMsg");
      const done = v => { d.remove(); res(v); };
      d.querySelector("#mzBkPwNo").onclick = () => done(null);
      const ok = () => {
        const a = p1.value;
        if (a.length < 6) { msg.textContent = "At least 6 characters."; p1.focus(); return; }
        if (p2 && a !== p2.value) { msg.textContent = "The two passwords are not the same."; p2.focus(); return; }
        done(a);
      };
      d.querySelector("#mzBkPwOk").onclick = ok;
      [p1, p2].forEach(x => x && x.addEventListener("keydown", e => { if (e.key === "Enter") ok(); }));
      setTimeout(() => p1.focus(), 50);
    });
  }
  function confirmRestore(box, n) {
    return new Promise(res => {
      const d = shell("♻️ Restore settings", `
        <div style="font-size:14px;line-height:1.5;margin-bottom:14px;">${esc(n)} settings · ${esc(fmtAt(box.at))}${box.device ? " · " + esc(box.device) : ""}</div>
        <div style="display:flex;gap:10px;"><button type="button" class="secondary" id="mzBkRsNo" style="flex:1;margin:0;">Cancel</button>
        <button type="button" class="primary" id="mzBkRsOk" style="flex:1;margin:0;">Restore</button></div>`);
      d.querySelector("#mzBkRsNo").onclick = () => { d.remove(); res(false); };
      d.querySelector("#mzBkRsOk").onclick = () => { d.remove(); res(true); };
    });
  }

  // ---------- backup ----------
  async function makeBox(askIfNeeded) {
    let raw, salt;
    if (haveKey()) { raw = unb64(ls.get(K_KEY)); salt = unb64(ls.get(K_SALT)); }
    else {
      if (!askIfNeeded) return null;
      const pw = await askPassword("set"); if (!pw) return null;
      salt = crypto.getRandomValues(new Uint8Array(16)); raw = await keyFrom(pw, salt); remember(raw, salt);
    }
    const keys = collect();
    return { box: await seal(raw, salt, keys), hash: await digest(keys) };
  }
  async function toOneDrive(made) {
    const token = await getToken(); if (!token) throw new Error("Microsoft sign-in needed.");
    const r = await fetch(G_FILE, { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(made.box) });
    if (!r.ok) throw new Error("OneDrive save failed (" + r.status + ").");
    ls.set(K_AT, made.box.at); ls.set(K_HASH, made.hash); ls.set(K_WHERE, "OneDrive");
  }
  function toFile(made) {
    const name = `Moltrix-settings-${made.box.at.slice(0, 10)}.json`;
    const url = URL.createObjectURL(new Blob([JSON.stringify(made.box)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  // automatic: once a day after opening, only when something changed and a backup password was set on this device
  async function autoBackup() {
    try {
      if (!haveKey() || !signedOwner() || navigator.onLine === false) return;
      const at = Date.parse(ls.get(K_AT) || "") || 0;
      if (Date.now() - at < DAY) return;
      const keys = collect();
      if ((await digest(keys)) === ls.get(K_HASH) && ls.get(K_WHERE) === "OneDrive") { ls.set(K_AT, new Date().toISOString()); return; }
      await toOneDrive(await makeBox(false));
    } catch (e) { /* next time */ }
  }

  // ---------- restore ----------
  async function restoreBox(box, where) {
    if (!box || box.app !== "Moltrix") throw new Error("This is not a Moltrix backup.");
    const pw = await askPassword("open"); if (!pw) return false;
    const { keys, raw, salt } = await open(box, pw);
    const names = Object.keys(keys).filter(k => !skip(k));
    if (!(await confirmRestore(box, names.length))) return false;
    names.forEach(k => ls.set(k, keys[k]));
    remember(raw, salt);   // the same password keeps the automatic backup going on this device
    ls.set(K_AT, box.at); ls.set(K_WHERE, where);
    ls.set(K_HASH, await digest(collect()));
    setTimeout(() => location.reload(), 300);
    return true;
  }
  async function fromOneDrive() {
    const token = await getToken(); if (!token) throw new Error("Microsoft sign-in needed.");
    const r = await fetch(G_FILE + "?t=" + Date.now(), { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
    if (r.status === 404) throw new Error("No backup on OneDrive yet.");
    if (!r.ok) throw new Error("OneDrive read failed (" + r.status + ").");
    return restoreBox(await r.json(), "OneDrive");
  }
  function pickFile() {
    return new Promise(res => {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
      inp.onchange = () => res(inp.files && inp.files[0] || null);
      inp.click();
    });
  }

  // ---------- the panel ----------
  function openPanel() {
    if (document.querySelector(".mzBkOv")) return;
    const owner = signedOwner();
    const btn = (id, label, cls) => `<button type="button" class="${cls || "secondary"}" id="${id}" style="width:100%;margin:0 0 10px;">${label}</button>`;
    const d = shell("💾 Backup & Restore", `
      <div id="mzBkLast" style="font-size:13px;opacity:.8;margin-bottom:12px;"></div>
      ${owner ? btn("mzBkUp", "☁️ Back up to OneDrive", "primary") + btn("mzBkDown", "☁️ Restore from OneDrive") : ""}
      ${btn("mzBkSave", "📄 Save backup file")}${btn("mzBkLoad", "📄 Restore from file")}
      ${haveKey() ? btn("mzBkPwChg", "🔑 Change backup password") : ""}
      <div id="mzBkSt" style="font-size:13px;min-height:18px;margin:2px 0 10px;white-space:pre-wrap;"></div>
      <button type="button" class="secondary" id="mzBkClose" style="width:100%;margin:0;">Close</button>`);
    const st = d.querySelector("#mzBkSt");
    const showLast = () => { const at = ls.get(K_AT); d.querySelector("#mzBkLast").textContent = at ? `Last backup: ${fmtAt(at)} (${ls.get(K_WHERE) || "OneDrive"})` : "No backup yet"; };
    showLast();
    const run = (id, fn) => { const b = d.querySelector("#" + id); if (!b) return; b.onclick = async () => {
      d.querySelectorAll("button").forEach(x => x.disabled = true); st.style.color = ""; st.textContent = "…";
      try { const m = await fn(); st.textContent = m || ""; } catch (e) { st.style.color = "#c0392b"; st.textContent = "⚠️ " + (e && e.message || e); }
      finally { d.querySelectorAll("button").forEach(x => x.disabled = false); showLast(); }
    }; };
    run("mzBkUp", async () => { const m = await makeBox(true); if (!m) return ""; await toOneDrive(m); return `✅ Saved on OneDrive (${m.box.n} settings).`; });
    run("mzBkDown", async () => (await fromOneDrive()) ? "✅ Restored - restarting…" : "");
    run("mzBkSave", async () => { const m = await makeBox(true); if (!m) return ""; toFile(m); ls.set(K_AT, m.box.at); ls.set(K_WHERE, "file"); return `✅ File saved (${m.box.n} settings).`; });
    run("mzBkLoad", async () => { const f = await pickFile(); if (!f) return ""; let box; try { box = JSON.parse(await f.text()); } catch (e) { throw new Error("This is not a Moltrix backup."); } return (await restoreBox(box, "file")) ? "✅ Restored - restarting…" : ""; });
    run("mzBkPwChg", async () => {
      const pw = await askPassword("set"); if (!pw) return "";
      const salt = crypto.getRandomValues(new Uint8Array(16)); remember(await keyFrom(pw, salt), salt);
      if (owner) { await toOneDrive(await makeBox(false)); return "✅ New password set; OneDrive backup saved again."; }
      return "✅ New password set.";
    });
    d.querySelector("#mzBkClose").onclick = () => d.remove();
    d.addEventListener("click", e => { if (e.target === d) d.remove(); });
  }

  window.mzOpenBackup = openPanel;
  window.mzBackupTest = { collect, skip, seal, open, digest, keyFrom };
  mzAfterLoad(() => setTimeout(autoBackup, 25000));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(autoBackup, 25000); });
})();
