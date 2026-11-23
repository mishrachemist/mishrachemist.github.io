package com.mishrachemist.moltrixerp;

import android.annotation.SuppressLint;
import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/**
 * Market data for the F&O screen, fetched on the phone itself (NSE blocks cloud servers).
 * NSE / BSE: a hidden WebView opens the exchange's own page (same browser, same cookies as a person would have),
 * then the data is asked with fetch() from inside that page. Yahoo (price candles): a plain HTTPS request.
 * Only these sites are allowed. The Moltrix page gets the answer through window.mzMkDone(id) + MoltrixApp.mkTake(id).
 */
final class MarketFetch {
    interface Done { void done(String id); }

    private static final Pattern SITE = Pattern.compile("^https://(www\\.)?(nseindia\\.in|nseindia\\.com|bseindia\\.com)(/[^\\s\"'<>]*)?$");
    private static final Pattern API = Pattern.compile("^(/api/[^\\s\"'<>]*|https://api\\.bseindia\\.com/[^\\s\"'<>]*)$");
    private static final Pattern YAHOO = Pattern.compile("^https://query[12]\\.finance\\.yahoo\\.com/[^\\s\"'<>]*$");
    private static final long TIMEOUT_MS = 25_000, PAGE_MAX_AGE_MS = 10 * 60_000;

    private final Context ctx;
    private final FrameLayout root;   // null in a background service (the hidden pages are not put on any screen)
    private final Done done;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private final ExecutorService pool = Executors.newFixedThreadPool(2);
    private final Map<String, String> results = new ConcurrentHashMap<>();
    private final java.util.Set<String> finished = ConcurrentHashMap.newKeySet();
    private final Map<String, Site> sites = new HashMap<>();     // per page address (UI thread only)

    private final class Site {
        final String page; WebView view; boolean ready = false; long loadedAt = 0; int reloads = 0;
        final List<String[]> queue = new ArrayList<>();          // {id, path}
        Site(String page) { this.page = page; }
    }

    MarketFetch(Context ctx, FrameLayout root, Done done) { this.ctx = ctx; this.root = root; this.done = done; }

    String take(String id) { String r = results.remove(id); return r == null ? "" : r; }

    private void finish(String id, int status, String text) {
        if (id == null || !finished.add(id)) return;   // only the first answer counts (late timeouts are dropped)
        if (finished.size() > 5000) finished.clear();
        try { results.put(id, new JSONObject().put("s", status).put("t", text == null ? "" : text).toString()); }
        catch (Exception e) { results.put(id, "{\"s\":0,\"t\":\"\"}"); }
        done.done(id);
    }

    /** NSE / BSE data: page = the exchange page to open first, path = /api/... (same site) or an api.bseindia.com address */
    void site(String id, String page, String path) {
        if (page == null || path == null || !SITE.matcher(page).matches() || !API.matcher(path).matches()) { finish(id, 0, "not allowed"); return; }
        ui.post(() -> {
            Site s = sites.get(page);
            if (s == null) { s = new Site(page); sites.put(page, s); }
            s.queue.add(new String[]{id, path});
            if (s.view == null || (s.ready && System.currentTimeMillis() - s.loadedAt > PAGE_MAX_AGE_MS)) open(s);
            else if (s.ready) flush(s);
            final Site fs = s;
            ui.postDelayed(() -> { for (int i = fs.queue.size() - 1; i >= 0; i--) if (fs.queue.get(i)[0].equals(id)) fs.queue.remove(i); finish(id, 0, "timeout"); }, TIMEOUT_MS);
        });
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void open(Site s) {
        s.ready = false;
        if (s.view == null) {
            WebView v = new WebView(ctx);
            WebSettings st = v.getSettings();
            st.setJavaScriptEnabled(true);
            st.setDomStorageEnabled(true);
            st.setBlockNetworkImage(true);
            st.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            CookieManager.getInstance().setAcceptThirdPartyCookies(v, true);
            v.addJavascriptInterface(new Back(), "MoltrixMk");
            v.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest r) {
                    Uri u = r.getUrl();   // stays on the exchange's own site
                    return !("https".equals(u.getScheme()) && u.getHost() != null && u.getHost().matches("(.+\\.)?(nseindia\\.in|nseindia\\.com|bseindia\\.com)"));
                }
                @Override public void onPageFinished(WebView w, String url) {
                    if (w.getProgress() < 100) return;
                    s.ready = true; s.loadedAt = System.currentTimeMillis();
                    ui.postDelayed(() -> flush(s), 1200);   // let the site's own scripts set their cookies first
                }
                @Override public void onReceivedError(WebView w, WebResourceRequest r, WebResourceError e) {
                    if (!r.isForMainFrame()) return;
                    for (String[] q : new ArrayList<>(s.queue)) finish(q[0], 0, "page: " + e.getDescription());
                    s.queue.clear();
                }
            });
            v.setVisibility(View.INVISIBLE);
            if (root != null) root.addView(v, 0, new FrameLayout.LayoutParams(4, 4));   // kept under the app's page, never seen
            s.view = v;
        }
        s.view.loadUrl(s.page);
    }

    private void flush(Site s) {
        if (!s.ready || s.view == null) return;
        List<String[]> q = new ArrayList<>(s.queue);
        s.queue.clear();
        for (String[] r : q) {
            String js = "(function(){var id=" + JSONObject.quote(r[0]) + ";fetch(" + JSONObject.quote(r[1]) + ",{credentials:'include',"
                + "headers:{'Accept':'application/json, text/plain, */*'}}).then(function(x){return x.text().then(function(t){"
                + "MoltrixMk.done(id,x.status,t);});}).catch(function(e){MoltrixMk.done(id,0,String(e));});})();";
            s.view.evaluateJavascript(js, null);
        }
    }

    private final class Back {
        @JavascriptInterface public void done(String id, int status, String text) {
            if (status == 401 || status == 403) {   // cookies too old: open the page again once, then ask again
                ui.post(() -> {
                    for (Site s : sites.values()) {
                        if (s.reloads < 3 && s.view != null) { s.reloads++; s.ready = false; s.view.loadUrl(s.page); }
                    }
                });
            } else ui.post(() -> { for (Site s : sites.values()) s.reloads = 0; });
            finish(id, status, text);
        }
    }

    /** Yahoo Finance price candles (no exchange page needed) */
    void yahoo(String id, String url) {
        if (url == null || !YAHOO.matcher(url).matches()) { finish(id, 0, "not allowed"); return; }
        pool.execute(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(12_000); c.setReadTimeout(15_000);
                c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36");
                c.setRequestProperty("Accept", "application/json");
                int code = c.getResponseCode();
                InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                if (in != null) { byte[] b = new byte[16384]; int n; while ((n = in.read(b)) > 0) out.write(b, 0, n); in.close(); }
                finish(id, code, out.toString("UTF-8"));
            } catch (Exception e) {
                finish(id, 0, String.valueOf(e.getMessage()));
            } finally { if (c != null) c.disconnect(); }
        });
    }

    /** Moltrix Sheet: IMPORTDATA / IMPORTHTML / IMPORTXML read a public https page (GET only, at most 5 MB) */
    void web(String id, String url) {
        if (url == null || !url.startsWith("https://") || url.length() > 2000) { finish(id, 0, "not allowed"); return; }
        pool.execute(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(12_000); c.setReadTimeout(20_000);
                c.setInstanceFollowRedirects(true);
                c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36");
                int code = c.getResponseCode();
                InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                if (in != null) {
                    byte[] b = new byte[16384]; int n;
                    while ((n = in.read(b)) > 0) { out.write(b, 0, n); if (out.size() > 5_000_000) { in.close(); finish(id, 0, "too big (over 5 MB)"); return; } }
                    in.close();
                }
                String cs = "UTF-8", ct = c.getContentType();
                if (ct != null) { java.util.regex.Matcher m = Pattern.compile("charset=([\\w-]+)", Pattern.CASE_INSENSITIVE).matcher(ct); if (m.find()) cs = m.group(1); }
                String text;
                try { text = out.toString(cs); } catch (Exception e) { text = out.toString("UTF-8"); }
                finish(id, code, text);
            } catch (Exception e) {
                finish(id, 0, String.valueOf(e.getMessage()));
            } finally { if (c != null) c.disconnect(); }
        });
    }

    void destroy() {
        ui.post(() -> { for (Site s : sites.values()) if (s.view != null) { if (root != null) root.removeView(s.view); s.view.destroy(); } sites.clear(); });
        pool.shutdownNow();
    }
}
