// ===== Moltrix: start the cloud WhatsApp sync every hour =====
// Paste this at the END of the WA Inbox Apps Script (Extensions -> Apps Script), below the existing code.
// 1) Project Settings (gear) -> Script Properties -> Add: GH_SYNC_TOKEN = your GitHub token (Actions: Read and write,
//    only for the mishrachemist.github.io repository).
// 2) Choose the function moltrixSetupHourly in the top bar -> Run -> allow access. It makes the hourly trigger
//    and starts one sync straight away. Run it only once (running it again just replaces the trigger).
// No re-deploy is needed.

var MOLTRIX_SYNC_URL = 'https://api.github.com/repos/mishrachemist/mishrachemist.github.io/actions/workflows/moltrix-wa-sync.yml/dispatches';

function moltrixSyncNow() {
  var token = PropertiesService.getScriptProperties().getProperty('GH_SYNC_TOKEN');
  if (!token) throw new Error('Script property GH_SYNC_TOKEN is not set.');
  var res = UrlFetchApp.fetch(MOLTRIX_SYNC_URL, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    payload: JSON.stringify({ ref: 'main', inputs: { force: 'false' } })
  });
  var code = res.getResponseCode();
  if (code !== 204) throw new Error('GitHub refused the start (' + code + '): ' + res.getContentText().slice(0, 200));
}

function moltrixSetupHourly() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'moltrixSyncNow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('moltrixSyncNow').timeBased().everyHours(1).create();
  moltrixSyncNow();
}
