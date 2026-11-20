package com.mishrachemist.moltrixerp;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import java.util.concurrent.TimeUnit;

/** Market widget: the 4 indices' price and day change + India VIX from Yahoo, every 15 min while the market is open */
public class WidgetWorker extends Worker {
    static final String NAME = "moltrixWidgetQuotes";

    public WidgetWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    static Constraints net() { return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(); }

    static void schedule(Context c) {
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.KEEP,
                new PeriodicWorkRequest.Builder(WidgetWorker.class, 15, TimeUnit.MINUTES).setConstraints(net()).build());
    }
    static void now(Context c) {
        WorkManager.getInstance(c).enqueueUniqueWork(NAME + "Now", ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(WidgetWorker.class).setConstraints(net()).build());
    }
    static void cancel(Context c) { WorkManager.getInstance(c).cancelUniqueWork(NAME); }

    /** Mon–Fri 09:00–15:45 IST (one more fetch soon after the close gives the closing price) */
    static boolean marketTime() {
        Calendar k = Calendar.getInstance(Widgets.IST);
        int d = k.get(Calendar.DAY_OF_WEEK), m = k.get(Calendar.HOUR_OF_DAY) * 60 + k.get(Calendar.MINUTE);
        return d != Calendar.SATURDAY && d != Calendar.SUNDAY && m >= 9 * 60 && m <= 15 * 60 + 50;
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        if (!Widgets.any(c, MarketWidget.class)) { cancel(c); return Result.success(); }
        JSONObject old = Widgets.json(c, "wQuote");
        boolean fresh = old != null && Widgets.fmt("yyyy-MM-dd", old.optLong("t", 0)).equals(Widgets.today())
                && System.currentTimeMillis() - old.optLong("t", 0) < 10 * 60000L;
        if (old != null && !marketTime() && !afterCloseOnce(old)) return Result.success();
        if (fresh) return Result.success();
        try {
            JSONObject q = new JSONObject();
            String[] syms = { "^NSEI", "^NSEBANK", "NIFTY_FIN_SERVICE.NS", "NIFTY_MID_SELECT.NS", "^INDIAVIX" };
            int got = 0;
            for (String s : syms) {
                try {
                    JSONObject meta = new JSONObject(get("https://query1.finance.yahoo.com/v8/finance/chart/" + URLEncoder.encode(s, "UTF-8") + "?interval=1d&range=1d"))
                            .getJSONObject("chart").getJSONArray("result").getJSONObject(0).getJSONObject("meta");
                    double p = meta.optDouble("regularMarketPrice", Double.NaN), pc = meta.optDouble("chartPreviousClose", meta.optDouble("previousClose", Double.NaN));
                    if (Double.isNaN(p)) continue;
                    JSONObject o = new JSONObject().put("p", p);
                    if (!Double.isNaN(pc) && pc > 0) o.put("c", (p - pc) / pc * 100);
                    q.put(s, o); got++;
                } catch (Exception ignored) { }
            }
            if (got == 0) return Result.retry();
            MoltrixActivity.prefs(c).edit().putString("wQuote", new JSONObject().put("t", System.currentTimeMillis()).put("q", q).toString()).apply();
            Widgets.refresh(c, MarketWidget.class, Widgets::market);
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        }
    }

    /** outside market time: fetch once if the last prices are from before today's close */
    static boolean afterCloseOnce(JSONObject old) {
        Calendar k = Calendar.getInstance(Widgets.IST);
        int d = k.get(Calendar.DAY_OF_WEEK);
        if (d == Calendar.SATURDAY || d == Calendar.SUNDAY) return false;
        if (k.get(Calendar.HOUR_OF_DAY) * 60 + k.get(Calendar.MINUTE) < 9 * 60) return false;
        Calendar close = Calendar.getInstance(Widgets.IST);
        close.set(Calendar.HOUR_OF_DAY, 15); close.set(Calendar.MINUTE, 35); close.set(Calendar.SECOND, 0);
        return old.optLong("t", 0) < close.getTimeInMillis();
    }

    static String get(String url) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(url).openConnection();
        try {
            h.setConnectTimeout(15000); h.setReadTimeout(15000);
            h.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36");
            if (h.getResponseCode() != 200) throw new Exception("HTTP " + h.getResponseCode());
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            try (InputStream in = h.getInputStream()) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n); }
            return new String(o.toByteArray(), StandardCharsets.UTF_8);
        } finally { h.disconnect(); }
    }
}
