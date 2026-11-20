// ===== Moltrix: dashboard add-ons - paste ONCE, they update themselves afterwards =====
// Where: the V5 PRO Google Sheet -> Extensions -> Apps Script -> + (Add a file) -> Script -> name it Moltrix_Dash_Addons
//        -> delete the empty function -> paste this -> Save.
// Then: Deploy -> Manage deployments -> ✏️ Edit -> Version: New version -> Deploy (the dashboard links stay the same).
// Nothing else in the script is changed. Every dashboard page (Dashboard 2, USA, Intraday) then also loads
// formats/md-addons.js from the Moltrix website, so later changes (e.g. the "What is missing" ⓘ popup) reach the
// dashboards by themselves - no more script editing.
// On a phone (only for this one paste): Chrome -> script.google.com -> menu ⋮ -> "Desktop site".

var MOLTRIX_DASH_ADDONS_URL = 'https://mishrachemist.github.io/formats/md-addons.js';

// Every dashboard page is made with  <PAGE>_HTML.replace("/*__DASH2_KEY__*/", ...)  - right there the add-on
// script tag is put in front of </body>. Any other text replace works exactly as before.
(function moltrixDashAddons() {
  var orig = String.prototype.replace;
  if (orig.__moltrix) return;
  var tag = '<script id="moltrix-dash-addons" src="' + MOLTRIX_DASH_ADDONS_URL + '"></scr' + 'ipt>';
  var patched = function (pattern) {
    var out = orig.apply(this, arguments);
    if (pattern === '/*__DASH2_KEY__*/' && typeof out === 'string' && out.indexOf('moltrix-dash-addons') < 0) {
      var i = out.lastIndexOf('</body>');
      out = i < 0 ? out + tag : out.slice(0, i) + tag + out.slice(i);
    }
    return out;
  };
  patched.__moltrix = true;
  String.prototype.replace = patched;
})();
