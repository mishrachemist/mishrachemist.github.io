// ===== Moltrix part of the WA Inbox Apps Script - the real code =====
// Not pasted anywhere: the small loader (Moltrix_Hourly_Sync.gs, pasted once into the WA Inbox Apps Script) downloads this
// file from the website every 10 minutes and runs it. So a change here reaches the Google Sheet by itself - no editing of the
// script on a PC or phone. Only the services the loader names can be used here (SpreadsheetApp, UrlFetchApp, ScriptApp,
// PropertiesService, CacheService) - Google asks permission for those once, when the loader is first run.
var MOLTRIX = (function () {
  var SYNC_URL = 'https://api.github.com/repos/mishrachemist/mishrachemist.github.io/actions/workflows/moltrix-wa-sync.yml/dispatches';
  var SETUP_VERSION = '2';   // raise it when the triggers below change: the next run sets them up again by itself
  var props = function () { return PropertiesService.getScriptProperties(); };

  // force = true: fetch now (do not wait for the hourly fixed time)
  function syncNow(force) {
    var token = props().getProperty('GH_SYNC_TOKEN');
    if (!token) throw new Error('Script property GH_SYNC_TOKEN is not set.');
    var res = UrlFetchApp.fetch(SYNC_URL, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      payload: JSON.stringify({ ref: 'main', inputs: { force: force === true ? 'true' : 'false' } })
    });
    var code = res.getResponseCode();
    if (code !== 204) throw new Error('GitHub refused the start (' + code + '): ' + res.getContentText().slice(0, 200));
  }

  // the triggers: every minute a look at the inbox, every hour the normal sync (spare)
  function setupTriggers() {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      var f = t.getHandlerFunction();
      if (f === 'moltrixSyncNow' || f === 'moltrixWatch' || f === 'moltrixHourly') ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('moltrixWatch').timeBased().everyMinutes(1).create();
    ScriptApp.newTrigger('moltrixHourly').timeBased().everyHours(1).create();
    props().setProperty('MOLTRIX_SETUP_V', SETUP_VERSION);
  }
  function ensure() { if (props().getProperty('MOLTRIX_SETUP_V') !== SETUP_VERSION) setupTriggers(); }

  // a new row in the inbox (MacroDroid -> doPost) -> start the sync now
  function watch() {
    ensure();
    var n = 0;
    SpreadsheetApp.getActive().getSheets().forEach(function (s) {
      if (!/^logins?$/i.test(s.getName())) n = Math.max(n, s.getLastRow());   // the inbox = the sheet with the most rows
    });
    var p = props(), last = Number(p.getProperty('MOLTRIX_LAST_ROWS') || 0);
    if (n === last) return;
    p.setProperty('MOLTRIX_LAST_ROWS', String(n));
    if (n > last && last > 0) syncNow(true);   // the very first run only remembers the count
  }

  function hourly() { ensure(); syncNow(false); }
  function setup() { setupTriggers(); watch(); syncNow(false); }

  return { version: SETUP_VERSION, syncNow: syncNow, watch: watch, hourly: hourly, setup: setup };
})();
