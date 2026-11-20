/* ===================== NAV DRAWER + GREETING CARD + BOTTOM TAB BAR ===================== */
(function () {
  const hamburgerBtn = document.getElementById("hamburgerBtn");
  const navDrawer = document.getElementById("navDrawer");
  const navDrawerBackdrop = document.getElementById("navDrawerBackdrop");
  const bottomTabBar = document.getElementById("bottomTabBar");

  function openDrawer() {
    navDrawer.classList.remove("closed");
    navDrawerBackdrop.classList.remove("closed");
  }
  function closeDrawer() {
    navDrawer.classList.add("closed");
    navDrawerBackdrop.classList.add("closed");
  }
  if (hamburgerBtn) hamburgerBtn.addEventListener("click", (e) => { e.stopPropagation(); openDrawer(); });
  navDrawerBackdrop.addEventListener("click", closeDrawer);

  /* ---------- Theme colour picker ---------- */
  const THEME_COLORS = {
    navy: { name: "Denim Blue", c1: "#0b2545", c2: "#12345c", text: "#fff", textRgb: "255,255,255" },
    black: { name: "Leather Black", c1: "#1a1a1a", c2: "#2e2e2e", text: "#fff", textRgb: "255,255,255" },
    chocolate: { name: "Wooden", c1: "#5c3a21", c2: "#7a4f2e", text: "#fff", textRgb: "255,255,255" },
    white: { name: "Marble White", c1: "#ffffff", c2: "#f0f0f0", text: "#16233d", textRgb: "22,35,61", light: true },
    steel: { name: "Brushed Steel", c1: "#cdd2d7", c2: "#adb4bb", text: "#16233d", textRgb: "22,35,61", light: true },
    molten: { name: "Molten Steel", c1: "#1c0d08", c2: "#2e160c", text: "#fff", textRgb: "255,255,255" },
    copper: { name: "Copper Patina", c1: "#8a4a28", c2: "#a95f36", text: "#fff", textRgb: "255,255,255" },
    graph: { name: "Graph Paper", c1: "#fdfcf7", c2: "#f1eee2", text: "#16233d", textRgb: "22,35,61", light: true },
    blueprint: { name: "Blueprint", c1: "#164a80", c2: "#1f62a5", text: "#fff", textRgb: "255,255,255" },
    kraft: { name: "Kraft Paper", c1: "#c99c68", c2: "#b88a57", text: "#2b1a0c", textRgb: "43,26,12", light: true },
    brass: { name: "Brass Gold", c1: "#d8b45c", c2: "#b8923a", text: "#2a1d05", textRgb: "42,29,5", light: true },
    clean: { name: "Clean (Default) - Day / Night", c1: "#f6f0e6", c2: "#efe7da", text: "#1f3864", textRgb: "31,56,100", light: true, swatch: "linear-gradient(135deg, #f3ede3 0 50%, #141416 50% 100%)" }
  };

  // textured themes (CSS + SVG patterns, see "Textured themes" style block)
  const THEME_TEXTURE = { navy: "tex-denim", chocolate: "tex-wood", black: "tex-leather", white: "tex-marble", steel: "tex-steel", molten: "tex-molten",
                          copper: "tex-copper", graph: "tex-graph", blueprint: "tex-blueprint", kraft: "tex-kraft", brass: "tex-brass", clean: "tex-clean" };
  window.applyTheme = (k) => applyTheme(k);
  function applyTheme(key) {
    if (!THEME_COLORS[key]) key = "clean";   // a theme that was removed (Leaf, Rust, Brick, Concrete, Transparent, Jute, Slate) -> Denim
    const t = THEME_COLORS[key], light = !!t.light;
    // Set on <body> (not just :root) so this overrides body.dark-mode's own
    // --navy/--navy-2 too - an inline style on body always wins over a
    // class-based CSS rule on that same element. --navy-text flips every
    // hardcoded-white label on a --navy background to dark automatically
    // when a light theme color (like White) is chosen, so nothing goes
    // invisible.
    document.body.style.setProperty("--navy", t.c1);
    document.body.style.setProperty("--navy-2", t.c2);
    document.body.style.setProperty("--navy-text", t.text);
    document.body.style.setProperty("--navy-text-rgb", t.textRgb);
    localStorage.setItem("themeColor", key);
    document.body.classList.toggle("theme-light", light);   // light themes (Marble, Steel, Graph, Kraft, Brass): light look everywhere
    document.body.classList.toggle("themed", !light);       // pages follow the theme colour
    document.body.classList.remove("theme-transparent");
    Object.keys(THEME_TEXTURE).forEach(k => document.body.classList.toggle(THEME_TEXTURE[k], k === key));
    // Light themes are a fully light look - every page, form, table and popup.
    // (Turning Dark Mode on while a light theme is chosen switches back to Navy.)
    // Day / Night only for the Clean theme (Night = black); other themes: one look, no dark mode
    const night = key === "clean" && localStorage.getItem("cleanNight") === "1";
    if (night) {
      const st = document.body.style;
      st.setProperty("--navy", "#141416"); st.setProperty("--navy-2", "#1d1d21"); st.setProperty("--navy-text", "#ececf0"); st.setProperty("--navy-text-rgb", "236,236,240");
      document.body.classList.remove("theme-light"); document.body.classList.add("themed");
    }
    document.body.classList.toggle("dark-mode", night);
    document.body.classList.toggle("clean-night", night);
    const dmt = document.getElementById("darkModeToggle");
    if (dmt) { dmt.textContent = night ? "☀️ Day mode" : "🌙 Night mode"; dmt.style.display = key === "clean" ? "" : "none"; }
    const dmd = document.querySelector('.navDrawerItem[data-drawer-action="dark"]');
    if (dmd) { dmd.style.display = key === "clean" ? "" : "none"; dmd.innerHTML = `<span class="navDrawerIcon">${night ? "☀️" : "🌙"}</span><span>${night ? "Day mode" : "Night mode"}</span>`; }
    document.querySelectorAll("#themeSwatches button").forEach(b => {
      b.style.borderColor = b.dataset.themeKey === key ? "var(--gold)" : "rgba(128,128,128,.35)";
    });
  }

  function buildThemeSwatches() {
    const container = document.getElementById("themeSwatches");
    if (!container || container.children.length) return; // build once
    const current = localStorage.getItem("themeColor") || "clean";
    Object.keys(THEME_COLORS).forEach(key => {
      const t = THEME_COLORS[key];
      const wrap = document.createElement("div");
      wrap.style.textAlign = "center";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = t.name;
      btn.dataset.themeKey = key;
      btn.style.cssText = `width:52px;height:52px;border-radius:50%;border:3px solid ${key === current ? "var(--gold)" : "rgba(128,128,128,.35)"};background:${t.swatch || ("linear-gradient(135deg, " + t.c1 + ", " + t.c2 + ")")};cursor:pointer;display:block;margin:0 auto;padding:0;`;
      if (THEME_TEXTURE[key]) btn.classList.add("texSw-" + THEME_TEXTURE[key].slice(4));
      btn.addEventListener("click", () => applyTheme(key));
      const label = document.createElement("div");
      label.textContent = t.name;
      label.style.cssText = "font-size:10.5px;margin-top:5px;color:var(--muted);line-height:1.2;";
      wrap.appendChild(btn);
      wrap.appendChild(label);
      container.appendChild(wrap);
    });
  }

  function openThemePicker() {
    buildThemeSwatches();
    document.getElementById("themePickerOverlay").classList.remove("hidden");
  }
  const themeCloseBtn = document.getElementById("themePickerCloseBtn");
  if (themeCloseBtn) themeCloseBtn.addEventListener("click", () => {
    document.getElementById("themePickerOverlay").classList.add("hidden");
  });
  const themeOverlay = document.getElementById("themePickerOverlay");
  if (themeOverlay) themeOverlay.addEventListener("click", (e) => {
    if (e.target === themeOverlay) themeOverlay.classList.add("hidden");
  });

  // Apply the saved theme (if any) right away, before sign-in even completes.
  applyTheme(localStorage.getItem("themeColor") || "clean");

  // Sync the drawer's avatar/name from the header logo once it's available.
  function syncDrawerProfile() {
    const drawerImg = document.getElementById("navDrawerAvatar");
    if (!drawerImg) return;
    const savedPhoto = localStorage.getItem("customProfilePhoto");
    const headerImg = document.getElementById("headerLogoImg");
    const src = savedPhoto || (headerImg && headerImg.src) || "";
    if (src) drawerImg.src = src;
  }
  syncDrawerProfile();

  // Drawer items that jump to a main section reuse the existing icon-grid
  // navItem click handlers, so behavior (sub-nav resets, active states,
  // etc.) stays in one place.
  document.querySelectorAll("#navDrawerList [data-drawer-section]").forEach(btn => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.drawerSection;
      const target = document.querySelector('#mainSidebar > .navItem[data-section="' + section + '"]');
      if (target) target.click();
      closeDrawer();
      setBottomTabActive(section);
    });
  });

  document.querySelectorAll("#navDrawerList [data-drawer-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.drawerAction;
      closeDrawer();
      runNavAction(action);
    });
  });

  function runNavAction(action) {
    if (action === "theme") { openThemePicker(); return; }
    if (action === "games") { if (window.openGames) window.openGames(); return; }
    if (action === "snake") { if (window.openSnakeGame) window.openSnakeGame(); return; }
    if (action === "switchacct") { if (window.openSwitchAccount) window.openSwitchAccount(); return; }
    if (action === "iconstyle") { openIconStylePicker(); return; }
    if (action === "fpsignin") { openFpSignInSetup(); return; }
    if (action === "backup") { if (window.mzOpenBackup) window.mzOpenBackup(); return; }
    if (action === "locklog") { if (window.mzShowLockLog) window.mzShowLockLog(); return; }
    if (action === "fplock") { const b = document.getElementById("fpLockToggle"); if (b) b.click(); return; }
    if (action === "apk") { downloadAndroidApk(); return; }
    const map = {
      home: "backToMenuBtn",
      search: "cmdPaletteBtn",
      filelocation: "fileLocationMenuBtn",
      qr: "qrShareBtn",
      lang: "langToggle",
      dark: "darkModeToggle",
      refresh: "refreshPageBtn"
    };
    const id = map[action];
    const el = id && document.getElementById(id);
    if (el) el.click();
    if (action === "home") setBottomTabActive("home");
  }

  // Sign Out inside the drawer mirrors the Settings-menu Sign Out button.
  document.getElementById("navDrawerSignOut").addEventListener("click", () => {
    const el = document.getElementById("signOutBtn");
    if (el) el.click();
    closeDrawer();
  });

  /* ---------- Bottom tab bar ---------- */
  function setBottomTabActive(key) {
    document.querySelectorAll("#bottomTabBar .bottomTabItem").forEach(b => b.classList.remove("active"));
    const sel = key === "home"
      ? '#bottomTabBar [data-tab-action="home"]'
      : '#bottomTabBar [data-tab-section="' + key + '"]';
    const btn = document.querySelector(sel);
    if (btn) btn.classList.add("active");
  }

  document.querySelectorAll("#bottomTabBar [data-tab-section]").forEach(btn => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.tabSection;
      const target = document.querySelector('#mainSidebar > .navItem[data-section="' + section + '"]');
      if (target) target.click();
      setBottomTabActive(section);
    });
  });
  // Centre gold button: opens the WhatsApp page (so the progress is visible)
  // and starts "Fetch WhatsApp" straight away; the circle spins while it runs.
  const fabBtn = document.getElementById("bottomTabFetch");
  if (fabBtn) fabBtn.addEventListener("click", async () => {
    if (fabBtn.classList.contains("busy")) return;
    try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {}
    const wa = document.querySelector('#mainSidebar > .navItem[data-section="whatsapp"]');
    if (wa) wa.click();
    document.querySelectorAll("#bottomTabBar .bottomTabItem").forEach(b => b.classList.remove("active"));
    const lbl = document.getElementById("bottomTabFetchLabel");
    fabBtn.classList.add("busy"); if (lbl) { lbl.dataset.enText = "Fetching"; lbl.textContent = uiT("Fetching"); }
    try { await waInboxFetch(); }
    finally { fabBtn.classList.remove("busy"); if (lbl) { lbl.dataset.enText = "Fetch"; lbl.textContent = uiT("Fetch"); } }
  });
  document.querySelectorAll("#bottomTabBar [data-tab-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.tabAction;
      if (action === "home") { runNavAction("home"); setBottomTabActive("home"); }
      else if (action === "more") openDrawer();
    });
  });

  // The main "Back to Menu" button (used when leaving a section from inside
  // its own page) should also reset the bottom tab bar to Home.
  const backBtn = document.getElementById("backToMenuBtn");
  if (backBtn) backBtn.addEventListener("click", () => setBottomTabActive("home"));

  // Reveal the bottom tab bar once the app becomes visible (i.e. signed in).
  const appEl = document.getElementById("app");
  if (appEl) {
    const obs = new MutationObserver(() => {
      if (!appEl.classList.contains("hidden")) {
        bottomTabBar.classList.remove("hidden");
        syncDrawerProfile();
      } else {
        bottomTabBar.classList.add("hidden");
      }
    });
    obs.observe(appEl, { attributes: true, attributeFilter: ["class"] });
    if (!appEl.classList.contains("hidden")) bottomTabBar.classList.remove("hidden");
  }
})();
