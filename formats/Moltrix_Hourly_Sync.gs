// ===== Moltrix: cloud WhatsApp sync starter - paste ONCE, it updates itself afterwards =====
// Paste this at the END of the WA Inbox Apps Script (Extensions -> Apps Script), below the existing code.
// If an older Moltrix part is already there (moltrixSyncNow, moltrixWatch ...), delete that part first and paste this instead.
// 1) Script Properties (Project Settings, gear): GH_SYNC_TOKEN = your GitHub token (Actions: Read and write, only for the
//    mishrachemist.github.io repository). Already there if the hourly sync works.
// 2) Choose moltrixSetupRealtime in the top bar -> Run -> allow access. Only once.
// After that this script never needs editing again: the real code (formats/Moltrix_WA_Core.js on the Moltrix website) is
// downloaded every 10 minutes and run, so every Moltrix change reaches the Google Sheet by itself, even from the phone.
// What it does now: every minute it looks for a new WhatsApp message in the inbox and starts the cloud sync at once
// (about 1-2 minutes from message to Excel); every hour the normal sync as a spare.
// On a phone (only for this one paste): Chrome -> script.google.com -> menu ⋮ -> "Desktop site".

var MOLTRIX_CORE_URL = 'https://raw.githubusercontent.com/mishrachemist/mishrachemist.github.io/main/formats/Moltrix_WA_Core.js';

function moltrixCore_() {
  if (globalThis.__moltrixCore) return globalThis.__moltrixCore;
  var cache = CacheService.getScriptCache(), code = cache.get('moltrixCore');
  if (!code) {
    var r = UrlFetchApp.fetch(MOLTRIX_CORE_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) {
      code = PropertiesService.getScriptProperties().getProperty('MOLTRIX_CORE_LAST');   // website not reachable: last good copy
      if (!code) throw new Error('Moltrix code not reachable (' + r.getResponseCode() + ')');
    } else {
      code = r.getContentText();
      try { cache.put('moltrixCore', code, 600); } catch (e) {}
      try { PropertiesService.getScriptProperties().setProperty('MOLTRIX_CORE_LAST', code); } catch (e) {}
    }
  }
  var core = new Function('SpreadsheetApp', 'UrlFetchApp', 'ScriptApp', 'PropertiesService', 'CacheService', code + '\nreturn MOLTRIX;')
    (SpreadsheetApp, UrlFetchApp, ScriptApp, PropertiesService, CacheService);
  globalThis.__moltrixCore = core;
  return core;
}

function moltrixWatch() { moltrixCore_().watch(); }
function moltrixHourly() { moltrixCore_().hourly(); }
function moltrixSyncNow(force) { moltrixCore_().syncNow(force === true); }   // older hourly trigger still lands here
function moltrixSetupRealtime() { moltrixCore_().setup(); }
function moltrixSetupHourly() { moltrixCore_().setup(); }
