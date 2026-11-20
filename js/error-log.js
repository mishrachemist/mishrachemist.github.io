/* ===================== ERROR LOG (☰ → Error Log) =====================
   Shows what window.mzErr collected (page errors, files that did not load, NSE / Screener errors) with time and
   app version, newest first. Copy = the whole list as text (to paste in a chat instead of screenshots). ===== */
(function errorLog() {
  const K = "mzErrLog";
  const esc = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
  const load = () => { try { return JSON.parse(localStorage.getItem(K) || "[]"); } catch (e) { return []; } };
  const fmt = ts => { const d = new Date(ts); return d.toLocaleDateString("en-GB").replace(/\//g, "-").slice(0, 5) + " " + d.toLocaleTimeString("en-GB", { hour12: false }); };
  const asText = L => L.slice().reverse().map(x => `${fmt(x[0])} [${x[3] || ""}] ${x[1]}: ${x[2]}`).join("\n");
  function show() {
    if (document.getElementById("mzErrBox")) return;
    const L = load();
    let gw = ""; try { if (window.MoltrixApp && MoltrixApp.gammaWatchStatus) gw = MoltrixApp.gammaWatchStatus() || ""; } catch (e) {}
    const d = document.createElement("div");
    d.id = "mzErrBox";
    d.style.cssText = "position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:14px;";
    d.innerHTML = `<div style="background:var(--card-bg,#fffaf2);color:inherit;width:100%;max-width:560px;max-height:86vh;display:flex;flex-direction:column;border-radius:16px;padding:16px;box-shadow:0 12px 34px rgba(0,0,0,.35);">
      <div style="font-weight:800;font-size:17px;margin-bottom:4px;">🐞 Error Log <small style="font-weight:600;opacity:.7">${esc(typeof APP_VERSION !== "undefined" ? APP_VERSION : "")}</small></div>
      ${gw ? `<div style="font-size:12px;opacity:.8;margin-bottom:6px;">⚡ Gamma watch: ${esc(gw)}</div>` : ""}
      <div style="flex:1;min-height:60px;overflow:auto;font:12px/1.45 ui-monospace,monospace;border:1px solid rgba(128,128,128,.3);border-radius:10px;padding:8px;margin:6px 0 10px;user-select:text;-webkit-user-select:text;">
        ${L.length ? L.slice().reverse().map(x => `<div style="margin-bottom:6px;"><b>${esc(fmt(x[0]))}</b> <span style="opacity:.6">${esc(x[3] || "")}</span> <b>${esc(x[1])}</b><br>${esc(x[2])}</div>`).join("") : "No errors"}
      </div>
      <div style="display:flex;gap:8px;"><button type="button" class="primary" id="mzErrCopy" style="flex:1;margin:0;">${window.MZ_NATIVE ? "📤 Share" : "📋 Copy"}</button>
        <button type="button" class="secondary" id="mzErrClear" style="flex:1;margin:0;">🗑 Clear</button>
        <button type="button" class="secondary" id="mzErrClose" style="flex:1;margin:0;">Close</button></div></div>`;
    document.body.appendChild(d);
    const close = () => d.remove();
    d.addEventListener("click", e => { if (e.target === d) close(); });
    d.querySelector("#mzErrClose").onclick = close;
    d.querySelector("#mzErrClear").onclick = () => { if (!confirm("Clear the error log?")) return; try { localStorage.removeItem(K); } catch (e) {} close(); };
    d.querySelector("#mzErrCopy").onclick = async ev => {
      const b = ev.currentTarget, txt = `Moltrix ${typeof APP_VERSION !== "undefined" ? APP_VERSION : ""}${gw ? "\nGamma watch: " + gw : ""}\n` + (asText(L) || "No errors");
      let ok = false;
      try { if (window.MoltrixApp && MoltrixApp.shareText) { MoltrixApp.shareText(txt, "Moltrix error log"); ok = true; } else { await navigator.clipboard.writeText(txt); ok = true; } } catch (e) {}
      if (!ok) { const t = document.createElement("textarea"); t.value = txt; t.style.cssText = "position:fixed;left:-9999px"; document.body.appendChild(t); t.select(); try { ok = document.execCommand("copy"); } catch (e) {} t.remove(); }
      b.textContent = ok ? "✅ Done" : "Select and copy by hand"; setTimeout(() => { b.textContent = window.MZ_NATIVE ? "📤 Share" : "📋 Copy"; }, 2500);
    };
  }
  window.mzShowErrLog = show;
})();
