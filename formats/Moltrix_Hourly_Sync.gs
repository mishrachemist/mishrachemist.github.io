// ===== Moltrix: start the cloud WhatsApp sync - as soon as a message arrives, and every hour =====
// Paste this at the END of the WA Inbox Apps Script (Extensions -> Apps Script), below the existing code
// (if an older copy of this Moltrix part is already there, replace it with this one).
// 1) Project Settings (gear) -> Script Properties -> Add: GH_SYNC_TOKEN = your GitHub token (Actions: Read and write,
//    only for the mishrachemist.github.io repository). Already done if the hourly sync works.
// 2) Choose the function moltrixSetupRealtime in the top bar -> Run -> allow access. Run it only once.
//    It makes two triggers:
//    - every minute: looks whether MacroDroid has added a new WhatsApp message to the inbox; if yes, the cloud sync
//      starts at once (about 1-2 minutes from message to Excel). Nothing is sent to GitHub when nothing is new.
//    - every hour: the normal sync, as a spare.
// No re-deploy is needed.

var MOLTRIX_SYNC_URL = 'https://api.github.com/repos/mishrachemist/mishrachemist.github.io/actions/workflows/moltrix-wa-sync.yml/dispatches';

// force = true: fetch now (do not wait for the hourly fixed time)
function moltrixSyncNow(force) {
  var token = PropertiesService.getScriptProperties().getProperty('GH_SYNC_TOKEN');
  if (!token) throw new Error('Script property GH_SYNC_TOKEN is not set.');
  var res = UrlFetchApp.fetch(MOLTRIX_SYNC_URL, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: JSON.stringify({ ref: 'main', inputs: { force: force === true ? 'true' : 'false' } })
  });
  var code = res.getResponseCode();
  if (code !== 204) throw new Error('GitHub refused the start (' + code + '): ' + res.getContentText().slice(0, 200));
}

// every minute: a new row in the inbox (MacroDroid -> doPost) -> start the sync now
function moltrixWatch() {
  var n = 0;
  SpreadsheetApp.getActive().getSheets().forEach(function (s) {
    if (!/^logins?$/i.test(s.getName())) n = Math.max(n, s.getLastRow());   // the inbox = the sheet with the most rows
  });
  var p = PropertiesService.getScriptProperties();
  var last = Number(p.getProperty('MOLTRIX_LAST_ROWS') || 0);
  if (n === last) return;
  p.setProperty('MOLTRIX_LAST_ROWS', String(n));
  if (n > last && last > 0) moltrixSyncNow(true);   // first run only remembers the count
}

function moltrixSetupRealtime() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'moltrixSyncNow' || f === 'moltrixWatch' || f === 'moltrixHourly') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('moltrixWatch').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('moltrixHourly').timeBased().everyHours(1).create();
  moltrixWatch();
  moltrixSyncNow(false);
}

function moltrixHourly() { moltrixSyncNow(false); }

// older set-up (hourly only) - still works; moltrixSetupRealtime replaces it
function moltrixSetupHourly() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'moltrixSyncNow' || f === 'moltrixHourly') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('moltrixHourly').timeBased().everyHours(1).create();
  moltrixSyncNow(false);
}
