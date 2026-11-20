/* ===================== MIRROR: every Excel entry also in another account's OneDrive =====================
   Switch Account → "Every entry also in". The other account must be signed in on this device once (Switch Account
   → Sign in with another account). After each successful write to YOUR file (Excel workbook writes, $batch writes,
   "Create Next Month File" copy) the same request is sent - in the same order - to the file with the same path in
   the other account's OneDrive, with that account's own sign-in. Item ids are matched by file path. Reading stays
   on your own files. App settings (app folder) are never mirrored. Failed ones are kept and can be sent again. ===== */
(function mirrorEntries() {
  const KEY = "mirrorCfg", G = "https://graph.microsoft.com/v1.0";
  const $ = id => document.getElementById(id);
  const cfg = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } };
  const saveCfg = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} };
  const accs = () => { try { return msalInstance.getAllAccounts() || []; } catch (e) { return []; } };
  const active = () => {   // only while signed in as the account that turned it on (never mirrors back from the colleague)
    const c = cfg(); if (!c || !c.on || typeof account === "undefined" || !account || account.homeAccountId !== c.primary) return null;
    const t = accs().find(a => a.homeAccountId === c.target); return t ? { c, t } : null;
  };
  const idPath = new Map();      // your item id -> path ("Desktop/MIPPL/...")
  const theirId = new Map();     // path -> their item id
  let chain = Promise.resolve(), pending = 0, done = 0;
  const failed = [];             // { url, method, body, why }

  const isWrite = m => m !== "GET" && m !== "HEAD";
  const pathFromUrl = u => { const m = /\/me\/drive\/root:\/([^:?]+)(?::|$|\?)/.exec(u); if (!m) return null; try { return m[1].split("/").map(decodeURIComponent).join("/"); } catch (e) { return null; } };
  const isAppFolder = u => /\/me\/drive\/special\//.test(u);
  const mirrorable = (u, method, body) => {
    if (!/^https:\/\/graph\.microsoft\.com\//i.test(u) || isAppFolder(u)) return false;
    const p = u.split("?")[0];
    if (/\/\$batch$/.test(p)) { try { return (JSON.parse(body).requests || []).some(r => isWrite(String(r.method || "GET").toUpperCase()) && /\/workbook\//.test(r.url || "")); } catch (e) { return false; } }
    if (!isWrite(method)) return false;
    if (/\/workbook\/(createSession|closeSession|refreshSession)$/.test(p)) return false;
    return /\/me\/drive\/items\/[^/]+\/(workbook\/|copy$)/.test(p);
  };

  async function theirToken(t) {
    try { return (await msalInstance.acquireTokenSilent({ scopes: graphScopes, account: t })).accessToken; }
    catch (e) { throw new Error(`${t.username}: sign-in expired - Switch Account → sign in with that account once, then come back`); }
  }
  async function pathOfMyId(f, id, myAuth) {
    if (idPath.has(id)) return idPath.get(id);
    const r = await f(`${G}/me/drive/items/${id}?$select=name,parentReference`, { headers: { Authorization: myAuth } });
    if (!r.ok) throw new Error("your file's path could not be read (" + r.status + ")");
    const j = await r.json();
    if (!j || !j.name || !j.parentReference || typeof j.parentReference.path !== "string") throw new Error("your file's path could not be read");
    let pp = j.parentReference.path.replace(/^\/drive\/root:?\/?/, ""); try { pp = decodeURIComponent(pp); } catch (e) {}
    const path = (pp ? pp + "/" : "") + j.name; idPath.set(id, path); return path;
  }
  // their copy of a file: first the same path; if it is kept in another folder there (e.g. not inside
  // "Reports 26-27"), the file with the same NAME is found by search (the one in the same-named folder, else under MIPPL).
  const theirWhere = new Map();   // your path -> their path (shown in the settings)
  async function searchByName(f, path, tok) {
    const name = path.split("/").pop(), parent = (path.split("/").slice(-2, -1)[0] || "").toLowerCase();
    const q = encodeURIComponent(name.replace(/'/g, "''"));
    const r = await f(`${G}/me/drive/root/search(q='${q}')?$select=id,name,parentReference,folder,file&$top=50`, { headers: { Authorization: "Bearer " + tok }, mirror: true });
    if (!r.ok) return null;
    const j = await r.json();
    const hits = (j.value || []).filter(x => String(x.name || "").toLowerCase() === name.toLowerCase());   // exact same name only
    if (!hits.length) return null;
    const pathOf = x => { let pp = String((x.parentReference && x.parentReference.path) || "").replace(/^\/drive\/root:?\/?/, ""); try { pp = decodeURIComponent(pp); } catch (e) {} return (pp ? pp + "/" : "") + x.name; };
    const score = x => { const p = pathOf(x).toLowerCase(), segs = p.split("/"); return (segs[segs.length - 2] === parent ? 4 : 0) + (p.indexOf("production sheet") >= 0 ? 2 : 0) + (p.indexOf("mippl") >= 0 ? 1 : 0); };
    hits.sort((a, b) => score(b) - score(a));
    return { id: hits[0].id, path: pathOf(hits[0]) };
  }
  async function theirIdOf(f, path, tok) {
    if (theirId.has(path)) return theirId.get(path);
    for (let k = 0; k < 6; k++) {      // a file just copied ("next month") may need a few seconds to appear
      const r = await f(`${G}/me/drive/root:/${path.split("/").map(encodeURIComponent).join("/")}`, { headers: { Authorization: "Bearer " + tok }, mirror: true });
      if (r.ok) { const j = await r.json(); theirId.set(path, j.id); theirWhere.set(path, path); return j.id; }
      if (r.status !== 404) throw new Error(`their "${path}" could not be opened (${r.status})`);
      const hit = await searchByName(f, path, tok);
      if (hit) { theirId.set(path, hit.id); theirWhere.set(path, hit.path); return hit.id; }
      await new Promise(res => setTimeout(res, 3000));
    }
    throw new Error(`"${path.split("/").pop()}" is not in their OneDrive (looked at ${path} and searched by name)`);
  }
  async function mapIds(f, text, myAuth, tok) {   // every /me/drive/items/<id> in a url/body -> their id
    const ids = [...new Set((text.match(/\/me\/drive\/items\/([A-Za-z0-9!._-]+)/g) || []).map(x => x.split("/").pop()))];
    for (const id of ids) { const their = await theirIdOf(f, await pathOfMyId(f, id, myAuth), tok); text = text.split("/me/drive/items/" + id).join("/me/drive/items/" + their); }
    return text;
  }
  async function send(f, job) {
    const a = active(); if (!a) throw new Error("mirror is off");
    const tok = await theirToken(a.t);
    let url = await mapIds(f, job.url, job.myAuth, tok), body = job.body;
    if (typeof body === "string") {
      if (/\/\$batch$/.test(url.split("?")[0])) body = await mapIds(f, body, job.myAuth, tok);
      if (/\/copy$/.test(url.split("?")[0])) {   // Create Next Month File: their template -> their folder
        const j = JSON.parse(body);
        if (j.parentReference && j.parentReference.id) j.parentReference.id = await theirIdOf(f, await pathOfMyId(f, j.parentReference.id, job.myAuth), tok);
        body = JSON.stringify(j);
      }
    }
    const r = await f(url, { method: job.method, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body });
    if (!r.ok && r.status !== 202) throw new Error(`their file answered ${r.status}: ${(await r.text()).slice(0, 140)}`);
    if (/\/\$batch$/.test(url.split("?")[0])) {
      const j = await r.json().catch(() => null), bad = j && (j.responses || []).find(x => x.status >= 400);
      if (bad) throw new Error(`their file refused a write (${bad.status})`);
    }
  }
  function queue(f, job) {
    pending++; chip();
    chain = chain.then(() => send(f, job).then(() => { done++; }).catch(e => { job.why = e.message; failed.push(job); }))
      .finally(() => { pending--; chip(); });
  }
  window.__mirrorWrap = function (f, input, init) {
    window.__mirrorF = f;   // the plain fetch: mirror requests must never be mirrored again
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = String((init && init.method) || "GET").toUpperCase();
    const g = /^https:\/\/graph\.microsoft\.com\//i.test(url), a = g ? active() : null;
    const p = f.call(window, input, init);
    if (!g) return p;
    const hdr = (init && init.headers) || {}, myAuth = hdr.Authorization || hdr.authorization || "";
    const myCall = !/THEIR_MIRROR/.test(myAuth);
    return p.then(res => {
      try {   // remember which file id is which path (also before the mirror is turned on)
        if (res.ok && method === "GET" && pathFromUrl(url) && !/:\/(content|workbook)/.test(url) && myCall && !(init && init.mirror)) res.clone().json().then(j => { if (j && j.id && !idPath.has(j.id)) idPath.set(j.id, pathFromUrl(url)); }).catch(() => {});
        if (!a) return res;
        if ((res.ok || res.status === 202) && mirrorable(url, method, init && init.body))
          queue(f, { url, method, body: init && init.body, myAuth });
      } catch (e) {}
      return res;
    });
  };

  // ---- status chip + settings ----
  function chip() {
    const a = active(); let c = $("mirrorChip");
    if (!a) { if (c) c.remove(); return; }
    if (!c) { c = document.createElement("button"); c.id = "mirrorChip"; c.type = "button"; c.addEventListener("click", () => window.openSwitchAccount && window.openSwitchAccount()); document.body.appendChild(c); }
    const who = (a.t.name || a.t.username).split(" ")[0];
    c.classList.toggle("bad", failed.length > 0);
    c.textContent = failed.length ? `🪞 ${failed.length} not copied to ${who} - tap` : pending ? `🪞 copying to ${who}… (${pending})` : `🪞 + ${who}`;
    info();
  }
  function info() {
    const el = $("mirrorInfo"); if (!el) return;
    const a = active(), c = cfg();
    $("mirrorRetryRow").classList.toggle("hidden", !failed.length);
    if (!c || !c.on) { el.textContent = "Off."; return; }
    if (!a) { el.textContent = typeof account !== "undefined" && account && account.homeAccountId !== c.primary ? "Paused - you are signed in with another account (mirror works from the account that turned it on)." : "⚠️ The other account is not signed in on this device."; return; }
    const where = [...theirWhere.entries()].filter(([m, t]) => m !== t).map(([m, t]) => `${htmlEsc(m.split("/").pop())} → their ${htmlEsc(t)}`);
    el.innerHTML = `✅ On → <b>${htmlEsc(a.t.username)}</b>. Copied this session: ${done}` + (pending ? `, waiting: ${pending}` : "") +
      (where.length ? `<br><span style="font-size:11.5px;opacity:.85;">📁 ${where.join("<br>📁 ")}</span>` : "") +
      (failed.length ? `<br>⚠️ Not copied: ${failed.length} - last reason: ${htmlEsc(failed[failed.length - 1].why || "")}` : "");
  }
  function fill() {
    const sel = $("mirrorAcc"); if (!sel) return;
    const c = cfg(), cur = typeof account !== "undefined" && account ? account.homeAccountId : "";
    const others = accs().filter(a => a.homeAccountId !== cur);
    sel.innerHTML = others.length ? others.map(a => `<option value="${htmlEsc(a.homeAccountId)}"${c && c.target === a.homeAccountId ? " selected" : ""}>${htmlEsc((a.name ? a.name + " - " : "") + a.username)}</option>`).join("")
      : `<option value="">(sign in with the other account first - button above)</option>`;
    $("mirrorOn").checked = !!(c && c.on && c.primary === cur);
    $("mirrorOn").disabled = !others.length;
    info();
  }
  async function turnOn() {
    const sel = $("mirrorAcc"), t = accs().find(a => a.homeAccountId === sel.value);
    if (!t) { $("mirrorOn").checked = false; return; }
    $("mirrorInfo").textContent = "Checking " + t.username + "…";
    try {
      const tok = await theirToken(t), now = new Date();
      const myTok = await getToken(), path = await detectFilePathForMonth(myTok, now.getFullYear(), now.getMonth());
      let note = "";
      if (path) {
        const r = await fetch(`${G}/me/drive/root:/${path.split("/").map(encodeURIComponent).join("/")}`, { headers: { Authorization: "Bearer " + tok }, mirror: true });
        const hit = r.ok ? null : await searchByName(window.__mirrorF || fetch.bind(window), path, tok);
        note = r.ok ? `✅ "${path.split("/").pop()}" found in ${t.username}'s OneDrive.` : hit ? `✅ "${path.split("/").pop()}" found in ${t.username}'s OneDrive at ${hit.path}.` : `⚠️ "${path.split("/").pop()}" is NOT in ${t.username}'s OneDrive - entries for it will fail.`;
      }
      if (!confirm(`From now on every entry is also written in ${t.username}'s OneDrive (same files, same cells).\n\n${note}\n\nTurn on?`)) { $("mirrorOn").checked = false; info(); return; }
      saveCfg({ on: true, primary: account.homeAccountId, target: t.homeAccountId, user: t.username, at: Date.now() });
      theirId.clear(); chip(); fill();
    } catch (e) { $("mirrorOn").checked = false; $("mirrorInfo").textContent = "⚠️ " + e.message; }
  }
  document.addEventListener("change", e => {
    if (e.target && e.target.id === "mirrorOn") { if (e.target.checked) turnOn(); else { const c = cfg() || {}; c.on = false; saveCfg(c); chip(); fill(); } }
    if (e.target && e.target.id === "mirrorAcc") { const c = cfg(); if (c && c.on) { c.target = e.target.value; c.user = (accs().find(a => a.homeAccountId === c.target) || {}).username; saveCfg(c); theirId.clear(); chip(); fill(); } }
  });
  if ($("mirrorRetryBtn")) $("mirrorRetryBtn").addEventListener("click", () => {
    const list = failed.splice(0); chip();
    if (!window.__mirrorF) return; getToken().then(t => list.forEach(j => { j.myAuth = "Bearer " + t; queue(window.__mirrorF, j); }));
  });
  window.addEventListener("beforeunload", e => { if (pending > 0) { e.preventDefault(); e.returnValue = "Entries are still being copied to the other account."; } });
  const open0 = window.openSwitchAccount;
  window.openSwitchAccount = () => { if (open0) open0(); fill(); };
  setTimeout(chip, 3000); setInterval(chip, 15000);
  window._mirrorTest = { idPath, theirId, failed, state: () => ({ pending, done, failed: failed.length }) };
})();
