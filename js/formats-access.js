/* ===================== FORMATS ON A NEW ONEDRIVE + APP ACCESS LIST ===================== */
(function fmtAndAccess() {
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const G = "https://graph.microsoft.com/v1.0/me/drive";
  const encPath = p => p.split("/").map(encodeURIComponent).join("/");
  // blank formats kept on the website (folder "formats" next to index.html)
  const FORMAT_FILES = ["Template.xlsx", "Inward Raw Material Data.xlsx", "Debit Note Data 26-27.xlsm", "Strip_Coils_EDGE_CRACK_Data.xlsm", "Party_Wise_Test_Reports.xlsx"];

  async function pushFormats(out, when) {
    const lines = [];
    const say = t => { lines.push(t); out.textContent = lines.join("\n"); };
    const token = await getToken();
    if (!(await tryGetItem(token, "Desktop"))) {
      await graphFetch(`${G}/root/children`, token, { method: "POST", body: JSON.stringify({ name: "Desktop", folder: {}, "@microsoft.graph.conflictBehavior": "fail" }) });
      say("📁 Desktop folder made");
    }
    let made = 0;
    for (const name of FORMAT_FILES) {
      if (await tryGetItem(token, `Desktop/${name}`)) { say(`⏭️ ${name} - already on the Desktop (not changed)`); continue; }
      say(`⏳ ${name} ...`);
      const r = await fetch(`./formats/${encodeURIComponent(name)}`, { cache: "no-store" });
      if (!r.ok) { lines.pop(); say(`⚠️ ${name} - format not found on the website (${r.status})`); continue; }
      let buf = await r.arrayBuffer();
      // 2-10 crucibles: the Template gets Prod. / Strip Mill / BIS Doc sheets for each crucible (made here, on the phone / PC)
      if (name === "Template.xlsx" && xlCrus()[0]) buf = await xlBuildCruTemplate(buf, xlCrus().length);
      const up = await fetch(`${G}/root:/${encPath("Desktop/" + name)}:/content?@microsoft.graph.conflictBehavior=fail`,
        { method: "PUT", headers: { Authorization: "Bearer " + token, "Content-Type": "application/octet-stream" }, body: buf });
      lines.pop();
      if (up.ok) { say(`✅ ${name}`); made++; }
      else say(`❌ ${name} - ${up.status} ${typeof shortError === "function" ? shortError(await up.text()) : ""}`);
    }
    // this month's Reports file, made from the Template (same as "Create Next Month File")
    const now = new Date(), y = when && when.y ? when.y : now.getFullYear(), m0 = when && when.m0 != null ? when.m0 : now.getMonth();
    _filePathCache.clear();
    for (const cru of [""]) {
      const mName = xlFileName(y, m0);
      const existing = await detectFilePathForMonth(token, y, m0);
      if (existing) { say(`⏭️ ${existing} - already there (not changed)`); continue; }
      say(`⏳ ${mName} from the Template ...`);
      const tplIn = $("nmTemplatePath"), monIn = $("nmTargetMonth"), keepTpl = tplIn.value;
      let tpl = tplIn.value.trim();
      if (!tpl || !(await tryGetItem(token, tpl))) tpl = "Desktop/Template.xlsx";
      tplIn.value = tpl; monIn.value = `${y}-${String(m0 + 1).padStart(2, "0")}`;
      await createNextMonthFileFor(cru, true);
      const st = $("status");
      lines.pop();
      if (st && st.className === "ok") { say(`✅ ${mName} (made from ${tpl})${xlCrus()[0] ? ` - ${xlCrus().length} crucibles` : ""}`); made++; }
      else { say(`❌ ${mName} - ${st ? st.textContent.replace(/^Error:\s*/, "") : "not made"}`); tplIn.value = keepTpl; }
    }
    say(made ? `\nDone - ${made} file(s) put on the Desktop. The app now reads them from there.` : "\nNothing new was needed.");
    return made;
  }
  if ($("fmtPushBtn")) $("fmtPushBtn").addEventListener("click", async () => {
    const b = $("fmtPushBtn"), out = $("fmtStatus");
    const when = await xlAskCrucibles(); if (!when) return;
    b.disabled = true; out.textContent = "Starting...";
    try { await pushFormats(out, when); } catch (e) { out.textContent += "\n❌ " + e.message; } finally { b.disabled = false; }
  });
  // a new (non-owner) account without the formats: offer them once
  window.fmtFirstRunOffer = async () => {
    try {
      if (!account) return;
      const k = "fmtOffered:" + accountEmail(account);
      if (localStorage.getItem(k)) return;
      const token = await getToken();
      if (await tryGetItem(token, "Desktop/Template.xlsx")) { localStorage.setItem(k, "1"); return; }
      localStorage.setItem(k, "1");
      if (!confirm("Welcome to Moltrix!\n\nYour OneDrive does not have the Excel formats yet. Put them on your OneDrive Desktop now?\n(You can also do it later: Menu → Get Started → Put formats on the Desktop)")) return;
      const sec = document.getElementById("fileLocationMenuBtn"); if (sec) sec.click();
      const ft = document.querySelector('#getStartedSubNav [data-subgs="formats"]'); if (ft) ft.click();
      const when = await xlAskCrucibles(); if (!when) return;
      const out = $("fmtStatus"); out.textContent = "Starting...";
      await pushFormats(out, when);
    } catch (e) { console.warn("formats offer", e); }
  };

  /* ---- App access list (owner) ---- */
  // 26-Nov-2026: the same layout as the owner's live script - the key is NOT written in the code (only in Script
  // Properties), and every owner / viewer / revoke e-mail this device knows is filled in, so pasting it never drops an owner
  const emList = a => "[" + [...new Set((a || []).map(x => String(x || "").trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, "")).filter(x => x.includes("@")))].map(x => JSON.stringify(x)).join(",") + "]";
  const SCRIPT_CODE = (owners, viewers, revoke) => `// SMS Reports - secure access server.   KEEP THIS FILE PRIVATE: Apps Script only, never GitHub.
// Paste this over ALL the old code of your Apps Script, then:
//   1) Run the function  authorize  once (Run button) and accept the permissions.
//   2) Deploy > Manage deployments > pencil > Version: New version > Deploy   (the /exec link stays the same).
// ADMIN_KEY: kept ONLY in Project Settings > Script Properties (name: ADMIN_KEY) - not written in this code.
const ADMIN_KEY = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY") || "";
const OWNERS = ${emList(owners)};   // every e-mail YOU sign in with (exact sign-in e-mail). MAIN account FIRST. Add your other accounts here too.
const VIEWERS = ${emList(viewers)};                           // optional: team e-mails that may only look at reports
const REVOKE = ${emList(revoke)};                            // optional: old team e-mails whose OneDrive sharing you want to remove

function doGet() { return out_({ ok: false, error: "please update the app" }); }

function doPost(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || "");
  try {
    const me = who_(String(p.token || ""));       // Microsoft itself confirms who this is
    const role = role_(me.email);
    if (action === "whoami") {
      const r = { ok: true, role: role };
      if (role === "owner") r.cfg = { owners: lc_(OWNERS), viewers: lc_(VIEWERS), revoke: lc_(REVOKE) };
      else { const mine = list_().filter(function (x) { return x.email === me.email; })[0]; r.hide = (mine && mine.hide) || []; }   // tiles the owner hid for this account
      if (role !== "none" && (r.hide || []).indexOf("marketdash") < 0) r.dash = dash_();   // Market dashboard links - not to an account whose Market tile is hidden
      return out_(r);
    }
    if (action === "log") {
      rate_(me.email);
      sheet_().appendRow([new Date(), safe_(me.email), safe_(me.name), role, safe_(String(p.event || "").slice(0, 40)), safe_(String(p.device || "").slice(0, 120)),
        safe_(String(p.ip || "").slice(0, 45)), safe_(String(p.loc || "").slice(0, 120))]);
      return out_({ ok: true });
    }
    // everything below: owner only = the owner's Microsoft sign-in AND the admin key
    if (role !== "owner") throw new Error("owner only");
    key_(String(p.key || ""));
    const email = String(p.email || "").trim().toLowerCase();
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      let L = list_();
      if (action === "add") {
        const at = email.indexOf("@");
        if (at < 1 || email.indexOf(".", at) < 0 || email.indexOf(" ") >= 0) throw new Error("not a valid e-mail: " + email);
        if (!L.some(function (x) { return x.email === email; })) L.push({ email: email, added: new Date().toISOString() });
        save_(L);
      } else if (action === "remove") {
        L = L.filter(function (x) { return x.email !== email; });
        save_(L);
      } else if (action === "hide") {           // App Access -> gear: which tiles this account may NOT see
        let h = []; try { h = JSON.parse(String(p.hide || "[]")); } catch (x) { throw new Error("bad tile list"); }
        if (!Array.isArray(h) || h.length > 80) throw new Error("bad tile list");
        h = h.map(String).filter(function (t) { return /^[a-z0-9]{1,30}$/.test(t); });
        const it = L.filter(function (x) { return x.email === email; })[0];
        if (!it) throw new Error("not in the access list: " + email);
        it.hide = h;
        save_(L);
      } else if (action === "dash") {           // the owner's Market dashboard links (India / USA / Intraday), shared with every account
        let d = {}; try { d = JSON.parse(String(p.dash || "{}")); } catch (x) { throw new Error("bad links"); }
        const ok = {};
        ["ind", "us", "intra"].forEach(function (k) {
          const u = String(d[k] || "");
          if (!u) return;
          if (!/^https:\\/\\/script\\.google\\.com\\/macros\\/s\\/[A-Za-z0-9_-]{30,}\\/exec(\\?[A-Za-z0-9_=&.%-]*)?$/.test(u) || u.length > 400) throw new Error("not a dashboard link: " + k);
          ok[k] = u;
        });
        PropertiesService.getScriptProperties().setProperty("dash", JSON.stringify(ok));
      } else if (action !== "list") {
        throw new Error("unknown action");
      }
      return out_({ ok: true, list: L });
    } finally { lock.releaseLock(); }
  } catch (err) { return out_({ ok: false, error: String((err && err.message) || err) }); }
}

// Ask Microsoft Graph who owns this sign-in token. Work/school accounts: the UPN (its domain is proven by the
// tenant). Personal accounts: the verified mail address. Nothing the app itself says about the user is trusted.
function who_(token) {
  if (token.length < 200 || token.length > 8000) throw new Error("sign in again");
  const cache = CacheService.getScriptCache();
  const ck = "id" + sha_(token);
  const hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  const r = UrlFetchApp.fetch("https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName",
    { headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error("sign in again");
  const j = JSON.parse(r.getContentText());
  const work = token.split(".").length === 3;      // work/school tokens are JWTs, personal ones are not
  const upn = String(j.userPrincipalName || "").trim().toLowerCase();
  const mail = String(j.mail || "").trim().toLowerCase();
  const email = work ? upn : (mail || upn);
  if (!email) throw new Error("no e-mail on this account");
  const me = { email: email, name: String(j.displayName || "") };
  cache.put(ck, JSON.stringify(me), 600);
  return me;
}

function role_(email) {
  if (lc_(OWNERS).indexOf(email) >= 0) return "owner";
  if (lc_(VIEWERS).indexOf(email) >= 0) return "viewer";
  return list_().some(function (x) { return x.email === email; }) ? "user" : "none";
}

function key_(k) {
  if (!ADMIN_KEY) throw new Error("add the script property ADMIN_KEY first (Project Settings > Script Properties)");
  const c = CacheService.getScriptCache();
  const bad = parseInt(c.get("badkey") || "0", 10);
  if (bad >= 8) throw new Error("too many wrong keys - try again in 15 minutes");
  let diff = k.length ^ ADMIN_KEY.length;
  for (let i = 0; i < ADMIN_KEY.length; i++) diff |= (k.charCodeAt(i) || 0) ^ ADMIN_KEY.charCodeAt(i);
  if (diff !== 0) { c.put("badkey", String(bad + 1), 900); throw new Error("wrong key"); }
}

function rate_(email) {
  const c = CacheService.getScriptCache(), k = "rl" + sha_(email);
  const n = parseInt(c.get(k) || "0", 10);
  if (n >= 60) throw new Error("too many requests");
  c.put(k, String(n + 1), 3600);
}

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty("logSheet");
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create("SMS Reports - login log");
    props.setProperty("logSheet", ss.getId());
    ss.getSheets()[0].appendRow(["Time", "E-mail", "Name", "Role", "Event", "Device", "IP", "Location"]);
  }
  const sh = ss.getSheets()[0];
  if (sh.getRange(1, 7).getValue() === "") sh.getRange(1, 7, 1, 2).setValues([["IP", "Location"]]);   // older log sheets: add the 2 new headings
  return sh;
}

function authorize() { UrlFetchApp.fetch("https://graph.microsoft.com/v1.0/$metadata", { muteHttpExceptions: true }); sheet_(); }
// text that starts with = + - @ would become a FORMULA in Google Sheets - store it as plain text
function safe_(v) { const s = String(v == null ? "" : v).replace(/[\\r\\n\\t]+/g, " "); return /^[=+\\-@]/.test(s) ? "'" + s : s; }
function lc_(a) { return a.map(function (x) { return String(x).trim().toLowerCase(); }); }
function sha_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s).map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join(""); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function dash_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("dash") || "{}"); } catch (e) { return {}; } }
function list_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("access") || "[]"); } catch (e) { return []; } }
function save_(L) { PropertiesService.getScriptProperties().setProperty("access", JSON.stringify(L)); }
`;
  const box = $("accessBox"); if (!box) return;
  const st = $("accessStatus"), listEl = $("accessList");
  const getKey = () => {
    let k = ""; try { k = localStorage.getItem("accessKey") || ""; } catch (e) {}
    if (!k) { const a = new Uint8Array(18); crypto.getRandomValues(a); k = Array.from(a, b => b.toString(16).padStart(2, "0")).join(""); try { localStorage.setItem("accessKey", k); } catch (e) {} }
    return k;
  };
  const showSetup = () => {
    $("accessUrlInput").value = accessUrl(); $("accessKeyInput").value = getKey();
    $("accessSetupWrap").open = !accessUrl();
  };
  showSetup();
  async function call(action, email, extra) {
    if (!accessUrl()) throw new Error("First do the one-time setup above (script URL).");
    const j = await authCall(Object.assign({ action: action, key: getKey(), email: email || "" }, extra || {}));
    if (!j || !j.ok) throw new Error(j && j.error === "wrong key" ? "The key does not match the script (⚙️ Script setup / key → 🔑 Key)."
      : j && j.error === "unknown action" ? "Update the access script first: 📋 Copy script code → paste it over the old code → Deploy → New version."
      : ((j && j.error) || "no answer from the access script"));
    return j.list || [];
  }
  const T_ = s => (typeof uiT === "function" ? uiT(s) : s);
  let lastList = [];
  function draw(L) {
    lastList = L;
    const tilesN = accessTiles().length;
    listEl.innerHTML = L.length ? L.map(x => { const h = (x.hide || []).filter(t => accessTiles().some(a => a.id === t)).length;
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(128,128,128,.25);">
      <span style="flex:1;font-size:13.5px;word-break:break-all;">✅ ${esc(x.email)}<br><small style="opacity:.6;">${T_("since")} ${esc(String(x.added || "").slice(0, 10).split("-").reverse().join("-"))} · ${h ? `${tilesN - h} ${T_("of")} ${tilesN} ${T_("tiles")}` : T_("all tiles")}</small></span>
      <button class="secondary accessTiles" data-e="${esc(x.email)}" type="button" title="${T_("Tiles this account can open")}" style="width:auto;margin:0;padding:6px 10px;font-size:15px;">⚙️</button>
      <button class="secondary accessRevoke" data-e="${esc(x.email)}" type="button" style="width:auto;margin:0;padding:6px 10px;font-size:12.5px;">${T_("🚫 Remove")}</button></div>`; }).join("")
      : '<div style="font-size:12.5px;opacity:.7;">' + T_("No one else has access.") + '</div>';
  }
  // ⚙️ per account: tick the tiles / functions it may open (26-Nov-2026)
  function tilesDialog(em) {
    const it = lastList.find(x => x.email === em) || {}, hide = new Set(it.hide || []);
    document.getElementById("accTilesBox")?.remove();
    const box = document.createElement("div");
    box.id = "accTilesBox";
    box.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:14px;";
    box.innerHTML = `<div style="background:var(--card,#fffaf2);color:var(--ink,#16233d);border-radius:14px;padding:16px;max-width:460px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.35);">
      <div style="font-weight:700;font-size:15px;">⚙️ ${esc(em)}</div>
      <div style="display:flex;gap:8px;margin:10px 0 6px;"><button type="button" class="secondary" id="accTilesAll" style="width:auto;margin:0;padding:5px 10px;font-size:12.5px;">${T_("✅ All")}</button>
        <button type="button" class="secondary" id="accTilesNone" style="width:auto;margin:0;padding:5px 10px;font-size:12.5px;">${T_("⬜ None")}</button></div>
      <div id="accTilesList" style="overflow:auto;flex:1;border-top:1px solid rgba(128,128,128,.25);">${accessTiles().map(t => `
        <label style="display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid rgba(128,128,128,.18);font-size:14px;cursor:pointer;">
          <input type="checkbox" data-t="${esc(t.id)}" ${hide.has(t.id) ? "" : "checked"} style="width:auto;margin:0;transform:scale(1.15);"> <span>${esc(T_(t.label))}</span></label>`).join("")}</div>
      <div id="accTilesMsg" style="font-size:12.5px;min-height:18px;margin-top:8px;"></div>
      <div style="display:flex;gap:8px;margin-top:6px;"><button type="button" class="primary" id="accTilesSave" style="flex:1;margin:0;">${T_("💾 Save")}</button>
        <button type="button" class="secondary" id="accTilesClose" style="flex:1;margin:0;">${T_("Close")}</button></div></div>`;
    document.body.appendChild(box);
    const boxes = () => [...box.querySelectorAll("input[data-t]")];
    box.addEventListener("click", async e => {
      if (e.target === box || e.target.id === "accTilesClose") { box.remove(); return; }
      if (e.target.id === "accTilesAll") boxes().forEach(c => { c.checked = true; });
      if (e.target.id === "accTilesNone") boxes().forEach(c => { c.checked = false; });
      if (e.target.id === "accTilesSave") {
        const h = boxes().filter(c => !c.checked).map(c => c.dataset.t), msg = box.querySelector("#accTilesMsg");
        e.target.disabled = true; msg.textContent = T_("Saving...");
        try { draw(await call("hide", em, { hide: JSON.stringify(h) })); msg.textContent = uiLang() === "hi" ? T_("✅ Saved - it applies the next time this account opens the app.") + " (" + em + ")" : "✅ Saved - it applies the next time " + em + " opens the app."; }
        catch (x) { msg.textContent = "⚠️ " + x.message; } finally { e.target.disabled = false; }
      }
    });
  }
  async function refresh() { if (!accessUrl()) { listEl.innerHTML = ""; return; } try { draw(await call("list")); st.textContent = ""; } catch (e) { st.textContent = "⚠️ " + e.message; } }
  $("accessCopyCode").addEventListener("click", async () => {
    const me = accountEmail(account), owners = [me].concat(ALLOWED_EMAILS.filter(x => x !== me));
    const code = SCRIPT_CODE(owners, VIEWER_EMAILS, TEAM_REVOKE_EMAILS);
    try { await navigator.clipboard.writeText(code); st.textContent = "✅ Script code copied (owners: " + owners.join(", ") + ") - paste it over the code of your Apps Script, then Deploy → New version. " +
      "The key stays in Project Settings → Script Properties → ADMIN_KEY" + (getKey() ? " (the key saved on this device: " + getKey() + ")" : "") + "."; }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = code; ta.style.cssText = "width:100%;height:160px;font-size:11px;";
      st.textContent = "Copy this code:"; st.after(ta); ta.select();
    }
  });
  $("accessSaveUrl").addEventListener("click", async () => {
    const u = $("accessUrlInput").value.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(u)) { st.textContent = "⚠️ Paste the Web app URL - it ends with /exec"; return; }
    try { localStorage.setItem("accessUrl", u); } catch (e) {}
    st.textContent = "Checking..."; await refresh(); if (!/⚠️/.test(st.textContent)) st.textContent = "✅ Connected.";
  });
  $("accessSaveKey").addEventListener("click", async () => {
    const k = $("accessKeyInput").value.trim();
    if (!/^[0-9a-f]{20,}$/i.test(k)) { st.textContent = "⚠️ The key is the long code saved in the script's Project Settings → Script Properties → ADMIN_KEY."; return; }
    try { localStorage.setItem("accessKey", k); } catch (e) {}
    st.textContent = "Checking..."; await refresh(); if (!/⚠️/.test(st.textContent)) st.textContent = "✅ Key saved.";
  });
  $("accessAddBtn").addEventListener("click", async () => {
    const em = $("accessEmail").value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { st.textContent = "⚠️ Type a full e-mail address."; return; }
    if (ALLOWED_EMAILS.includes(em)) { st.textContent = "That is one of your own accounts - it always has access."; return; }
    const b = $("accessAddBtn"); b.disabled = true; st.textContent = "Giving access...";
    try { draw(await call("add", em)); $("accessEmail").value = ""; st.textContent = `✅ ${em} can now sign in.`; }
    catch (e) { st.textContent = "⚠️ " + e.message; } finally { b.disabled = false; }
  });
  listEl.addEventListener("click", async e => {
    const tb = e.target.closest(".accessTiles"); if (tb) { tilesDialog(tb.dataset.e); return; }
    const b = e.target.closest(".accessRevoke"); if (!b) return;
    const em = b.dataset.e;
    if (!confirm(`Remove access for ${em}?\nThey are signed out the next time the app opens or checks.`)) return;
    b.disabled = true; st.textContent = "Removing...";
    try { draw(await call("remove", em)); st.textContent = `🚫 ${em} removed.`; } catch (x) { st.textContent = "⚠️ " + x.message; b.disabled = false; }
  });
  const waBtn = $("waGuideSettingsBtn"), waInfo = $("waGuideInfo");
  const waShow = () => { try { const u = localStorage.getItem("waInboxUrl"); waInfo.textContent = u ? "✅ Inbox set: " + u.replace(/^https:\/\/script\.google\.com\/macros\/s\/(.{6}).*(.{6})\/exec$/, "…$1…$2/exec") : "Not set up on this phone yet."; } catch (e) {} };
  if (waBtn) waBtn.addEventListener("click", () => { if (typeof waInboxEditSettings === "function") waInboxEditSettings(); waShow(); });
  if ($("fileLocationMenuBtn")) $("fileLocationMenuBtn").addEventListener("click", waShow);
  const flBtn = $("fileLocationMenuBtn");
  if (flBtn) flBtn.addEventListener("click", () => { if (account && accountRole(account) === "owner") { showSetup(); refresh(); } });
})();
