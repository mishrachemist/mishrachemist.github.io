package com.mishrachemist.moltrixerp;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebStorage;
import android.content.SharedPreferences;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Moltrix ERP: the Lighthouse ERP in a WebView that does the whole entry by itself.
 * Moltrix sends the data (same JSON as "Copy for ERP"); this app logs in with the ID / password kept
 * on this phone, opens the right screen through the ERP's Quick Search, loads erpfill.js (the same
 * filler as the bookmark), loads the data and presses Start (no Trial - straight Save).
 * The steps on the ERP page are in assets/driver.js; this class only runs it every 1.5 s.
 */
public class MainActivity extends Activity {
    // The ERP address comes from Moltrix with the first job (the user confirms it once) and is kept on the phone.
    static final String ERP_URL_DEFAULT = "";
    private String erpUrl() { return getSharedPreferences("erp", MODE_PRIVATE).getString("erpUrl", ERP_URL_DEFAULT); }
    private String erpHost() { try { Uri u = Uri.parse(erpUrl()); return u.getScheme() + "://" + u.getHost(); } catch (Exception e) { return "\u0000"; } }
    private boolean onErp(String u) { String h = erpHost(); return u != null && !h.isEmpty() && u.startsWith(h); }
    static final String TAG = "MOLTRIX-ERP1 ";

    private final Handler h = new Handler(Looper.getMainLooper());
    private KeepAliveWebView web;
    private TextView status;
    private Creds creds;
    private String driverJs;

    // the job now running
    private boolean running;
    private String jobMode, jobJson, jobLabel;
    private boolean dataSent;
    private int loginTries;
    private long lastLoginAt;
    private String keepJs;          // Moltrix's own keys (done lists etc.) to put back after a fresh ERP login

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        creds = new Creds(this);
        driverJs = asset("driver.js");
        fetchDriver();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(0xFF0B2545);
        bar.setPadding(dp(10), dp(6), dp(6), dp(6));
        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        status.setMaxLines(3);
        status.setText("Moltrix ERP");
        bar.addView(status, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        bar.addView(barButton("📋", v -> runFromClipboard()));
        bar.addView(barButton("■", v -> stopJob("Rok diya.")));
        bar.addView(barButton("⚙", v -> askLogin(null)));
        root.addView(bar);

        web = new KeepAliveWebView(this);
        web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);   // the page isn't slowed down when it's not on screen
        root.addView(web, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setUseWideViewPort(true);          // erpfill sets the page 1366 px wide on a phone (the ERP shows its PC buttons only then)
        s.setLoadWithOverviewMode(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);   // erpfill keeps the screen on with a tiny muted video
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        // look like plain Chrome to the ERP (14-Nov: the same Indent saved in phone Chrome but gave "Problem in Approval"
        // from this app): no "; wv" / "Version/4.0" in the user agent, no "X-Requested-With: <this app>" header
        s.setUserAgentString(s.getUserAgentString().replace("; wv", "").replaceAll(" Version/\\d+(\\.\\d+)*", ""));
        try {
            if (androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.REQUESTED_WITH_HEADER_ALLOW_LIST))
                androidx.webkit.WebSettingsCompat.setRequestedWithHeaderOriginAllowList(s, java.util.Collections.emptySet());
        } catch (Throwable ignored) { }
        CookieManager.getInstance().setAcceptCookie(true);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String sc = u.getScheme();
                if ("http".equals(sc) || "https".equals(sc)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        { String eu = erpUrl(); if (!eu.isEmpty()) web.loadUrl(eu); }

        if (!creds.has()) askLogin(null);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        handleIntent(i);
    }

    @Override
    protected void onDestroy() {
        RunService.stop(this);
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (running) { Toast.makeText(this, "Entry chal rahi hai - rokna ho to ■ dabayein.", Toast.LENGTH_SHORT).show(); return; }
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    // ---------------- data from Moltrix ----------------
    private void handleIntent(Intent i) {
        if (i == null) return;
        String p = i.getStringExtra("payload");
        if (p == null && i.getData() != null) p = i.getData().getQueryParameter("p");
        if (p == null) return;
        setIntent(new Intent(this, MainActivity.class));   // don't run it again after a rotation / restart
        offer(p, "Moltrix");
    }

    private void runFromClipboard() {
        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData cd = cm == null ? null : cm.getPrimaryClip();
        CharSequence t = cd != null && cd.getItemCount() > 0 ? cd.getItemAt(0).coerceToText(this) : null;
        if (t == null || !t.toString().trim().startsWith(TAG.trim())) {
            alert("Clipboard mein Moltrix ka data nahi hai", "Moltrix mein 📲 button (ya \"Copy for ERP\") dabayein.");
            return;
        }
        offer(t.toString(), "clipboard");
    }

    private static final String[][] MODES = {
            {"full", "Production + RM"}, {"cons", "RM add (saved vouchers)"}, {"approve", "Approve production"}, {"qc", "Production QC"},
            {"m2m", "M2M SMS2 → BLRM"}, {"indent", "Indent"}, {"req", "Requisition (store issue)"}};

    /** Shows what will go in and asks once (a link on any website could open this app, so nothing starts unseen). */
    private void offer(String raw, String from) {
        if (running) { alert("Pehle wali entry abhi chal rahi hai", "Khatam hone dein, ya ■ dabakar rokein."); return; }
        String json = raw.trim();
        if (json.startsWith(TAG.trim())) json = json.substring(TAG.trim().length()).trim();
        JSONObject d;
        try { d = new JSONObject(json); } catch (Exception e) { alert("Data adhoora hai", "Moltrix mein button dobara dabayein."); return; }
        String eu = d.optString("erpUrl", "");
        if (!eu.isEmpty() && !eu.equals(erpUrl())) {
            Uri pu = Uri.parse(eu);
            if (!("http".equals(pu.getScheme()) || "https".equals(pu.getScheme())) || pu.getHost() == null) { alert("ERP address theek nahi", eu); return; }
            final String fr = raw, ff = from;
            new AlertDialog.Builder(this).setTitle("ERP address save karein?")
                    .setMessage(eu + "\n\nYahi aapka ERP hai? Haan dabane par app isi par login karegi.")
                    .setPositiveButton("Haan", (x, y) -> { getSharedPreferences("erp", MODE_PRIVATE).edit().putString("erpUrl", eu).apply(); web.loadUrl(eu); offer(fr, ff); })
                    .setNegativeButton("Nahi", null).show();
            return;
        }
        if (erpUrl().isEmpty()) { alert("ERP address nahi hai", "Moltrix ka naya version kholkar 📲 button dobara dabayein."); return; }
        String mode = d.optString("mode", ""), label = null;
        for (String[] m : MODES) if (m[0].equals(mode)) label = m[1];
        if (label == null) { alert("Yeh kaam pehchana nahi", "mode: " + mode); return; }
        JSONArray heats = d.optJSONArray("heats"), items = d.optJSONArray("items");
        String what = heats != null ? heats.length() + (mode.equals("m2m") ? " voucher" : " heat") + " · " + d.optString("date", "")
                : items != null ? items.length() + " item" : "";
        final String fj = json, fm = mode, fl = label;
        new AlertDialog.Builder(this)
                .setTitle(label)
                .setMessage(what + (fm.equals("approve") ? "\n\nERP mein seedha Approve hoga." : "\n\nERP mein seedha Save hoga (Trial nahi)."))
                .setPositiveButton("Start", (x, y) -> {
                    if (!creds.has()) askLogin(() -> startJob(fm, fj, fl)); else startJob(fm, fj, fl);
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    // ---------------- the job ----------------
    private void startJob(String mode, String json, String label) {
        running = true; jobMode = mode; jobJson = json; jobLabel = label;
        dataSent = false; loginTries = 0; lastLoginAt = 0;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web.keepAlive = true;                       // page stays "visible" for the ERP / erpfill with the screen locked
        try { RunService.start(this, label + ": shuru…"); } catch (Exception ignored) { }
        askBackgroundOnce();
        setStatus(label + ": shuru…");
        h.removeCallbacks(tick);
        if (!driverJs.contains("var FRESH_LOGIN = true")) {      // fresh ERP login per job: off (the ERP then forgot Division / its series lists)
            keepJs = getSharedPreferences("erp", MODE_PRIVATE).getString("keep", null);   // put back anything an earlier wipe left
            web.evaluateJavascript(driverJs + "\n;window.MOLTRIX_DRIVER && window.MOLTRIX_DRIVER.reset();", null);
            String u = web.getUrl();
            if (!onErp(u)) { String eu = erpUrl(); if (!eu.isEmpty()) web.loadUrl(eu); }
            h.postDelayed(tick, 1500);
            return;
        }
        freshSession(() -> {
            web.evaluateJavascript(driverJs + "\n;window.MOLTRIX_DRIVER && window.MOLTRIX_DRIVER.reset();", null);
            h.removeCallbacks(tick);
            h.postDelayed(tick, 2500);
        });
    }

    // Every job starts from a clean ERP login: a session the ERP restores by itself after a page reload can lack its
    // globals (e.g. "Cannot read properties of null (reading 'G_YRBEGDATE')" on Indent). Moltrix's own keys
    // (moltrix* / mzf*: what is already saved, PC view) are kept and put back.
    private void freshSession(Runnable then) {
        SharedPreferences sp = getSharedPreferences("erp", MODE_PRIVATE);
        String u = web.getUrl();
        if (!onErp(u)) {      // ERP page not open - nothing to read, don't wipe
            keepJs = sp.getString("keep", null);
            { String eu = erpUrl(); if (!eu.isEmpty()) web.loadUrl(eu); }
            then.run();
            return;
        }
        String js = "(function(){try{var o={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(/^(moltrix|mzf)/i.test(k))o[k]=localStorage.getItem(k);}return JSON.stringify(o);}catch(e){return null;}})()";
        web.evaluateJavascript(js, v -> {
            String keep = null;
            try { Object o = new JSONTokener(v).nextValue(); if (o instanceof String) { new JSONObject((String) o); keep = (String) o; } } catch (Exception ignored) { }
            if (keep == null) { setStatus(jobLabel + ": shuru… (purana ERP login)"); then.run(); return; }   // couldn't read - keep the session rather than lose the done lists
            sp.edit().putString("keep", keep).apply();                        // survives the app being killed before it is put back
            keepJs = keep;
            setStatus(jobLabel + ": ERP fresh login…");
            WebStorage.getInstance().deleteAllData();
            web.clearCache(false);
            CookieManager.getInstance().removeAllCookies(ok -> {
                CookieManager.getInstance().flush();
                { String eu = erpUrl(); if (!eu.isEmpty()) web.loadUrl(eu); }
                then.run();
            });
        });
    }

    private void restoreKeep() {
        if (keepJs == null) return;
        String js = "(function(o){try{for(var k in o)localStorage.setItem(k,o[k]);return 'ok';}catch(e){return 'x';}})(" + keepJs + ")";
        keepJs = null;
        web.evaluateJavascript(js, v -> { if (v != null && v.contains("ok")) getSharedPreferences("erp", MODE_PRIVATE).edit().remove("keep").apply(); });
    }

    private void stopJob(String msg) {
        boolean was = running;
        running = false;
        h.removeCallbacks(tick);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web.keepAlive = false;
        RunService.stop(this);
        if (was) setStatus(msg);
    }

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            String js = driverJs + "\n;JSON.stringify(window.MOLTRIX_DRIVER.tick(" + JSONObject.quote(jobMode) + "))";
            web.evaluateJavascript(js, MainActivity.this::onTick);
        }
    };

    private void onTick(String val) {
        if (!running) return;
        JSONObject st = null;
        try {
            Object o = new JSONTokener(val).nextValue();          // evaluateJavascript gives the result JSON-encoded
            if (o instanceof String) st = new JSONObject((String) o);
        } catch (Exception ignored) { }
        long next = 1500;
        if (st == null) { setStatus(jobLabel + ": ERP khul raha hai…"); h.postDelayed(tick, next); return; }
        String u = web.getUrl();
        if (keepJs != null && onErp(u)) restoreKeep();   // before data is loaded / erpfill reads its lists
        String s = st.optString("s"), msg = st.optString("msg");
        switch (s) {
            case "login":
                if (System.currentTimeMillis() - lastLoginAt < 8000) { setStatus(jobLabel + ": login ho raha hai…"); break; }
                if (++loginTries > 3) { stopJob("Login nahi hua - ⚙ mein ERP ID / password check karein."); alert("Login nahi hua", "ERP ID / password check karein (⚙)."); return; }
                lastLoginAt = System.currentTimeMillis();
                setStatus(jobLabel + ": login…");
                web.evaluateJavascript(driverJs + "\n;window.MOLTRIX_DRIVER.login(" + JSONObject.quote(creds.id()) + "," + JSONObject.quote(creds.pw()) + ")", null);
                break;
            case "need-data":
                if (!dataSent) {
                    dataSent = true;
                    setStatus(jobLabel + ": data load…");
                    web.evaluateJavascript(driverJs + "\n;window.MOLTRIX_DRIVER.load(" + JSONObject.quote(jobJson) + ")", null);
                }
                break;
            case "done": {
                int ok = st.optInt("ok"), err = st.optInt("err"), saved = st.optInt("saved", -1), total = st.optInt("total", -1);
                stopJob(jobLabel + ": khatam - " + (saved >= 0 ? saved + " of " + total + " save" : ok + " ✓" + (err > 0 ? ", " + err + " ✗" : "")));
                // erpfill's "Finished: X of N" decides (red lines from a first try that worked the 2nd time don't count)
                boolean allDone = saved >= 0 ? saved == total : err == 0;
                String head = jobLabel + (allDone ? " - ho gaya" : " - kuch entry nahi hui");
                RunService.done(this, head, msg);
                alert(head, msg);
                return;
            }
            case "error":
                stopJob(jobLabel + ": ✗ " + msg);
                RunService.done(this, jobLabel + " - ruk gaya", msg);
                alert(jobLabel + " - ruk gaya", msg);
                return;
            default:   // params, nav, manual, loading-filler, loading-data, running
                setStatus(jobLabel + (msg.isEmpty() ? ": " + s + "…" : ": " + msg));
                if ("running".equals(s)) next = 2500;
        }
        h.postDelayed(tick, next);
    }

    // ---------------- ERP login (kept on this phone only) ----------------
    private void askLogin(Runnable after) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(20), dp(8), dp(20), 0);
        EditText id = new EditText(this);
        id.setHint("ERP User ID");
        id.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        id.setText(creds.id());
        EditText pw = new EditText(this);
        pw.setHint("Password");
        pw.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        box.addView(id);
        box.addView(pw);
        TextView note = new TextView(this);
        note.setText("Sirf is phone mein encrypted rahega.");
        note.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        box.addView(note);
        new AlertDialog.Builder(this)
                .setTitle("ERP login")
                .setView(box)
                .setPositiveButton("Save", (x, y) -> {
                    String i = id.getText().toString().trim(), p = pw.getText().toString();
                    if (i.isEmpty() || p.isEmpty()) { Toast.makeText(this, "ID aur password dono chahiye", Toast.LENGTH_SHORT).show(); return; }
                    if (!creds.save(i, p)) { alert("Save nahi hua", "Phone ka secure storage kaam nahi kar raha."); return; }
                    Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show();
                    if (after != null) after.run();
                })
                .setNeutralButton("Delete", (x, y) -> { creds.clear(); Toast.makeText(this, "Login hata diya", Toast.LENGTH_SHORT).show(); })
                .setNegativeButton("Cancel", null)
                .show();
    }

    // ---------------- helpers ----------------
    /** the newest driver.js from the website (fixes without a new APK); the copy inside the APK if that fails */
    static final String DRIVER_URL = "https://mishrachemist.github.io/android-erp/app/src/main/assets/driver.js";
    private void fetchDriver() {
        new Thread(() -> {
            try {
                java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(DRIVER_URL + "?t=" + System.currentTimeMillis()).openConnection();
                c.setConnectTimeout(8000); c.setReadTimeout(8000); c.setUseCaches(false);
                if (c.getResponseCode() == 200) {
                    try (InputStream in = c.getInputStream()) {
                        ByteArrayOutputStream o = new ByteArrayOutputStream();
                        byte[] buf = new byte[8192]; int n;
                        while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
                        String js = o.toString(StandardCharsets.UTF_8.name());
                        if (js.contains("window.MOLTRIX_DRIVER = {")) h.post(() -> { if (!running) driverJs = js; });
                    }
                }
            } catch (Exception ignored) { }
        }).start();
    }

    private String lastNote = "";
    private void setStatus(String t) {
        status.setText(t);
        if (running && !t.equals(lastNote)) { lastNote = t; RunService.update(this, t); }
    }

    /** once: notification permission (Android 13+) and "don't optimise battery" so a long run isn't cut off */
    private void askBackgroundOnce() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName()) && !getPreferences(MODE_PRIVATE).getBoolean("askedBattery", false)) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("askedBattery", true).apply();
            try {
                startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
            } catch (Exception ignored) { }
        }
    }

    /** A WebView that tells the page it is still on screen while an entry runs (screen locked / other app in front). */
    static final class KeepAliveWebView extends WebView {
        boolean keepAlive;
        KeepAliveWebView(Context c) { super(c); }
        @Override
        protected void onWindowVisibilityChanged(int v) { super.onWindowVisibilityChanged(keepAlive ? View.VISIBLE : v); }   // a locked screen sends GONE
    }

    private void alert(String title, String msg) {
        if (isFinishing()) return;
        new AlertDialog.Builder(this).setTitle(title).setMessage(msg).setPositiveButton("OK", null).show();
    }

    private Button barButton(String t, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(t);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        b.setMinWidth(0);
        b.setMinimumWidth(0);
        b.setPadding(dp(10), 0, dp(10), 0);
        b.setOnClickListener(l);
        return b;
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private String asset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
            return o.toString(StandardCharsets.UTF_8.name());
        } catch (Exception e) { return ""; }
    }
}
