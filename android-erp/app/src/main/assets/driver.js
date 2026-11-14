/* Moltrix ERP app - steps on the Lighthouse ERP page. The app runs tick(mode) every 1.5 s; each tick looks at
   what the ERP shows now and does the next step:
     login page          -> {s:"login"}   (the app then calls login(id, pw))
     Log In Parameters   -> presses OK (Company / Division / Role / Year are already filled by the ERP)
     any other screen    -> Quick Search (🔍) -> search text -> "Open" on the row with the menu code
     the right listing   -> loads erpfill.js -> {s:"need-data"} (the app calls load(json)) -> Start, no Trial
     running / finished  -> {s:"running"} / {s:"done"} with erpfill's own log lines
   If the screen can't be opened within 2 minutes it asks to open it by hand and carries on once it is open. */
(function () {
  if (window.MOLTRIX_DRIVER) return;
  var FILLER = "https://mishrachemist.github.io/erpfill.js";
  var PROD = { search: "production entry", code: "05.02.01.31", name: "Production Entry", title: /^Production Entry Listing/i, loose: /^Production Entry( Listing)?\b/i };
  var T = {
    full: PROD,
    cons: PROD,
    approve: PROD,
    qc: { search: "production qc", code: "07.01.02.01", name: "Production QC", title: /^Production QC \[NQ:QCPRO\]/i, loose: /^Production QC( Listing)?\b/i },
    m2m: { search: "material transfer", code: "03.03.04.06", name: "Material to Material Transfer", title: /^Material to Material Transfer \[QM:M2M\]/i, loose: /^Material to Material Transfer\b/i },
    req: { search: "store requisition", code: "03.04.02.01", name: "Store Issue Requisition", title: /^Requisition - Store Issue \[NI:REQI\]/i, loose: /^Requisition - Store Issue\b/i },
    indent: { search: "purchase requisition", code: "", name: "Purchase Requisition Entry", title: /^Purchase Requisition Listing \[IP:INDI\]/i, loose: /^Purchase Requisition Listing\b/i }
  };
  var S;
  var FRESH_LOGIN = false;   // true: the app clears the ERP login before every job (switched off - the ERP lost its Division / series lists)
  function reset() { S = { loadErr: "", navT0: 0, lastAct: 0, tries: 0, fillerT: 0, loadT: 0, started: false, startT: 0, sawBusy: false, logN: 0, paramsT: 0, paramsT0: 0, divT: 0, divTry: 0, openT: 0, loadingT: 0 }; }
  reset();

  function vis(e) {
    if (!e || !e.getBoundingClientRect) return false;
    var r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    var cs = getComputedStyle(e);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  }
  function onTop(e) {   // really the top thing on the screen (Ionic keeps old pages, e.g. the login page, behind the new one)
    if (!vis(e)) return false;
    var r = e.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    var x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
    var t = document.elementFromPoint(x, y);
    return !!t && (t === e || e.contains(t) || t.contains(e));
  }
  function txt(e) { return String((e && (e.innerText || e.textContent)) || "").replace(/\s+/g, " ").trim(); }
  function norm(s) { return String(s || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function inPanel(e) { return !!(e && e.closest && e.closest("#mzfPanel")); }
  function click(el) {
    if (!el) return false;
    try { el.scrollIntoView({ block: "center" }); } catch (e) {}
    ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(function (t) {
      try { el.dispatchEvent(new (t.indexOf("pointer") === 0 ? PointerEvent : MouseEvent)(t, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    });
    el.click();
    return true;
  }
  function setVal(inp, v) {
    inp.focus();
    var proto = inp.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(inp, v);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    inp.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
  }
  function buttons() {
    return Array.prototype.slice.call(document.querySelectorAll("ion-button, button, [role=button], a"))
      .filter(function (b) { return vis(b) && !inPanel(b); });
  }
  function findBtn(re) { return buttons().filter(function (b) { return re.test(txt(b)); })[0] || null; }
  function screenTitle() {   // the shortest text with "[XX:" in it that is really on screen, e.g. "Production QC [NQ:QCPRO]"
    // (Ionic keeps old pages in the page behind the new one - their titles must not count; erpfill's own check once it is loaded)
    if (window.MZF && window.MZF._t && window.MZF._t.screenTitle) { try { return window.MZF._t.screenTitle() || ""; } catch (e) {} }
    var c = Array.prototype.slice.call(document.querySelectorAll("body *")).filter(function (x) {
      if (inPanel(x)) return false;
      var tc = x.textContent || "";
      return tc.length <= 120 && /\[[A-Z]{2}:/.test(tc) && onTop(x);
    });
    c.sort(function (a, b) { return txt(a).length - txt(b).length; });
    return c.length ? txt(c[0]) : "";
  }

  // ---- login ----
  function pwInput() { return Array.prototype.slice.call(document.querySelectorAll("input[type=password]")).filter(onTop)[0] || null; }
  function topBtn(re) { return buttons().filter(function (b) { return re.test(txt(b)) && onTop(b); })[0] || null; }
  function isLogin() { return !!pwInput() && !!topBtn(/^log\s?in$/i); }
  function divListOpen() { return leaves().some(function (e) { return /^(RM|SM)\s*-\s*\(/i.test(txt(e)) && onTop(e); }); }   // the Division list is open
  function isParams() {
    if (!!topBtn(/^OK$/i) && leaves().some(function (e) { return /^Log In Parameters$/i.test(txt(e)) && onTop(e); })) return true;
    // an open dropdown lays a see-through cover over the whole page - then nothing else counts as "on top"
    return divListOpen() && !!findBtn(/^OK$/i) && leaves().some(function (e) { return /^Log In Parameters$/i.test(txt(e)); });
  }
  function leaves() { return Array.prototype.slice.call(document.querySelectorAll("body *")).filter(function (e) { return e.children.length === 0 && vis(e) && !inPanel(e); }); }

  // ---- Log In Parameters: Division must be SM-(STEEL MELTING SHOP (SMS)) before OK ----
  var DIV_RE = /^SM\s*-\s*\(?\s*STEEL MELTING SHOP/i;
  function fieldAfter(labelRe, stopRe) {
    var all = Array.prototype.slice.call(document.querySelectorAll("body *")).filter(function (e) { return vis(e) && !inPanel(e); });
    var lab = all.filter(function (e) { return e.children.length === 0 && labelRe.test(txt(e)); })[0];
    if (!lab) return null;
    var stop = all.filter(function (e) { return e.children.length === 0 && stopRe.test(txt(e)) && (lab.compareDocumentPosition(e) & 4); })[0];
    return all.filter(function (e) {
      if (!(lab.compareDocumentPosition(e) & 4) || e.contains(lab)) return false;               // after the label
      if (stop && !(e.compareDocumentPosition(stop) & 4)) return false;                        // before the next label
      var tag = e.tagName.toLowerCase(), cls = String(e.className || "");
      return /^(select|ion-select|ng-select|mat-select|p-dropdown|input|ion-item)$/.test(tag) || e.getAttribute("role") === "combobox" || /select|dropdown|combo/i.test(cls);
    })[0] || null;
  }
  function fieldText(f) {
    if (!f) return "";
    if (f.tagName === "SELECT") return f.selectedOptions && f.selectedOptions[0] ? f.selectedOptions[0].text : "";
    return txt(f) || (f.shadowRoot ? String(f.shadowRoot.textContent || "").trim() : "") || String(f.value || "");
  }
  // Account Year must show its value (e.g. "26-27") before OK - an OK pressed while it is still loading leaves the
  // ERP without its year globals (later: "Cannot read properties of null (reading 'G_YRBEGDATE')")
  var YR_RE = /\b\d{2}\s*-\s*\d{2}\b/;
  function yearReady() {
    var lab = leaves().filter(function (e) { return /^Account Year$/i.test(txt(e)) && onTop(e); })[0];
    if (!lab) return true;                                       // no such label seen - don't block
    var f = fieldAfter(/^Account Year$/i, /^(OK|Cancel)$/i);
    if (f && YR_RE.test(fieldText(f))) return true;
    return leaves().some(function (e) { return (lab.compareDocumentPosition(e) & 4) && onTop(e) && YR_RE.test(txt(e)) && txt(e).length <= 12; });
  }
  function paramsOk(now) {     // "" when OK was pressed, else why not yet
    var d = divisionStep();
    if (d) { S.divT = now; return "Division: SM chun raha hoon… (" + d + ")"; }
    if (!yearReady()) return "Account Year load ho raha hai…";
    if (S.divT && now - S.divT < 4000) return "Division set - ruk kar OK…";
    click(topBtn(/^OK$/i));
    return "";
  }
  function divisionStep() {   // "" when Division is already SM, else what was done now
    var f = fieldAfter(/^Division$/i, /^Select Role$/i);
    if (!f) return "";                                        // no Division field seen - just press OK
    if (DIV_RE.test(fieldText(f).replace(/^\s+/, ""))) return "";
    if (f.tagName === "SELECT") {
      var o = Array.prototype.slice.call(f.options).filter(function (x) { return DIV_RE.test(x.text.trim()); })[0];
      if (o) { f.value = o.value; f.dispatchEvent(new Event("change", { bubbles: true })); return "select"; }
      return "no-option";
    }
    var opt = leaves().filter(function (e) { return DIV_RE.test(txt(e)) && !f.contains(e) && onTop(e); })[0];   // the open list
    if (opt) {
      click(opt.closest("button, ion-item, li, [role=option], [role=radio], .alert-radio-button, ion-radio, mat-option, .ng-option, .p-dropdown-item") || opt);
      setTimeout(function () {                                   // an Ionic alert needs its own OK
        var box = document.querySelector("ion-alert, .alert-wrapper, ion-picker, ion-popover, ion-modal");
        if (box) { var ok = Array.prototype.slice.call(box.querySelectorAll("button, ion-button")).filter(function (b) { return vis(b) && /^(ok|done|select)$/i.test(txt(b)); })[0]; if (ok) click(ok); }
      }, 600);
      return "picked";
    }
    // open it the way a finger does: the thing really at the field's middle (Angular dropdowns open from an inner
    // trigger, not from the outer box); every 2nd try the inner trigger / arrow itself
    S.divTry = (S.divTry || 0) + 1;
    var r = f.getBoundingClientRect(), hit = null;
    if (S.divTry % 2) {
      try { f.scrollIntoView({ block: "center" }); r = f.getBoundingClientRect(); } catch (e) {}
      hit = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
      if (hit && !(f.contains(hit) || hit.contains(f))) hit = null;
    } else {
      hit = f.querySelector(".mat-mdc-select-trigger, .mat-select-trigger, .ng-select-container, .mat-mdc-select-arrow-wrapper, .ng-arrow-wrapper, [role=combobox], .select-trigger, .dropdown-toggle");
    }
    click(hit || f);
    return "opened " + S.divTry;
  }
  function login(id, pw) {
    var p = pwInput();
    var others = Array.prototype.slice.call(document.querySelectorAll("input")).filter(function (i) {
      return vis(i) && ["password", "checkbox", "radio", "hidden", "submit", "button"].indexOf((i.type || "").toLowerCase()) < 0;
    });
    var u = others.filter(function (i) { return /user/i.test([i.placeholder, i.name, i.id, i.getAttribute("aria-label")].join(" ")); })[0] || others[0];
    if (!p || !u) return "no-fields";
    setVal(u, id);
    setVal(p, pw);
    setTimeout(function () { var b = findBtn(/^log\s?in$/i); if (b) click(b); }, 700);
    return "ok";
  }

  // ---- Quick Search -> Open ----
  function searchBox() {
    var w = Array.prototype.slice.call(document.querySelectorAll("input")).filter(function (i) { return vis(i) && !inPanel(i) && /what to search/i.test(i.placeholder || ""); })[0];
    if (w) return w;                                           // the Quick Search box (in PC width it sits lower than 300 px)
    return Array.prototype.slice.call(document.querySelectorAll("input")).filter(function (i) {
      var t = (i.type || "text").toLowerCase();
      return vis(i) && !inPanel(i) && (t === "text" || t === "search") && !/where to search/i.test(i.placeholder || "") && i.getBoundingClientRect().top < 300;
    })[0] || null;
  }
  function searchOpen() { return !!findBtn(/^search menu$/i) || !!findBtn(/^search all$/i); }
  function searchIcon() {
    var c = Array.prototype.slice.call(document.querySelectorAll("ion-icon, ion-button, button, a, svg, img, i, span")).filter(function (e) {
      if (!vis(e) || inPanel(e) || e.getBoundingClientRect().top > 140) return false;
      var a = [e.getAttribute("name"), e.getAttribute("icon"), e.getAttribute("class"), e.getAttribute("aria-label"),
        e.getAttribute("title"), e.getAttribute("src"), e.getAttribute("ios"), e.getAttribute("md")].join(" ");
      return /search|magnif/i.test(a);
    });
    if (!c.length) return null;
    return c[0].closest("ion-button, button, a, [role=button]") || c[0];
  }
  function openButtonFor(t) {
    var leaves = Array.prototype.slice.call(document.querySelectorAll("body *")).filter(function (e) {
      return e.children.length === 0 && vis(e) && !inPanel(e);
    });
    var hit = leaves.filter(function (e) { return t.code ? txt(e) === t.code : norm(txt(e)) === norm(t.name); })[0];
    if (!hit && t.code) hit = leaves.filter(function (e) { return norm(txt(e)) === norm(t.name); })[0];
    for (var row = hit, i = 0; row && i < 7; i++, row = row.parentElement) {   // the first parent that has an "Open" button is the row
      var ob = Array.prototype.slice.call(row.querySelectorAll("ion-button, button, a, [role=button]")).filter(function (b) {
        return vis(b) && /^open$/i.test(txt(b)) && onTop(b);   // not the Open of an old search page kept behind
      })[0];
      if (ob) return ob;
    }
    return null;
  }
  function nav(t) {
    var ob = openButtonFor(t);
    if (ob) { click(ob); S.tries = 0; S.openT = Date.now(); return "open"; }
    var box = searchBox();
    if (searchOpen() && box) {
      if (norm(box.value) !== norm(t.search)) {
        setVal(box, t.search);
        ["keydown", "keyup"].forEach(function (k) { box.dispatchEvent(new KeyboardEvent(k, { bubbles: true, key: "Enter", code: "Enter", keyCode: 13, which: 13 })); });
        return "typed";
      }
      S.tries++;
      var b = findBtn(S.tries % 2 ? /^search menu$/i : /^search all$/i);
      if (b) click(b);
      return "search";
    }
    var ic = searchIcon();
    if (ic) { click(ic); return "icon"; }
    return "no-icon";
  }

  // ---- erpfill: data + Start ----
  function panelLog() {
    var p = document.getElementById("mzfPanel");
    return p ? Array.prototype.slice.call(p.querySelectorAll("#mzfLog > div")).map(function (d) { return { t: d.textContent || "", c: d.style.color || "" }; }) : [];
  }
  function load(json) {
    S.loadT = Date.now();
    if (!window.MZF) { S.loadErr = "erpfill.js load nahi hua"; return "no-filler"; }
    try { window.MZF.show(); window.MZF._t.loadPasted("MOLTRIX-ERP1 " + json); } catch (e) { S.loadErr = "Data load nahi hua: " + e.message; return "err"; }
    setTimeout(function () {
      var p = document.getElementById("mzfPanel");
      if (!p) return;
      var tr = p.querySelector("#mzfTrial");
      if (tr && tr.checked) tr.click();                                // straight Save - no Trial
      var sb = p.querySelector('[data-a="start"]');
      if (sb) { S.logN = panelLog().length; S.started = true; S.startT = Date.now(); sb.click(); }
    }, 1500);
    return "ok";
  }
  function runState() {
    var lines = panelLog().slice(S.logN), last = lines.length ? lines[lines.length - 1].t : "";
    if (window.MZF && window.MZF.busy) { S.sawBusy = true; return { s: "running", msg: last || "Entry chal rahi hai…" }; }
    if (!S.sawBusy && Date.now() - S.startT < 6000) return { s: "running", msg: last || "Start…" };
    var isErr = function (l) { return /255,\s*138,\s*128|#ff8a80/i.test(l.c); }, isOk = function (l) { return /155,\s*231,\s*160|#9be7a0/i.test(l.c); };
    var fin = null;
    lines.forEach(function (l) { var m = /Finished:\s*(\d+)\s+of\s+(\d+)/i.exec(l.t); if (m) fin = { saved: +m[1], total: +m[2] }; });
    return { s: "done", ok: lines.filter(isOk).length, err: lines.filter(isErr).length, saved: fin ? fin.saved : -1, total: fin ? fin.total : -1,
      msg: lines.slice(-10).map(function (l) { return l.t; }).join("\n") || "Kuch nahi hua - ERP ki screen dekhein." };
  }

  // the ERP opens in PC width from the very first page (login included): when it was started in the phone layout and
  // switched to PC width only later, its Indent screens missed their year data ("G_YRBEGDATE") - a login in PC width sets it up
  function pcWide() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement("meta"); m.name = "viewport"; m.content = ""; document.head.appendChild(m); }
    if (m.dataset.mzfOrig === undefined) m.dataset.mzfOrig = m.content;
    if (!/width=1366/.test(m.content)) { m.content = "width=1366"; try { localStorage.setItem("mzfPcView", "1"); } catch (e) {} window.dispatchEvent(new Event("resize")); }
  }
  function tick(mode) {
    var t = T[mode], now = Date.now();
    try { pcWide(); } catch (e) {}
    if (!t) return { s: "error", msg: "unknown mode " + mode };
    if (S.started) {   // the ERP can log out in the middle of a run: log in again (erpfill then reopens its screen by itself)
      if (isParams()) { var pm = ""; if (now - S.paramsT > 2000) { S.paramsT = now; pm = paramsOk(now); } return { s: "running", msg: "ERP logged out - Log In Parameters… " + pm }; }
      if (isLogin()) return { s: "login" };
      return runState();
    }
    if (S.loadErr) return { s: "error", msg: S.loadErr };
    if (S.loadT) {
      if (now - S.loadT > 20000) {
        var l = panelLog();
        return { s: "error", msg: "Data load nahi hua" + (l.length ? ": " + l[l.length - 1].t : "") };
      }
      return { s: "loading-data", msg: "data load…" };
    }
    if (isParams()) {
      if (!S.paramsT0) S.paramsT0 = now;
      if (now - S.paramsT0 > 45000) return { s: "manual", msg: "Division mein SM-(STEEL MELTING SHOP (SMS)) chunein aur OK dabayein - phir aage apne aap chalega." };
      if (now - S.paramsT < 2000) return { s: "params", msg: "Log In Parameters…" };
      S.paramsT = now;
      var pm = paramsOk(now);
      return { s: "params", msg: pm || "Log In Parameters → OK" };
    }
    if (isLogin()) return { s: "login" };
    // on the phone layout (before erpfill sets PC width) the screen's heading can come without its "[XX:YYY]" code -
    // then its plain name on top counts too, once Open was pressed and the search page is gone
    var here = t.title.test(screenTitle()) ||
      (S.openT && now - S.openT > 3000 && !searchOpen() && leaves().some(function (e) { return t.loose.test(txt(e)) && txt(e).length <= 60 && onTop(e); }));
    if (here) {
      if (!window.MZF) {
        if (!S.fillerT || now - S.fillerT > 20000) {
          S.fillerT = now;
          var sc = document.createElement("script");
          sc.src = FILLER + "?t=" + now;
          document.body.appendChild(sc);
        }
        return { s: "loading-filler", msg: "erpfill.js load…" };
      }
      if (window.MZF.busy) return { s: "error", msg: "ERP panel pehle se kuch chala raha hai - khatam hone dein." };
      return { s: "need-data" };
    }
    // the ERP's "Loading ×" box can stay up forever and cover the page (nothing can be tapped) - close it after 15 s
    var ld = leaves().filter(function (e) { return /^Loading$/i.test(txt(e)); })[0];
    if (ld) {
      if (!S.loadingT) S.loadingT = now;
      if (now - S.loadingT > 15000) {
        var box = ld.parentElement, x = null;
        for (var k = 0; k < 4 && box && !x; k++, box = box.parentElement)
          x = Array.prototype.slice.call(box.querySelectorAll("ion-icon, button, ion-button, span, div")).filter(function (e) {
            return vis(e) && (/close/i.test((e.getAttribute("name") || "") + " " + (e.getAttribute("class") || "")) || /^[×✕xX]$/.test(txt(e)));
          })[0] || null;
        if (x) { click(x.closest("ion-button, button") || x); S.loadingT = now; return { s: "nav", msg: t.name + " - ERP ka atka hua Loading band kiya" }; }
      }
    } else S.loadingT = 0;
    if (!S.navT0) S.navT0 = now;
    if (now - S.navT0 > 120000) return { s: "manual", msg: "\"" + t.name + "\" screen khud kholiye - khulte hi entry shuru ho jayegi." };
    if (now - S.lastAct < 2500) return { s: "nav", msg: t.name + " khol raha hoon…" };
    if (S.openT && now - S.openT < 20000 && !searchOpen()) return { s: "nav", msg: t.name + " khul raha hai…" };   // Open pressed - let the page come up
    S.lastAct = now;
    var did = nav(t);
    return { s: "nav", msg: t.name + " khol raha hoon… (" + did + ")" };
  }

  window.MOLTRIX_DRIVER = { tick: tick, login: login, load: load, reset: reset, _screenTitle: screenTitle };
})();
