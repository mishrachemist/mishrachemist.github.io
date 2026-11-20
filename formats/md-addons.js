/* ===== Moltrix dashboard add-ons (loaded by every V5 PRO dashboard page through Moltrix_Dash_Addons.gs) =====
   1) "What is missing" column: the long text becomes one small sign (ⓘ, or ⛔ when the text has ⛔);
      a tap on the sign shows the full text in a popup. Works for every table with that column, also after
      the dashboard refreshes its tables. ===== */
(function () {
  if (window.__mzDashAddons) return;
  window.__mzDashAddons = true;

  var css = document.createElement("style");
  css.textContent =
    ".mzWmBtn{border:0;background:transparent;cursor:pointer;padding:2px 6px;margin:0;font-size:17px;line-height:1;color:inherit}" +
    ".mzWmCell{text-align:center!important;width:40px!important;min-width:40px!important;max-width:40px!important;white-space:nowrap!important;padding-left:2px!important;padding-right:2px!important}" +
    "#mzWmPop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}" +
    "#mzWmPop .b{background:#13213a;color:#e8ecf4;border:1px solid #2c4268;border-radius:14px;padding:16px 16px 14px;max-width:440px;width:100%;" +
    "font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);max-height:80vh;overflow:auto}" +
    "#mzWmPop .h{font-weight:800;font-size:15px;margin-bottom:8px}#mzWmPop .s{opacity:.75;font-size:12.5px;margin:-4px 0 8px}" +
    "#mzWmPop ul{margin:0;padding-left:18px}#mzWmPop li{margin:3px 0}" +
    "#mzWmPop button{margin-top:14px;padding:8px 20px;border:0;border-radius:8px;background:#3b82f6;color:#fff;font-weight:700;cursor:pointer}";
  document.head.appendChild(css);

  var RE = /what\s*is\s*missing/i;
  function pop(title, sub, text) {
    var old = document.getElementById("mzWmPop"); if (old) old.remove();
    var o = document.createElement("div"); o.id = "mzWmPop";
    var b = document.createElement("div"); b.className = "b";
    var h = document.createElement("div"); h.className = "h"; h.textContent = title; b.appendChild(h);
    if (sub) { var s = document.createElement("div"); s.className = "s"; s.textContent = sub; b.appendChild(s); }
    var parts = String(text).split(/\s*(?:\u00B7|\||;|\n)\s*/).filter(function (x) { return x; });
    if (parts.length > 1) { var ul = document.createElement("ul"); parts.forEach(function (p) { var li = document.createElement("li"); li.textContent = p; ul.appendChild(li); }); b.appendChild(ul); }
    else { var p = document.createElement("div"); p.style.whiteSpace = "pre-wrap"; p.textContent = text; b.appendChild(p); }
    var c = document.createElement("button"); c.type = "button"; c.textContent = "Close"; c.onclick = function () { o.remove(); }; b.appendChild(c);
    o.appendChild(b); o.addEventListener("click", function (e) { if (e.target === o) o.remove(); });
    document.body.appendChild(o);
  }
  function colOf(table) {
    var ci = -1;
    var heads = table.querySelectorAll("thead th, thead td, tr:first-child th");
    for (var i = 0; i < heads.length; i++) {
      var th = heads[i];
      if (th.dataset.mzWm || RE.test(th.textContent)) {
        ci = Array.prototype.indexOf.call(th.parentNode.children, th);
        if (!th.dataset.mzWm) { th.dataset.mzWm = "1"; th.title = th.textContent.trim(); th.textContent = "\u24D8"; th.classList.add("mzWmCell"); }
        break;
      }
    }
    return ci;
  }
  function fix() {
    var tables = document.querySelectorAll("table");
    for (var t = 0; t < tables.length; t++) {
      var table = tables[t], ci = colOf(table);
      if (ci < 0) continue;
      var rows = table.querySelectorAll("tbody tr");
      for (var r = 0; r < rows.length; r++) {
        var cell = rows[r].children[ci];
        if (!cell || cell.tagName === "TH" || cell.querySelector(".mzWmBtn")) continue;
        var text = cell.textContent.replace(/\s+/g, " ").trim();
        if (cell.dataset.mzWm && !text) continue;   // already done (empty)
        cell.dataset.mzWm = "1";
        cell.classList.add("mzWmCell");
        if (!text || text === "-" || text === "\u2014") { cell.textContent = ""; continue; }
        var name = (rows[r].children[0] && rows[r].children[0].textContent || "").replace(/\s+/g, " ").trim();
        if (name.length > 40) name = name.slice(0, 40) + "\u2026";
        cell.textContent = "";
        var btn = document.createElement("button"); btn.type = "button"; btn.className = "mzWmBtn";
        btn.textContent = text.indexOf("\u26D4") > -1 ? "\u26D4" : "\u24D8"; btn.title = text; btn.setAttribute("aria-label", "What is missing");
        (function (tx, nm) { btn.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); pop("What is missing", nm, tx); }); })(text, name);
        cell.appendChild(btn);
      }
    }
  }
  var timer = 0;
  function later() { clearTimeout(timer); timer = setTimeout(fix, 80); }
  function start() { fix(); new MutationObserver(later).observe(document.body, { childList: true, subtree: true, characterData: true }); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
