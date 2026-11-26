/* Big libraries load only when something first uses them (26-Nov-2026).
   Excel (XLSX, ~880 KB), PDF (jspdf + autotable, ~400 KB) and Chart.js (~200 KB) used to load on every app start,
   before the first screen. Now window.XLSX / window.jspdf / window.Chart are placeholders: the first time any code
   reads one, the file is read from this site (vendor/, kept by the service worker, so it works offline too) and run
   right there, and the code carries on as if it had always been loaded. When the app is idle the files are fetched
   into the cache in advance (not run), so the first use does not wait for the network. */
(function () {
  "use strict";
  const LIBS = {
    XLSX: ["vendor/xlsx-0.18.5/xlsx.full.min.js"],
    jspdf: ["vendor/jspdf-2.5.1/jspdf.umd.min.js", "vendor/jspdf-autotable-3.8.2/jspdf.plugin.autotable.min.js"],
    Chart: ["vendor/chart.js-4.5.0/chart.umd.min.js"],
  };
  const after = { jspdf: () => { try { if (typeof window.mzZeroBlank === "function") window.mzZeroBlank(); } catch (e) {} } };
  const loading = {};

  function run(src) {   // read the file synchronously (same site) and run it as a page script
    const x = new XMLHttpRequest();
    x.open("GET", src, false); x.send(null);
    if (x.status !== 200 && x.status !== 0) throw new Error("could not load " + src + " (" + x.status + ")");
    const s = document.createElement("script");
    s.textContent = x.responseText.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, "") + "\n//# sourceURL=" + new URL(src, location.href).href;
    // a page-wide AMD/CommonJS loader (if any ever appears) would swallow the library: hide it while it runs
    const hid = {}; ["define", "module", "exports"].forEach(k => { if (k in window) { hid[k] = window[k]; try { window[k] = undefined; } catch (e) {} } });
    try { (document.head || document.documentElement).appendChild(s); s.remove(); }
    finally { Object.keys(hid).forEach(k => { try { window[k] = hid[k]; } catch (e) {} }); }
  }
  function settle(name, v) { Object.defineProperty(window, name, { value: v, writable: true, configurable: true, enumerable: true }); }
  function load(name) {
    if (loading[name]) return;   // a library that reads its own name while loading gets undefined, as before
    loading[name] = true;
    settle(name, undefined);
    try { LIBS[name].forEach(run); }
    catch (e) { try { console.error("lazy-libs", name, e); if (window.mzErr) window.mzErr("Libraries", name + ": " + (e && e.message || e)); } catch (x) {} }
    if (after[name]) after[name]();
  }
  Object.keys(LIBS).forEach(name => {
    if (window[name] !== undefined) return;
    Object.defineProperty(window, name, {
      configurable: true, enumerable: true,
      get() { load(name); return Object.getOwnPropertyDescriptor(window, name).value; },
      set(v) { settle(name, v); },   // the library itself (or a test) setting it
    });
  });
  window.mzLibsLoaded = name => !Object.getOwnPropertyDescriptor(window, name).get;

  // fetch (not run) the files into the cache once the app is idle
  const warm = () => Object.values(LIBS).flat().forEach(u => { try { fetch(u, { priority: "low" }).catch(() => {}); } catch (e) {} });
  addEventListener("load", () => setTimeout(() => (window.requestIdleCallback || setTimeout)(warm, { timeout: 8000 }), 4000), { once: true });
})();
