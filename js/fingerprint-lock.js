/* ===================== FINGERPRINT LOCK =====================
   Microsoft (Outlook) sign-in stays once; with the lock ON this device asks for the fingerprint (or the phone's screen lock)
   every time Moltrix is opened, and again when it comes back after more than a minute away. It uses the phone's own
   screen-lock check through the browser (WebAuthn, platform authenticator, user verification required) - nothing is
   sent anywhere and no fingerprint data reaches Moltrix. Per device: the PC is not affected. Way out if the fingerprint
   no longer works: sign in again with the Microsoft account (then the lock is switched off and can be set again). */
(function () {
  if (window.MZ_NATIVE) {   // Moltrix Android app: the app checks the fingerprint itself (phone's own prompt)
    const btn = document.getElementById("fpLockToggle");
    const label = () => {
      const on = MoltrixApp.lockOn() ? "ON" : "OFF";
      if (btn) btn.textContent = `🔒 Fingerprint Lock: ${on}`;
      const d = document.querySelector("#navFpLockItem span:last-child"); if (d) d.textContent = `Fingerprint Lock: ${on}`;
    };
    label();
    window.mzNativeLock = () => label();
    window.mzLockRecovered = () => { try { if (!MoltrixApp.lockOn() && MoltrixApp.lockPossible()) setTimeout(() => MoltrixApp.setLock(true), 900); } catch (e) {} };
    // signed in but the lock is off (e.g. the sign-in check was missed when the app was installed): ask once per app start to set it
    (function () {
      let n = 0;
      const t = setInterval(() => {
        n++;
        try {
          if (MoltrixApp.lockOn() || n > 40) { clearInterval(t); return; }
          if (typeof account === "undefined" || !account || !MoltrixApp.lockPossible()) return;
          if (sessionStorage.getItem("mzNatLockAsk") === "1") { clearInterval(t); return; }
          sessionStorage.setItem("mzNatLockAsk", "1"); clearInterval(t);
          MoltrixApp.setLock(true);
        } catch (e) { clearInterval(t); }
      }, 1500);
    })();
    if (btn) btn.addEventListener("click", () => {
      if (!MoltrixApp.lockOn() && !MoltrixApp.lockPossible()) { alert("The fingerprint lock cannot work on this phone (a fingerprint or screen lock must be set on the phone)."); return; }
      MoltrixApp.setLock(!MoltrixApp.lockOn());
    });
    return;
  }
  const KEY = "mzLockCred", GRACE = 60 * 1000;
  const html = document.documentElement;
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const cred = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const supported = async () => {
    try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; }
  };
  let busy = false, hiddenAt = 0;
  const LOG = (t) => { try { const L = JSON.parse(localStorage.getItem("mzLockLog") || "[]"); L.push([Date.now(), t]); localStorage.setItem("mzLockLog", JSON.stringify(L.slice(-60))); } catch (e) {} };
  window.mzLockLogAdd = LOG;

  // ---- lock screen ----
  const box = document.createElement("div");
  box.id = "mzLock";
  // the lock screen is blank on purpose: a tap anywhere asks for the fingerprint again; holding a finger on it for
  // 3 seconds offers the Microsoft sign-in (the way out if the fingerprint no longer works)
  document.body.appendChild(box);
  const msg = () => {};
  let holdT = 0, held = false;
  box.addEventListener("pointerdown", () => { held = false; clearTimeout(holdT); holdT = setTimeout(() => { held = true; recover(); }, 3000); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(ev => box.addEventListener(ev, () => clearTimeout(holdT)));
  box.addEventListener("click", () => { if (!held) unlock(); held = false; });   // a long press is not a tap
  box.addEventListener("contextmenu", e => e.preventDefault());
  async function recover() {
    if (busy) return;
    if (!confirm("Open Moltrix by signing in again with the Microsoft account? After the sign-in the phone asks for the fingerprint once to set the lock again.")) return;
    try { sessionStorage.setItem("mzLockRecover", "1"); } catch (e) {}
    try {
      await msalReady;
      const acc = (typeof account !== "undefined" && account) ? account : null;
      await msalInstance.loginRedirect({ scopes: graphScopes, prompt: "login", loginHint: acc ? acc.username : undefined });
    } catch (e) { alert("Microsoft sign-in did not open: " + ((e && e.message) || e)); }
  }
  // every new Microsoft sign-in (called from init, only for an allowed account): on a phone without the lock the phone
  // asks for the fingerprint at once and the lock is set (no menu option any more). After the "Microsoft account" way out the
  // old key is dropped first, so a new one is set the same way.
  const isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  window.mzLockRecovered = () => {
    let want = false; try { want = sessionStorage.getItem("mzLockRecover") === "1"; sessionStorage.removeItem("mzLockRecover"); } catch (e) {}
    if (want) { try { localStorage.removeItem(KEY); } catch (e) {} html.classList.remove("mzLocked"); label(); }
    if (cred() || !isPhone) return;
    setTimeout(async () => { if (!cred() && await supported()) autoSet(); }, 900);
  };
  async function enroll() {   // a key (passkey) for Moltrix, made with the fingerprint; true = lock on
    const c = await navigator.credentials.create({ publicKey: {
      rp: { name: "Moltrix", id: location.hostname },
      user: { id: rnd(16), name: "Moltrix lock", displayName: "Moltrix lock" },
      challenge: rnd(32), timeout: 60000, attestation: "none",
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" } } });
    if (!c) throw new Error("no key");
    localStorage.setItem(KEY, b64(c.rawId));
    let uv = false;   // the fingerprint was checked while making the key - else check it once now
    try { uv = !!(c.response.getAuthenticatorData && (new Uint8Array(c.response.getAuthenticatorData())[32] & 0x04)); } catch (e) {}
    if (!uv) await verify();
    label(); return true;
  }
  async function autoSet() {
    if (busy || cred()) return;
    busy = true;
    try { await enroll(); toastLock("🔒 Fingerprint lock set - Moltrix will ask for it every time it is opened."); }
    catch (e) { try { localStorage.removeItem(KEY); } catch (x) {} label(); askSheet(); }   // no prompt without a tap / cancelled: one button
    finally { busy = false; hiddenAt = 0; }
  }
  function toastLock(t) {
    const d = document.createElement("div");
    d.textContent = t;
    d.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:2147483646;background:#1f3864;color:#fff;padding:10px 16px;border-radius:12px;font-size:14px;max-width:88vw;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.25);";
    document.body.appendChild(d); setTimeout(() => d.remove(), 4000);
  }
  function askSheet() {
    if (document.getElementById("mzLockAsk")) return;
    const d = document.createElement("div");
    d.id = "mzLockAsk";
    d.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center;";
    d.innerHTML = `<div style="background:#f6f0e6;color:#1f3864;width:100%;max-width:480px;border-radius:18px 18px 0 0;padding:22px 20px 28px;text-align:center;">
      <div style="font-size:40px;">🔒</div><div style="font-weight:700;font-size:18px;margin:6px 0 4px;">Set the fingerprint lock</div>
      <div style="font-size:13.5px;opacity:.85;margin-bottom:16px;">Moltrix will ask for your fingerprint every time it is opened on this phone.</div>
      <button type="button" class="mzlSet" style="border:none;border-radius:14px;padding:14px 22px;font-size:16px;font-weight:700;background:#1f3864;color:#fff;width:100%;">👆 Set fingerprint</button>
      <button type="button" class="mzlLater" style="border:none;background:transparent;color:#1f3864;margin-top:10px;font-size:13px;text-decoration:underline;">Not now</button></div>`;
    document.body.appendChild(d);
    d.querySelector(".mzlLater").addEventListener("click", () => d.remove());
    d.querySelector(".mzlSet").addEventListener("click", async () => {
      if (busy) return; busy = true;
      try { await enroll(); d.remove(); toastLock("🔒 Fingerprint lock set - Moltrix will ask for it every time it is opened."); }
      catch (e) { try { localStorage.removeItem(KEY); } catch (x) {} label(); }
      finally { busy = false; hiddenAt = 0; }
    });
  }

  async function verify() {
    const id = cred(); if (!id) return true;
    const a = await navigator.credentials.get({ publicKey: {
      challenge: rnd(32), rpId: location.hostname, timeout: 60000, userVerification: "required",
      allowCredentials: [{ type: "public-key", id: unb64(id), transports: ["internal"] }] } });
    if (!a || b64(a.rawId) !== id) throw new Error("a different key was used");
    const flags = new Uint8Array(a.response.authenticatorData)[32];
    if (!(flags & 0x04)) throw new Error("the fingerprint / screen lock was not checked");   // UV flag
    return true;
  }
  async function unlock(why) {
    if (busy || !html.classList.contains("mzLocked")) return;
    busy = true; msg("");
    LOG("fingerprint asked (" + (typeof why === "string" ? why : "tap") + ")");
    try { await verify(); html.classList.remove("mzLocked"); LOG("unlocked"); }
    catch (e) { LOG("fingerprint failed: " + ((e && (e.name + " " + e.message)) || e).slice(0, 120)); try { navigator.vibrate && navigator.vibrate(60); } catch (x) {} }      // stays blank - tap to try again
    finally { busy = false; hiddenAt = 0; }
  }
  function lock(why) {
    if (!cred()) return;
    LOG("LOCK: " + (why || "?"));
    html.classList.add("mzLocked"); msg("");
    try { document.activeElement && document.activeElement.blur(); } catch (e) {}
    if (document.visibilityState === "visible") setTimeout(() => unlock("after lock"), 250);
  }

  // when to ask: every open (page start) and after more than a minute away (a quick switch - file picker, share - doesn't ask)
  document.addEventListener("visibilitychange", () => {
    if (cred()) LOG("app " + document.visibilityState + (busy ? " (while asking)" : ""));
    if (!cred() || busy) return;
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    if (html.classList.contains("mzLocked")) { setTimeout(() => unlock("app visible, still locked"), 250); return; }
    if (hiddenAt && Date.now() - hiddenAt > GRACE) lock("away " + Math.round((Date.now() - hiddenAt) / 1000) + " s");
    hiddenAt = 0;
  });
  window.addEventListener("pageshow", e => { if (e.persisted && cred()) lock("page restored from back/forward cache"); });
  // resolves when the page is unlocked (used before a Microsoft sign-in round)
  window.mzLockWait = () => new Promise(res => {
    if (!html.classList.contains("mzLocked")) return res();
    const mo = new MutationObserver(() => { if (!html.classList.contains("mzLocked")) { mo.disconnect(); res(); } });
    mo.observe(html, { attributes: true, attributeFilter: ["class"] });
  });
  // the page is going away while open (refresh): remember the moment for the reload (see the first script in <body>)
  window.addEventListener("pagehide", () => {
    if (cred()) LOG("page left" + (html.classList.contains("mzLocked") ? " (locked)" : " (unlocked, remembered)"));
    try { if (cred() && !html.classList.contains("mzLocked") && !busy) sessionStorage.setItem("mzLockOk", String(Date.now())); } catch (e) {}
  });
  if (cred() && !window.__mzRefreshOk) {
    html.classList.add("mzLocked");
    let rec = false; try { rec = sessionStorage.getItem("mzLockRecover") === "1"; } catch (e) {}
    if (!rec) setTimeout(() => unlock("page start"), 400);
  }
  // hold the clock at the top for 2 s: the lock log (to send as a screenshot)
  (function () {
    const ck = document.getElementById("liveClock"); if (!ck) return;
    let t = 0;
    // Android: a long press on text starts "select text" (Copy / Select all bar) and cancels the touch - the clock is not selectable, and the long-press itself opens the log
    ck.style.cssText += ";user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;";
    ck.addEventListener("contextmenu", e => { e.preventDefault(); clearTimeout(t); show(); });
    ck.addEventListener("pointerdown", () => { clearTimeout(t); t = setTimeout(show, 2000); });
    ["pointerup", "pointerleave"].forEach(ev => ck.addEventListener(ev, () => clearTimeout(t)));
    window.mzShowLockLog = () => show();
    const mi = document.getElementById("navLockLogItem"); if (mi && cred()) mi.style.display = "";
    function show() {
      if (document.getElementById("mzLockLogBox")) return;
      try { window.getSelection && window.getSelection().removeAllRanges(); } catch (e) {}
      let L = []; try { L = JSON.parse(localStorage.getItem("mzLockLog") || "[]"); } catch (e) {}
      const d = document.createElement("div");
      d.id = "mzLockLogBox";
      d.style.cssText = "position:fixed;inset:0;z-index:2147483645;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px;";
      const f = ts => new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
      d.innerHTML = `<div style="background:#fff;color:#111;width:100%;max-width:520px;max-height:85vh;overflow:auto;border-radius:12px;padding:12px;font:12px/1.45 monospace;">
        <b style="font:700 15px sans-serif">🔒 Lock log (${esc0(APP_VERSION)})</b>
        <div style="margin:8px 0">${L.slice(-40).map(x => `<div>${f(x[0])} ${esc0(x[1])}${x[2] ? " " + esc0(x[2]) : ""}</div>`).join("") || "empty"}</div>
        <button type="button" id="mzLogClose" style="padding:8px 16px;border-radius:8px;border:0;background:#1f3864;color:#fff">Close</button>
        <button type="button" id="mzLogClear" style="padding:8px 16px;border-radius:8px;border:1px solid #1f3864;background:#fff;color:#1f3864">Clear</button></div>`;
      document.body.appendChild(d);
      d.querySelector("#mzLogClose").onclick = () => d.remove();
      d.querySelector("#mzLogClear").onclick = () => { try { localStorage.removeItem("mzLockLog"); } catch (e) {} d.remove(); };
    }
    function esc0(t) { return String(t == null ? "" : t).replace(/[&<>]/g, c => "&#" + c.charCodeAt(0) + ";"); }
  })();

  // ---- ☰ menu / ⋮ menu: switch on / off ----
  const btn = document.getElementById("fpLockToggle");
  function label() {
    const on = cred() ? "ON" : "OFF";
    if (btn) btn.textContent = `🔒 Fingerprint Lock: ${on}`;
    const d = document.querySelector("#navFpLockItem span:last-child"); if (d) d.textContent = `Fingerprint Lock: ${on}`;   // ☰ menu
  }
  label();
  if (btn) btn.addEventListener("click", async () => {
    if (cred()) {      // off: only after the fingerprint
      if (!confirm("Switch the fingerprint lock off? The fingerprint is needed first.")) return;
      try { busy = true; await verify(); localStorage.removeItem(KEY); html.classList.remove("mzLocked"); label(); alert("Fingerprint lock is off."); }
      catch (e) { alert("Not switched off - the fingerprint was not checked."); }
      finally { busy = false; }
      return;
    }
    if (!(await supported())) { alert("The fingerprint lock cannot work on this phone / browser (a fingerprint or screen lock must be set on the phone)."); return; }
    if (!confirm("Switch the fingerprint lock on?\n\nOn this phone Moltrix will ask for the fingerprint every time it is opened (and after more than 1 minute away). The Microsoft sign-in stays as it is (once). The fingerprint never leaves the phone.\n\nNext the phone asks for the fingerprint: a key (passkey) is saved for Moltrix, then checked once.")) return;
    try {
      busy = true;
      const c = await navigator.credentials.create({ publicKey: {
        rp: { name: "Moltrix", id: location.hostname },
        user: { id: rnd(16), name: "Moltrix lock", displayName: "Moltrix lock" },
        challenge: rnd(32), timeout: 60000, attestation: "none",
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" } } });
      if (!c) throw new Error("no key");
      localStorage.setItem(KEY, b64(c.rawId));
      await verify();                          // opens once with it, so the lock never starts with a key that doesn't work
      label();
      alert("✅ Fingerprint lock is on. Moltrix will now ask for the fingerprint every time it is opened.");
    } catch (e) {
      try { localStorage.removeItem(KEY); } catch (x) {}
      label();
      alert("Lock not switched on: " + ((e && e.name === "NotAllowedError") ? "the fingerprint was cancelled or timed out." : ((e && e.message) || e)));
    } finally { busy = false; hiddenAt = 0; }
  });
})();
