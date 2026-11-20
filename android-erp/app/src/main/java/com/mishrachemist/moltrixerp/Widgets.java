package com.mishrachemist.moltrixerp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/** Home-screen widgets: Production (ProdWidget), Market (MarketWidget) and Quick buttons (QuickWidget).
 *  Data: the page hands it over (MoltrixApp.widgetSet → prefs wProd / wMkt), the cloud WhatsApp sync carries a
 *  production snapshot in the news file (NotifyWorker), and WidgetWorker refreshes the index prices every 15 min. */
final class Widgets {
    private Widgets() { }

    static final int WHITE = 0xFFFFFFFF, INK = 0xFFE8ECF4, MUTED = 0xFFA9B6CC, GOLD = 0xFFF1D27A, NAVY2 = 0xFF13315C,
            GREEN = 0xFF4ADE80, RED = 0xFFF87171;
    static final TimeZone IST = TimeZone.getTimeZone("Asia/Kolkata");
    static final String[][] IDX = { { "NIFTY", "^NSEI" }, { "BANKNIFTY", "^NSEBANK" }, { "FINNIFTY", "NIFTY_FIN_SERVICE.NS" }, { "MIDCPNIFTY", "NIFTY_MID_SELECT.NS" } };

    // ---------- common ----------
    static JSONObject json(Context c, String key) {
        try { String s = MoltrixActivity.prefs(c).getString(key, ""); return s.isEmpty() ? null : new JSONObject(s); } catch (Exception e) { return null; }
    }

    static String fmt(String pattern, long t) { SimpleDateFormat f = new SimpleDateFormat(pattern, Locale.ENGLISH); f.setTimeZone(IST); return f.format(new Date(t)); }
    static String today() { return fmt("yyyy-MM-dd", System.currentTimeMillis()); }

    /** "10:42" today, "19 Nov 10:42" another day */
    static String when(long t) {
        if (t <= 0) return "";
        return fmt("yyyy-MM-dd", t).equals(today()) ? fmt("HH:mm", t) : fmt("d MMM HH:mm", t);
    }

    static String mt(double v) {
        if (Double.isNaN(v)) return "–";
        return v >= 1000 ? String.format(Locale.ENGLISH, "%,.0f", v) : String.format(Locale.ENGLISH, "%.1f", v);
    }

    static String num(double v, int dec) { return Double.isNaN(v) ? "–" : String.format(Locale.ENGLISH, "%,." + dec + "f", v); }

    /** a widget button: opens Moltrix, and the page then opens that screen (window.mzWidgetOpen) */
    static PendingIntent open(Context c, String target) {
        Intent i = new Intent(c, MoltrixActivity.class)
                .setAction("com.mishrachemist.moltrixerp.WIDGET." + target)
                .putExtra("open", target)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, ("w:" + target).hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    interface Maker { RemoteViews make(Context c, int size); }   // size 0 small (2x2), 1 wide (4x2), 2 large (4x3)

    /** Android 12+: the launcher picks the layout for the widget's size itself; older: pick by the size we are told */
    static void update(Context c, AppWidgetManager m, int id, Maker mk) {
        RemoteViews v;
        if (Build.VERSION.SDK_INT >= 31) {
            Map<SizeF, RemoteViews> map = new HashMap<>();
            map.put(new SizeF(100f, 90f), mk.make(c, 0));
            map.put(new SizeF(220f, 90f), mk.make(c, 1));
            map.put(new SizeF(220f, 200f), mk.make(c, 2));
            v = new RemoteViews(map);
        } else {
            Bundle o = m.getAppWidgetOptions(id);
            int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110), h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110);
            v = mk.make(c, w < 220 ? 0 : h < 200 ? 1 : 2);
        }
        m.updateAppWidget(id, v);
    }

    static void refresh(Context c, Class<?> provider, Maker mk) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            for (int id : m.getAppWidgetIds(new ComponentName(c, provider))) update(c, m, id, mk);
        } catch (Exception ignored) { }
    }

    static boolean any(Context c, Class<?> provider) {
        try { return AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c, provider)).length > 0; } catch (Exception e) { return false; }
    }

    static void refreshAll(Context c) {
        refresh(c, ProdWidget.class, Widgets::prod);
        refresh(c, MarketWidget.class, Widgets::market);
        refresh(c, QuickWidget.class, Widgets::quick);
    }

    /** the page or the cloud sync hands over new data */
    static void set(Context c, String kind, String data) {
        try {
            JSONObject n = new JSONObject(data);
            String key = "prod".equals(kind) ? "wProd" : "mkt".equals(kind) ? "wMkt" : null;
            if (key == null) return;
            JSONObject old = json(c, key);
            if (old != null && old.optLong("t", 0) > n.optLong("t", 0)) return;   // keep the newer one
            MoltrixActivity.prefs(c).edit().putString(key, data).apply();
            if (key.equals("wProd")) { refresh(c, ProdWidget.class, Widgets::prod); refresh(c, QuickWidget.class, Widgets::quick); }
            else refresh(c, MarketWidget.class, Widgets::market);
        } catch (Exception ignored) { }
    }

    // ---------- A · Production ----------
    static RemoteViews prod(Context c, int size) {
        int lay = size == 0 ? R.layout.w_prod_s : size == 1 ? R.layout.w_prod_m : R.layout.w_prod_l;
        RemoteViews v = new RemoteViews(c.getPackageName(), lay);
        v.setOnClickPendingIntent(R.id.w_root, open(c, "prod"));
        JSONObject j = json(c, "wProd");
        if (j == null) {
            v.setTextViewText(R.id.p_mt, "–");
            if (size == 0) v.setTextViewText(R.id.p_sync, "Open Moltrix once");
            else v.setTextViewText(R.id.p_foot, "Open Moltrix once to load the data");
            return v;
        }
        String day = j.optString("day", ""), td = today();
        boolean isToday = day.equals(td);
        String dayLabel = isToday ? "Today" : label(day);
        double mtV = j.optDouble("mt", Double.NaN), month = j.optDouble("month", Double.NaN);
        int heats = j.optInt("heats", 0);
        long sync = j.optLong("sync", 0);
        v.setTextViewText(R.id.p_mt, mt(mtV));
        String syncTxt = sync > 0 ? "Sync " + when(sync) : "";
        if (size == 0) {
            v.setTextViewText(R.id.p_title, dayLabel);
            v.setTextViewText(R.id.p_sub, "MT · " + heats + " heats");
            v.setTextViewText(R.id.p_sync, syncTxt);
        } else if (size == 1) {
            v.setTextViewText(R.id.p_title, dayLabel);
            v.setTextViewText(R.id.p_sync, syncTxt);
            v.setTextViewText(R.id.p_heats, String.valueOf(heats));
            v.setTextViewText(R.id.p_month, mt(month));
            v.setTextViewText(R.id.p_foot, "Yesterday " + mt(j.optDouble("yMt", Double.NaN)) + " MT · Month " + j.optInt("mHeats", 0) + " heats");
        } else {
            v.setTextViewText(R.id.p_title, "Production · " + dayLabel);
            v.setTextViewText(R.id.p_sync, syncTxt);
            v.setTextViewText(R.id.p_sub, "MT billet");
            v.setTextViewText(R.id.p_sub2, heats + " heats · Yesterday " + mt(j.optDouble("yMt", Double.NaN)) + " MT");
            v.setTextViewText(R.id.p_foot, fmt("MMMM", System.currentTimeMillis()) + ": " + mt(month) + " MT · " + j.optInt("mHeats", 0) + " heats");
            JSONArray d = j.optJSONArray("days");
            if (d != null && d.length() > 0) v.setImageViewBitmap(R.id.p_bars, bars(d));
        }
        return v;
    }

    static String label(String iso) {
        try { SimpleDateFormat p = new SimpleDateFormat("yyyy-MM-dd", Locale.ENGLISH); p.setTimeZone(IST); return fmt("d MMM", p.parse(iso).getTime()); }
        catch (Exception e) { return iso; }
    }

    /** last 7 days: one bar each, today in gold, the MT on top and the date below */
    static Bitmap bars(JSONArray d) {
        int W = 640, H = 220, n = d.length();
        Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas cv = new Canvas(b);
        double max = 0;
        for (int i = 0; i < n; i++) max = Math.max(max, d.optJSONObject(i).optDouble("mt", 0));
        Paint bar = new Paint(Paint.ANTI_ALIAS_FLAG), txt = new Paint(Paint.ANTI_ALIAS_FLAG), val = new Paint(Paint.ANTI_ALIAS_FLAG);
        txt.setColor(MUTED); txt.setTextSize(24); txt.setTextAlign(Paint.Align.CENTER); txt.setFakeBoldText(true);
        val.setColor(INK); val.setTextSize(22); val.setTextAlign(Paint.Align.CENTER);
        float slot = W / (float) n, bw = slot * 0.56f, top = 30, bottom = H - 34;
        for (int i = 0; i < n; i++) {
            JSONObject o = d.optJSONObject(i);
            double m = o.optDouble("mt", 0);
            float cx = slot * i + slot / 2, h = max > 0 ? (float) ((bottom - top) * m / max) : 0;
            bar.setColor(i == n - 1 ? GOLD : 0xFF2F5288);
            if (h > 0) cv.drawRoundRect(new RectF(cx - bw / 2, bottom - Math.max(h, 6), cx + bw / 2, bottom), 8, 8, bar);
            if (m > 0) cv.drawText(m >= 1000 ? String.format(Locale.ENGLISH, "%.1fk", m / 1000) : String.format(Locale.ENGLISH, "%.0f", m), cx, bottom - Math.max(h, 6) - 6, val);
            cv.drawText(o.optString("d", ""), cx, H - 6, txt);
        }
        return b;
    }

    // ---------- B · Market ----------
    /** the index's price and day change: from WidgetWorker (Yahoo) if newer, else the F&O screen's last spot */
    static double[] quote(Context c, String yahoo, JSONObject mk, String sym) {
        double p = Double.NaN, ch = Double.NaN; long at = 0;
        JSONObject q = json(c, "wQuote");
        if (q != null) {
            JSONObject o = q.optJSONObject("q") == null ? null : q.optJSONObject("q").optJSONObject(yahoo);
            if (o != null) { p = o.optDouble("p", Double.NaN); ch = o.optDouble("c", Double.NaN); at = q.optLong("t", 0); }
        }
        JSONObject x = idx(mk, sym);
        if (x != null && x.optLong("at", 0) > at && !Double.isNaN(x.optDouble("spot", Double.NaN))) p = x.optDouble("spot");
        return new double[] { p, ch };
    }

    static JSONObject idx(JSONObject mk, String sym) {
        JSONArray a = mk == null ? null : mk.optJSONArray("idx");
        if (a == null) return null;
        for (int i = 0; i < a.length(); i++) { JSONObject o = a.optJSONObject(i); if (o != null && sym.equals(o.optString("s"))) return o; }
        return null;
    }

    /** the F&O signal of the day (an old day's signal is not shown) */
    static String sig(JSONObject mk, String sym) {
        if (mk == null || !today().equals(mk.optString("day"))) return "";
        JSONObject o = idx(mk, sym);
        return o == null ? "" : o.optString("sig", "");
    }

    static void chip(RemoteViews v, int id, String s) {
        String t; int bg;
        if (s.startsWith("BUY CE")) { t = "BUY CE"; bg = R.drawable.w_chip_buy; }
        else if (s.startsWith("BUY PE")) { t = "BUY PE"; bg = R.drawable.w_chip_sell; }
        else if (s.startsWith("WATCH")) { t = s.contains("PE") ? "WATCH PE" : s.contains("CE") ? "WATCH CE" : "WATCH"; bg = R.drawable.w_chip_watch; }
        else if (s.isEmpty()) { t = "–"; bg = R.drawable.w_chip_none; }
        else { t = "NO TRADE"; bg = R.drawable.w_chip_none; }
        v.setTextViewText(id, t);
        v.setInt(id, "setBackgroundResource", bg);
    }

    static void change(RemoteViews v, int id, double ch) {
        if (Double.isNaN(ch)) { v.setTextViewText(id, ""); return; }
        v.setTextViewText(id, (ch >= 0 ? "▲ " : "▼ ") + String.format(Locale.ENGLISH, "%.2f%%", Math.abs(ch)));
        v.setTextColor(id, ch >= 0 ? GREEN : RED);
    }

    static String expTxt(JSONObject mk, String sym) {
        JSONObject o = idx(mk, sym);
        if (o == null || o.isNull("dte")) return "";
        int d = o.optInt("dte", -1);
        return d == 0 ? "Expiry today" : d > 0 ? d + "d to expiry" : "";
    }

    static RemoteViews market(Context c, int size) {
        int lay = size == 0 ? R.layout.w_mkt_s : size == 1 ? R.layout.w_mkt_m : R.layout.w_mkt_l;
        RemoteViews v = new RemoteViews(c.getPackageName(), lay);
        v.setOnClickPendingIntent(R.id.w_root, open(c, "fno"));
        JSONObject mk = json(c, "wMkt"), q = json(c, "wQuote");
        long t = Math.max(mk == null ? 0 : mk.optLong("t", 0), q == null ? 0 : q.optLong("t", 0));
        if (size == 0) {
            double[] p = quote(c, IDX[0][1], mk, IDX[0][0]);
            v.setTextViewText(R.id.m_spot, num(p[0], 2));
            change(v, R.id.m_chg, p[1]);
            JSONObject o = idx(mk, "NIFTY");
            double pcr = o == null ? Double.NaN : o.optDouble("pcr", Double.NaN);
            v.setTextViewText(R.id.m_pcr, Double.isNaN(pcr) ? when(t) : "PCR " + num(pcr, 2));
            chip(v, R.id.m_sig, sig(mk, "NIFTY"));
        } else if (size == 1) {
            v.setTextViewText(R.id.m_time, when(t));
            int[][] ids = { { R.id.t1_name, R.id.t1_spot, R.id.t1_chg, R.id.t1_sig, R.id.t1_exp }, { R.id.t2_name, R.id.t2_spot, R.id.t2_chg, R.id.t2_sig, R.id.t2_exp } };
            for (int i = 0; i < 2; i++) {
                double[] p = quote(c, IDX[i][1], mk, IDX[i][0]);
                v.setTextViewText(ids[i][0], IDX[i][0]);
                v.setTextViewText(ids[i][1], num(p[0], 0));
                change(v, ids[i][2], p[1]);
                chip(v, ids[i][3], sig(mk, IDX[i][0]));
                v.setTextViewText(ids[i][4], expTxt(mk, IDX[i][0]));
            }
        } else {
            v.setTextViewText(R.id.m_time, when(t));
            int[][] ids = { { R.id.r0_name, R.id.r0_spot, R.id.r0_chg, R.id.r0_sig }, { R.id.r1_name, R.id.r1_spot, R.id.r1_chg, R.id.r1_sig },
                    { R.id.r2_name, R.id.r2_spot, R.id.r2_chg, R.id.r2_sig }, { R.id.r3_name, R.id.r3_spot, R.id.r3_chg, R.id.r3_sig } };
            for (int i = 0; i < 4; i++) {
                double[] p = quote(c, IDX[i][1], mk, IDX[i][0]);
                v.setTextViewText(ids[i][0], IDX[i][0]);
                v.setTextViewText(ids[i][1], num(p[0], 0));
                change(v, ids[i][2], p[1]);
                chip(v, ids[i][3], sig(mk, IDX[i][0]));
            }
            double vix = Double.NaN;
            JSONObject qq = q == null ? null : q.optJSONObject("q");
            if (qq != null && qq.optJSONObject("^INDIAVIX") != null) vix = qq.optJSONObject("^INDIAVIX").optDouble("p", Double.NaN);
            if (Double.isNaN(vix) && mk != null) vix = mk.optDouble("vix", Double.NaN);
            v.setTextViewText(R.id.m_vix, Double.isNaN(vix) ? "" : "VIX " + num(vix, 2));
            JSONObject s = mk == null ? null : mk.optJSONObject("scr");
            String st;
            if (s == null || !fmt("yyyy-MM-dd", s.optLong("t", 0)).equals(today())) st = "Screener: not run today";
            else {
                int n = s.optInt("n", 0);
                JSONArray top = s.optJSONArray("top");
                StringBuilder names = new StringBuilder();
                for (int i = 0; top != null && i < top.length(); i++) names.append(i == 0 ? " · " : ", ").append(top.optString(i));
                st = (n == 0 ? "Screener: no BUY" : "Screener: " + n + " BUY" + names) + " · " + when(s.optLong("t", 0));
            }
            v.setTextViewText(R.id.m_scr, st);
            v.setOnClickPendingIntent(R.id.m_scr, open(c, "scr"));
        }
        return v;
    }

    // ---------- C · Quick buttons ----------
    static RemoteViews quick(Context c, int size) {
        int lay = size == 0 ? R.layout.w_quick_s : size == 1 ? R.layout.w_quick_m : R.layout.w_quick_l;
        RemoteViews v = new RemoteViews(c.getPackageName(), lay);
        String[] all = size == 0 ? new String[] { "fetch", "prod", "reports", "fno" }
                : size == 1 ? new String[] { "fetch", "prod", "reports", "fno", "dashboard", "stock", "oos", "scr" }
                : new String[] { "fetch", "prod", "reports", "dashboard", "stock", "oos", "fno", "scr", "trends" };
        for (String t : all) v.setOnClickPendingIntent(btn(t), open(c, t));
        if (size == 2) {
            JSONObject j = json(c, "wProd");
            long s = j == null ? 0 : j.optLong("sync", 0);
            v.setTextViewText(R.id.q_sync, s > 0 ? "Last sync " + when(s) : "WhatsApp → Excel");
            v.setOnClickPendingIntent(R.id.q_title, open(c, "dashboard"));
        }
        return v;
    }

    static int btn(String t) {
        switch (t) {
            case "fetch": return R.id.q_fetch;
            case "prod": return R.id.q_prod;
            case "reports": return R.id.q_reports;
            case "fno": return R.id.q_fno;
            case "dashboard": return R.id.q_dashboard;
            case "stock": return R.id.q_stock;
            case "oos": return R.id.q_oos;
            case "scr": return R.id.q_scr;
            default: return R.id.q_trends;
        }
    }

    static SharedPreferences p(Context c) { return MoltrixActivity.prefs(c); }
}
