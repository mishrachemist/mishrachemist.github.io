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
  const SCRIPT_CODE = (key, owner) => `// Moltrix (SMS Reports) - secure access server.   KEEP THIS PRIVATE: Apps Script only, never GitHub.
// Paste over ALL the old code of your script. Then: 1) Run the function  authorize  once and accept the permissions.
// 2) Deploy > Manage deployments > pencil > Version: New version > Deploy   (the /exec link stays the same).
// ADMIN_KEY: Project Settings > Script Properties > ADMIN_KEY wins; the key below is only used until you add it there.
const ADMIN_KEY = PropertiesService.getScriptProperties().getProperty("ADMIN_KEY") || "${key}";      // the long code you already use (app: Script setup / key)
const OWNERS = ["${String(owner || "").replace(/[^a-z0-9@._+-]/gi, "")}"];         // every e-mail YOU sign in with (exact sign-in e-mail). MAIN account FIRST.
const VIEWERS = [];                           // optional: team e-mails that may only look at reports
const REVOKE = [];                            // optional: old team e-mails whose OneDrive sharing you want to remove

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
  if (!ADMIN_KEY || ADMIN_KEY.indexOf("PASTE") === 0) throw new Error("set ADMIN_KEY in the script first");
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
  async function call(action, email) {
    if (!accessUrl()) throw new Error("First do the one-time setup above (script URL).");
    const j = await authCall({ action: action, key: getKey(), email: email || "" });
    if (!j || !j.ok) throw new Error(j && j.error === "wrong key" ? "The key does not match the script (⚙️ Script setup / key → 🔑 Key)." : ((j && j.error) || "no answer from the access script"));
    return j.list || [];
  }
  function draw(L) {
    listEl.innerHTML = L.length ? L.map(x => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(128,128,128,.25);">
      <span style="flex:1;font-size:13.5px;word-break:break-all;">✅ ${esc(x.email)}<br><small style="opacity:.6;">since ${esc(String(x.added || "").slice(0, 10).split("-").reverse().join("-"))}</small></span>
      <button class="secondary accessRevoke" data-e="${esc(x.email)}" type="button" style="width:auto;margin:0;padding:6px 10px;font-size:12.5px;">🚫 Remove</button></div>`).join("")
      : '<div style="font-size:12.5px;opacity:.7;">No one else has access.</div>';
  }
  async function refresh() { if (!accessUrl()) { listEl.innerHTML = ""; return; } try { draw(await call("list")); st.textContent = ""; } catch (e) { st.textContent = "⚠️ " + e.message; } }
  $("accessCopyCode").addEventListener("click", async () => {
    const code = SCRIPT_CODE(getKey(), accountEmail(account));
    try { await navigator.clipboard.writeText(code); st.textContent = "✅ Script code copied - paste it over the code of your Apps Script, run authorize once, then Deploy → New version."; }
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
    if (!/^[0-9a-f]{20,}$/i.test(k)) { st.textContent = "⚠️ The key is the long code after ADMIN_KEY = in the script."; return; }
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
