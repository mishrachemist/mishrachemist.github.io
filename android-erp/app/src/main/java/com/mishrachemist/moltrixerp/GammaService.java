package com.mishrachemist.moltrixerp;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/**
 * Expiry-day gamma watch in the background (F&O → ⚡ → Background watch).
 * Started by GammaAlarm at about 10:58 on weekdays (or at once when switched on during the watch time).
 * It opens NSE's own page in a hidden WebView (like the F&O screen), finds which watched indices expire TODAY
 * (none = stops at once), then every minute reads their option chains and notifies when an ATM ± 2 premium
 * rises by JUMP % or more within WIN minutes (from FROM). Stops at 15:30 and books the next weekday.
 */
public class GammaService extends Service {
    static final String CH_RUN = "gamma_run", CH_HIT = "gamma_hit";
    static final int ID_RUN = 31;
    static final TimeZone IST = TimeZone.getTimeZone("Asia/Kolkata");
    static volatile boolean running = false;

    private final Handler h = new Handler(Looper.getMainLooper());
    private WebView wv;
    private boolean ready = false, phaseExp = true;
    private PowerManager.WakeLock wl;
    private final Map<String, String> expToday = new HashMap<>();          // symbol -> today's expiry (dd-MMM-yyyy)
    private final Map<String, ArrayDeque<double[]>> hist = new HashMap<>(); // "NIFTY 25600 CE" -> {time ms, premium}
    private final Map<String, Long> sent = new HashMap<>();
    private final Map<String, Cb> cbs = new HashMap<>();
    private int seq = 0, reloads = 0;
    private List<String> syms = new ArrayList<>();
    private String base = "https://www.nseindia.in", from = "11:00", until = "15:30";
    private double jump = 50, minPrem = 2; private int winMin = 15;

    interface Cb { void done(int status, String text); }
    private final Runnable stepR = this::step;
    private void stepIn(long ms) { h.removeCallbacks(stepR); h.postDelayed(stepR, ms); }

    static void start(Context c) {
        Intent i = new Intent(c, GammaService.class);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }
    static void stop(Context c) { c.stopService(new Intent(c, GammaService.class)); }

    static String hm(long ms) { SimpleDateFormat f = new SimpleDateFormat("HH:mm", Locale.ENGLISH); f.setTimeZone(IST); return f.format(new Date(ms)); }
    static String todayExp() { SimpleDateFormat f = new SimpleDateFormat("dd-MMM-yyyy", Locale.ENGLISH); f.setTimeZone(IST); return f.format(new Date()); }

    private void status(String s) {
        MoltrixActivity.prefs(this).edit().putString("gwStatus", hm(System.currentTimeMillis()) + " · " + s).apply();
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(ID_RUN, ongoing(s));
    }

    private void channels() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || Build.VERSION.SDK_INT < 26) return;
        nm.createNotificationChannel(new NotificationChannel(CH_RUN, "Gamma watch running", NotificationManager.IMPORTANCE_LOW));
        nm.createNotificationChannel(new NotificationChannel(CH_HIT, "Gamma alerts", NotificationManager.IMPORTANCE_HIGH));
    }

    private Notification ongoing(String text) {
        PendingIntent pi = PendingIntent.getActivity(this, 3, new Intent(this, MoltrixActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CH_RUN).setSmallIcon(R.drawable.ic_stat_moltrix).setColor(Color.parseColor("#1F3864"))
            .setContentTitle("⚡ Gamma watch").setContentText(text).setOngoing(true).setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW).setContentIntent(pi).build();
    }

    private void readCfg() {
        SharedPreferences p = MoltrixActivity.prefs(this);
        syms = new ArrayList<>();
        try {
            JSONObject c = new JSONObject(p.getString("gwCfg", "{}"));
            JSONArray a = c.optJSONArray("syms");
            if (a != null) for (int i = 0; i < a.length(); i++) { String s = a.optString(i, ""); if (s.matches("[A-Z0-9&-]{2,20}")) syms.add(s); }
            String b = c.optString("base", base); if (b.matches("^https://www\\.nseindia\\.(in|com)$")) base = b;
            from = c.optString("from", from).matches("\\d\\d:\\d\\d") ? c.optString("from", from) : from;
            jump = c.optDouble("jump", jump); minPrem = c.optDouble("minPrem", minPrem); winMin = c.optInt("win", winMin);
        } catch (Exception ignored) { }
        if (syms.isEmpty()) { syms.add("NIFTY"); syms.add("BANKNIFTY"); syms.add("FINNIFTY"); syms.add("MIDCPNIFTY"); }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        channels();
        Notification n = ongoing("starting…");
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID_RUN, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(ID_RUN, n);
        if (running) return START_NOT_STICKY;
        running = true;
        readCfg();
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Moltrix:gamma");
        wl.setReferenceCounted(false);
        wl.acquire(5 * 60 * 60 * 1000L);
        wv = new WebView(getApplicationContext());
        WebSettings st = wv.getSettings();
        st.setJavaScriptEnabled(true); st.setDomStorageEnabled(true); st.setBlockNetworkImage(true);
        st.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true);
        wv.addJavascriptInterface(new Back(), "MoltrixGw");
        wv.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest r) {
                String host = r.getUrl().getHost();
                return !("https".equals(r.getUrl().getScheme()) && host != null && host.matches("(.+\\.)?nseindia\\.(in|com)"));
            }
            @Override public void onPageFinished(WebView w, String url) {
                if (w.getProgress() < 100 || ready) return;
                ready = true;
                stepIn(1500);
            }
        });
        status("opening NSE…");
        wv.loadUrl(base + "/option-chain");
        h.postDelayed(() -> { if (!ready) finish("NSE page did not open"); }, 90_000);
        return START_NOT_STICKY;
    }

    private void reload() {
        ready = false; h.removeCallbacks(stepR);
        if (reloads++ < 20 && wv != null) wv.loadUrl(base + "/option-chain"); else finish("NSE refused");
    }

    private void fetch(String path, Cb cb) {
        if (wv == null) return;
        String id = "g" + (++seq);
        cbs.put(id, cb);
        String js = "(function(){var id=" + JSONObject.quote(id) + ";fetch(" + JSONObject.quote(path) + ",{credentials:'include',headers:{'Accept':'application/json, text/plain, */*'}})"
            + ".then(function(x){return x.text().then(function(t){MoltrixGw.done(id,x.status,t);});}).catch(function(e){MoltrixGw.done(id,0,String(e));});})();";
        wv.evaluateJavascript(js, null);
        h.postDelayed(() -> { Cb c = cbs.remove(id); if (c != null) c.done(0, "timeout"); }, 25_000);
    }

    private final class Back {
        @JavascriptInterface public void done(String id, int status, String text) {
            h.post(() -> { Cb c = cbs.remove(id); if (c != null) c.done(status, text); });
        }
    }

    /** first: which indices expire today; then: one round of option chains a minute */
    private void step() {
        if (!running) return;
        if (hm(System.currentTimeMillis()).compareTo(until) >= 0) { finish("market closed"); return; }
        if (phaseExp) {
            final String today = todayExp();
            final int[] left = {syms.size()};
            final boolean[] auth = {false};
            for (String s : syms) {
                fetch("/api/option-chain-contract-info?symbol=" + s, (code, text) -> {
                    if (code == 401 || code == 403) auth[0] = true;
                    else try { JSONArray a = new JSONObject(text).getJSONArray("expiryDates"); for (int i = 0; i < a.length(); i++) if (today.equalsIgnoreCase(a.getString(i))) expToday.put(s, a.getString(i)); }
                    catch (Exception ignored) { }
                    if (--left[0] > 0) return;
                    if (expToday.isEmpty() && auth[0]) { reload(); return; }
                    phaseExp = false;
                    if (expToday.isEmpty()) finish("no expiry today");
                    else { status("expiry today: " + String.join(", ", expToday.keySet()) + " · watching from " + from); stepIn(500); }
                });
            }
            return;
        }
        for (Map.Entry<String, String> e : expToday.entrySet()) {
            final String sym = e.getKey();
            fetch("/api/option-chain-v3?type=Indices&symbol=" + sym + "&expiry=" + e.getValue(), (code, text) -> {
                if (code == 401 || code == 403) { reload(); return; }
                if (code == 200) try { check(sym, new JSONObject(text)); } catch (Exception ignored) { }
            });
        }
        stepIn(60_000);
    }

    private static double num(JSONObject o, String k) { if (o == null) return Double.NaN; try { return o.has(k) && !o.isNull(k) ? o.getDouble(k) : Double.NaN; } catch (Exception x) { return Double.NaN; } }

    private void check(String sym, JSONObject j) throws Exception {
        JSONObject rec = j.optJSONObject("records"); if (rec == null) rec = j;
        JSONArray data = rec.optJSONArray("data"); if (data == null || data.length() == 0) return;
        double spot = num(rec, "underlyingValue");
        List<JSONObject> rows = new ArrayList<>();
        for (int i = 0; i < data.length(); i++) { JSONObject r = data.getJSONObject(i); rows.add(r);
            if (Double.isNaN(spot)) { double u = num(r.optJSONObject("CE"), "underlyingValue"); if (Double.isNaN(u)) u = num(r.optJSONObject("PE"), "underlyingValue"); if (!Double.isNaN(u)) spot = u; } }
        if (Double.isNaN(spot)) return;
        rows.sort((a, b) -> Double.compare(num(a, "strikePrice"), num(b, "strikePrice")));
        int atm = 0; for (int i = 0; i < rows.size(); i++) if (Math.abs(num(rows.get(i), "strikePrice") - spot) < Math.abs(num(rows.get(atm), "strikePrice") - spot)) atm = i;
        long now = System.currentTimeMillis(); boolean late = hm(now).compareTo(from) >= 0;
        for (int i = Math.max(0, atm - 2); i <= Math.min(rows.size() - 1, atm + 2); i++) {
            JSONObject r = rows.get(i); long k = Math.round(num(r, "strikePrice"));
            for (String t : new String[]{"CE", "PE"}) {
                double p = num(r.optJSONObject(t), "lastPrice"); if (Double.isNaN(p) || p <= 0) continue;
                String key = sym + " " + k + " " + t;
                ArrayDeque<double[]> q = hist.get(key); if (q == null) { q = new ArrayDeque<>(); hist.put(key, q); }
                q.addLast(new double[]{now, p});
                while (!q.isEmpty() && now - q.peekFirst()[0] > winMin * 60_000L) q.pollFirst();
                double lo = Double.MAX_VALUE; for (double[] x : q) lo = Math.min(lo, x[1]);
                if (late && q.size() >= 2 && p >= minPrem && lo > 0 && (p / lo - 1) * 100 >= jump) {
                    Long last = sent.get(key);
                    if (last == null || now - last >= winMin * 60_000L) {
                        sent.put(key, now);
                        MoltrixActivity.notifyNow(this, CH_HIT, "Gamma alerts", (int) (now & 0xffffff),
                            String.format(Locale.ENGLISH, "⚡ %s +%.0f %%", key, (p / lo - 1) * 100),
                            String.format(Locale.ENGLISH, "%.2f → %.2f in ≤ %d min (expiry today)", lo, p, winMin), null);
                    }
                }
            }
        }
        // forget strikes far from the price
        for (Iterator<Map.Entry<String, ArrayDeque<double[]>>> it = hist.entrySet().iterator(); it.hasNext(); ) { ArrayDeque<double[]> q = it.next().getValue(); if (q.isEmpty() || now - q.peekLast()[0] > winMin * 60_000L) it.remove(); }
        status(String.format(Locale.ENGLISH, "%s %.2f · %s", sym, spot, late ? "watching" : "from " + from));
    }

    private void finish(String why) {
        if (!running) return;
        running = false;
        MoltrixActivity.prefs(this).edit().putString("gwStatus", hm(System.currentTimeMillis()) + " · " + why).apply();
        GammaAlarm.schedule(this);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        running = false;
        h.removeCallbacksAndMessages(null);
        if (wv != null) { wv.destroy(); wv = null; }
        if (wl != null && wl.isHeld()) wl.release();
        stopForeground(true);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    /** weekday and inside 10:58 - 15:25 IST */
    static boolean inWindowNow() {
        Calendar c = Calendar.getInstance(IST);
        int d = c.get(Calendar.DAY_OF_WEEK); if (d == Calendar.SATURDAY || d == Calendar.SUNDAY) return false;
        String t = hm(c.getTimeInMillis());
        return t.compareTo("10:58") >= 0 && t.compareTo("15:25") < 0;
    }
}
