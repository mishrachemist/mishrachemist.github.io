/* Moltrix → Lighthouse ERP filler  (loaded by the "Moltrix ERP" bookmark on the ERP page)
   1. Bookmark loads this file on the ERP page and shows a small panel.
   2. "Open Moltrix" opens Moltrix (already signed in to OneDrive); there you pick the
      date and press "Send to ERP". Moltrix sends the ERP Entry Sheet here with postMessage.
   3. Tick the heats and press Start. For every heat the filler creates a Production Entry
      (series Q2) through the ERP's own screens, fills the billet lines and the RM
      consumption, and saves it (Unapproved). Every value is read back and checked
      before saving; a heat with any problem is NOT saved and is reported.
   Modes:  full – billets + ONE RM line of 0.001 MT, of the first RM item with SMS1 stock (the ERP refuses a
                  Production Entry without an RM line); the rest of the consumption goes in with cons mode
           prod – billets only (only works if the ERP admin makes RM consumption optional)
           cons – open the heat's saved voucher and add the RM lines that are missing
                  (also the quantity still lacking for items entered as 0.001 MT placeholder).
           qc   – Production QC (series 2G, HEAT WISE ANALYSIS): one entry per heat on the heat's
                  first billet line, the BIS Doc Final row (C Mn P S Si N S+P CE, Bend, Camber,
                  Length, Width, Freedom From Defects, Grade if asked), QC Time = heat date
                  10:00 (shift A), every test Pass. Needs the production voucher approved (only
                  approved vouchers are in the ERP's Batch No. list). Start on Production QC.
           m2m  – Material to Material Transfer (series BL), one voucher per heat and length for the hot charging (R)
                  billets: SMS2 (F03..) -> BLRM (R06.., division RM), Dept QAD03, Cost INDF1, qty MT, Batch / Ref
                  No d/m/nR, voucher date = heat date. Trial box = fill one heat, don't save. Start on M2M.   */
(() => {
  "use strict";
  const VERSION = "2026.11.14.22";
  const APP_ORIGIN = "https://mishrachemist.github.io";
  const APP_URL = APP_ORIGIN + "/?erpbridge=1";
  const DONE_KEY = "moltrixErpDone";   // date|heat -> voucher no (this browser only)
  const QC_DONE_KEY = "moltrixErpQcDone"; // date|heat -> Production QC voucher no
  const APPROVE_DONE_KEY = "moltrixErpApproved"; // date|heat -> production voucher no approved from here
  const QC_NOEDIT_KEY = "moltrixErpQcNoEdit"; // set when the ERP refused Edit on a saved QC (no rights) - saved QCs then aren't ticked by themselves
  const QC_LEFT_KEY = "moltrixErpQcLeft"; // date|heat -> tests not entered yet in that QC (tried again on the next run)
  const PLACEHOLDER_MT = 0.001;   // used only when NO RM line could be entered in full: the ERP needs one RM line to save
  if (window.MZF && window.MZF.busy) { window.MZF.show(); return; }
  // a panel left by an older erpfill (bookmark tapped again without reloading the page) would keep running the old code
  { const old = document.getElementById("mzfPanel"); if (old && old.dataset.v !== VERSION) old.remove(); }

  /* ================= helpers ================= */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const vis = e => !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length));
  const txt = e => (e && e.innerText || "").replace(/\s+/g, " ").trim();
  let STOP = false;
  const chk = () => { if (STOP) throw new Error("Stopped by user"); };
  // Chrome freezes the page while the phone screen is off / locked; the time it was frozen is not counted, so a
  // wait just carries on when the screen comes back instead of timing out
  let FROZEN = 0;
  async function waitFor(fn, ms = 15000, what = "") {
    let used = 0, last = Date.now();
    while (used < ms) {
      chk(); let v; try { v = fn(); } catch (e) { if (/^ERP said/.test(e.message)) throw e; v = null; } if (v) return v;
      await sleep(150);
      const now = Date.now(), gap = now - last; last = now;
      if (gap > 4000) { FROZEN += gap; try { log(`   (page was paused ${Math.round(gap / 1000)} s - screen off / phone locked; carrying on)`, "h"); } catch (e) {} } else used += gap;
    }
    const a = alertBox();
    if (a && /TypeError|Cannot read propert|of (null|undefined)/i.test(a.text))   // the ERP's own script broke - its login session is half restored
      throw new Error(`ERP ki apni script mein galti (${a.text.replace(/Know More.*$/i, "").replace(/^\s*Information\s*/i, "").replace(/\s*OK\s*$/, "").slice(0, 120)}) while waiting for ${what || "the ERP"}`);
    throw new Error("Timed out waiting for " + (what || "the ERP") + (a ? ` (ERP message: ${a.text.replace(/Know More.*$/i, "").slice(0, 160)})` : ""));
  }
  let DEBUG = false, dbgT = Date.now();
  const dbg = m => { if (!DEBUG) return; const t = Date.now(); console.log(`[MZF +${((t - dbgT) / 1000).toFixed(1)}s] ${m}`); dbgT = t; };
  const mouse = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  const click = el => { mouse(el, "mousedown"); mouse(el, "mouseup"); mouse(el, "click"); };
  const keyEv = (el, k) => { const kc = { Tab: 9, Enter: 13 }[k] || 0;
    ["keydown", "keyup"].forEach(t => el.dispatchEvent(new KeyboardEvent(t, { key: k, code: k, keyCode: kc, which: kc, bubbles: true, cancelable: true }))); };
  const setIn = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  const setTa = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
  async function typeInto(inp, v, wait = 350) {
    inp.focus(); (inp.tagName === "TEXTAREA" ? setTa : setIn).call(inp, String(v));
    inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true }));
    keyEv(inp, "Tab");
    inp.dispatchEvent(new FocusEvent("blur", { bubbles: true })); inp.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); inp.blur();
    await sleep(wait);
  }
  // a date typed key by key the way a person does it ("30/11/26"), then a tap somewhere else on the page - the ERP's own
  // date code then turns it into "30-Nov-2026". A value put in all at once is shown but not taken (the item kept today's
  // date, Default Details Ok gave "G_YRBEGDATE", Save gave "Problem in Approval")
  // The ERP reads a typed date when the field gets "blur" or "change" (focusout / Enter / a tap do nothing). With only the
  // text put in, it fell back to today - so it also wants what the keyboard sends while typing. Tried in turn:
  async function typeDateLikeHand(inp, str, how) {
    const setter = (inp.tagName === "TEXTAREA" ? setTa : setIn), host = inp.closest("ion-input");
    click(inp); inp.focus(); await sleep(150);
    setter.call(inp, ""); inp.dispatchEvent(new Event("input", { bubbles: true }));
    const kc = ch => /\d/.test(ch) ? 48 + +ch : ch === "/" ? 191 : ch === "-" ? 189 : ch.toUpperCase().charCodeAt(0);
    const key = (t, ch) => inp.dispatchEvent(new KeyboardEvent(t, how.android
      ? { key: "Unidentified", keyCode: 229, which: 229, bubbles: true, cancelable: true }
      : { key: ch, code: /\d/.test(ch) ? "Digit" + ch : "", keyCode: kc(ch), which: kc(ch), charCode: t === "keypress" ? ch.charCodeAt(0) : 0, bubbles: true, cancelable: true }));
    for (const ch of str) {
      if (how.keys) { key("keydown", ch); if (!how.android) key("keypress", ch); }
      setter.call(inp, inp.value + ch);
      try { inp.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" })); } catch (e) { inp.dispatchEvent(new Event("input", { bubbles: true })); }
      if (how.keys) key("keyup", ch);
      await sleep(80);
    }
    if (host && host.value !== inp.value) try { host.value = inp.value; } catch (e) {}
    await sleep(250);
    inp.dispatchEvent(new FocusEvent(how.end || "blur"));   // "blur" is what the ERP listens to
    if (how.end === "change") inp.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(1200);
  }
  // text typed letter by letter with key events, then blur (a value put in all at once is shown but may not be taken)
  async function typeTextLikeHand(inp, str) {
    const setter = (inp.tagName === "TEXTAREA" ? setTa : setIn);
    click(inp); inp.focus(); await sleep(150);
    setter.call(inp, ""); inp.dispatchEvent(new Event("input", { bubbles: true }));
    for (const ch of String(str)) {
      const kc = ch.toUpperCase().charCodeAt(0), o = { key: ch, keyCode: kc, which: kc, bubbles: true, cancelable: true };
      inp.dispatchEvent(new KeyboardEvent("keydown", o)); inp.dispatchEvent(new KeyboardEvent("keypress", Object.assign({}, o, { charCode: ch.charCodeAt(0) })));
      setter.call(inp, inp.value + ch);
      try { inp.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" })); } catch (e) { inp.dispatchEvent(new Event("input", { bubbles: true })); }
      inp.dispatchEvent(new KeyboardEvent("keyup", o));
      await sleep(40);
    }
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    inp.dispatchEvent(new FocusEvent("blur")); inp.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await sleep(600);
  }
  const dateOk = (inp, dmy) => dmyOf(String(inp.value || "").trim()) === dmy;   // only once the ERP itself made it "30-Nov-2026"
  // every element, shadow roots included (a date picker may be a web component)
  function deepAll(root = document) {
    const out = [], walk = r => { for (const e of r.querySelectorAll("*")) { out.push(e); if (e.shadowRoot) walk(e.shadowRoot); } };
    walk(root); return out;
  }
  const dTxt = e => (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim();
  // pick the date from the field's calendar - taps work where typed text isn't read (14-Nov: typed dates in the app were
  // shown but not taken by the ERP -> "Problem in Approval" on Save)
  async function pickFromCalendar(inp, dmy) {
    const [d, m, y] = dmy.split("-").map(Number);
    const MN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    let w = inp, icon = null;
    for (let k = 0; k < 5 && w && !icon; k++, w = w.parentElement)
      icon = [...w.querySelectorAll("ion-icon, i, img, svg, button, span")].filter(e => vis(e) && !/close|clear|times/i.test((e.getAttribute("name") || "") + " " + (e.getAttribute("class") || "")))
        .find(e => /calendar|date|event/i.test((e.getAttribute("name") || "") + " " + (e.getAttribute("class") || "") + " " + (e.getAttribute("src") || "") + " " + (e.getAttribute("aria-label") || "")));
    if (!icon) return "no calendar icon next to the field";
    const before = new Set(deepAll().filter(vis));
    click(icon.closest("ion-button, button") || icon); await sleep(1300);
    const fresh = deepAll().filter(e => vis(e) && !before.has(e) && !(e.closest && e.closest("#mzfPanel")));
    if (!fresh.length) return `the calendar didn't open - tapped <${icon.tagName.toLowerCase()} ${(icon.getAttribute("name") || icon.getAttribute("class") || "").slice(0, 40)}>`;
    const pop = fresh.reduce((a, b) => (b.querySelectorAll("*").length > a.querySelectorAll("*").length ? b : a));
    const head = () => { const t = dTxt(pop).toLowerCase(), mm = MN.findIndex(x => new RegExp("\\b" + x).test(t)), yr = (t.match(/\b(20\d\d)\b/) || [])[1]; return { mm: mm + 1, yr: +yr }; };
    const navNext = () => [...pop.querySelectorAll("*")].filter(vis).find(e => /next|forward|right/i.test((e.getAttribute("name") || "") + " " + (e.getAttribute("class") || "") + " " + (e.getAttribute("aria-label") || "")) || /^[>›»]$/.test(dTxt(e)));
    for (let k = 0; k < 12; k++) { const h = head(); if (h.mm === m && h.yr === y) break; const n = navNext(); if (!n) break; click(n.closest("button, ion-button") || n); await sleep(500); }
    const h = head();
    if (!(h.mm === m && h.yr === y)) { const info = `calendar shows "${dTxt(pop).slice(0, 80)}"`; document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return info; }
    const bad = e => { let x = e; for (let k = 0; k < 3 && x; k++, x = x.parentElement) if (/disabled|other-month|outside|adjacent|not-current|unavailable/i.test(x.getAttribute("class") || "") || x.getAttribute("aria-disabled") === "true") return true; return false; };
    const day = [...pop.querySelectorAll("*")].concat(pop.shadowRoot ? deepAll(pop.shadowRoot) : []).filter(e => vis(e) && dTxt(e) === String(d) && e.querySelectorAll("*").length < 3 && !bad(e))[0];
    if (!day) { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return `day ${d} not found in "${dTxt(pop).slice(0, 80)}"`; }
    click(day.closest("button, td, ion-button") || day); await sleep(700);
    const ok = [...pop.querySelectorAll("button, ion-button, span, div")].filter(vis).find(e => /^(Done|OK|Ok|Set|Select|Apply)$/.test(dTxt(e)) && e.querySelectorAll("*").length < 4);
    if (ok && vis(ok)) { click(ok.closest("button, ion-button") || ok); await sleep(700); }
    await sleep(500);
    return "";
  }
  async function setErpDate(inp, dmy, what) {
    const before = inp.value, why = await pickFromCalendar(inp, dmy).catch(e => "calendar: " + e.message);
    if (!why && dateOk(inp, dmy)) { log(`   Required Date picked from the calendar (${before || "empty"} → ${inp.value})`, "h"); return; }
    log(`   calendar didn't give the date (${why || `field shows "${inp.value}"`}) - typing it`, "h");
    const [d, m, y] = dmy.split("-"), yy = String(y).slice(-2), slash = `${d}/${m}/${yy}`;
    const ways = [
      { n: "ddmmyy + PC keys", s: `${d}${m}${yy}`, keys: true },   // by hand on the PC: "291126" → the ERP made it 29-NOV-2026
      { n: "ddmmyy + phone keys", s: `${d}${m}${yy}`, keys: true, android: true },
      { n: "dd/mm/yy + phone keys", s: slash, keys: true, android: true },
      { n: "dd/mm/yy + PC keys", s: slash, keys: true },
      { n: "dd-Mon-yyyy + PC keys", s: monDate(dmy), keys: true },
      { n: "dd/mm/yyyy + PC keys", s: `${d}/${m}/${y}`, keys: true },
      { n: "dd/mm/yy + phone keys, change", s: slash, keys: true, android: true, end: "change" }
    ];
    const seen = [];
    for (const w of ways) {
      await typeDateLikeHand(inp, w.s, w);
      if (dateOk(inp, dmy)) { log(`   Required Date taken (${w.n})${/dd-Mon/.test(w.n) ? " - typed in the ERP's own format, so it is not sure the ERP read it" : ""}`, "h"); return; }
      seen.push(`${w.n} → "${inp.value}"`);
    }
    throw new Error(`${what}: the ERP didn't take Required Date ${dmy} (${seen.join("; ")}) [${inp.closest("ion-input") ? "ion-input" : inp.parentElement ? inp.parentElement.tagName.toLowerCase() : "?"}${inp.type ? " type=" + inp.type : ""}]`);
  }
  const btn = (re, root = document) => [...root.querySelectorAll("ion-button, button")].filter(vis).find(b => re.test(txt(b)));
  const near = (a, b, tol) => Math.abs(+a - +b) <= tol;
  // a program error (not an ERP message): add where in erpfill.js it happened, for the screenshot
  const whereOf = e => e instanceof TypeError || e instanceof ReferenceError ? ` [erpfill ${((e.stack || "").split("\n").slice(1, 3).map(l => (l.match(/:(\d+:\d+)\)?\s*$/) || [])[1]).filter(Boolean).join(" < ")) || "?"}]` : "";
  // a voucher form is open: Save / Update shows, or (phone layout, where those sit in the "..." menu) the Series field shows
  const formOpen = () => !!btn(/^(Save|Update)$/) || (!btn(/^Create New Record$/) && [...document.querySelectorAll("p.input-group-label, ion-label.input-group-label")].some(p => vis(p) && txt(p).replace(/\*$/, "") === "Series"));
  // On a narrow screen (phone) the ERP moves Create New Record / Save / Back into the "..." menu at the top right.
  // doAction clicks the button if it shows, else opens that menu and clicks the item with the same name.
  const moreBtns = () => [...document.querySelectorAll("ion-button, button, ion-icon, [role=button]")].filter(vis).filter(b => !b.closest("#mzfPanel") && b.getBoundingClientRect().top < 170 &&
    (/^(\.\.\.|…|⋯|⋮)$/.test(txt(b)) || (b.tagName === "ION-ICON" ? /ellipsis/i.test(b.getAttribute("name") || "") : !!b.querySelector("ion-icon[name*=ellipsis]"))))
    .filter((b, k, all) => !all.some(o => o !== b && o.contains(b)));   // the outer button only
  const actionEls = re => [...document.querySelectorAll("ion-item, ion-button, button, ion-label, a, li, p, span, div")].filter(e => vis(e) && !e.closest("#mzfPanel") && re.test(txt(e)));
  const pageText = () => [...document.body.children].filter(e => e.id !== "mzfPanel").map(e => e.innerText || "").join("\n");
  async function doAction(re, what) {
    const b = [...document.querySelectorAll("ion-button, button")].filter(vis).find(x => !x.closest("#mzfPanel") && re.test(txt(x)));
    if (b) { click(b); return; }
    const tried = [], cands = moreBtns();
    for (const m of cands) {
      const before = new Set(actionEls(re)), t0 = new Set(pageText().split("\n").map(x => x.trim()).filter(Boolean));
      m.scrollIntoView({ block: "center" }); await sleep(200);
      ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(t => m.dispatchEvent(new (t.startsWith("pointer") ? PointerEvent : MouseEvent)(t, { bubbles: true, cancelable: true, view: window })));
      let hit = null;
      for (let w = 0; w < 10 && !hit; w++) { await sleep(250); hit = actionEls(re).filter(e => !before.has(e)).sort((x, y) => x.querySelectorAll("*").length - y.querySelectorAll("*").length)[0]; }
      if (hit) { click(hit.closest("ion-item, ion-button, button, a, li") || hit); await sleep(400); return; }
      const fresh = pageText().split("\n").map(x => x.trim()).filter(x => x && !t0.has(x));
      tried.push(`${m.tagName.toLowerCase()}${m.getAttribute("name") ? " " + m.getAttribute("name") : ""} → ${fresh.length ? fresh.slice(0, 8).join(", ") : "nothing new on the page"}`);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); const bd = [...document.querySelectorAll("ion-backdrop")].find(vis); if (bd) click(bd); await sleep(500);
    }
    const e = new Error(`"${what}" button not found` + (cands.length ? ` (tapped the ... button: ${tried.join(" | ").slice(0, 300)})` : " (no ... button found at the top)"));
    e.stopAll = true; throw e;
  }

  // what the listing check sees - shown when a listing is not recognised (e.g. on a phone layout)
  const seen = () => `title "${screenTitle() || "none"}", Create New Record button ${btn(/^Create New Record$/) ? "found" : "NOT found"}, Save/Update ${formOpen() ? "showing" : "not showing"}, lookup ${lov() ? "open" : "closed"}; buttons: ${[...document.querySelectorAll("ion-button, button")].filter(vis).filter(b => !b.closest("#mzfPanel")).map(txt).filter(Boolean).slice(0, 12).join(" | ")}`;

  /* ================= ERP message boxes ================= */
  // boxes already answered: in the phone app a closed "saved successfully" box can stay in the page looking visible
  // (every way of closing it done, it doesn't go) - such a box with the same text is not a new message
  const CLOSED = new WeakMap();
  function alertBox() {
    const box = [...document.querySelectorAll("ion-popover.modelalert-box, ion-content.alert-boxes")].map(b => b.closest("ion-popover") || b)
      .find(b => vis(b) && CLOSED.get(b) !== txt(b));
    if (!box) return null;
    const t = txt(box);
    return { box, text: t, kind: /saved successfully|updated successfully/i.test(t) ? "ok" : /which figure do you want to change/i.test(t) ? "opt" : "err" };
  }
  // an ERP message box: OK; in the phone app the mouse-event click sometimes leaves it open - then the button's own
  // click, pointer events, Escape and the backdrop are tried in turn (only this box; a different message is left for the caller)
  async function closeAlert(a) {
    const gone = () => !vis(a.box) || !document.contains(a.box);
    const tries = [
      () => { const ok = btn(/^OK$/i, a.box); if (ok) click(ok); },
      () => { const ok = btn(/^OK$/i, a.box); if (ok) ok.click(); },
      () => { const ok = btn(/^OK$/i, a.box); if (ok) { ["pointerdown", "pointerup"].forEach(t => ok.dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true }))); ok.click(); } },
      () => { keyEv(a.box, "Escape"); keyEv(document.body, "Escape"); const bd = a.box.querySelector("ion-backdrop"); if (bd) bd.click(); }
    ];
    for (const t of tries) { if (gone()) break; t(); await waitFor(gone, 2500, "message to close").catch(() => {}); }
    if (!gone()) { CLOSED.set(a.box, txt(a.box)); dbg("message box would not close - ignored from now: " + txt(a.box).slice(0, 80)); }
    await sleep(300);
  }
  // "Which figure do you want to change?" → keep C/F, recalculate the other quantity
  async function answerOptions() { await sleep(400); const a = alertBox(); if (a && a.kind === "opt") { const b = btn(/^Adnl Quantity$/i, a.box); if (b) click(b); await sleep(500); } }

  /* ================= lookups ================= */
  const lov = () => document.querySelector("#sigleMultiLov.show");
  async function closeLov() { const L = lov(); if (!L) return; const c = btn(/^Close$/, L); if (c) click(c); await waitFor(() => !lov(), 5000).catch(() => {});
    if (lov()) { const c2 = btn(/^Close$/, lov()); if (c2) c2.click(); await waitFor(() => !lov(), 4000).catch(() => {}); }   // phone app: the element's own click
    await sleep(250); }
  const lovRows = L => [...L.querySelectorAll("tbody.single_selectlov tr")].filter(r => txt(r));
  async function pickLov(col, value) {
    await waitFor(lov, 15000, "lookup panel");
    // look the panel up afresh each time: on a phone the previous lookup's panel can still be closing when this one opens
    const L = await waitFor(() => { const x = lov(); return x && lovRows(x).length && x; }, 40000, `lookup rows (${col} ${value})`);   // a phone on mobile data can be slow
    const heads = [...L.querySelectorAll("thead tr")].find(tr => [...tr.children].some(c => txt(c)));
    const names = [...heads.children].map(c => txt(c).replace(/\*$/, "").toLowerCase());
    const ci = names.indexOf(col.toLowerCase());
    if (ci < 0) throw new Error(`Lookup column "${col}" not found`);
    const ftr = [...L.querySelectorAll("thead tr")].find(tr => tr.querySelector("input"));
    const f = ftr && ftr.children[ci] && ftr.children[ci].querySelector("input");
    const want = String(value).trim().toUpperCase();
    const match = () => lovRows(L).find(r => { const c = r.children[ci]; return c && txt(c).toUpperCase() === want; });
    if (!match() && f) await typeInto(f, `%${value}%`, 300);
    let row;
    try { row = await waitFor(match, 15000, `"${value}"`); }
    catch (e) { await closeLov(); throw new Error(`"${value}" is not in the ERP's ${col} list`); }
    const td = [...row.children].find(t => getComputedStyle(t).display !== "none") || row.firstElementChild;
    mouse(td, "click"); mouse(td, "dblclick");
    await waitFor(() => !lov(), 15000, "lookup to close"); await sleep(600);
  }

  /* ================= header fields ================= */
  function field(label) {
    let lab = [...document.querySelectorAll("p.input-group-label, ion-label.input-group-label")].filter(vis).find(p => txt(p).replace(/\*$/, "") === label);
    // on a phone some fields (the dates) carry a small label above the box instead - any label-like text with that name
    if (!lab) lab = [...document.querySelectorAll("p, ion-label, label, span, div, ion-text")].filter(e => vis(e) && !e.closest("#mzfPanel, ion-button, button, table") &&
      ![...e.children].some(c => txt(c)) && txt(e).replace(/\s*\*$/, "") === label)[0];
    if (!lab) throw new Error(`Field "${label}" not found`);
    let w = lab; for (let i = 0; i < 6 && w && !w.querySelector("input,textarea"); i++) w = w.parentElement;
    return { inp: w.querySelector("input,textarea"), wrap: w };
  }
  // Create New Record + the series. On a weak line the ERP's series list can keep spinning and never fill: then it is
  // closed, the listing is opened again and Create New Record pressed once more (3 tries)
  async function newWithSeries(code, back) {
    for (let t = 0; t < 3; t++) {
      if (t) { log(`   the series list did not load - trying again (${t + 1}/3)`, "h"); if (lov()) await closeLov(); await sleep(3000); await back(); }
      await doAction(/^Create New Record$/, "Create New Record");
      try {
        await waitFor(() => { const a = alertBox(); if (a && a.kind === "err") throw new Error("ERP said: " + a.text.replace(/Know More.*$/i, "").slice(0, 200)); return lov(); }, 15000, "series list");
        await pickLov("Series", code); return;
      }
      catch (e) { if (t === 2 || !/^Timed out waiting for (lookup|series)/.test(e.message)) throw e; }
    }
  }
  async function seriesSet() { await waitFor(() => { try { return field("Series").inp.value.trim(); } catch (e) { return "no Series field"; } }, 30000, "the Series to fill in"); await sleep(800); }
  async function headerLov(label, col, value, expect) {
    const { inp, wrap } = field(label);
    if (lov()) await closeLov();
    for (let t = 0; t < 2; t++) {   // a lookup that never fills is closed and opened once more
      click(wrap.querySelector("ion-icon[name=search]") || wrap.querySelector("ion-icon"));
      try { await pickLov(col, value); break; }
      catch (e) { if (t || !/Timed out waiting for lookup (rows|panel)/.test(e.message)) throw e; await closeLov(); await sleep(2000); }
    }
    if (expect && !new RegExp(expect, "i").test(inp.value)) throw new Error(`${label} shows "${inp.value}"`);
  }

  /* ================= grids ================= */
  function grid(title) {
    const t = [...document.querySelectorAll("*")].filter(vis).find(e => e.children.length === 0 && txt(e) === title && !e.closest("ion-button,button"));
    if (!t) throw new Error(`Grid "${title}" not found`);
    let fr = t; for (let i = 0; i < 8 && fr && !fr.querySelector("table"); i++) fr = fr.parentElement;
    return fr;
  }
  // real (editable) rows have a search icon in the Item Name cell; the grey filler rows don't
  // the ERP's boxes: on a PC the <input> itself carries the field id (ITEM_NAME ...); on a phone the ERP draws
  // <ion-input id="ITEM_NAME"> around an <input id="ion-input-123">, so look inside that too
  const inpOf = (root, id) => root.querySelector("input#" + id) || root.querySelector(`#${id} input, #${id} textarea`);
  const realRows = fr => [...fr.querySelector("table").querySelectorAll("tbody tr")].filter(r => { const i = inpOf(r, "ITEM_NAME"); return i && i.closest("td").querySelector("ion-icon[name=search]"); });
  const cell = (tr, id) => inpOf(tr, id);
  // the first (blank) row of a grid; on a phone the grid can draw its rows a moment later, so bring it into view and wait
  async function firstRow(fr, name) {
    try { fr.scrollIntoView({ block: "center" }); } catch (e) {}
    try { return await waitFor(() => realRows(fr)[0], 10000, `the first row of the ${name} grid`); }
    catch (e) {
      const t = fr.querySelector("table"), rows = t ? t.querySelectorAll("tbody tr").length : 0, ids = t ? [...new Set([...t.querySelectorAll("tbody [id]")].map(i => i.tagName.toLowerCase() + "#" + i.id))].slice(0, 10).join(", ") : "";
      throw new Error(`${e.message} (grid table ${t ? "found" : "NOT found"}, ${rows} row(s), inputs: ${ids || "none"})`);
    }
  }
  let TAP_ROWS = false;
  // a tap as a finger makes it: pointer + touch + mouse events at the middle of the element
  function fingerTap(el) {
    const r = el.getBoundingClientRect(), x = r.left + Math.min(r.width / 2, 20), y = r.top + r.height / 2;
    const o = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, pointerId: 1, pointerType: "touch", isPrimary: true };
    let touch = null; try { touch = new Touch({ identifier: Date.now(), target: el, clientX: x, clientY: y }); } catch (e) {}
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    if (touch) try { el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] })); } catch (e) {}
    el.dispatchEvent(new PointerEvent("pointerup", o));
    if (touch) try { el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch] })); } catch (e) {}
    ["mousedown", "mouseup", "click"].forEach(t => el.dispatchEvent(new MouseEvent(t, o)));
  }
  async function activate(tr) {      // the grid works on its "active" row, which follows focus -
    // always re-focus: the row can look active while the ERP's own current-row index is elsewhere
    const inp = cell(tr, "SLNO") || tr.querySelector("input");
    const on = () => tr.classList.contains("trow-active");
    inp.dispatchEvent(new FocusEvent("focus", { bubbles: true })); inp.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    try { if (TAP_ROWS) throw 0; await waitFor(on, 2000, "row to become active"); }
    catch (e) {   // phone layout: the row follows a tap, not focus alone (remembered, so later rows are tapped straight away)
      if (e !== 0 && !on()) TAP_ROWS = true;
      try { tr.scrollIntoView({ block: "center" }); } catch (e2) {}
      const host = inp.closest("ion-input") || inp, td = inp.closest("td") || tr.firstElementChild;
      const name = cell(tr, "ITEM_NAME"), targets = [td, host, inp, tr, name && (name.closest("td") || name)].filter(Boolean);
      for (let round = 0; round < 2 && !on(); round++) {   // a second round after a pause: the phone app can be slow to move the active row
        if (round) await sleep(1500);
        for (const el of targets) {
          if (on()) break;
          fingerTap(el); try { el.focus && el.focus(); } catch (e2) {}
          await sleep(500);
        }
        inp.focus(); inp.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        try { await waitFor(on, 3000, "row to become active"); } catch (e4) {}
      }
      try { await waitFor(on, 1000, "row to become active"); }
      catch (e3) {
        const rows = [...tr.parentElement.children], act = rows.findIndex(r => r.classList.contains("trow-active"));
        throw new Error(`Timed out waiting for row ${rows.indexOf(tr) + 1} to become active (active row now: ${act < 0 ? "none" : act + 1}; row classes: ${tr.className || "none"})`);
      }
    }
    await sleep(150);
  }
  async function addRow(fr) {
    const n = realRows(fr).length;
    const last = realRows(fr).slice(-1)[0]; if (last) await activate(last);
    const add = [...fr.querySelectorAll("ion-icon[name=add-circle-outline]")].find(vis); click(add.closest("ion-button") || add);
    const grown = () => { const a = alertBox(); if (a && a.kind === "err") throw new Error("ERP said: " + a.text.slice(0, 200)); return realRows(fr).length > n; };
    // slow internet / a phone tap the ERP didn't take: wait, then press + once more (only if still no new row)
    try { await waitFor(grown, 25000, "new row"); }
    catch (e) {
      if (/^ERP said/.test(e.message) || realRows(fr).length > n) throw e;
      const b = add.closest("ion-button") || add; fingerTap(b); click(b);
      await waitFor(grown, 30000, "new row (+ pressed twice)");
    }
    const empties = realRows(fr).filter(r => !cell(r, "ITEM_CODE").value.trim());
    const nr = empties[empties.length - 1]; if (!nr) throw new Error("new row not found");
    await activate(nr); return nr;
  }
  // delete works on the last CLICKED row (not the focused one), so focus + click it, then make sure
  // exactly that row went
  async function deleteRow(fr, tr) {
    const codes = () => realRows(fr).map(r => cell(r, "ITEM_CODE").value.trim());
    const before = codes(), idx = realRows(fr).indexOf(tr);
    await activate(tr);
    click((cell(tr, "SLNO") || tr.querySelector("input")).closest("td")); click(tr); await sleep(400);
    const t = [...fr.querySelectorAll("ion-icon[name=trash-outline]")].find(vis); click(t.closest("ion-button") || t);
    await waitFor(() => realRows(fr).length < before.length, 5000, "row delete");
    await sleep(400);
    const want = before.slice(0, idx).concat(before.slice(idx + 1)).join("|");
    if (codes().join("|") !== want) throw new Error(`row delete went wrong (now ${codes().join(", ")})`);
  }
  async function cellLov(tr, id, col, value) {
    await activate(tr);
    const inp = cell(tr, id); if (!inp) throw new Error("Cell " + id + " not found");
    if (lov()) await closeLov();
    for (let t = 0; t < 2; t++) {
      click(inp.closest("td").querySelector("ion-icon[name=search]"));
      try { await pickLov(col, value); return; }
      catch (e) { if (t || !/Timed out waiting for lookup (rows|panel)/.test(e.message)) throw e; await closeLov(); await sleep(2000); await activate(tr); }
    }
  }
  async function editCell(inp, v) {   // grid cells only take typing after a double-click
    const tr = inp.closest("tr"); if (tr && cell(tr, "SLNO")) await activate(tr);
    mouse(inp, "click"); mouse(inp, "dblclick"); await sleep(300); await typeInto(inp, v);
  }
  async function setStockType(tr, v = "R") {
    const s = tr.querySelector("ion-select"); if (!s || s.value === v) return;
    s.value = v; s.dispatchEvent(new CustomEvent("ionChange", { detail: { value: v }, bubbles: true })); await sleep(300);
  }
  async function openTab(name) {
    [...document.querySelectorAll("*")].filter(vis).filter(e => e.children.length === 0 && txt(e) === name && !e.closest("app-frame-newtable2")).forEach(t => click(t));
    await sleep(900);
  }

  /* ================= one billet line ================= */
  async function fillProdLine(tr, l) {
    dbg("line start " + l.ref);
    await cellLov(tr, "ITEM_NAME", "Item Code", l.code); dbg("item");
    if (cell(tr, "ITEM_CODE").value.trim() !== l.code) throw new Error(`item ${l.code} not set`);
    await cellLov(tr, "GODOWN_NAME", "Godown Code", "SMS2"); dbg("godown");
    await editCell(cell(tr, "BATCHNO"), l.batch);
    await editCell(cell(tr, "REF_SLNO"), l.ref);
    await setStockType(tr, "R");
    await cellLov(tr, "DEPT_NAME", "Department", "QAD03"); dbg("dept");
    await cellLov(tr, "AUM", "Tranum", "PCS"); dbg("aum");
    await sleep(500);
    await editCell(cell(tr, "AQTYRECD"), String(l.pcs)); await answerOptions();
    for (let k = 0; k < 5; k++) {   // the ERP reloads the master C/F a moment later - keep ours
      await sleep(600);
      if (near(cell(tr, "AUMTOUM").value, l.cf, 1e-6)) { await sleep(700); if (near(cell(tr, "AUMTOUM").value, l.cf, 1e-6)) break; }
      await editCell(cell(tr, "AUMTOUM"), String(l.cf)); await answerOptions();
    }
    // the ERP works out the MT a moment later (slower on a phone / weak internet); wait, and retype C/F once if it still doesn't come
    if (!near(cell(tr, "QTYRECD").value, l.mt, 0.0005)) {
      await waitFor(() => near(cell(tr, "QTYRECD").value, l.mt, 0.0005), 8000, "MT").catch(() => {});
      if (!near(cell(tr, "QTYRECD").value, l.mt, 0.0005)) { await editCell(cell(tr, "AUMTOUM"), String(l.cf)); await answerOptions(); await waitFor(() => near(cell(tr, "QTYRECD").value, l.mt, 0.0005), 10000, "MT").catch(() => {}); }
    }
    // MT can stay worked out from the master C/F (phone app: 33.768 instead of 33.265) - enter the pcs again so the ERP
    // works the MT out with our C/F, keeping our C/F; as the last try type the MT itself (only if the cell takes typing)
    let typedMt = false;
    for (let k = 0; k < 2 && !near(cell(tr, "QTYRECD").value, l.mt, 0.0005); k++) {
      dbg("MT from master C/F - pcs again");
      await editCell(cell(tr, "AQTYRECD"), String(l.pcs)); await answerOptions(); await sleep(1500);
      if (!near(cell(tr, "AUMTOUM").value, l.cf, 1e-6)) { await editCell(cell(tr, "AUMTOUM"), String(l.cf)); await answerOptions(); }
      await waitFor(() => near(cell(tr, "QTYRECD").value, l.mt, 0.0005), 6000, "MT").catch(() => {});
    }
    { const q = cell(tr, "QTYRECD");
      if (!near(q.value, l.mt, 0.0005) && !q.readOnly && !q.disabled) { dbg("MT typed"); await editCell(q, String(l.mt)); await answerOptions(); await sleep(1500); typedMt = true; } }
    dbg("cf");
    const got = { batch: cell(tr, "BATCHNO").value, ref: cell(tr, "REF_SLNO").value, pcs: cell(tr, "AQTYRECD").value, cf: cell(tr, "AUMTOUM").value, mt: cell(tr, "QTYRECD").value, st: (tr.querySelector("ion-select") || {}).value, godown: cell(tr, "GODOWN_CODE").value };
    const bad = [];
    if (got.godown !== "SMS2") bad.push("godown"); if (got.batch !== l.batch) bad.push("batch"); if (got.ref !== l.ref) bad.push("Ref No");
    if (!near(got.pcs, l.pcs, 1e-9)) bad.push("pcs"); if (!near(got.cf, l.cf, typedMt ? 1e-4 : 1e-6)) bad.push("C/F " + got.cf);   // MT typed: the ERP may work C/F back out of the 3-decimal MT
    if (!near(got.mt, l.mt, 0.0005)) bad.push(`MT ${got.mt} (expected ${l.mt})`); if (got.st !== "R") bad.push("stock type");
    if (bad.length) throw new Error(`billet ${l.code} ${l.ref}: ${bad.join(", ")} did not take`);
  }

  /* ================= one RM consumption line (SMS1 stock) ================= */
  // "Voucher number … saved successfully" boxes left open (the ERP can show two at once): close them, they are not answers
  async function closeOkAlerts() { for (let i = 0; i < 3; i++) { const a = alertBox(); if (a && a.kind === "ok") await closeAlert(a); else break; } }
  async function fillRmLine(rf, tr, l, want) {   // want = MT to add on this item; returns {short, avail} if SMS1 stock is not enough
    await closeOkAlerts();
    await cellLov(tr, "ITEM_NAME", "Item Code", l.code);
    // on a row that held another item (the one before had no stock) the new item can take a moment, or a second pick
    if (cell(tr, "ITEM_CODE").value.trim() !== l.code) await waitFor(() => cell(tr, "ITEM_CODE").value.trim() === l.code, 3000).catch(() => {});
    if (cell(tr, "ITEM_CODE").value.trim() !== l.code) { await cellLov(tr, "ITEM_NAME", "Item Code", l.code); await waitFor(() => cell(tr, "ITEM_CODE").value.trim() === l.code, 3000).catch(() => {}); }
    if (cell(tr, "ITEM_CODE").value.trim() !== l.code) throw new Error(`item ${l.code} not set (the line shows ${cell(tr, "ITEM_CODE").value.trim() || "nothing"})`);
    const pre = realRows(rf).filter(t => t !== tr && cell(t, "ITEM_CODE").value.trim() === l.code).reduce((s, t) => s + (+cell(t, "QTYISSUED").value || 0), 0);   // already in the voucher
    click(cell(tr, "GODOWN_NAME").closest("td").querySelector("ion-icon[name=search]"));
    let sf, closing = false;   // an ERP alert instead of the picker (e.g. negative / no stock) = skip this item, like short stock
    try {
      sf = await waitFor(() => {
        const a = alertBox(); if (a && a.kind === "ok") { if (!closing) { closing = true; closeAlert(a).finally(() => { closing = false; }); } return null; }   // an old "saved successfully" - close it, keep waiting
        if (a) { const e = new Error("ERP said: " + a.text.slice(0, 150)); e.erpAlert = a; throw e; }
        return [...document.querySelectorAll("[id^=WETE]")].find(e => vis(e) && /Stock Details/.test(txt(e.querySelector("h2") || e)));
      }, 15000, "stock picker");
    } catch (e) { if (e.erpAlert) { await closeAlert(e.erpAlert); return { short: true, avail: 0, reason: e.message.replace(/^ERP said: /, "") }; } throw e; }
    let d = sf; while (d && !(btn(/^Ok$/, d) && btn(/^Show$/, d))) d = d.parentElement;
    const back = async () => { const b = btn(/^Back$/, d); if (b) click(b); await waitFor(() => !vis(sf), 8000).catch(() => {}); await sleep(400); };
    click(btn(/^Show$/, d));
    const rowsOf = () => [...sf.querySelectorAll("table tbody tr")].filter(r => txt(r.children[3]));
    await waitFor(() => rowsOf().length, 12000, "stock rows").catch(() => {});
    const stock = r => +txt(r.children[11]).replace(/,/g, "") || 0;
    const rows = rowsOf().filter(r => txt(r.children[3]) === "SMS1" && stock(r) > 0);
    const avail = rows.reduce((s, r) => s + stock(r), 0);
    if (avail + 1e-9 < want) { await back(); return { short: true, avail }; }
    let left = Math.round(want * 1000) / 1000; const used = [];
    for (const r of rows) {
      if (left <= 0) break;
      const take = Math.min(left, stock(r));
      const cb = r.querySelector("ion-checkbox"); if (!cb.checked) { click(cb); await sleep(300); }
      await editCell(r.children[12].querySelector("input"), take.toFixed(3));
      const aq = r.children[16] && r.children[16].querySelector("input");
      if (aq && !near(aq.value, take, 0.0005)) await editCell(aq, take.toFixed(3));
      used.push(`${txt(r.children[7])} ${take.toFixed(3)}`);
      left = Math.round((left - take) * 1000) / 1000;
    }
    click(btn(/^Ok$/, d));
    await waitFor(() => !vis(sf), 10000, "stock picker to close"); await sleep(600);
    const a = alertBox(); if (a) {
      const t = a.text; await closeAlert(a);
      if (/stock|negative|insufficient|balance|availab|-ve/i.test(t)) return { short: true, avail: 0, reason: t.slice(0, 150) };   // stock problem: skip the item
      throw new Error("ERP said: " + t.slice(0, 200));
    }
    // both quantity columns must show our figure
    for (const t of realRows(rf).filter(t => cell(t, "ITEM_CODE").value.trim() === l.code)) {
      const q = cell(t, "QTYISSUED").value, aq = cell(t, "AQTYISSUED");
      if (!near(aq.value, q, 0.0005)) { await editCell(aq, q); await answerOptions(); }
      await setStockType(t, "R");
    }
    const lines = realRows(rf).filter(t => cell(t, "ITEM_CODE").value.trim() === l.code);
    const q = lines.reduce((s, t) => s + (+cell(t, "QTYISSUED").value || 0), 0), aqs = lines.reduce((s, t) => s + (+cell(t, "AQTYISSUED").value || 0), 0);
    const exp = pre + want;
    if (!near(q, exp, 0.0005) || !near(aqs, exp, 0.0005)) throw new Error(`ERP shows ${q.toFixed(3)} / ${aqs.toFixed(3)} MT, expected ${exp.toFixed(3)}`);
    return { used: used.join(", ") };
  }

  // add the RM lines. Items without an ERP code, or whose SMS1 stock is short, are SKIPPED and reported (the
  // half-filled row is deleted again) - the quantity is added later with "cons" mode. placeholder=true (new
  // production voucher): if NO line could be entered in full, 0.001 MT of one short item that has some stock
  // is entered - the ERP only needs one RM line to save. have = RM already in the voucher {code: MT}.
  // Any other problem stops this heat WITHOUT saving. Returns {ok, missing, added}
  const notInList = e => /is not in the ERP's Item Code list/.test(e.message);   // an item code the RM lookup doesn't have: skip that item, not the heat
  async function fillRm(rm, log, have = {}, placeholder = false) {
    await openTab("RM Consumption");
    const rf = await waitFor(() => grid("R.M. Consumed For Material"), 10000, "RM Consumption grid");
    const ok = [], missing = [], added = {}, need = {}, shorts = [];
    let spare = realRows(rf).find(t => !cell(t, "ITEM_CODE").value.trim()) || null;   // the blank first row
    for (const l of rm) {
      if (!l.code) { missing.push(`${l.label} ${l.qty.toFixed(3)} MT (no ERP item code)`); log(`   RM ${l.label} ${l.qty.toFixed(3)} MT skipped - no ERP item code`, "err"); continue; }
      need[l.code] = r3((need[l.code] || 0) + l.qty);
      const want = r3(need[l.code] - (have[l.code] || 0) - (added[l.code] || 0));   // what the voucher still lacks for this item
      if (want <= 0.0005) continue;
      const tr = spare || await addRow(rf); spare = null;
      try {
        const r = await fillRmLine(rf, tr, l, want);
        if (r.short) { shorts.push({ l, want, avail: r.avail, tr, reason: r.reason }); log(`   RM ${l.label} ${want.toFixed(3)} MT skipped - ${r.reason ? "ERP: " + r.reason : "SMS1 stock only " + r.avail.toFixed(3) + " MT"}`, "err"); continue; }
        ok.push(l.code); added[l.code] = r3((added[l.code] || 0) + want);
        log(`   RM ${l.label} ${want.toFixed(3)} MT ✓ (${r.used})`, "ok");
      }
      catch (e) {
        if (lov()) await closeLov();
        if (notInList(e) && cell(tr, "ITEM_CODE").value.trim() !== l.code) {
          missing.push(`${l.label} ${want.toFixed(3)} MT (${l.code} is not in the ERP's RM item list)`); log(`   RM ${l.label} ${want.toFixed(3)} MT skipped - ${l.code} is not in the ERP's RM item list`, "err");
          spare = tr; continue;
        }
        throw new Error(`RM ${l.label} ${want.toFixed(3)} MT: ${e.message}`);
      }
    }
    if (spare && !cell(spare, "ITEM_CODE").value.trim() && realRows(rf).length > 1) { await deleteRow(rf, spare); spare = null; }   // the row left by a skipped item
    if (placeholder && !ok.length) {   // nothing in full: one 0.001 MT line is enough for the ERP to save
      const s = shorts.find(x => x.avail + 1e-9 >= PLACEHOLDER_MT);
      if (s) {
        try {
          await fillRmLine(rf, s.tr, s.l, PLACEHOLDER_MT);
          ok.push(s.l.code); added[s.l.code] = PLACEHOLDER_MT; s.placed = true;
          log(`   RM ${s.l.label} stock short - ${PLACEHOLDER_MT.toFixed(3)} MT placeholder entered (need ${s.want.toFixed(3)} MT)`, "err");
        } catch (e) { if (lov()) await closeLov(); throw new Error(`RM ${s.l.label} ${PLACEHOLDER_MT.toFixed(3)} MT: ${e.message}`); }
      }
    }
    shorts.forEach(s => missing.push(s.placed
      ? `${s.l.label}: only ${PLACEHOLDER_MT.toFixed(3)} MT entered, ${s.want.toFixed(3)} MT needed (add later with Consumption mode)`
      : `${s.l.label} ${s.want.toFixed(3)} MT not entered - ${s.reason ? "ERP: " + s.reason : "SMS1 stock " + s.avail.toFixed(3) + " MT"} (add later with Consumption mode)`));
    if (ok.length) for (const s of shorts.filter(x => !x.placed)) {   // remove the skipped items' rows
      try { await deleteRow(rf, s.tr); } catch (e) { throw new Error(`could not remove the skipped RM line ${s.l.label}: ${e.message}`); }
    }
    return { ok, missing, added };
  }

  /* ================= final check before saving ================= */
  const r3 = v => Math.round(+v * 1000) / 1000;
  function prodRowsNow() {
    const pf = grid("Production Received");
    return realRows(pf).map(t => ({ code: cell(t, "ITEM_CODE").value.trim(), godown: cell(t, "GODOWN_CODE").value.trim(), batch: cell(t, "BATCHNO").value, ref: cell(t, "REF_SLNO").value,
      um: cell(t, "AUM").value.trim(), pcs: +cell(t, "AQTYRECD").value, cf: +cell(t, "AUMTOUM").value, mt: +cell(t, "QTYRECD").value, st: (t.querySelector("ion-select") || {}).value }));
  }
  function rmRowsNow() {
    const rf = grid("R.M. Consumed For Material");
    return realRows(rf).map(t => ({ code: cell(t, "ITEM_CODE").value.trim(), godown: cell(t, "GODOWN_CODE").value.trim(), q: +cell(t, "QTYISSUED").value || 0, aq: +cell(t, "AQTYISSUED").value || 0 }));
  }
  const rmTotals = rows => rows.reduce((m, r) => { if (r.code) m[r.code] = r3((m[r.code] || 0) + r.q); return m; }, {});
  async function checkProd(lines) {
    await openTab("Production Received");
    const got = prodRowsNow(), bad = [];
    if (got.length !== lines.length) bad.push(`${got.length} billet lines in the ERP, expected ${lines.length}`);
    lines.forEach((l, i) => { const g = got[i]; if (!g) return;
      if (g.code !== l.code || g.godown !== "SMS2" || g.batch !== l.batch || g.ref !== l.ref || g.um !== "PCS" || !near(g.pcs, l.pcs, 1e-9) || !near(g.cf, l.cf, 1e-6) || !near(g.mt, l.mt, 0.0005) || g.st !== "R")
        bad.push(`line ${i + 1} shows ${g.code} ${g.ref} ${g.pcs} pcs C/F ${g.cf} = ${g.mt}`); });
    if (bad.length) throw new Error("check before saving failed - " + bad.join("; "));
  }
  async function checkRm(expect) {        // expect: {code: qty}
    await openTab("RM Consumption");
    const rows = rmRowsNow(), bad = [];
    if (rows.some(r => !r.code)) bad.push("an empty RM line is left");
    rows.forEach(r => { if (r.code && (r.godown !== "SMS1" || !near(r.q, r.aq, 0.0005))) bad.push(`${r.code} ${r.godown} ${r.q} / ${r.aq}`); });
    const tot = rmTotals(rows);
    const codes = new Set([...Object.keys(tot), ...Object.keys(expect)]);
    codes.forEach(c => { if (!near(tot[c] || 0, expect[c] || 0, 0.0005)) bad.push(`${c}: ERP ${(tot[c] || 0).toFixed(3)}, expected ${(expect[c] || 0).toFixed(3)}`); });
    if (bad.length) throw new Error("check before saving failed - " + bad.join("; "));
  }

  /* ================= listing / vouchers ================= */
  // the screen title, e.g. "Production Entry Listing [QP:PROD]" / "Production Entry [QP:PROD]"
  const screenTitle = () => {
    const c = [...document.querySelectorAll("body *")].filter(x => { if (x.closest("#mzfPanel")) return false; const tc = x.textContent || ""; if (tc.length > 120 || !/\[[A-Z]{2}:/.test(tc) || !vis(x)) return false; return /[A-Za-z]\s*\[[A-Z]{2}:[A-Z0-9]+\]\s*$/.test(txt(x)); });
    c.sort((a, b) => txt(a).length - txt(b).length); return c.length ? txt(c[0]) : "";
  };
  const onListing = () => /^Production Entry Listing/i.test(screenTitle()) && !formOpen() && !lov();
  // the ERP's own tab strip at the top ("Production Entry Listing | Menu Object | ...")
  const erpTab = () => [...document.querySelectorAll("*")].filter(vis).find(e => e.children.length === 0 && txt(e) === "Production Entry Listing" && e.getBoundingClientRect().top < 80);
  // the ERP can drop back to its landing page in the middle of a run (it logs in again): open the screen again through
  // Quick Search (🔍 → text → "Search menu" → Open on the row with the menu code), like the Moltrix ERP app does
  const SCREENS = {
    prod: { search: "production entry", code: "05.02.01.31", name: "Production Entry" },
    qc: { search: "production qc", code: "07.01.02.01", name: "Production QC" },
    m2m: { search: "material transfer", code: "03.03.04.06", name: "Material to Material Transfer" },
    req: { search: "store requisition", code: "03.04.02.01", name: "Store Issue Requisition" },
    indent: { search: "purchase requisition", code: "", name: "Purchase Requisition Entry" }
  };
  let LAST_QUICK_OPEN = 0;
  async function quickOpen(key, onIt) {
    // only from the ERP's landing page (no screen title, its "Go to Landing Page" / "Quick Menu" buttons, no form, no listing),
    // and not again within 2 minutes - a form that is still loading has no title either, and must not send us searching in a loop
    const t = SCREENS[key];
    if (!t || screenTitle() || formOpen() || btn(/^Create New Record$/) || !(btn(/^Go to Landing Page$/i) || btn(/^Quick Menu$/i))) return false;
    if (Date.now() - LAST_QUICK_OPEN < 120000) return false;
    LAST_QUICK_OPEN = Date.now();
    log(`   the ERP is on its landing page - opening ${t.name} through Quick Search`, "h");
    const norm = x => String(x || "").replace(/\s+/g, " ").trim().toLowerCase();
    const openBtn = () => {
      const leaves = [...document.querySelectorAll("body *")].filter(e => e.children.length === 0 && vis(e) && !e.closest("#mzfPanel"));
      let hit = leaves.find(e => t.code ? txt(e) === t.code : norm(txt(e)) === norm(t.name));
      if (!hit && t.code) hit = leaves.find(e => norm(txt(e)) === norm(t.name));
      for (let row = hit, i = 0; row && i < 7; i++, row = row.parentElement) {
        const ob = [...row.querySelectorAll("ion-button, button, a, [role=button]")].find(b => vis(b) && /^open$/i.test(txt(b)));
        if (ob) return ob;
      }
      return null;
    };
    const box = () => [...document.querySelectorAll("input")].find(i => vis(i) && !i.closest("#mzfPanel") && /^(text|search)?$/i.test(i.type || "") && !/where to search/i.test(i.placeholder || "") && i.getBoundingClientRect().top < 300);
    const icon = () => { const c = [...document.querySelectorAll("ion-icon, ion-button, button, a, svg, img, i, span")].find(e => vis(e) && !e.closest("#mzfPanel") && e.getBoundingClientRect().top < 140 &&
        /search|magnif/i.test([e.getAttribute("name"), e.getAttribute("icon"), e.getAttribute("class"), e.getAttribute("aria-label"), e.getAttribute("title")].join(" ")));
      return c ? c.closest("ion-button, button, a, [role=button]") || c : null; };
    try {
      if (!btn(/^Search menu$/i)) { const ic = icon(); if (!ic) return false; click(ic); await waitFor(() => btn(/^Search menu$/i) && box(), 10000, "Quick Search"); }
      const b = box(); await typeInto(b, t.search); keyEv(b, "Enter"); await sleep(1500);
      if (!openBtn()) { click(btn(/^Search menu$/i)); }
      const ob = await waitFor(openBtn, 15000, `${t.name} in Quick Search`);
      click(ob);
      await waitFor(onIt, 30000, t.name);
      log(`   ${t.name} open again ✓`, "ok");
      return true;
    } catch (e) { if (e.message === "Stopped by user") throw e; return false; }
  }
  async function backToListing() {
    for (let i = 0; i < 4 && !onListing(); i++) {
      const a = alertBox(); if (a) await closeAlert(a); if (lov()) await closeLov();
      const b = btn(/^Back$/);
      if (!b && formOpen()) { try { await doAction(/^Back$/, "Back"); } catch (e) {} await sleep(2500); continue; }
      if (/^Production Entry Listing/i.test(screenTitle()) && !formOpen()) { await sleep(1500); continue; }   // already on the listing - just wait
      if (b && /\[QP:PROD\]/.test(screenTitle())) click(b);         // a Production Entry voucher is open
      else { const t = erpTab(); if (t) click(t); else if (b && formOpen()) click(b); }
      await sleep(2500);
    }
    try { await waitFor(onListing, 15000, "Production Entry Listing"); }
    catch (e) {
      if (e.message === "Stopped by user") throw e;
      if (await quickOpen("prod", onListing)) return;
      const shown = screenTitle() || "(no screen title found)";
      throw new Error(`the ERP is not on Production Entry Listing (it shows "${shown}"). Open the Production Entry Listing screen, wait for the list, then press Start again. [seen: ${seen()}]`);
    }
  }
  async function save(re) {
    await doAction(re, String(re).replace(/[\/^$]/g, ""));
    const a = await waitFor(alertBox, 120000, "the ERP to answer Save");
    const text = a.text; await closeAlert(a);
    for (let i = 0; i < 2; i++) { const b = alertBox(); if (b && b.text === text) await closeAlert(b); else break; }   // the same message shown twice (phone app)
    if (a.kind === "ok") await closeOkAlerts();
    if (a.kind !== "ok") throw new Error("ERP said: " + text.replace(/Know More.*$/i, "").slice(0, 300));
    const m = text.match(/Voucher number\s+(\S+)\s+(saved|updated)/i); return m ? m[1] : "(number not shown)";
  }
  async function newVoucher(h, mode, log) {
    await backToListing();
    await newWithSeries("Q2", backToListing); await seriesSet();
    await waitFor(() => { try { return field("Transaction Type"); } catch (e) { return null; } }, 20000, "new Production Entry"); await sleep(800);
    if (!/STOCK MATERIAL/i.test(field("Transaction Type").inp.value)) await headerLov("Transaction Type", "Tran-Type Name", "STOCK MATERIAL", "STOCK MATERIAL");
    await headerLov("Plant Name", "Plant Code", "INDF1", "INDUCTION FURNACE");
    await headerLov("Process Name", "Process Code", "BILLETS", "BILLETS");
    await headerLov("Cost Name", "Cost Code", "INFUR", "INDUCTION FURNACE");
    await typeInto(field("Remark").inp, h.remark);
    // 12-Nov-2026 first: a phone WebView reads 12-11-2026 as month-day (11-Dec-2026); then 12-11-2026 as before
    for (const l of ["Production In Date", "Production Out Date"]) { const i = field(l).inp, ok = () => i.value === h.date || dmyOf(i.value) === h.date;
      await typeInto(i, monDate(h.date)); if (!ok()) await typeInto(i, h.date); if (!ok()) throw new Error(`${l} shows "${i.value}"`); }   // PC shows 11-11-2026, phone 11-Nov-2026
    const pf = grid("Production Received");
    for (let i = 0; i < h.lines.length; i++) {
      const tr = i === 0 ? await firstRow(pf, "Production Received") : await addRow(pf);
      await fillProdLine(tr, h.lines[i]); log(`   billet ${h.lines[i].ref} ${h.lines[i].len} Mtr ${h.lines[i].pcs} pcs = ${h.lines[i].mt.toFixed(3)} MT ✓`, "ok");
    }
    let missing = [], expect = {};
    // ONE RM line only, 0.001 MT, of the first RM item that has SMS1 stock - the ERP needs one RM line to save; the rest of
    // the heat's consumption goes in later with "Add RM to saved vouchers" (Consumption mode). Quicker on the phone.
    let one = null; const skip = new Set(RUN_SKIP);   // items the ERP refused on Save earlier in this run are not tried again
    const leftOver = () => (h.rm || []).map(l => {
      if (!l.code) return `${l.label} ${l.qty.toFixed(3)} MT (no ERP item code)`;
      const left = r3(l.qty - (one && one.code === l.code ? one.qty : 0));
      return left > 0.0005 ? `${l.label} ${left.toFixed(3)} MT` : "";
    }).filter(Boolean);
    if (mode === "full") {
      if (!(h.rm || []).length) throw new Error(`Moltrix sent no RM consumption for heat ${h.heat} - the RM Report has no consumption for ${h.date}; fill it in the RM Report, send again from Moltrix (the ERP needs at least one RM line)`);
      one = await oneRm(h.rm, log, skip);
      await checkRm({ [one.code]: one.qty });
    }
    await checkProd(h.lines);
    log("   all lines re-checked ✓", "ok");
    // the ERP checks the division stock again on Save ("Qty Issued should not be More than available stock for item code X");
    // then the next RM item with stock goes in instead and Save is pressed again
    for (let t = 0; ; t++) {
      try {
        const vr = await save(/^Save$/);
        const rest = mode === "full" ? leftOver() : [];
        return { vr, missing: rest.length ? [`to add with Consumption mode: ${rest.join("; ")}`] : [] };
      }
      catch (e) {
        const m = /available stock for item code\s+([A-Z0-9]+)[^]*?Available Stock:\s*(-?[\d.]+)/i.exec(e.message);
        if (mode !== "full" || !m || !one || m[1] !== one.code || t >= 4) throw e;
        const l = h.rm.find(x => x.code === one.code);
        log(`   RM ${l ? l.label : one.code}: the ERP says its division stock is ${m[2]} MT - trying the next RM item`, "err");
        skip.add(one.code); RUN_SKIP.add(one.code);
        const old = one.code;
        one = await oneRm(h.rm, log, skip);                       // a new line first (the ERP needs one), then the refused one goes
        const rf = grid("R.M. Consumed For Material");
        for (const tr of realRows(rf).filter(x => cell(x, "ITEM_CODE").value.trim() === old).reverse()) await deleteRow(rf, tr);
        await checkRm({ [one.code]: one.qty });
      }
    }
  }
  // enter one RM line: the first item (in RM Report order) whose SMS1 stock covers min(0.001, its qty); if none does, the item with
  // the most stock, as much as it has. Returns {code, qty}.
  const ONE_RM_MAX = 0.001;   // just enough for the ERP to take the voucher; the heat's consumption goes in with Add RM later
  const RUN_SKIP = new Set();   // RM items whose division stock the ERP refused on Save (this run)
  async function oneRm(rm, log, skip) {
    await openTab("RM Consumption");
    const rf = await waitFor(() => grid("R.M. Consumed For Material"), 10000, "RM Consumption grid");
    let tr = realRows(rf).find(t => !cell(t, "ITEM_CODE").value.trim()) || null;
    const cands = rm.filter(l => l.code && !skip.has(l.code) && l.qty > 0);
    let best = null;
    for (const l of cands) {
      const want = r3(Math.min(ONE_RM_MAX, l.qty));
      if (!tr) tr = await addRow(rf);
      let r;
      try { r = await fillRmLine(rf, tr, l, want); }
      catch (e) { if (lov()) await closeLov(); if (notInList(e) && cell(tr, "ITEM_CODE").value.trim() !== l.code) { log(`   RM ${l.label}: ${l.code} is not in the ERP's RM item list - next item`); skip.add(l.code); continue; } throw e; }
      if (!r.short) { log(`   RM ${l.label} ${want.toFixed(3)} MT ✓ (${r.used}) - one RM line only; the rest with Consumption mode`, "ok"); return { code: l.code, qty: want }; }
      log(`   RM ${l.label}: ${r.reason ? "ERP: " + r.reason : "SMS1 stock " + r.avail.toFixed(3) + " MT"} - next item`);
      if (!r.reason && r.avail >= 0.001 && (!best || r.avail > best.avail)) best = { l, avail: r.avail };
    }
    if (best) {
      const want = r3(Math.min(best.avail, ONE_RM_MAX, best.l.qty));
      const r = await fillRmLine(rf, tr, best.l, want);
      if (!r.short) { log(`   RM ${best.l.label} ${want.toFixed(3)} MT ✓ (${r.used}) - all its SMS1 stock; the rest with Consumption mode`, "ok"); return { code: best.l.code, qty: want }; }
    }
    throw new Error("no RM item of this heat has SMS1 stock - no RM line could be entered and the ERP needs one");
  }
  async function openVoucherForEdit(vr, back = backToListing, remark = "RM consumption added by Moltrix") {
    await back();
    const findRow = () => [...document.querySelectorAll("tr")].filter(vis).find(r => new RegExp("\\b" + vr + "\\b").test(txt(r)));
    if (!findRow()) {
      const s = [...document.querySelectorAll("input")].filter(vis).find(i => /Search Here/i.test(i.placeholder || ""));
      if (s) { await typeInto(s, vr); keyEv(s, "Enter"); await sleep(2500); }
    }
    const r = await waitFor(findRow, 15000, "voucher " + vr + " in the list");
    click(r.children[1]); await sleep(800);
    const pen = [...document.querySelectorAll("ion-icon")].filter(vis).find(i => /create|pencil/.test(i.getAttribute("name") || ""));
    if (!pen) throw new Error("Edit button not found"); click(pen.closest("ion-button") || pen);
    // the ERP answers Edit with a message when this login may not edit the screen ("You do not have rights to perform this activity")
    await waitFor(() => { const a = alertBox();
      if (a && a.kind === "err") { const e = new Error(/rights/i.test(a.text) ? `the ERP does not let this login edit a saved voucher here ("${a.text.replace(/^Failed\s*/i, "").replace(/\s*OK$/, "").replace(/Know More.*$/i, "").trim()}")` : "ERP said: " + a.text.replace(/Know More.*$/i, "").slice(0, 200)); if (/rights/i.test(a.text)) { e.stopAll = true; e.noRights = true; } throw e; }
      return btn(/^Update$/) || formOpen(); }, 20000, "voucher to open in Edit");
    await waitFor(() => { const v = document.getElementById("VRNO") || inpOf(document, "VRNO"); return v ? v.value === vr : back !== backToListing; }, 10000, "voucher " + vr);
    await sleep(800);
    let ar = null; try { ar = field("Audit Remark").inp; } catch (e) { if (back === backToListing) throw e; }   // QC: only if the screen has one
    if (ar) await typeInto(ar, remark);
  }
  async function addConsumption(h, vr, log) {
    await openVoucherForEdit(vr);
    await openTab("RM Consumption");
    const rf = await waitFor(() => grid("R.M. Consumed For Material"), 10000, "RM Consumption grid");
    const before = rmRowsNow().filter(x => x.code);
    const have = rmTotals(before);
    const r = await fillRm(h.rm, log, have, false);
    if (!r.ok.length) { await backToListing(); return { vr, missing: r.missing, nothing: true }; }
    const expect = { ...have };
    Object.keys(r.added).forEach(c => { expect[c] = r3((expect[c] || 0) + r.added[c]); });
    await checkRm(expect);
    log("   all RM lines re-checked ✓", "ok");
    const v2 = await save(/^Update$/);
    return { vr: v2, missing: r.missing };
  }

  // Approve: Production Entry Listing → the voucher's row → ✓ in the toolbar → the voucher opens with Approve / Back → Approve
  async function approveVoucher(vr) {
    await backToListing();
    const findRow = () => [...document.querySelectorAll("tr")].filter(vis).find(r => new RegExp("\\b" + vr + "\\b").test(txt(r)));
    if (!findRow()) {
      const s = [...document.querySelectorAll("input")].filter(vis).find(i => /Search Here/i.test(i.placeholder || ""));
      if (s) { await typeInto(s, vr); keyEv(s, "Enter"); await sleep(2500); }
    }
    const clean = t => t.replace(/^(Failed|Information)\s*/i, "").replace(/Know More.*$/i, "").replace(/\s*OK$/, "").trim();
    const tickBtn = () => { const i = [...document.querySelectorAll("ion-icon")].filter(vis).find(e => /checkmark/.test(e.getAttribute("name") || "")); return i ? i.closest("ion-button") || i : null; };
    let already = false, opened = false;
    // the list and its toolbar load a moment after the listing shows (slower in the phone app): wait for the row and the ✓,
    // select the row, press ✓; if the voucher doesn't open, select and press once more
    for (let t = 0; t < 2 && !opened; t++) {
      const r = await waitFor(findRow, 20000, "voucher " + vr + " in the list");
      click(r.children[1]); await sleep(1200);
      const tb = await waitFor(tickBtn, 15000, "the Approve (✓) button above the voucher list");
      click(tb);
      try {
        await waitFor(() => { const a = alertBox();
          if (a && a.kind === "err") { if (/already\s+approved/i.test(a.text)) { already = true; return true; } throw new Error("ERP said: " + clean(a.text).slice(0, 200)); }
          return btn(/^Approve$/); }, 20000, "voucher to open for Approve");
        opened = true;
      } catch (e) { if (t || /^ERP said/.test(e.message)) throw e; await backToListing(); }
    }
    if (already) { const a = alertBox(); if (a) await closeAlert(a); await backToListing(); return { vr, already: true }; }
    // never approve another voucher: the open one must show this voucher number
    await waitFor(() => { const v = document.getElementById("VRNO") || inpOf(document, "VRNO"); return v ? v.value === vr : (document.body.innerText || "").includes(vr); }, 10000, "voucher " + vr + " to show in the open voucher");
    if (window.MZF_DRY) { log("   (dry run - not approved)", "h"); await backToListing(); return { vr: "DRY RUN" }; }
    await doAction(/^Approve$/, "Approve");
    const a = await waitFor(() => alertBox() || (onListing() ? { none: true } : null), 60000, "the ERP to answer Approve");
    if (!a.none) {
      const text = clean(a.text); await closeAlert(a);
      if (!/approv/i.test(text) || /not|fail|error|rights|cannot|can't|unable/i.test(text)) throw new Error("ERP said: " + text.slice(0, 200));
    }
    await backToListing();
    return { vr };
  }

  /* ================= Production QC (one per heat) ================= */
  const onQcListing = () => /^Production QC \[NQ:QCPRO\]/i.test(screenTitle()) && !formOpen() && !lov();
  const qcTab = () => [...document.querySelectorAll("*")].filter(vis).find(e => e.children.length === 0 && txt(e) === "Production QC" && e.getBoundingClientRect().top < 80);
  async function backToQcListing() {
    for (let i = 0; i < 4 && !onQcListing(); i++) {
      const a = alertBox(); if (a) await closeAlert(a); if (lov()) await closeLov();
      const b = btn(/^Back$/);
      if (!b && formOpen()) { try { await doAction(/^Back$/, "Back"); } catch (e) {} await sleep(2500); continue; }
      if (/\[NQ:QCPRO\]/.test(screenTitle()) && !formOpen()) { await sleep(1500); continue; }
      if (b && /\[NQ:QCPRO\]/.test(screenTitle())) click(b); else { const t = qcTab(); if (t) click(t); else if (b && formOpen()) click(b); }
      await sleep(2500);
    }
    try { await waitFor(onQcListing, 15000, "Production QC"); }
    catch (e) {
      if (e.message === "Stopped by user") throw e;
      if (await quickOpen("qc", onQcListing)) return;
      throw new Error(`the ERP is not on the Production QC screen (it shows "${screenTitle() || "(no screen title found)"}"). Open Production QC (Quick Search → QC → Production QC), then press Start again. [seen: ${seen()}]`);
    }
  }
  const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  const dmyOf = s => { const m = String(s).trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/); return m ? `${m[1].padStart(2, "0")}-${String(MON[m[2].toUpperCase()]).padStart(2, "0")}-${m[3]}` : ""; };
  // Batch No. list = lines of approved production vouchers; its search box only matches the
  // voucher number from the start, so list the Q2 vouchers and filter on the batch column
  async function qcPickBatch(h) {
    const { inp, wrap } = field("Batch No.");
    if (lov()) await closeLov();
    click(wrap.querySelector("ion-icon[name=search]") || wrap.querySelector("ion-icon"));
    const L = await waitFor(lov, 15000, "Batch No. list");
    const s = [...L.querySelectorAll("input")].find(i => /Search Here/i.test(i.placeholder || ""));
    s.focus(); setIn.call(s, "Q2"); s.dispatchEvent(new Event("input", { bubbles: true }));
    click(btn(/^Find$/, L));
    await waitFor(() => lovRows(L).length, 30000, "production vouchers in the Batch No. list");
    const heads = [...L.querySelectorAll("thead tr")].find(tr => [...tr.children].some(c => txt(c)));
    const names = [...heads.children].map(c => txt(c).replace(/\*$/, "").toLowerCase());
    const ci = n => { const i = names.indexOf(n); if (i < 0) throw new Error(`Batch No. list has no "${n}" column`); return i; };
    const cB = ci("batch no."), cI = ci("item code"), cD = ci("production vr date"), cV = ci("production vr no."), cS = ci("slno");
    const ftr = [...L.querySelectorAll("thead tr")].find(tr => tr.querySelector("input"));
    const f = ftr && ftr.children[cB] && ftr.children[cB].querySelector("input");
    if (f) await typeInto(f, `%${h.qc.batch}%`, 300);
    // the voucher date is the day it was entered (not the heat date) and the list only shows some
    // of the voucher's lines, so take the first listed billet line of this heat's batch
    const codes = h.qc.codes && h.qc.codes.length ? h.qc.codes : [h.qc.code];
    const match = () => { const r = lovRows(L).filter(r => txt(r.children[cB]) === h.qc.batch && codes.includes(txt(r.children[cI])));
      return r.length ? r.sort((a, b) => +txt(a.children[cS]) - +txt(b.children[cS])) : null; };
    let rows;
    try { rows = await waitFor(match, 15000, `batch ${h.qc.batch}`); }
    catch (e) { await closeLov(); throw new Error(`batch ${h.qc.batch} (${codes.join("/")}) is not in the ERP's Batch No. list - is the heat's production voucher approved?`); }
    const row = rows[0], vr = txt(row.children[cV]), code = txt(row.children[cI]), sl = txt(row.children[cS]);
    const td = [...row.children].find(t => getComputedStyle(t).display !== "none") || row.firstElementChild;
    mouse(td, "click"); mouse(td, "dblclick");
    await waitFor(() => !lov(), 15000, "lookup to close"); await sleep(800);
    if (inp.value.trim() !== h.qc.batch) throw new Error(`Batch No. shows "${inp.value}"`);
    return { vr, code, sl };
  }
  // ERP test (code or name) -> BIS Doc column. The ERP admin sets the test names, so match loosely.
  const QC_KEYS = ["C", "Mn", "P", "S", "Si", "N", "S+P", "CE", "Bend", "Camber", "Length", "Width", "Defects", "Grade"];
  const QC_NEED = ["C", "Mn", "P", "S", "Si", "N", "S+P", "CE", "Bend", "Camber", "Length", "Width", "Defects"];   // Grade only if the ERP asks
  function qcKeyOf(raw) {
    const t = String(raw || "").toLowerCase().replace(/[%()\s._-]+/g, " ").trim();
    if (!t) return null;
    if (/s ?\+ ?p|sulph?f?ur ?\+ ?phos|s and p/.test(t)) return "S+P";
    if (/carbon equiv|^ce$|^c ?e$|^c\.?e\.?$/.test(t)) return "CE";
    if (/^c$|carbon/.test(t)) return "C";
    if (/^mn$|mangan/.test(t)) return "Mn";
    if (/^p$|phosph/.test(t)) return "P";
    if (/^s$|sulph|sulf/.test(t)) return "S";
    if (/^si$|silic/.test(t)) return "Si";
    if (/^n$|nitrog/.test(t)) return "N";
    if (/bend/.test(t)) return "Bend";
    if (/camber/.test(t)) return "Camber";
    if (/length/.test(t)) return "Length";
    if (/width|size|dimension/.test(t)) return "Width";
    if (/defect|crack|visual|freedom|surface/.test(t)) return "Defects";
    if (/grade/.test(t)) return "Grade";
    return null;
  }
  function qcRowsNow() {
    const t = [...document.querySelectorAll("table")].filter(vis).filter(t => /Test Code/.test(txt(t.querySelector("thead") || t))).pop();
    return t ? [...t.querySelectorAll("tbody tr")].filter(tr => { const c = inpOf(tr, "TEST_CODE"); return c && c.value.trim(); }) : [];
  }
  const testOf = tr => qcKeyOf(inpOf(tr, "TEST_CODE").value) || qcKeyOf((inpOf(tr, "TEST_NAME") || {}).value);
  // numbers must come back equal (the ERP may round them); text must come back the same
  const sameVal = (got, want) => /^-?\d*\.?\d+$/.test(String(want).trim()) ? near(got, +want, 1e-9) : String(got).replace(/\s+/g, " ").trim() === String(want).replace(/\s+/g, " ").trim();
  async function newQc(h, log) {
    await backToQcListing();
    await newWithSeries("2G", backToQcListing); await seriesSet();
    await waitFor(() => { try { return field("Batch No."); } catch (e) { return null; } }, 20000, "new Production QC"); await sleep(800);
    await headerLov("Plant", "Plant Code", "INDF1", "INDUCTION FURNACE");
    await headerLov("Process", "Process Code", "BILLETS", "BILLETS");
    await headerLov("Item Category", "Item Category", "BL", "BILLETS");
    await headerLov("Shift Code", "Shift Code", "A", "^A$");
    const qt = field("QC Time").inp, when = `${h.date} 10:00:00`;
    // PC shows 11-11-2026 10:00:00, the phone 11-Nov-2026 10:00:00 - same time
    const sameWhen = v => { v = String(v || "").trim(); if (v === when) return true; const m = /^(\S+)\s+(\d{1,2}:\d{2}(:\d{2})?)$/.exec(v); return !!m && dmyOf(m[1]) === h.date && /^10:00(:00)?$/.test(m[2]); };
    await typeInto(qt, `${monDate(h.date)} 10:00:00`); if (!sameWhen(qt.value)) await typeInto(qt, when); if (!sameWhen(qt.value)) throw new Error(`QC Time shows "${qt.value}"`);
    const pb = await qcPickBatch(h);
    await headerLov("Item Name", "Item Code", pb.code);
    if (field("Batch No.").inp.value.trim() !== h.qc.batch) throw new Error(`Batch No. was cleared after choosing the item (shows "${field("Batch No.").inp.value}")`);
    log(`   production voucher ${pb.vr} line ${pb.sl}, batch ${h.qc.batch}, item ${pb.code}`);
    click(btn(/^Show$/));
    await waitFor(() => { const a = alertBox(); if (a && a.kind === "err") throw new Error("ERP said: " + a.text.replace(/Know More.*$/i, "").slice(0, 200)); return qcRowsNow().length; }, 20000, "test list");
    await sleep(800);
    const r = await qcFill(h, log, false);
    if (!r.done) throw new Error(`none of the ERP's tests (${r.inErp.map(k => k || "?").join(", ")}) could be filled from the BIS Doc - nothing to save`);
    if (!sameWhen(field("QC Time").inp.value)) throw new Error(`check before saving failed - QC Time shows "${field("QC Time").inp.value}"`);
    if (window.MZF_DRY) { log("   (dry run - not saved)", "h"); return { vr: "DRY RUN", left: r.left }; }
    return { vr: await save(/^Save$/), left: r.left };
  }
  // fill the test list now on the screen from the BIS Doc. onlyEmpty: a saved QC opened again - tests that already
  // have a result stay as they are, only the empty ones are filled
  async function qcFill(h, log, onlyEmpty) {
    // what the ERP's test list has gets entered; parameters it doesn't have (yet) are only reported
    const rows = qcRowsNow(), inErp = rows.map(testOf);
    const unknown = rows.filter(r => !testOf(r)).map(r => inpOf(r, "TEST_CODE").value.trim() + " " + ((inpOf(r, "TEST_NAME") || {}).value || ""));
    if (unknown.length) log(`   ERP test(s) Moltrix can't match to a BIS Doc column, left empty: ${unknown.join(", ")}`, "err");
    const notInErp = QC_NEED.filter(k => !inErp.includes(k));
    if (notInErp.length) log(`   not in the ERP's test list for ${h.qc.code} (not entered): ${notInErp.join(", ")}`, "err");
    const hasVal = tr => String(inpOf(tr, "TEST_RESULT").value || "").trim() !== "";
    const had = new Set(onlyEmpty ? rows.filter(tr => testOf(tr) && hasVal(tr)).map(testOf) : []);
    if (had.size) log(`   already in this QC (left as they are): ${[...had].join(", ")}`);
    const done = new Set(), noVal = [], rounded = [], keptVal = new Map();
    for (const tr of rows) {
      const k = testOf(tr); if (!k || had.has(k)) continue;
      const want = h.qc.vals[k];
      if (want === null || want === undefined || want === "") { noVal.push(k); continue; }
      const inp = inpOf(tr, "TEST_RESULT");
      inp.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await editCell(inp, String(want));
      if (!sameVal(inp.value, want)) {
        // the ERP keeps fewer decimals (0.034 -> 0.03): saved as the ERP keeps it, and noted
        const kept = String(inp.value).trim(), dec = (kept.split(".")[1] || "").length;
        if (/^-?\d*\.?\d+$/.test(String(want).trim()) && /^-?\d*\.?\d+$/.test(kept) && Math.abs(+kept - +want) <= 0.5 * Math.pow(10, -dec) + 1e-9) {
          rounded.push(`${k} ${want} → ${kept}`); keptVal.set(k, kept);
        } else throw new Error(`${k}: typed "${want}" but the ERP keeps "${inp.value}"`);
      }
      const sel = tr.querySelector("ion-select");
      if (sel && sel.value !== "P") { sel.value = "P"; sel.dispatchEvent(new CustomEvent("ionChange", { detail: { value: "P" }, bubbles: true })); await sleep(300); }
      if (!sel || sel.value !== "P") throw new Error(`${k}: Test Status did not take Pass`);
      done.add(k);
    }
    if (noVal.length) log(`   no value in the BIS Doc for ${noVal.join(", ")} - left empty`, "err");
    if (rounded.length) log(`   the ERP keeps fewer decimals - saved as: ${rounded.join(", ")} (BIS Doc value → ERP)`, "err");
    // tests still without a result in this QC - tried again on the next run (BIS Doc filled later / test added in the ERP)
    const need = QC_NEED.concat(inErp.includes("Grade") ? ["Grade"] : []);
    const left = need.filter(k => !had.has(k) && !done.has(k));
    if (!done.size) return { done: 0, inErp, left };
    // final check (only the tests filled now)
    const filled = qcRowsNow().filter(tr => done.has(testOf(tr)));
    const got = filled.map(tr => `${testOf(tr)} ${inpOf(tr, "TEST_RESULT").value} ${(tr.querySelector("ion-select") || {}).value}`);
    const bad = filled.filter(tr => { const k = testOf(tr); return !sameVal(inpOf(tr, "TEST_RESULT").value, keptVal.has(k) ? keptVal.get(k) : h.qc.vals[k]) || (tr.querySelector("ion-select") || {}).value !== "P"; });
    if (bad.length || field("Batch No.").inp.value.trim() !== h.qc.batch) throw new Error("check before saving failed - " + got.join("; "));
    log(`   ${got.map(g => g.replace(/ P$/, "")).join(", ")} · Pass ✓`, "ok");
    return { done: done.size, inErp, left };
  }
  // run again for a heat whose QC is already saved: open that QC, fill the tests that are still empty and Update
  async function qcAddRest(h, vr, log) {
    log(`   QC ${vr} is already saved - opening it to add the tests that are still empty`);
    await openVoucherForEdit(vr, backToQcListing, "QC tests added by Moltrix");
    await waitFor(() => qcRowsNow().length, 20000, "the QC's test list");
    await sleep(800);
    if (field("Batch No.").inp.value.trim() !== h.qc.batch) throw new Error(`QC ${vr} is for batch "${field("Batch No.").inp.value}", not ${h.qc.batch}`);
    const r = await qcFill(h, log, true);
    if (!r.done) { await backToQcListing(); return { vr, nothing: true, left: r.left }; }
    if (window.MZF_DRY) { log("   (dry run - not updated)", "h"); return { vr: "DRY RUN", left: r.left }; }
    const v2 = await save(/^Update$/);
    return { vr: /^\(/.test(v2) ? vr : v2, left: r.left };
  }

  /* ================= Indent (Purchase Requisition [IP:INDI]) / Requisition - Store Issue [NI:REQI] ================= */
  const IRQ_DONE_KEY = "moltrixErpIrqDone";   // list id -> voucher no
  const IRQ = {
    indent: { re: /\[IP:INDI\]/, listing: /^Purchase Requisition Listing \[IP:INDI\]/i, tab: "Purchase Requisition Listing", name: "Indent (Purchase Requisition)",
      open: "Quick Search → requ → Purchase Requisition Entry", qty: "AQTYINDENT", qtyUm: "QTYINDENT" },
    req: { re: /\[NI:REQI\]/, listing: /^Requisition - Store Issue \[NI:REQI\]/i, tab: "Requisition - Store Issue - Listing", name: "Requisition - Store Issue",
      open: "Quick Search → store issue → Store Issue Requisition", qty: "APARTYQTY", qtyUm: "PARTYQTY" }
  };
  const irqCfg = m => IRQ[m];
  // these screens jump to the next field (and open its lookup) on a Tab key, so type without one
  async function typePlain(inp, v, wait = 500) {
    inp.focus(); (inp.tagName === "TEXTAREA" ? setTa : setIn).call(inp, String(v));
    inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true }));
    inp.dispatchEvent(new FocusEvent("blur")); inp.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); inp.blur();
    await sleep(wait);
  }
  const onIrqListing = m => irqCfg(m).listing.test(screenTitle()) && !formOpen() && !lov() && !irqModalOpen();
  const irqModalOpen = () => vis(inpOf(document, "ITEM_NAME")) && !!inpOf(document, inpOf(document, "AQTYINDENT") ? "AQTYINDENT" : "APARTYQTY");
  const val = id => ((inpOf(document, id) || {}).value || "").trim();
  const byTitle = (t, tag = "input,textarea") => [...document.querySelectorAll(tag)].filter(vis).filter(e => e.title === t).pop();
  async function backToIrqListing(m) {
    const c = irqCfg(m);
    for (let i = 0; i < 4 && !onIrqListing(m); i++) {
      const a = alertBox(); if (a) await closeAlert(a); if (lov()) await closeLov();
      if (irqModalOpen()) { const cr = btn(/^Cancel Record$/); if (cr) { click(cr); await sleep(1500); continue; } }
      const b = btn(/^Back$/);
      if (!b && formOpen() && !irqModalOpen()) { try { await doAction(/^Back$/, "Back"); } catch (e) {} await sleep(2500); continue; }
      if (c.listing.test(screenTitle()) && !formOpen() && !irqModalOpen()) { await sleep(1500); continue; }
      if (b && c.re.test(screenTitle())) click(b);
      else { const t = [...document.querySelectorAll("*")].filter(vis).find(e => e.children.length === 0 && txt(e) === c.tab && e.getBoundingClientRect().top < 80); if (t) click(t); else if (b) click(b); }
      await sleep(2500);
    }
    try { await waitFor(() => onIrqListing(m), 15000, c.tab); }
    catch (e) {
      if (e.message === "Stopped by user") throw e;
      if (await quickOpen(m === "indent" ? "indent" : "req", () => onIrqListing(m))) return;
      throw new Error(`the ERP is not on the ${c.tab} screen (it shows "${screenTitle() || "(no screen title found)"}"). Open it (${c.open}), wait for the list, then press Start again. [seen: ${seen()}]`);
    }
  }
  // search icon next to an input inside the item form
  function iconOf(id) { let w = inpOf(document, id); for (let k = 0; k < 5 && w && !w.querySelector("ion-icon[name=search]"); k++) w = w.parentElement; return w && w.querySelector("ion-icon[name=search]"); }
  async function itemLov(id, col, value) {
    for (let t = 0; t < 2; t++) {
      const ic = iconOf(id); if (!ic) throw new Error(`lookup for ${id} not found`); if (lov()) await closeLov(); click(ic);
      try { await pickLov(col, value); return; }
      catch (e) { if (t || !/Timed out waiting for lookup rows/.test(e.message)) throw e; await closeLov(); await sleep(2000); }
    }
  }
  // ng-select dropdowns (Stock Type, Priority): the ERP reacts only when the field loses focus
  // a list field on the item form, whatever it is here: ng-select (PC), ion-select / <select> (phone browsers)
  async function itemSel(label, re) {
    const l = [...document.querySelectorAll("p, ion-label, label, span, div")].filter(e => vis(e) && e.children.length === 0 && txt(e).replace(/\*$/, "").trim() === label && !e.closest("#mzfPanel")).pop();
    if (!l) throw new Error(`Field "${label}" not found`);
    let z = l; for (let k = 0; k < 6 && z && !z.querySelector("ng-select, ion-select, select"); k++) z = z.parentElement;
    const ns = z && z.querySelector("ng-select, ion-select, select"); if (!ns) throw new Error(`"${label}" list not found`);
    const tag = ns.tagName.toLowerCase();
    if (tag === "ng-select") {
      const cur = () => txt(ns.querySelector(".ng-value") || { innerText: "" });
      if (!re.test(cur())) {
        const inp = ns.querySelector("input");
        let opts = [];
        for (let t = 0; t < 4 && !opts.some(x => re.test(txt(x))); t++) {   // the list can open empty and fill a moment later - open it again
          if (inp) inp.focus();
          if (!document.querySelector("ng-dropdown-panel")) (t % 2 ? (ns.querySelector(".ng-arrow-wrapper") || ns.querySelector(".ng-select-container")) : ns.querySelector(".ng-select-container")).dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          for (let w = 0; w < 8 && !opts.some(x => re.test(txt(x))); w++) { await sleep(300); opts = [...document.querySelectorAll("ng-dropdown-panel .ng-option")]; }
          if (!opts.some(x => re.test(txt(x)))) { document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); await sleep(500); }
        }
        const o = opts.find(x => re.test(txt(x)));
        if (!o) throw new Error(`"${label}" has no option ${re} (it has ${opts.map(txt).join(", ") || "none"})`);
        ["mousedown", "mouseup", "click"].forEach(t => o.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))); await sleep(800);
      }
      if (!re.test(cur())) throw new Error(`"${label}" shows "${cur()}"`);
      return;
    }
    const opts = tag === "select" ? [...ns.options].map(o => ({ v: o.value, t: o.text.trim() })) : [...ns.querySelectorAll("ion-select-option")].map(o => ({ v: o.value != null ? o.value : o.getAttribute("value"), t: txt(o) }));
    const curT = () => { const o = opts.find(x => String(x.v) === String(ns.value)); return o ? o.t : String(ns.value || ""); };
    if (!re.test(curT())) {
      const o = opts.find(x => re.test(x.t)) || opts.find(x => re.test(String(x.v)));
      if (!o) throw new Error(`"${label}" has no option ${re} (has ${opts.map(x => x.t).join(", ") || "none"})`);
      ns.value = o.v;
      if (tag === "select") ns.dispatchEvent(new Event("change", { bubbles: true }));
      else ns.dispatchEvent(new CustomEvent("ionChange", { detail: { value: o.v }, bubbles: true }));
      await sleep(800);
    }
    if (!re.test(curT())) throw new Error(`"${label}" shows "${curT()}"`);
  }
  async function ngPick(label, re) {
    const lab = [...document.querySelectorAll("p.input-group-label, ion-label.input-group-label")].filter(e => vis(e) && txt(e).replace(/\*$/, "") === label).pop();
    if (!lab) throw new Error(`Field "${label}" not found`);
    let w = lab; for (let k = 0; k < 5 && w && !w.querySelector("ng-select"); k++) w = w.parentElement;
    const ns = w && w.querySelector("ng-select"); if (!ns) throw new Error(`"${label}" list not found`);
    const inp = ns.querySelector("input"), cur = () => txt(ns.querySelector(".ng-value") || { innerText: "" });
    if (!re.test(cur())) {
      inp.focus(); ns.querySelector(".ng-select-container").dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); await sleep(500);
      const opts = [...document.querySelectorAll("ng-dropdown-panel .ng-option")], o = opts.find(x => re.test(txt(x)));
      if (!o) throw new Error(`"${label}" has no option ${re} (it has ${opts.map(txt).join(", ")})`);
      ["mousedown", "mouseup", "click"].forEach(t => o.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }))); await sleep(300);
    }
    inp.dispatchEvent(new FocusEvent("blur")); inp.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); await sleep(1200);
    if (!re.test(cur())) throw new Error(`${label} shows "${cur()}"`);
  }
  // Stock Type / Priority set inside the item form don't reliably take (the field is often locked), so set the
  // voucher's Default Details once - Stock Type R, cost (+ Priority, Required Date for an indent; godown, Ref / Batch
  // N.D. for a requisition) - and every item gets them when its item (and division) is chosen
  async function irqDefaults(m, d) {
    IRQ_NODEF = false;
    // on the phone layout the item form's buttons (Add Record, Ok, Default Details …) sit at its very bottom and come a bit later
    await toFormBottom();   // the phone layout may only build the bottom buttons once they are scrolled to
    const b = await waitFor(() => btn(/^Default Details$/) || anyAct(/^Default Details$/), 12000, "the Default Details button").catch(() => null);
    if (b) await pressAct(b);
    else { log(`   Default Details not seen (v${VERSION}, ${document.querySelectorAll("*").length} elements, text on page: ${/Default\s*Details/i.test(document.body.innerText) ? "yes" : "no"}) - buttons on screen: ${[...document.querySelectorAll("ion-button, button")].filter(vis).filter(x => !x.closest("#mzfPanel")).map(txt).filter(Boolean).slice(0, 20).join(" | ")}`, "h"); await doAction(/^Default Details$/, "Default Details"); }
    const cost = await waitFor(() => { const i = inpOf(document, "DEFAULT_COST_NAME"); return vis(i) && i; }, 10000, "Default Details");
    await sleep(500);
    // the Default Details box: the first parent of its cost field that has a dropdown and an Ok button. Its dropdowns are
    // ng-select on the PC; in the phone app they can be ion-select or a plain <select> - all three are handled
    const SEL = "ng-select, ion-select, select";
    let box = cost; for (let k = 0; k < 16 && box && !(box.querySelector(SEL) && ([...box.querySelectorAll("ion-button,button")].some(x => /^Ok$/i.test(txt(x))) || anyAct(/^Ok$/i, box))); k++) box = box.parentElement;
    if (!box) box = document.body;
    async function ng(label, re) {
      const lab = [...box.querySelectorAll("p, ion-label, label, span, div")].filter(e => vis(e) && e.children.length === 0 && txt(e).replace(/\*$/, "").trim() === label)[0];
      let q = lab; for (let k = 0; k < 6 && q && !q.querySelector(SEL); k++) q = q.parentElement;
      const ns = q && q.querySelector(SEL); if (!ns) throw new Error(`Default Details: ${label} not found`);
      const tag = ns.tagName.toLowerCase();
      if (tag === "ng-select") {
        const cur = () => txt(ns.querySelector(".ng-value") || { innerText: "" });
        if (!re.test(cur())) {
          ns.querySelector("input").focus(); ns.querySelector(".ng-select-container").dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); await sleep(500);
          const o = [...document.querySelectorAll("ng-dropdown-panel .ng-option")].find(x => re.test(txt(x))); if (!o) throw new Error(`Default Details: ${label} has no option ${re}`);
          o.click(); await sleep(600);
        }
        if (!re.test(cur())) throw new Error(`Default Details: ${label} shows "${cur()}"`);
        return;
      }
      const opts = tag === "select" ? [...ns.options].map(o => ({ v: o.value, t: o.text.trim() })) : [...ns.querySelectorAll("ion-select-option")].map(o => ({ v: o.value != null ? o.value : o.getAttribute("value"), t: txt(o) }));
      const curT = () => { const o = opts.find(x => String(x.v) === String(ns.value)); return o ? o.t : String(ns.value || ""); };
      if (!re.test(curT())) {
        const o = opts.find(x => re.test(x.t)) || opts.find(x => re.test(String(x.v)));
        if (!o) throw new Error(`Default Details: ${label} has no option ${re} (has ${opts.map(x => x.t).join(", ") || "none"})`);
        ns.value = o.v;
        if (tag === "select") ns.dispatchEvent(new Event("change", { bubbles: true }));
        else ns.dispatchEvent(new CustomEvent("ionChange", { detail: { value: o.v }, bubbles: true }));
        await sleep(600);
      }
      if (!re.test(curT())) throw new Error(`Default Details: ${label} shows "${curT()}"`);
    }
    await ng("Stock Type", /^R\b/);
    if (m === "indent") await ng("Priority", new RegExp("^" + (d.opts.priority || "Medium") + "$", "i"));
    await itemLov("DEFAULT_COST_NAME", "Cost Code", d.opts.cost || "LAB01"); await sleep(500);
    const want = [["DEFAULT_COST_CODE", d.opts.cost || "LAB01"]];
    if (m === "req") {
      await itemLov("DEFAULT_GODOWN_NAME", "Godown Name", d.opts.godown || "CENTRAL STORE"); await sleep(500);
      await typePlain(inpOf(document, "DEFAULT_REF_SLNO"), "N.D.", 400);
      await typePlain(inpOf(document, "DEFAULT_BATCHNO"), "N.D.", 400);
      want.push(["DEFAULT_GODOWN_CODE", "STORE"], ["DEFAULT_REF_SLNO", "N.D."], ["DEFAULT_BATCHNO", "N.D."]);
    } else {
      const rd = [...box.querySelectorAll("input")].filter(vis).find(e => /Required Date/i.test(e.title || ""));
      if (!rd) throw new Error("Default Details: Required Date not found");
      await setErpDate(rd, d.opts.reqDate, "Default Details");
    }
    const bad = want.filter(([k, v]) => val(k) !== v);
    if (bad.length) throw new Error("Default Details: " + bad.map(([k]) => `${k.replace("DEFAULT_", "")} shows "${val(k)}"`).join(", "));
    let q = cost, ok = null; while (q && !ok) { q = q.parentElement; ok = q && ([...q.querySelectorAll("ion-button,button")].filter(vis).find(x => /^Ok$/i.test(txt(x))) || (q !== document.body && anyAct(/^Ok$/i, q))); }
    if (!ok) throw new Error("Default Details: Ok button not found");
    await pressAct(ok);
    // In the phone app the ERP's own Ok code fails here: "TypeError … (reading 'G_YRBEGDATE')" and the box stays open
    // (by hand in Chrome it works). Then: close the message, Cancel the box and fill the item form itself (Division SM
    // brings the defaults; Required Date is typed on the item).
    try { await waitFor(() => !vis(inpOf(document, "DEFAULT_COST_NAME")), 8000, "Default Details to close"); }
    catch (e) {
      const a = alertBox();
      if (!a || !/TypeError|Cannot read propert|G_YRBEG/i.test(a.text)) throw e;
      log(`   ERP ki apni galti on Default Details Ok (${a.text.replace(/^\s*Information\s*/i, "").replace(/\s*OK\s*$/, "").slice(0, 90)}) - box band karke item form par seedha bhar raha hoon`, "h");
      await closeAlert(a); await sleep(600);
      let q2 = cost, cancel = null; while (q2 && !cancel) { q2 = q2.parentElement; cancel = q2 && [...q2.querySelectorAll("ion-button,button")].filter(vis).find(x => /^Cancel$/i.test(txt(x))); }
      if (cancel) click(cancel);
      await waitFor(() => !vis(inpOf(document, "DEFAULT_COST_NAME")), 6000, "Default Details to close after Cancel");
      IRQ_NODEF = true;
    }
    await sleep(600);
  }
  let IRQ_NODEF = false;   // Default Details couldn't be used - the item form gets everything itself
  // "Show Stock" fills the item form's stock table; read the Division row
  async function irqStock() {
    const b = btn(/^Show Stock$/);
    if (b) { b.click(); await waitFor(() => val("DIV_STOCK") !== "" || val("DIV_BAL_INDENT") !== "", 6000, "stock").catch(() => {}); await sleep(400); }
    const f = (k, n) => { const v = val(k); return `${n} ${v === "" ? "not shown" : v}`; };
    return [f("DIV_STOCK", "available"), f("DIV_BAL_INDENT", "indent balance"), f("DIV_PUR_STOCK", "in purchase"), f("DIV_DEPT_STOCK", "dept stock")].join(" · ");
  }
  // on the phone layout the item form's bottom buttons are not <button>s: the smallest thing on the page with that text
  function anyAct(re, root = document) {
    return [...root.querySelectorAll("*")].filter(e => vis(e) && !e.closest("#mzfPanel") && re.test(txt(e)) && (e.innerText || "").length < 40)
      .sort((x, y) => x.querySelectorAll("*").length - y.querySelectorAll("*").length)[0] || null;
  }
  function itemFormBox() { let w = inpOf(document, "ITEM_NAME"); for (let k = 0; k < 14 && w && w.parentElement && !/Default\s*Details/i.test(w.innerText || ""); k++) w = w.parentElement; return w || document; }
  async function toFormBottom() {
    const i = inpOf(document, "ITEM_NAME"), ic = i && i.closest("ion-content");
    try { if (ic && ic.scrollToBottom) await ic.scrollToBottom(0); } catch (e) {}
    let w = i; for (let k = 0; k < 20 && w; k++, w = w.parentElement) if (w.scrollHeight > w.clientHeight + 20) w.scrollTop = w.scrollHeight;
    await sleep(800);
  }
  async function pressAct(e) {
    e.scrollIntoView({ block: "center" }); await sleep(300);
    const t = e.closest("ion-button, button, a, [role=button], ion-item, ion-col") || e;
    click(t);
    await sleep(300);
  }
  function modalOk() { let w = inpOf(document, "ITEM_NAME"); while (w) { w = w.parentElement; const b = w && [...w.querySelectorAll("ion-button,button")].filter(vis).find(x => /^OK$/i.test(txt(x))); if (b) return b; } return null; }
  const irqGridRows = () => { const t = grid("Item Details").querySelector("table"); const H = [...t.querySelectorAll("thead th")].map(th => txt(th)).filter(Boolean);
    return [...t.querySelectorAll("tbody tr")].map(r => { const c = [...r.children].map(td => txt(td)); const o = {}; H.forEach((h, i) => o[h] = c[i] || ""); return o; }).filter(o => (o["Item Code"] || "").trim()); };
  const numOf = s => +String(s || "").replace(/,/g, "");
  async function irqAddItem(m, it, d, log) {
    const c = irqCfg(m), before = irqGridRows().length;
    const fr = grid("Item Details"), add = [...fr.querySelectorAll("ion-icon[name=add-circle-outline]")].find(vis);
    if (!add) throw new Error("the + (add item) button was not found");
    (add.closest("ion-button,button") || add).click();
    await waitFor(() => irqModalOpen() && !val("ITEM_CODE"), 15000, "item form");
    await sleep(600);
    // Indent: Default Details is not opened at all - its Ok fails inside the ERP ("G_YRBEGDATE") when filled by Moltrix,
    // and the voucher then gives "Problem in Approval" on Save. The ERP itself puts Stock Type, Priority, Division and
    // Cost on the item; Moltrix sets Cost (if needed) and the Required Date on the item.
    if (m === "indent") { if (!d._defaultsSet) { IRQ_NODEF = true; d._defaultsSet = true; log("   (Default Details not used - item filled directly)", "h"); } }
    else if (!d._defaultsSet) { await irqDefaults(m, d); d._defaultsSet = true; }
    await itemLov("ITEM_NAME", "Item Code", it.code); await sleep(1500);
    if (val("ITEM_CODE").toUpperCase() !== it.code.toUpperCase()) throw new Error(`item shows "${val("ITEM_CODE")}" instead of ${it.code}`);
    const erpName = val("ITEM_NAME");
    const ngVal = label => {   // ng-select on the PC; ion-select / <select> in the phone app
      const l = [...document.querySelectorAll("p.input-group-label, ion-label.input-group-label, p, ion-label, label")].filter(e => vis(e) && e.children.length === 0 && txt(e).replace(/\*$/, "").trim() === label && !e.closest("#mzfPanel")).pop();
      let z = l; for (let k = 0; k < 6 && z && !z.querySelector("ng-select, ion-select, select"); k++) z = z.parentElement;
      const n = z && z.querySelector("ng-select, ion-select, select"); if (!n) return "";
      if (n.tagName === "NG-SELECT") return txt(n.querySelector(".ng-value") || { innerText: "" });
      const opts = n.tagName === "SELECT" ? [...n.options].map(o => ({ v: o.value, t: o.text.trim() })) : [...n.querySelectorAll("ion-select-option")].map(o => ({ v: o.value != null ? o.value : o.getAttribute("value"), t: txt(o) }));
      const o = opts.find(x => String(x.v) === String(n.value)); return o ? o.t : String(n.value || "");
    };
    if (m === "indent") {   // defaults come in once the Division is chosen (the first item gets it by itself)
      await sleep(800);
      // as done by hand on the PC (14-Nov, IR26-000028 saved): Stock Type R from its list - the ERP then puts Division SM
      if (IRQ_NODEF && !/^R\b/.test(ngVal("Stock Type"))) {
        try { await itemSel("Stock Type", /^R\b/); await waitFor(() => val("DIV_NAME"), 5000, "Division after Stock Type").catch(() => {}); }
        catch (e) { log(`   Stock Type: ${e.message}`, "h"); }
      }
      if (!val("DIV_NAME") || !/^R\b/.test(ngVal("Stock Type"))) { await itemLov("DIV_NAME", "Division Code", "SM"); await sleep(2000); }
      await waitFor(() => val("COST_CODE") && /^R\b/.test(ngVal("Stock Type")), 6000, "default details on the item").catch(() => {});
      const bad = [];
      if (!/^R\b/.test(ngVal("Stock Type"))) bad.push(`Stock Type shows "${ngVal("Stock Type")}"`);
      if (!new RegExp("^" + (d.opts.priority || "Medium") + "$", "i").test(ngVal("Priority"))) bad.push(`Priority shows "${ngVal("Priority")}"`);
      if (IRQ_NODEF) {   // no Default Details: Priority, Cost and Required Date on the item itself
        if (val("COST_CODE") !== (d.opts.cost || "LAB01")) { await itemLov("COST_NAME", "Cost Code", d.opts.cost || "LAB01"); await sleep(800); }
        const prRe = new RegExp("^" + (d.opts.priority || "Medium") + "$", "i");
        if (!prRe.test(ngVal("Priority"))) { try { await itemSel("Priority", prRe); } catch (e) { log(`   Priority: ${e.message}`, "h"); } }   // the PC item form leaves it empty
        const rdI = [...document.querySelectorAll("input")].filter(vis).find(e => /Required Date/i.test(e.title || "") && !e.closest("#mzfPanel"));
        if (rdI && dmyOf(rdI.value) !== d.opts.reqDate) await setErpDate(rdI, d.opts.reqDate, "Item");
        const a = alertBox(); if (a && /TypeError|G_YRBEG/i.test(a.text)) throw new Error("ERP ki apni galti item ki Required Date par bhi: " + a.text.slice(0, 90));
        bad.length = 0;
        if (!/^R\b/.test(ngVal("Stock Type"))) bad.push(`Stock Type shows "${ngVal("Stock Type")}"`);
        if (!new RegExp("^" + (d.opts.priority || "Medium") + "$", "i").test(ngVal("Priority"))) bad.push(`Priority shows "${ngVal("Priority")}"`);
        if (val("COST_CODE") !== (d.opts.cost || "LAB01")) bad.push(`Cost/Project shows "${val("COST_CODE")}"`);
        if (rdI && !dateOk(rdI, d.opts.reqDate)) bad.push(`Required Date shows "${rdI.value}"`);
      }
      if (bad.length) throw new Error(bad.join(", "));
    } else {   // godown, cost, stock type, batch, ref come from Default Details
      await waitFor(() => val("GODOWN_CODE") && val("COST_CODE") && val("BATCHNO") && val("REF_SLNO"), 8000, "default details on the item").catch(() => {});
      const bad = [["GODOWN_CODE", "STORE"], ["COST_CODE", d.opts.cost || "LAB01"], ["BATCHNO", "N.D."], ["REF_SLNO", "N.D."]].filter(([k, v]) => val(k) !== v);
      if (bad.length) throw new Error(bad.map(([k]) => `${k} shows "${val(k)}"`).join(", "));
      await itemLov("AUM", "Tranum", val("AUM") || val("UM")); await sleep(2000);   // gives C/F and the rate
    }
    if (val("COST_CODE") !== (d.opts.cost || "LAB01")) throw new Error(`Cost/Project shows "${val("COST_CODE")}"`);
    if (!val("DIV_NAME")) throw new Error("Division is empty");
    if (!val("AUMTOUM")) { const um = val("AUM") || val("UM"); if (um) { await itemLov("AUM", "Tranum", um); await sleep(800); } }
    const cf = +val("AUMTOUM"); if (!cf) throw new Error("C/F (Tran UM) is empty");
    // the ERP sometimes opens the Cost/Project lookup by itself; until it is answered nothing else is worked out
    const settle = async () => { await sleep(300); const L = lov(); if (!L) return;
      if (/Cost\/Project/i.test(txt(L).slice(0, 40))) { await pickLov("Cost Code", d.opts.cost || "LAB01"); await sleep(800); } else await closeLov(); };
    await settle();
    // stock of this item in the division (what the ERP's "Item Stock Validation" rule looks at) - only shown, Moltrix doesn't decide
    const stock = await irqStock(); await settle();
    it._bal = numOf(val("DIV_BAL_INDENT")) || 0;   // an Indent already pending for this item
    // the first typing right after a lookup is sometimes not taken (Quantity UM stays empty) - type again
    const q = inpOf(document, c.qty);
    const cfIn = inpOf(document, "AUMTOUM");
    for (let t = 0; t < 4 && !near(val(c.qtyUm), it.qty * cf, 0.0005); t++) {
      await settle();
      if (t % 2 === 1 && cfIn && !cfIn.readOnly) await typePlain(cfIn, cfIn.value, 700);   // retyping C/F makes the ERP work out Quantity UM
      else { if (t) { await typePlain(q, "", 400); await sleep(400); } await typePlain(q, it.qty, 700); await answerOptions(); }
      await waitFor(() => near(val(c.qtyUm), it.qty * cf, 0.0005) || lov(), 3000, "Quantity UM").catch(() => {});
    }
    await settle();
    if (!near(q.value, it.qty, 0.0005)) throw new Error(`Quantity shows "${q.value}" instead of ${it.qty}`);
    if (!near(val(c.qtyUm), it.qty * cf, 0.0005)) throw new Error(`Quantity UM shows "${val(c.qtyUm)}" (expected ${r3(it.qty * cf)})`);
    let rateNote = "";
    if (m === "indent") {
      // rate = the ERP's own FC Rate; only when the ERP gives none, the rate from Moltrix (typed / last indent)
      await waitFor(() => numOf(val("FC_RATE")) > 0, 4000, "FC Rate").catch(() => {});
      const erpRate = numOf(val("FC_RATE"));
      if (erpRate > 0) { it._rate = erpRate; rateNote = ` @ ${erpRate} (ERP rate)`; }
      else {
        if (!(+it.rate > 0)) throw new Error("the ERP gives no rate for this item and Moltrix has none - type the rate in Moltrix and send again");
        await typePlain(inpOf(document, "FC_RATE"), it.rate, 600);
        if (!near(numOf(val("FC_RATE")), it.rate, 0.0001)) throw new Error(`FC Rate shows "${val("FC_RATE")}" instead of ${it.rate}`);
        it._rate = +it.rate; rateNote = ` @ ${it.rate} (ERP had no rate - rate from Moltrix)`;
      }
      const rd = byTitle("Required Date", "input"); if (!rd) throw new Error("Required Date not found");
      if (dmyOf(rd.value) !== d.opts.reqDate) await setErpDate(rd, d.opts.reqDate, "Item");
      const pu = byTitle("Purpose", "textarea"); if (!pu) throw new Error("Purpose not found");
      await typeTextLikeHand(pu, d.opts.purpose); if (pu.value !== d.opts.purpose) throw new Error("Purpose did not take the text");
    } else {
      const rm = byTitle("Remark", "textarea"); if (!rm) throw new Error("Remark not found");
      await typeTextLikeHand(rm, d.opts.remark); if (rm.value !== d.opts.remark) throw new Error("Remark did not take the text");
      rateNote = val("PROVRATE") ? ` (prov. rate ${val("PROVRATE")})` : "";
    }
    await settle();
    if (!near(val(c.qtyUm), it.qty * cf, 0.0005)) throw new Error(`Quantity UM changed to "${val(c.qtyUm)}"`);
    await toFormBottom();
    const ok = modalOk() || anyAct(/^Ok$/i, itemFormBox()); if (ok) await pressAct(ok); else await doAction(/^Ok$/i, "Ok (item form)");
    await waitFor(() => { const a = alertBox(); if (a && a.kind === "err") throw new Error("ERP said: " + a.text.replace(/Know More.*$/i, "").slice(0, 200)); return !irqModalOpen() && irqGridRows().length > before; }, 15000, "item to go into the list");
    await sleep(500);
    log(`   ${it.code} ${erpName} · ${it.qty} ${val("UM") || it.um || ""}${rateNote} ✓`, "ok");
    log(`      stock: ${stock}`, /available [1-9]|available 0\.\d*[1-9]/.test(stock) ? "h" : "");
  }
  async function newIrq(d, log) {
    const m = d.mode, c = irqCfg(m);
    d._defaultsSet = false;
    await backToIrqListing(m);
    await newWithSeries(m === "indent" ? (d.opts.series || "IR") : "3O", () => backToIrqListing(m));
    await waitFor(() => { try { return field("Department"); } catch (e) { return null; } }, 20000, "new " + c.name); await sleep(1000);
    if (m === "req") await headerLov("Transaction Type", "Tran-Type", "IM", "MATERIAL ISSUES");
    await headerLov("Department", "Department Code", "QAD03", "QAD-SMS");
    if (m === "indent" && !/INDIAN RUPEES/i.test(val("CURRENCY_NAME"))) throw new Error(`Currency shows "${val("CURRENCY_NAME")}"`);
    for (const it of d.items) { chk(); await irqAddItem(m, it, d, log); }
    // final check: every line once, right qty (and rate / date for an indent)
    const rows = irqGridRows(), bad = [];
    if (rows.length !== d.items.length) bad.push(`${rows.length} line(s) in the ERP, ${d.items.length} sent`);
    d.items.forEach(it => {
      const r = rows.filter(x => (x["Item Code"] || "").toUpperCase() === it.code.toUpperCase());
      if (r.length !== 1) { bad.push(`${it.code}: ${r.length} line(s)`); return; }
      const q = numOf(r[0][m === "indent" ? "Quantity" : "Quantity (AUM)"]);
      if (!near(q, it.qty, 0.0005)) bad.push(`${it.code}: qty ${q}`);
      if (m === "indent" && !near(numOf(r[0]["FC Rate"]), it._rate, 0.0001)) bad.push(`${it.code}: rate ${r[0]["FC Rate"]} (expected ${it._rate})`);
      if (m === "indent" && dmyOf(r[0]["Required Date"]) !== d.opts.reqDate) bad.push(`${it.code}: date ${r[0]["Required Date"]}`);
      if (m === "indent" && "Purpose" in r[0] && (r[0]["Purpose"] || "").trim() !== d.opts.purpose) bad.push(`${it.code}: purpose "${r[0]["Purpose"]}" in the list (sent "${d.opts.purpose}")`);   // shown in the box but not taken by the ERP
    });
    if (bad.length) throw new Error("check before saving failed - " + bad.join("; "));
    log(`   all ${rows.length} line(s) re-checked ✓`, "ok");
    if (m === "indent") rows.forEach(r => log(`   list: ${Object.entries(r).filter(([k, v]) => k && String(v).trim()).map(([k, v]) => `${k}=${String(v).trim().slice(0, 30)}`).join(" · ").slice(0, 600)}`, "h"));   // what the ERP holds - to compare with a hand entry
    if (window.MZF_DRY) { log("   (dry run - not saved; press Back in the ERP to throw it away)", "h"); return "DRY RUN"; }
    try { return await save(/^Save$/); }
    catch (e) {
      // 14-Nov: the ERP refuses an item whose earlier Indent is still pending - as "Item Stock Validation … STOP" or as
      // "Problem in Approval of Indent/PR voucher"
      const pend = m === "indent" ? d.items.filter(it => it._bal > 0) : [];
      if (pend.length && /Stock Validation|Problem in Approval/i.test(e.message))
        e.message += ` - pehle se pending Indent: ${pend.map(it => `${it.code} (indent balance ${it._bal})`).join(", ")}. Aisa item pehla Indent approve / cancel hone tak shayad na jaye - use list se hata kar bhejiye.`;
      throw e;
    }
  }

  /* ================= Material to Material Transfer [QM:M2M] - billets SMS2 -> BLRM ================= */
  // one voucher per heat and length (the ERP takes one Received line when there are several Issued lines), series BL
  // (Billet Tranfer from SMS to RM), Tran-Type STOCK MATERIAL (MS), voucher date = heat date. Order, as done by hand: both
  // lines without quantity -> Save (refused) -> Division Code SM -> RM on the received line -> quantities -> check -> Save.
  // Issued: F03.. item, godown SMS2 (stock row of the heat's Ref No if the ERP has one, else the N.D. row), Dept QAD03,
  //         Cost INDF1, qty in MT (Tran UM MT, C/F 1). Received: R06.. item (same billet), godown BLRM, Division RM, Dept QAD03, Cost INDF1,
  //         Stock Type R, Batch No. and Ref No = the heat's Ref No (e.g. 4/11/1R), qty in MT.
  const M2M_DONE_KEY = "moltrixErpM2mDone";   // date|heat -> M2M voucher no
  const M2M = { series: "BL", dept: "QAD03", cost: "INDF1", from: "SMS2", to: "BLRM", div: "RM" };
  const MONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const monDate = dmy => { const [d, m, y] = dmy.split("-"); return `${d}-${MONS[+m - 1]}-${y}`; };
  const onM2mListing = () => /^Material to Material Transfer \[QM:M2M\]/i.test(screenTitle()) && !formOpen() && !lov();
  async function backToM2mListing() {
    for (let i = 0; i < 4 && !onM2mListing(); i++) {
      const a = alertBox(); if (a) await closeAlert(a); if (lov()) await closeLov();
      const b = btn(/^Back$/);
      if (!b && formOpen()) { try { await doAction(/^Back$/, "Back"); } catch (e) {} await sleep(2500); continue; }
      if (/\[QM:M2M\]/.test(screenTitle()) && !formOpen()) { await sleep(1500); continue; }
      if (b && /\[QM:M2M\]/.test(screenTitle())) click(b);
      else { const t = [...document.querySelectorAll("*")].filter(vis).find(e => e.children.length === 0 && txt(e) === "Material to Material Transfer" && e.getBoundingClientRect().top < 80); if (t) click(t); else if (b) click(b); }
      await sleep(2500);
    }
    try { await waitFor(onM2mListing, 15000, "Material to Material Transfer listing"); }
    catch (e) {
      if (e.message === "Stopped by user") throw e;
      if (await quickOpen("m2m", onM2mListing)) return;
      throw new Error(`the ERP is not on the Material to Material Transfer screen (it shows "${screenTitle() || "(no screen title found)"}"). Open it (Quick Search → material to material), wait for the list, then press Start again. [seen: ${seen()}]`);
    }
  }
  // column of a grid by its heading text
  function colIdx(fr, name) {
    const hr = [...fr.querySelector("table").querySelectorAll("thead tr")].find(tr => [...tr.children].some(c => txt(c)));
    return hr ? [...hr.children].findIndex(c => txt(c).replace(/\*$/, "") === name) : -1;
  }
  const colTxt = (fr, tr, name) => { const i = colIdx(fr, name); return i < 0 ? "" : txt(tr.children[i]); };
  const m2mVal = (tr, id) => ((cell(tr, id) || {}).value || "").trim();
  async function m2mAddRow(fr) {   // like addRow, but these grids have no Item Code input
    const n = realRows(fr).length;
    await activate(realRows(fr).slice(-1)[0]);
    const add = [...fr.querySelectorAll("ion-icon[name=add-circle-outline]")].find(vis); if (!add) throw new Error("the + (add row) button was not found");
    click(add.closest("ion-button") || add);
    await waitFor(() => { const a = alertBox(); if (a && a.kind === "err") throw new Error("ERP said: " + a.text.slice(0, 200)); return realRows(fr).length > n; }, 20000, "new row");
    const nr = realRows(fr).filter(r => !m2mVal(r, "ITEM_NAME")).pop(); if (!nr) throw new Error("new row not found");
    await activate(nr); return nr;
  }
  // a lookup can open by itself after a cell is filled (Cost/Project, Department ...): answer it, or close anything else
  async function m2mSettle() {
    await sleep(300); const L = lov(); if (!L) return;
    const head = txt(L).slice(0, 60);
    if (/Cost\/Project/i.test(head)) await pickLov("Cost Code", M2M.cost); else if (/Department/i.test(head)) await pickLov("Department Code", M2M.dept); else await closeLov();
    await sleep(500);
  }
  // Tran UM MT from the ERP's own list (gives C/F 1), then the MT qty; the ERP works out the UM qty only after C/F is
  // typed again, so retype C/F when it stays 0
  async function m2mQty(tr, mt, aId, qId) {
    await cellLov(tr, "AUM", "Tranum", "MT"); await m2mSettle();
    if (!near(m2mVal(tr, "AUMTOUM"), 1, 1e-9)) throw new Error(`C/F shows "${m2mVal(tr, "AUMTOUM")}" for MT (expected 1)`);
    for (let t = 0; t < 4 && !(near(m2mVal(tr, qId), mt, 0.0005) && near(m2mVal(tr, aId), mt, 0.0005)); t++) {
      if (t % 2 === 0) await editCell(cell(tr, aId), mt.toFixed(3)); else await editCell(cell(tr, "AUMTOUM"), "1");
      await answerOptions(); await m2mSettle(); await sleep(500);
    }
  }
  // Issued godown: the stock rows of the item; take SMS2 with the heat's Ref No, else the N.D. row
  async function m2mIssueGodown(tr, l) {
    await activate(tr); if (lov()) await closeLov();
    click(cell(tr, "GODOWN_NAME").closest("td").querySelector("ion-icon[name=search]"));
    const L = await waitFor(() => { const a = alertBox(); if (a && a.kind === "err") throw new Error("ERP said: " + a.text.replace(/Know More.*$/i, "").slice(0, 200)); return lov(); }, 15000, "godown list");
    await waitFor(() => lovRows(L).length, 20000, "godown rows").catch(() => {});
    const heads = [...[...L.querySelectorAll("thead tr")].find(tr => [...tr.children].some(c => txt(c))).children].map(c => txt(c).replace(/\*$/, "").toLowerCase());
    const ci = n => heads.findIndex(h => h === n.toLowerCase());
    const [gC, bC, rC, sC] = [ci("Godown Code"), ci("Batchno"), ci("Refrence slno"), heads.findIndex(h => /^stock/.test(h))];
    if (gC < 0) { await closeLov(); throw new Error("godown list has no Godown Code column"); }
    const rows = lovRows(L).filter(r => txt(r.children[gC]).toUpperCase() === M2M.from);
    const row = rows.find(r => rC >= 0 && txt(r.children[rC]).toUpperCase() === l.ref.toUpperCase()) || rows.find(r => bC < 0 || /^N\.?D\.?$/i.test(txt(r.children[bC])));
    if (!row) { const seen = lovRows(L).map(r => [gC, bC, rC].map(k => k < 0 ? "" : txt(r.children[k])).join(" ")).join("; "); await closeLov(); throw new Error(`no ${M2M.from} stock row for ${l.code} (ERP list: ${seen || "empty"})`); }
    const td = [...row.children].find(t => getComputedStyle(t).display !== "none") || row.firstElementChild;
    mouse(td, "click"); mouse(td, "dblclick");
    await waitFor(() => !lov(), 15000, "godown list to close"); await sleep(800);
  }
  async function m2mIssueLine(fr, tr, l, withQty = true) {
    await cellLov(tr, "ITEM_NAME", "Item Code", l.code); await sleep(800); await m2mSettle();
    if (colTxt(fr, tr, "Item Code").toUpperCase() !== l.code) throw new Error(`issued item shows "${colTxt(fr, tr, "Item Code")}" instead of ${l.code}`);
    await m2mIssueGodown(tr, l); await m2mSettle();
    await cellLov(tr, "DEPT_NAME", "Department Code", M2M.dept); await m2mSettle();
    await cellLov(tr, "COST_NAME", "Cost Code", M2M.cost); await m2mSettle();
    await setStockType(tr, "R");
    if (withQty) await m2mQty(tr, l.mt, "AQTYISSUED", "QTYISSUED");
    const st = +m2mVal(tr, "STOCK").replace(/,/g, "");
    const bad = [];
    if (m2mVal(tr, "GODOWN_CODE") !== M2M.from) bad.push(`godown ${m2mVal(tr, "GODOWN_CODE")}`);
    if (m2mVal(tr, "DEPT_CODE") !== M2M.dept) bad.push(`department ${m2mVal(tr, "DEPT_CODE")}`);
    if (m2mVal(tr, "COST_CODE") !== M2M.cost) bad.push(`cost ${m2mVal(tr, "COST_CODE")}`);
    if (withQty && (!near(m2mVal(tr, "AQTYISSUED"), l.mt, 0.0005) || !near(m2mVal(tr, "QTYISSUED"), l.mt, 0.0005))) bad.push(`qty ${m2mVal(tr, "AQTYISSUED")} / ${m2mVal(tr, "QTYISSUED")} (expected ${l.mt.toFixed(3)})`);
    if ((tr.querySelector("ion-select") || {}).value !== "R") bad.push("stock type");
    if (bad.length) throw new Error(`issued ${l.code}: ${bad.join(", ")} did not take`);
    if (withQty && m2mVal(tr, "STOCK") !== "" && st + 1e-9 < l.mt) throw new Error(`issued ${l.code}: SMS2 stock is only ${st.toFixed(3)} MT, need ${l.mt.toFixed(3)} MT`);
    return { batch: m2mVal(tr, "BATCHNO"), ref: m2mVal(tr, "REF_SLNO"), stock: m2mVal(tr, "STOCK") };
  }
  // received line without Division and qty: the ERP opens the Division for editing only after one Save was refused
  async function m2mRecvLine(fr, tr, l) {
    await cellLov(tr, "ITEM_NAME", "Item Code", l.rcode); await sleep(800); await m2mSettle();
    if (colTxt(fr, tr, "Item Code").toUpperCase() !== l.rcode) throw new Error(`received item shows "${colTxt(fr, tr, "Item Code")}" instead of ${l.rcode}`);
    await cellLov(tr, "GODOWN_NAME", "Godown Code", M2M.to); await m2mSettle();
    if (!m2mVal(tr, "DIV_CODE")) { await cellLov(tr, "DIV_NAME", "Division Code", "SM"); await m2mSettle(); }   // BLRM leaves it empty; the list has only SM
    await cellLov(tr, "DEPT_NAME", "Department Code", M2M.dept); await m2mSettle();
    await cellLov(tr, "COST_NAME", "Cost Code", M2M.cost); await m2mSettle();
    await setStockType(tr, "R");
    await editCell(cell(tr, "DEFAULT_BATCHNO"), l.ref); await m2mSettle();
    await editCell(cell(tr, "DEFAULT_REF_SLNO"), l.ref); await m2mSettle();
    const bad = [];
    if (m2mVal(tr, "GODOWN_CODE") !== M2M.to) bad.push(`godown ${m2mVal(tr, "GODOWN_CODE")}`);
    if (m2mVal(tr, "DEPT_CODE") !== M2M.dept) bad.push(`department ${m2mVal(tr, "DEPT_CODE")}`);
    if (m2mVal(tr, "COST_CODE") !== M2M.cost) bad.push(`cost ${m2mVal(tr, "COST_CODE")}`);
    if (m2mVal(tr, "DEFAULT_BATCHNO") !== l.ref) bad.push(`batch ${m2mVal(tr, "DEFAULT_BATCHNO")}`);
    if (m2mVal(tr, "DEFAULT_REF_SLNO") !== l.ref) bad.push(`Ref No ${m2mVal(tr, "DEFAULT_REF_SLNO")}`);
    if ((tr.querySelector("ion-select") || {}).value !== "R") bad.push("stock type");
    if (bad.length) throw new Error(`received ${l.rcode}: ${bad.join(", ")} did not take`);
  }
  // Save with every quantity empty: the ERP refuses it (no quantity) - this is what makes the Division editable
  async function m2mBlankSave(log) {
    const filled = [...realRows(grid("Item Issued Details")).map(t => m2mVal(t, "AQTYISSUED")), ...realRows(grid("Item Received Details")).map(t => m2mVal(t, "AQTYRECD"))].filter(v => +v);
    if (filled.length) throw new Error("a quantity is already filled - the Save-without-quantity step was not done");
    await doAction(/^Save$/, "Save");
    const a = await waitFor(alertBox, 60000, "the ERP to answer Save");
    const text = a.text.replace(/Know More.*$/i, ""); await closeAlert(a);
    if (a.kind === "ok") { const m = text.match(/Voucher number\s+(\S+)/i); const e = new Error(`the ERP SAVED a voucher without quantities (${m ? m[1] : "number not shown"}) - open it in the ERP and correct or delete it`); e.stopAll = true; throw e; }
    log(`   Save without quantity refused by the ERP as expected ("${text.slice(0, 120)}")`);
    await sleep(800); for (let i = 0; i < 2 && alertBox(); i++) await closeAlert(alertBox());
    if (lov()) await closeLov();
  }
  // Division RM on the received line, after the refused Save: type RM over SM in Division Code (the Division Name
  // keeps showing STEEL MELTING SHOP - the same happens when it is done by hand, and the ERP saves it)
  async function m2mRecvDiv(tr, l) {
    for (let t = 0; t < 2 && m2mVal(tr, "DIV_CODE") !== M2M.div; t++) { await editCell(cell(tr, "DIV_CODE"), M2M.div); await m2mSettle(); await sleep(400); }
    if (m2mVal(tr, "DIV_CODE") !== M2M.div) throw new Error(`received ${l.rcode}: Division Code shows "${m2mVal(tr, "DIV_CODE")}" instead of ${M2M.div}`);
  }
  async function m2mRecvQty(tr, l) {
    await m2mQty(tr, l.mt, "AQTYRECD", "QTYRECD");
    if (!near(m2mVal(tr, "AQTYRECD"), l.mt, 0.0005) || !near(m2mVal(tr, "QTYRECD"), l.mt, 0.0005)) throw new Error(`received ${l.rcode}: qty ${m2mVal(tr, "AQTYRECD")} / ${m2mVal(tr, "QTYRECD")} (expected ${l.mt.toFixed(3)}) did not take`);
  }
  function m2mRowsNow(title, recv) {
    const fr = grid(title);
    return realRows(fr).map(t => ({ code: colTxt(fr, t, "Item Code").toUpperCase(), godown: m2mVal(t, "GODOWN_CODE"), div: m2mVal(t, "DIV_CODE"), dept: m2mVal(t, "DEPT_CODE"), cost: m2mVal(t, "COST_CODE"),
      st: (t.querySelector("ion-select") || {}).value, ref: recv ? m2mVal(t, "DEFAULT_REF_SLNO") : m2mVal(t, "REF_SLNO"), batch: recv ? m2mVal(t, "DEFAULT_BATCHNO") : m2mVal(t, "BATCHNO"),
      aq: +m2mVal(t, recv ? "AQTYRECD" : "AQTYISSUED"), q: +m2mVal(t, recv ? "QTYRECD" : "QTYISSUED") }));
  }
  async function newM2m(h, log) {
    await backToM2mListing();
    await newWithSeries(M2M.series, backToM2mListing); await seriesSet();
    await waitFor(() => { try { return field("Transaction Type"); } catch (e) { return null; } }, 20000, "new Material to Material Transfer"); await sleep(1000);
    if (!/STOCK MATERIAL/i.test(field("Transaction Type").inp.value)) await headerLov("Transaction Type", "Tran-Type", "MS", "STOCK MATERIAL");
    await m2mSettle();
    await typePlain(field("Remark").inp, h.remark, 400);
    const vd = field("Voucher Date").inp;
    if (dmyOf(vd.value) !== h.date) await typePlain(vd, monDate(h.date), 700);
    if (dmyOf(vd.value) !== h.date) await typeInto(vd, monDate(h.date), 700);
    if (dmyOf(vd.value) !== h.date) await typeInto(vd, h.date, 700);
    await m2mSettle();
    if (dmyOf(vd.value) !== h.date) throw new Error(`Voucher Date shows "${vd.value}" instead of ${h.date}`);
    if (field("Remark").inp.value !== h.remark) throw new Error(`Remark shows "${field("Remark").inp.value}"`);
    // the ERP takes only one Received line when there are several Issued lines, so a voucher = one billet item
    if (h.lines.length !== 1) throw new Error(`${h.lines.length} lines in one voucher - send it again from the new Moltrix (one voucher per length)`);
    // 1. both sides without quantity (received Division SM, as the ERP gives)
    const fi = grid("Item Issued Details"), issued = [];
    for (let i = 0; i < h.lines.length; i++) {
      const l = h.lines[i], tr = i === 0 ? await firstRow(fi, "Item Issued Details") : await m2mAddRow(fi);
      issued.push(await m2mIssueLine(fi, tr, l, false));
    }
    const fr = grid("Item Received Details");
    for (let i = 0; i < h.lines.length; i++) {
      const l = h.lines[i], tr = i === 0 ? await firstRow(fr, "Item Received Details") : await m2mAddRow(fr);
      await m2mRecvLine(fr, tr, l);
    }
    // 2. Save without quantity - the ERP refuses it and opens the Division for editing (same as done by hand)
    await m2mBlankSave(log);
    // 3. Division Code RM on the received line, then the quantities on both sides
    for (let i = 0; i < h.lines.length; i++) await m2mRecvDiv(realRows(grid("Item Received Details"))[i], h.lines[i]);
    for (let i = 0; i < h.lines.length; i++) {
      const l = h.lines[i], tr = realRows(grid("Item Issued Details"))[i];
      await m2mQty(tr, l.mt, "AQTYISSUED", "QTYISSUED");
      if (!near(m2mVal(tr, "AQTYISSUED"), l.mt, 0.0005) || !near(m2mVal(tr, "QTYISSUED"), l.mt, 0.0005)) throw new Error(`issued ${l.code}: qty ${m2mVal(tr, "AQTYISSUED")} / ${m2mVal(tr, "QTYISSUED")} (expected ${l.mt.toFixed(3)}) did not take`);
      const st = +m2mVal(tr, "STOCK").replace(/,/g, "");
      if (m2mVal(tr, "STOCK") !== "" && st + 1e-9 < l.mt) throw new Error(`issued ${l.code}: SMS2 stock is only ${st.toFixed(3)} MT, need ${l.mt.toFixed(3)} MT`);
      log(`   issue ${l.code} ${l.size} ${l.len} Mtr ${l.mt.toFixed(3)} MT from ${M2M.from} (batch ${issued[i].batch || "-"}, ref ${issued[i].ref || "-"}, stock ${issued[i].stock || "not shown"}) ✓`, "ok");
    }
    for (let i = 0; i < h.lines.length; i++) {
      const l = h.lines[i]; await m2mRecvQty(realRows(grid("Item Received Details"))[i], l);
      log(`   receive ${l.rcode} ${l.mt.toFixed(3)} MT into ${M2M.to} (division ${M2M.div}), batch / ref ${l.ref} ✓`, "ok");
    }
    // final check: both sides, every line once, right item / godown / qty
    const iss = m2mRowsNow("Item Issued Details", false), rec = m2mRowsNow("Item Received Details", true), bad = [];
    if (iss.length !== h.lines.length) bad.push(`${iss.length} issued line(s), expected ${h.lines.length}`);
    if (rec.length !== h.lines.length) bad.push(`${rec.length} received line(s), expected ${h.lines.length}`);
    h.lines.forEach((l, i) => {
      const a = iss[i], b = rec[i];
      if (a && (a.code !== l.code || a.godown !== M2M.from || a.dept !== M2M.dept || a.cost !== M2M.cost || a.st !== "R" || !near(a.aq, l.mt, 0.0005) || !near(a.q, l.mt, 0.0005)))
        bad.push(`issued line ${i + 1} shows ${a.code} ${a.godown} ${a.dept} ${a.cost} ${a.aq} / ${a.q}`);
      if (b && (b.code !== l.rcode || b.godown !== M2M.to || b.div !== M2M.div || b.dept !== M2M.dept || b.cost !== M2M.cost || b.st !== "R" || b.ref !== l.ref || b.batch !== l.ref || !near(b.aq, l.mt, 0.0005) || !near(b.q, l.mt, 0.0005)))
        bad.push(`received line ${i + 1} shows ${b.code} ${b.godown} ${b.div} ${b.dept} ${b.cost} ${b.batch} ${b.ref} ${b.aq} / ${b.q}`);
    });
    const ti = r3(iss.reduce((s, x) => s + x.q, 0)), trc = r3(rec.reduce((s, x) => s + x.q, 0));
    if (!near(ti, trc, 0.0005)) bad.push(`issued ${ti} MT, received ${trc} MT`);
    if (dmyOf(field("Voucher Date").inp.value) !== h.date) bad.push(`Voucher Date ${field("Voucher Date").inp.value}`);
    if (bad.length) throw new Error("check before saving failed - " + bad.join("; "));
    log(`   all lines re-checked ✓ (${ti.toFixed(3)} MT issued = received)`, "ok");
    if (window.MZF_DRY) { log("   (trial - not saved; press Back in the ERP to throw it away)", "h"); return "DRY RUN"; }
    return await save(/^Save$/);
  }

  /* ================= panel ================= */
  const store =(key = DONE_KEY) => { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; } };
  const remember = (k, v, key = DONE_KEY) => { try { const s = store(key); s[k] = v; localStorage.setItem(key, JSON.stringify(s)); } catch (e) {} };
  let data = null, appWin = null;
  function panel() {
    let p = document.getElementById("mzfPanel"); if (p) return p;
    p = document.createElement("div"); p.id = "mzfPanel"; p.dataset.v = VERSION;
    p.style.cssText = "position:fixed;right:8px;bottom:8px;width:min(420px, calc(100vw - 16px));max-height:70vh;display:flex;flex-direction:column;background:#0f1d33;color:#e8eef8;font:13px/1.4 system-ui,Segoe UI,sans-serif;border:2px solid #d4a017;border-radius:10px;z-index:2147483647;box-shadow:0 8px 28px rgba(0,0,0,.45)";
    p.innerHTML = `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #2b3d5c">
        <b style="flex:1;color:#f2c94c">Moltrix → ERP <span style="font-weight:400;color:#8ea3c4;font-size:11px">v${VERSION}</span></b>
        <button data-a="open">Open Moltrix</button><button data-a="paste">Paste</button><button data-a="pcview" id="mzfPcBtn">PC view</button><button data-a="stop">Stop</button><button data-a="min" title="Make small / big">–</button><button data-a="x">✕</button></div>
      <div id="mzfPaste" style="display:none;padding:8px 10px;border-bottom:1px solid #2b3d5c">
        <div style="font-size:12px;color:#8ea3c4;margin-bottom:4px">Phone: in Moltrix press <b>Copy for ERP</b>, come back here, long-press the box below → Paste, then Load.</div>
        <textarea id="mzfPasteBox" rows="3" style="width:100%;box-sizing:border-box;font:12px Consolas,monospace;background:#0b1526;color:#e8eef8;border:1px solid #3d5a86;border-radius:6px" placeholder="Paste here"></textarea>
        <div style="margin-top:4px"><button data-a="load">Load</button></div></div>
      <div id="mzfBody" style="padding:8px 10px;overflow:auto"></div>
      <div id="mzfLog" style="padding:6px 10px;overflow:auto;max-height:36vh;border-top:1px solid #2b3d5c;font:12px/1.35 Consolas,monospace;white-space:pre-wrap"></div>`;
    p.querySelectorAll("button").forEach(b => b.style.cssText = "background:#1f3558;color:#fff;border:1px solid #3d5a86;border-radius:6px;padding:3px 8px;cursor:pointer");
    p.addEventListener("click", ev => { const a = ev.target.getAttribute && ev.target.getAttribute("data-a");
      if (a === "paste") { const z = p.querySelector("#mzfPaste"); z.style.display = z.style.display === "none" ? "" : "none"; if (z.style.display === "") p.querySelector("#mzfPasteBox").focus(); }
      else if (a === "load") loadPasted(p.querySelector("#mzfPasteBox").value);
      else if (a === "pcview") pcView(!pcViewOn());
      else if (a === "min") { const sm = p.dataset.min !== "1"; p.dataset.min = sm ? "1" : ""; ["#mzfBody", "#mzfLog", "#mzfPaste"].forEach(q => { const e = p.querySelector(q); if (e) e.style.display = sm ? "none" : (q === "#mzfPaste" ? "none" : ""); }); }
      else if (a === "open") openApp(); else if (a === "stop") { STOP = true; log("Stopping after the current step…", "err"); } else if (a === "x") { if (!MZF.busy) p.remove(); } else if (a === "start") start(); });
    document.body.appendChild(p); return p;
  }
  /* ---- phone: lay the ERP out like a PC (1366 px wide) - its Create New Record / Save / Back buttons only show on a wide screen ---- */
  const isPhone = () => (navigator.maxTouchPoints > 0 || "ontouchstart" in window) && Math.min(screen.width, screen.height) < 900;
  const vpMeta = () => { let m = document.querySelector('meta[name="viewport"]'); if (!m) { m = document.createElement("meta"); m.name = "viewport"; m.content = ""; document.head.appendChild(m); } if (m.dataset.mzfOrig === undefined) m.dataset.mzfOrig = m.content; return m; };
  const pcViewOn = () => /^width=1366/.test(vpMeta().content);
  // keep the panel readable and inside the screen whatever the page width
  function fitPanel() {
    const p = document.getElementById("mzfPanel"); if (!p) return;
    const z = Math.max(1, Math.min(4, window.innerWidth / (Math.min(screen.width, window.innerWidth) || window.innerWidth)));
    p.style.transformOrigin = "100% 100%"; p.style.transform = z > 1 ? `scale(${z})` : ""; p.style.width = `min(420px, ${Math.floor((window.innerWidth - 24) / z)}px)`; p.style.maxHeight = Math.floor(window.innerHeight * 0.7 / z) + "px";
    const L = p.querySelector("#mzfLog"); if (L) L.style.maxHeight = Math.floor(window.innerHeight * 0.36 / z) + "px";
    const b = p.querySelector("#mzfPcBtn"); if (b) b.textContent = pcViewOn() ? "Phone view" : "PC view";
  }
  // the phone's own width for one run (not remembered - the next load still opens in PC width)
  function phoneLayout() {
    const m = vpMeta(); m.content = (m.dataset.mzfOrig || "width=device-width, initial-scale=1") + (/user-scalable=no/.test(m.content) ? ", user-scalable=no" : "");
    window.dispatchEvent(new Event("resize")); setTimeout(() => { fitPanel(); window.dispatchEvent(new Event("resize")); }, 1200);
  }
  function pcView(on, auto) {
    const m = vpMeta(); m.content = on ? "width=1366" : m.dataset.mzfOrig;
    try { localStorage.setItem("mzfPcView", on ? "1" : "0"); } catch (e) {}
    window.dispatchEvent(new Event("resize"));
    setTimeout(() => {
      fitPanel(); window.dispatchEvent(new Event("resize"));
      if (on) log(`${auto ? "Phone found - " : ""}page set to PC width (${window.innerWidth} px) so the ERP shows its PC buttons. ` +
        (btn(/^Create New Record$/) ? "Create New Record shows ✓" : formOpen() ? "" : "Create New Record is still not showing - open the listing again (or reload the page) and tap the bookmark again; turn Chrome's Desktop site OFF if it is on."), btn(/^Create New Record$/) ? "ok" : "h");
      else log("Back to the phone layout.", "h");
    }, 1200);
  }
  window.addEventListener("resize", () => setTimeout(fitPanel, 300));
  // while a run is going on a phone: no on-screen keyboard (inputmode none on every box) and no zoom-in on a box
  let QUIET = null;
  function phoneQuiet(on) {
    if (!isPhone()) return;
    if (on && !QUIET) {
      const touched = new Map();
      const calm = root => (root.querySelectorAll ? root.querySelectorAll("input, textarea") : []).forEach(e => { if (!touched.has(e)) { touched.set(e, e.getAttribute("inputmode")); e.setAttribute("inputmode", "none"); } });
      calm(document);
      const mo = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (/^(INPUT|TEXTAREA)$/.test(n.tagName)) calm(n.parentNode || document); else calm(n); } })));
      mo.observe(document.body, { childList: true, subtree: true });
      const m = vpMeta(), vp = m.content; if (!/user-scalable=no/.test(vp)) m.content = (vp ? vp + ", " : "") + "user-scalable=no";
      QUIET = { touched, mo, vp };
    } else if (!on && QUIET) {
      QUIET.mo.disconnect();
      QUIET.touched.forEach((v, e) => { if (v === null) e.removeAttribute("inputmode"); else e.setAttribute("inputmode", v); });
      vpMeta().content = QUIET.vp; QUIET = null;
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
    }
  }
  const AWAKE_SRC = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAYWbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAD6AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAmd0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAD6AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAA+gAAAAAAABAAAAAAHfbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAABAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABim1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAUpzdGJsAAAAtnN0c2QAAAAAAAAAAQAAAKZhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALGF2Y0MBQsAK/+EAFWdCwAraewEQAAADABAAAAMAIPEiagEABGjOD8gAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAFQAAABUAAAAAYc3R0cwAAAAAAAAABAAAABAAAQAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAkc3RzegAAAAAAAAAAAAAABAAAAoUAAAAJAAAACQAAAAkAAAAgc3RjbwAAAAAAAAAEAAAGWwAACQAAAAkpAAAJUgAAAtl0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAACAAAAAAAAD6AAAAAAAAAAAAAAAAEBAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAA+gAAAEAAABAAAAAAJRbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAfQAAAgQBVxAAAAAAALWhkbHIAAAAAAAAAAHNvdW4AAAAAAAAAAAAAAABTb3VuZEhhbmRsZXIAAAAB/G1pbmYAAAAQc21oZAAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAABwHN0YmwAAAB+c3RzZAAAAAAAAAABAAAAbm1wNGEAAAAAAAAAAQAAAAAAAAAAAAEAEAAAAAAfQAAAAAAANmVzZHMAAAAAA4CAgCUAAgAEgICAF0AVAAAAAAAfQAAAASAFgICABRWIVuUABoCAgAECAAAAFGJ0cnQAAAAAAAAfQAAAASAAAAAgc3R0cwAAAAAAAAACAAAAIAAABAAAAAABAAABAAAAAChzdHNjAAAAAAAAAAIAAAABAAAAAQAAAAEAAAACAAAACAAAAAEAAACYc3RzegAAAAAAAAAAAAAAIQAAABUAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAACRzdGNvAAAAAAAAAAUAAAZGAAAI4AAACQkAAAkyAAAJWwAAABpzZ3BkAQAAAHJvbGwAAAACAAAAAf//AAAAHHNiZ3AAAAAAcm9sbAAAAAEAAAAhAAAAAQAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjAuMTYuMTAwAAAACGZyZWUAAAM9bWRhdN4CAExhdmM2MC4zMS4xMDIAAjBADgAAAm8GBf//a9xF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0xIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDE6MHgxMTEgbWU9aGV4IHN1Ym1lPTIgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MCBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTAgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9MCB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0wIHdlaWdodHA9MCBrZXlpbnQ9MjUwIGtleWludF9taW49MSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTEwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAA5liIQF////D0UAAVefgAEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAABUGaIBf1ARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAFQZpAFvUBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAVBmmAV9QEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAH";
  function keepAwake(on) {
    phoneQuiet(on);
    let v = document.getElementById("mzfAwake");
    if (!on) { if (v) { v.pause(); v.remove(); } return; }
    if (!isPhone()) return;
    if (!v) { v = document.createElement("video"); v.id = "mzfAwake"; v.src = AWAKE_SRC; v.loop = true; v.muted = true; v.playsInline = true; v.setAttribute("playsinline", "");
      v.style.cssText = "width:24px;height:24px;vertical-align:middle;border-radius:4px;background:#000;margin-left:6px";
      const h = panel().querySelector("b"); (h || panel()).appendChild(v); }
    const pr = v.play(); if (pr && pr.catch) pr.catch(e => log("Couldn't keep the screen on (" + e.message + ") - set the phone's screen time-out to 30 min while it runs.", "err"));
  }
  function log(m, cls) { const L = panel().querySelector("#mzfLog"); const d = document.createElement("div"); d.textContent = m; d.style.color = cls === "err" ? "#ff8a80" : cls === "ok" ? "#9be7a0" : cls === "h" ? "#f2c94c" : "#e8eef8"; L.appendChild(d); L.scrollTop = L.scrollHeight;
    try { if (appWin) appWin.postMessage({ type: "moltrix-erp-log", text: m, cls }, APP_ORIGIN); } catch (e) {} }
  function openApp() { const st = screenTitle(), sub = /\[IP:INDI\]/.test(st) ? "&erpsub=indent" : /\[NI:REQI\]/.test(st) ? "&erpsub=req" : /\[QM:M2M\]/.test(st) ? "&erpsub=m2m" : "";
    appWin = window.open(APP_URL + sub, "moltrixErpBridge", "width=520,height=760"); if (!appWin) log("Pop-up blocked - allow pop-ups for this ERP site, then press Open Moltrix again.", "err"); }
  function renderData() {
    if (!data) { panel().querySelector("#mzfBody").innerHTML = `<div>Press <b>Open Moltrix</b>, pick the date there and press <b>Send to ERP</b>.<br><span style="color:#8ea3c4;font-size:12px">On the phone: Moltrix app → <b>Copy for ERP</b> → here press <b>Paste</b>.</span></div>`; return; }
    const b = panel().querySelector("#mzfBody"), mode = data.mode, s = store(mode === "qc" ? QC_DONE_KEY : DONE_KEY);
    if (mode === "indent" || mode === "req") {
      const done = store(IRQ_DONE_KEY)[data.id], o = data.opts || {};
      b.innerHTML = `<div style="margin-bottom:6px"><b>${irqCfg(mode).name}</b> · ${data.items.length} item(s) · one voucher` +
        (mode === "indent" ? `<br><span style="color:#8ea3c4;font-size:11px">Series ${o.series || "IR"} · QAD-SMS · cost ${o.cost} · Priority ${o.priority} · Required ${o.reqDate} · Purpose "${o.purpose}"</span>`
          : `<br><span style="color:#8ea3c4;font-size:11px">Series 3O · MATERIAL ISSUES · QAD-SMS · ${o.godown} · cost ${o.cost} · Remark "${o.remark}"</span>`) + `</div>` +
        data.items.map(it => `<div style="margin:1px 0">${it.code} · ${String(it.name || "").replace(/</g, "&lt;")} · <b>${it.qty}</b> ${it.um || ""}${mode === "indent" ? " · rate: ERP's" + (it.rate ? ` (if none: ${it.rate})` : "") : ""}</div>`).join("") +
        (done ? `<div style="margin-top:6px;color:#9be7a0">Already saved as ${done} - Start would make a second voucher.</div>` : "") +
        `<label style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="mzfTrial" ${Object.keys(store(IRQ_DONE_KEY)).length ? "" : "checked"}> Trial - fill everything but don't Save (look at it, then press Back in the ERP)</label>` +
        `<div style="margin-top:8px"><button data-a="start" style="background:#d4a017;color:#10213a;border:0;border-radius:6px;padding:6px 14px;font-weight:700;cursor:pointer">Start</button>
         <span style="color:#8ea3c4;font-size:11px"> Start on the ${irqCfg(mode).tab} screen. Keep this tab in front.</span></div>`;
      return;
    }
    if (mode === "m2m") {
      const sm = store(M2M_DONE_KEY);
      b.innerHTML = `<div style="margin-bottom:6px"><b>${data.date}</b> · Billet transfer SMS2 → BLRM (M2M) · one voucher per heat and length` +
        `<br><span style="color:#8ea3c4;font-size:11px">Series BL · STOCK MATERIAL · SMS2 → BLRM (division RM) · Dept QAD03 · Cost INDF1 · voucher date ${data.date} · qty MT</span></div>` +
        data.heats.map((h, i) => { const done = sm[data.date + "|" + h.heat + "|" + h.lines[0].len];
          return `<label style="display:flex;gap:6px;align-items:flex-start;margin:2px 0"><input type="checkbox" data-i="${i}" ${done ? "" : "checked"}>
            <span>Heat ${h.heat} · ${h.lines.map(l => `${l.size} ${l.len} Mtr · ${l.code}→${l.rcode} · ${l.mt.toFixed(3)} MT`).join(", ")} · ${h.lines[0].ref}${done ? ` <span style="color:#9be7a0">(${done})</span>` : ""}</span></label>`; }).join("") +
        `<label style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="mzfTrial" ${Object.keys(sm).length ? "" : "checked"}> Trial - fill everything but don't Save (look at it, then press Back in the ERP)</label>` +
        `<div style="margin-top:8px"><button data-a="start" style="background:#d4a017;color:#10213a;border:0;border-radius:6px;padding:6px 14px;font-weight:700;cursor:pointer">Start</button>
         <span style="color:#8ea3c4;font-size:11px"> Start on the Material to Material Transfer screen. Keep this tab in front.</span></div>`;
      return;
    }
    if (mode === "qc") {
      b.innerHTML = `<div style="margin-bottom:6px"><b>${data.date}</b> · Production QC (Final chemistry from BIS Doc)</div>` +
        data.heats.map((h, i) => { const k = data.date + "|" + h.heat, done = s[k], left = store(QC_LEFT_KEY)[k], v = h.qc.vals;
          // saved QC with tests still empty (or saved before this was kept): ticked - Start fills the rest into the same QC
          const noEdit = (() => { try { return localStorage.getItem(QC_NOEDIT_KEY) === "1"; } catch (e) { return false; } })();
          const rest = done && (!Array.isArray(left) || left.length);
          return `<label style="display:flex;gap:6px;align-items:center;margin:2px 0"><input type="checkbox" data-i="${i}" ${!done || (rest && !noEdit) ? "checked" : ""}>
            <span>Heat ${h.heat} · ${QC_KEYS.filter(k => v[k] !== undefined && v[k] !== "").map(k => k + " " + v[k]).join(" ")}${done ? ` <span style="color:${rest ? "#f2c94c" : "#9be7a0"}">(${done}${!rest ? " · all tests" : Array.isArray(left) ? " · still empty: " + left.join(", ") + " → added to the same QC" : " · will check for empty tests"}${rest && noEdit ? " · ERP gave no Edit rights last time - tick to try again" : ""})</span>` : ""}</span></label>`; }).join("") +
        `<label style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="mzfTrial"> Trial - fill but don't Save/Update (look at it, then press Back in the ERP)</label>` +
        `<div style="margin-top:8px"><button data-a="start" style="background:#d4a017;color:#10213a;border:0;border-radius:6px;padding:6px 14px;font-weight:700;cursor:pointer">Start</button>
         <span style="color:#8ea3c4;font-size:11px"> Start on the Production QC screen. Keep this tab in front.</span></div>`;
      return;
    }
    b.innerHTML = `<div style="margin-bottom:6px"><b>${data.date}</b> · ${mode === "full" ? "Production + one RM line of 0.001 MT (the consumption with Add RM later)" : mode === "cons" ? "Add RM consumption to saved vouchers" : mode === "approve" ? "Approve the saved production vouchers" : "Production only"}</div>` +
      data.heats.map((h, i) => { const k = data.date + "|" + h.heat, done = s[k], appr = store(APPROVE_DONE_KEY)[k]; const can = mode === "cons" || mode === "approve" ? !!done : true;
        const tick = mode === "approve" ? can && !appr : mode === "cons" ? can && !appr : can && !done;   // an approved voucher doesn't open in Edit (13-Nov) - not ticked, can still be ticked by hand
        return `<label style="display:flex;gap:6px;align-items:center;margin:2px 0;${can ? "" : "opacity:.5"}"><input type="checkbox" data-i="${i}" ${tick ? "checked" : ""} ${can ? "" : "disabled"}>
          Heat ${h.heat} · ${h.lines.reduce((x, l) => x + l.pcs, 0)} pcs · ${h.mt.toFixed(3)} MT${done ? ` <span style="color:${mode === "cons" && appr ? "#ffb4a8" : "#9be7a0"}">(${done}${appr ? mode === "cons" ? " · approved - can't add RM" : " · approved" : ""})</span>` : ""}</label>`; }).join("") +
      `<div style="margin-top:8px"><button data-a="start" style="background:#d4a017;color:#10213a;border:0;border-radius:6px;padding:6px 14px;font-weight:700;cursor:pointer">Start</button>
       <span style="color:#8ea3c4;font-size:11px"> Keep this tab open and don't click in the ERP while it runs.</span></div>`;
  }
  async function startIrq() {
    const trialBox = panel().querySelector("#mzfTrial"), trial = !!(trialBox && trialBox.checked), dry0 = window.MZF_DRY;
    if (trial) window.MZF_DRY = true;
    keepAwake(true);
    MZF.busy = true; STOP = false; const t0 = Date.now();
    log(`Starting ${irqCfg(data.mode).name}: ${data.items.length} item(s)`, "h");
    // (14-Nov: a run in the phone layout was tried - the item form's buttons weren't reachable there; back to PC width)
    const wasPc = false;
    try {
      const vr = await newIrq(data, log);
      if (vr !== "DRY RUN") { remember(data.id, vr, IRQ_DONE_KEY); log(`   saved ${vr}`, "ok"); }
      try { if (appWin) appWin.postMessage({ type: "moltrix-erp-irq-done", id: data.id, vr }, APP_ORIGIN); } catch (e) {}
    } catch (e) {
      log(`   ✗ ${e.message}${whereOf(e)} - NOT saved`, "err");
      log(`   The half-filled voucher is still open - press Back in the ERP to throw it away, fix it in Moltrix and send again.`, "err");
    }
    log(`Finished in ${Math.round((Date.now() - t0) / 1000)} s.`, "h");
    if (wasPc) { const v = vpMeta(); v.content = "width=1366" + (/user-scalable=no/.test(v.content) ? ", user-scalable=no" : ""); window.dispatchEvent(new Event("resize")); setTimeout(fitPanel, 1200); }
    window.MZF_DRY = dry0; keepAwake(false);
    MZF.busy = false; STOP = false; renderData();
  }
  async function start() {
    if (MZF.busy || !data) return;
    if (data.mode === "indent" || data.mode === "req") return startIrq();
    const m2m = data.mode === "m2m", trialBox = panel().querySelector("#mzfTrial"), trial = (m2m || data.mode === "qc") && !!(trialBox && trialBox.checked), dry0 = window.MZF_DRY;
    let picked = [...panel().querySelectorAll("#mzfBody input[type=checkbox][data-i]")].filter(c => c.checked).map(c => data.heats[+c.dataset.i]);
    if (!picked.length) { log("No heat selected.", "err"); return; }
    if (trial) { picked = picked.slice(0, 1); window.MZF_DRY = true; log("Trial: only the first ticked heat is filled and left open, not saved.", "h"); }
    keepAwake(true);
    MZF.busy = true; STOP = false; const t0 = Date.now(); let okN = 0; RUN_SKIP.clear();
    log(`Starting ${picked.length} heat(s) for ${data.date}`, "h");
    const qc = data.mode === "qc", back = qc ? backToQcListing : m2m ? backToM2mListing : backToListing;
    try { await back(); }
    catch (e) { log(`✗ ${e.message}`, "err"); log("Nothing was entered.", "err"); window.MZF_DRY = dry0; keepAwake(false); MZF.busy = false; STOP = false; return; }
    let lastErr = "";
    const again = [];                                     // heats that only timed out (slow internet) - tried once more at the end
    const runOne = async (h, second) => {
      const k = data.date + "|" + h.heat + (m2m ? "|" + h.lines[0].len : "");
      log(`Heat ${h.heat}${m2m ? ` · ${h.lines[0].size} ${h.lines[0].len} Mtr` : ""}${second ? " (2nd try)" : ""}`, "h");
      try {
        let r;
        if (qc) { const vr0 = store(QC_DONE_KEY)[k]; r = vr0 ? await qcAddRest(h, vr0, log) : await newQc(h, log);
          if (r.vr !== "DRY RUN") remember(k, r.left, QC_LEFT_KEY);
          if (vr0 && !r.nothing) try { localStorage.removeItem(QC_NOEDIT_KEY); } catch (e) {}
          r.missing = r.left.length ? [`QC tests ${r.left.join(", ")} (Start again later - they are added to the same QC)`] : [];
          if (r.nothing && !r.left.length) { r.nothing = false; r.complete = true; } }
        else if (m2m) r = { vr: await newM2m(h, log) };
        else if (data.mode === "cons") { const vr = store()[k]; if (!vr) throw new Error("no saved voucher recorded for this heat");
          r = await addConsumption(h, vr, log); }
        else if (data.mode === "approve") { const vr = store()[k]; if (!vr) throw new Error("no saved voucher recorded for this heat on this phone / browser"); r = await approveVoucher(vr); }
        else r = await newVoucher(h, data.mode, log);
        if (r.already) { remember(k, r.vr, APPROVE_DONE_KEY); okN++; log(`   ${r.vr} was already approved ✓`, "ok"); }
        else if (r.complete) log(`   ${r.vr} already has all its tests ✓`, "ok");
        else if (r.nothing) log(`   nothing added to ${r.vr}`, "err");
        else if (r.vr === "DRY RUN") log("   trial done - check the voucher in the ERP, then press Back to throw it away", "h");
        else if (data.mode === "approve") { remember(k, r.vr, APPROVE_DONE_KEY); okN++; log(`   approved ${r.vr}`, "ok"); }
        else { remember(k, r.vr, qc ? QC_DONE_KEY : m2m ? M2M_DONE_KEY : DONE_KEY); okN++; log(`   saved ${r.vr}`, "ok"); }
        if (r.missing && r.missing.length) log(`   NOT entered: ${r.missing.join("; ")}`, "err");
        lastErr = "";
        try { if (appWin) appWin.postMessage({ type: "moltrix-erp-done", date: data.date, heat: h.heat, vr: r.vr, missing: r.missing || [] }, APP_ORIGIN); } catch (e) {}
      } catch (e) {
        const slow = /^Timed out/.test(e.message) && !e.stopAll;
        if (e.noRights && qc) { try { localStorage.setItem(QC_NOEDIT_KEY, "1"); } catch (x) {}
          log("   A saved QC can't be changed from this login, so tests still empty can't be added to it. Ask the ERP admin for Edit rights on Production QC [NQ:QCPRO], then tick those heats and Start again. New heats (no QC yet) still go in as before.", "err"); }
        log(`   ✗ ${e.message}${whereOf(e)} - this heat was NOT saved${slow && !second && !trial ? " (will try it again at the end)" : ""}`, "err");
        if (trial) { log("   The half-filled voucher is left open - press Back in the ERP to throw it away.", "err"); return "stop"; }
        if (slow && !second) { again.push(h); try { await back(); } catch (e2) {} return; }
        if (e.message === lastErr) { log("   Stopped - the same problem on two heats in a row; send me a screenshot of this.", "err"); try { await back(); } catch (e2) {} return "stop"; }
        lastErr = e.message;
        if (e.stopAll) { log("   Stopped - the other heats would fail the same way.", "err"); try { await back(); } catch (e2) {} return "stop"; }
        try { await back(); } catch (e2) {}
      }
    };
    let halted = false;
    for (const h of picked) { if ((await runOne(h)) === "stop") { halted = true; break; } renderData(); if (STOP) break; }
    if (!halted && !STOP && again.length) {
      log(`Trying again ${again.length} heat(s) that timed out (slow internet)...`, "h");
      for (const h of again) { if ((await runOne(h, true)) === "stop") break; renderData(); if (STOP) break; }
    }
    log(`Finished: ${okN} of ${picked.length} heat(s) saved in ${Math.round((Date.now() - t0) / 60000)} min.`, "h");
    window.MZF_DRY = dry0; keepAwake(false);
    MZF.busy = false; STOP = false; renderData();
  }
  function takeData(d, how) {
    if (MZF.busy) { log("Still busy - wait for the current run to finish.", "err"); return false; }
    data = d;
    if (data.items) log(`Received ${data.items.length} item(s) for ${irqCfg(data.mode).name} from Moltrix${how}.`, "h");
    else log(`Received ${data.heats.length} ${data.mode === "m2m" ? "voucher(s)" : "heat(s)"} for ${data.date} from Moltrix${how}.`, "h");
    renderData(); return true;
  }
  window.addEventListener("message", ev => {
    if (ev.origin !== APP_ORIGIN || !ev.data || ev.data.type !== "moltrix-erp-data") return;
    appWin = ev.source || appWin; takeData(ev.data.payload, "");
  });
  // phone: Moltrix "Copy for ERP" puts  MOLTRIX-ERP1 {json}  on the clipboard; it is pasted into the panel
  const MODES = ["full", "prod", "cons", "approve", "qc", "m2m", "indent", "req"];
  function loadPasted(t) {
    t = String(t || "").trim();
    const m = t.match(/^MOLTRIX-ERP1\s+([\s\S]+)$/);
    if (!m) { log("That is not Moltrix data - in Moltrix press \"Copy for ERP\" again, then paste the whole text here.", "err"); return; }
    let d; try { d = JSON.parse(m[1]); } catch (e) { log("The pasted text is cut or changed - copy it again in Moltrix.", "err"); return; }
    if (!d || !MODES.includes(d.mode) || !(Array.isArray(d.heats) || Array.isArray(d.items))) { log("The pasted data is not complete - copy it again in Moltrix.", "err"); return; }
    if (takeData(d, " (pasted)")) { const p = panel(); p.querySelector("#mzfPasteBox").value = ""; p.querySelector("#mzfPaste").style.display = "none"; }
  }
  window.MZF = { VERSION, busy: false, show() { panel(); renderData(); }, _t: { newVoucher, addConsumption, fillRm, backToListing, log, setData(d) { data = d; renderData(); }, debug(on) { DEBUG = on; dbgT = Date.now(); },
    grid, realRows, addRow, activate, fillProdLine, fillRmLine, alertBox, lov, pickLov, field, cell, newQc, qcFill, qcAddRest, backToQcListing, qcPickBatch, qcRowsNow, screenTitle,
    newIrq, irqAddItem, backToIrqListing, ngPick, irqGridRows, irqDefaults, loadPasted, doAction, formOpen, onListing, newM2m, backToM2mListing, m2mIssueLine, m2mRecvLine, m2mRowsNow, closeAlert } };
  panel(); renderData();
  // phone: the ERP shows Create New Record / Save only on a wide (PC) screen, so the page is laid out 1366 px wide
  if (isPhone() && (() => { try { return localStorage.getItem("mzfPcView") !== "0"; } catch (e) { return true; } })()) pcView(true, true); else fitPanel();
  if (!document.querySelector("ion-app") || !/Lighthouse/i.test(document.title + " " + (document.body.innerText || "").slice(0, 3000))) log("This doesn't look like the Lighthouse ERP page.", "err");
  else log(`ERP screen now: ${screenTitle() || "(unknown)"}`, onListing() || onQcListing() || onIrqListing("indent") || onIrqListing("req") || onM2mListing() ? "ok" : "");
})();
