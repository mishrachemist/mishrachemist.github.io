package com.mishrachemist.moltrixerp;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

/**
 * One background Screener scan (F&O → Screener → Background scan), started by ScrAlarm every 15 minutes.
 * A hidden WebView opens Moltrix's own scr-bg.html, which runs the SAME screener code as the F&O screen
 * (js/fno.js): it adds every BUY to the signal log (same phone storage as the app) and sends the BUY
 * notification. NSE / Yahoo data come through MarketFetch, exactly as on the F&O screen. Stops when the
 * page reports it is done, or after 8 minutes.
 */
public class ScrService extends Service {
    static final String CH_RUN = "scr_run";
    static final int ID_RUN = 32;
    static final String PAGE = MoltrixActivity.HOME + "scr-bg.html";
    static volatile boolean running = false;

    private final Handler h = new Handler(Looper.getMainLooper());
    private WebView wv;
    private MarketFetch market;
    private PowerManager.WakeLock wl;

    static void start(Context c) {
        Intent i = new Intent(c, ScrService.class);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }
    static void stop(Context c) { c.stopService(new Intent(c, ScrService.class)); }

    private Notification ongoing() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null && Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CH_RUN, "Screener scanning", NotificationManager.IMPORTANCE_LOW));
        return new NotificationCompat.Builder(this, CH_RUN).setSmallIcon(R.drawable.ic_stat_moltrix).setColor(Color.parseColor("#1F3864"))
            .setContentTitle("🔎 Screener").setContentText("Scanning F&O stocks…").setOngoing(true).setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW).build();
    }

    private void status(String s) {
        MoltrixActivity.prefs(this).edit().putString("scrStatus", GammaService.hm(System.currentTimeMillis()) + " · " + s).apply();
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = ongoing();
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID_RUN, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(ID_RUN, n);
        if (running) return START_NOT_STICKY;
        running = true;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Moltrix:scr");
        wl.setReferenceCounted(false);
        wl.acquire(9 * 60 * 1000L);
        Context app = getApplicationContext();
        market = new MarketFetch(app, null, id -> h.post(() -> {
            if (wv != null) wv.evaluateJavascript("window.mzMkDone&&window.mzMkDone(" + JSONObject.quote(id) + ")", null);
        }));
        wv = new WebView(app);
        WebSettings st = wv.getSettings();
        st.setJavaScriptEnabled(true); st.setDomStorageEnabled(true); st.setBlockNetworkImage(true);
        st.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        wv.addJavascriptInterface(new Bridge(), "MoltrixApp");
        wv.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest r) {
                return !("https".equals(r.getUrl().getScheme()) && MoltrixActivity.HOST.equals(r.getUrl().getHost()));
            }
        });
        status("scanning…");
        wv.loadUrl(PAGE + "?t=" + System.currentTimeMillis());
        h.postDelayed(() -> finish("did not finish in 8 min"), 8 * 60_000L);
        return START_NOT_STICKY;
    }

    /** window.MoltrixApp of scr-bg.html: only what the screener needs */
    final class Bridge {
        @JavascriptInterface public String version() { return "5"; }
        @JavascriptInterface public void mkGet(String id, String page, String path) { market.site(id, page, path); }
        @JavascriptInterface public void httpGet(String id, String url) { market.yahoo(id, url); }
        @JavascriptInterface public String mkTake(String id) { return market.take(id); }
        @JavascriptInterface public void notify(String title, String body) {
            MoltrixActivity.notifyNow(ScrService.this, "app", "Moltrix", (int) (System.currentTimeMillis() & 0xffffff), title, body, null);
        }
        /** the scan is over: r = {checked, buy, skip, err} */
        @JavascriptInterface public void scrDone(String r) {
            String s;
            try {
                JSONObject j = new JSONObject(r == null ? "{}" : r);
                if (!j.optString("err", "").isEmpty()) s = "⚠️ " + j.optString("err");
                else if (!j.optString("skip", "").isEmpty()) s = j.optString("skip");
                else s = j.optInt("checked", 0) + " checked · " + j.optInt("buy", 0) + " BUY";
            } catch (Exception e) { s = "done"; }
            final String fs = s;
            h.post(() -> finish(fs));
        }
    }

    private void finish(String why) {
        if (!running) return;
        running = false;
        status(why);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        running = false;
        h.removeCallbacksAndMessages(null);
        if (wv != null) { wv.destroy(); wv = null; }
        if (market != null) { market.destroy(); market = null; }
        if (wl != null && wl.isHeld()) wl.release();
        stopForeground(true);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
