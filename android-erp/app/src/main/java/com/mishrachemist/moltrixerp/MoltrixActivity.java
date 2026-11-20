package com.mishrachemist.moltrixerp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.fragment.app.FragmentActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Locale;

/**
 * Moltrix in this app's own WebView - no Chrome needed. Sign-in, data and notifications belong to this app.
 * The page talks to the app through window.MoltrixApp (files, sharing, fingerprint lock, notifications).
 */
public class MoltrixActivity extends FragmentActivity {
    static final String HOME = "https://mishrachemist.github.io/";
    static final String HOST = "mishrachemist.github.io";
    static final long LOCK_GRACE_MS = 60_000;
    private static final int REQ_FILE = 41, REQ_NOTIF = 42;

    private WebView web;
    private View cover;                       // blank lock screen over the page
    private ValueCallback<Uri[]> fileCb;
    private boolean signIn = false;           // inside a Microsoft sign-in: every page of it stays in the app
    private long stoppedAt = 0;               // elapsedRealtime when the app went to the background
    private boolean unlocked = false, prompting = false;

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("moltrix", MODE_PRIVATE); }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        applyBars(prefs(this).getString("barTop", "#F6F0E6"), prefs(this).getString("barBottom", "#F6F0E6"));

        FrameLayout root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        cover = new View(this);
        cover.setBackgroundColor(Color.parseColor("#F6F0E6"));
        cover.setClickable(true);
        cover.setOnClickListener(v -> askFingerprint());
        root.addView(cover, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        cover.setVisibility(lockOn() ? View.VISIBLE : View.GONE);
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setAllowFileAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);     // Microsoft token renewal (hidden frame) needs its cookies

        web.addJavascriptInterface(new Bridge(), "MoltrixApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                if (!r.isForMainFrame()) return false;
                return route(r.getUrl());
            }
            @Override
            public void onPageFinished(WebView v, String url) {
                CookieManager.getInstance().flush();
                Uri u = Uri.parse(url);
                if (HOST.equalsIgnoreCase(u.getHost())) signIn = false;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try {
                    Intent i = p.createIntent();
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                    if (i.getType() == null || i.getType().isEmpty()) i.setType("*/*");
                    startActivityForResult(Intent.createChooser(i, null), REQ_FILE);
                } catch (Exception e) { fileCb = null; return false; }
                return true;
            }
            @Override
            public void onPermissionRequest(PermissionRequest req) {
                Uri o = req.getOrigin();
                if (o != null && HOST.equalsIgnoreCase(o.getHost())) runOnUiThread(() -> req.grant(req.getResources()));
                else req.deny();
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> {      // a plain https download: the phone's browser / download app
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
        });

        if (b != null) web.restoreState(b);
        if (web.getUrl() == null) web.loadUrl(startUrl(getIntent()));
        if (prefs(this).getBoolean("notify", false)) NotifyWorker.schedule(this);
        if (lockOn()) cover.post(this::askFingerprint);
    }

    /** phone's status bar (top) and navigation bar (bottom) in the theme's colours; dark icons on light colours */
    void applyBars(String top, String bottom) {
        try {
            int t = Color.parseColor(top), b = Color.parseColor(bottom);
            getWindow().setStatusBarColor(t);
            getWindow().setNavigationBarColor(b);
            WindowInsetsControllerCompat w = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            w.setAppearanceLightStatusBars(light(t));
            w.setAppearanceLightNavigationBars(light(b));
        } catch (Exception ignored) { }
    }
    static boolean light(int c) { return (0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c)) > 160; }

    private String startUrl(Intent i) {
        Uri d = i != null ? i.getData() : null;
        if (d != null && "https".equals(d.getScheme()) && HOST.equalsIgnoreCase(d.getHost())) return d.toString();
        return HOME;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        Uri d = i.getData();
        if (d != null && "https".equals(d.getScheme()) && HOST.equalsIgnoreCase(d.getHost())) web.loadUrl(d.toString());
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }

    /** where a link of the page goes: Moltrix and Microsoft sign-in stay here, ERP / WhatsApp / other sites open outside */
    private boolean route(Uri u) {
        String sc = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
        String h = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
        if (sc.equals("intent")) {
            try {
                Intent i = Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME);
                if (getPackageName().equals(i.getPackage())) i.setPackage(getPackageName());
                startActivity(i);
            } catch (Exception e) {
                String fb = u.getQueryParameter("browser_fallback_url");
                if (fb != null) open(Uri.parse(fb)); else Toast.makeText(this, "Cannot open this link", Toast.LENGTH_SHORT).show();
            }
            return true;
        }
        if (!sc.equals("http") && !sc.equals("https")) { open(u); return true; }
        if (h.equals(HOST)) { signIn = false; return false; }
        if (isMicrosoftSignIn(h)) { signIn = true; return false; }
        if (signIn && sc.equals("https")) return false;      // the company's own sign-in page during a Microsoft sign-in
        open(u);
        return true;
    }

    static boolean isMicrosoftSignIn(String h) {
        return h.equals("login.microsoftonline.com") || h.endsWith(".microsoftonline.com") || h.equals("login.live.com")
            || h.equals("login.microsoft.com") || h.equals("account.live.com") || h.equals("account.microsoft.com")
            || h.endsWith(".msauth.net") || h.endsWith(".msftauth.net") || h.equals("login.windows.net");
    }

    private void open(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show(); }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE && fileCb != null) {
            Uri[] out = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    out = new Uri[data.getClipData().getItemCount()];
                    for (int k = 0; k < out.length; k++) out[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) out = new Uri[]{data.getData()};
            }
            fileCb.onReceiveValue(out);
            fileCb = null;
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (cover.getVisibility() == View.VISIBLE) { moveTaskToBack(true); return; }
        if (web.canGoBack()) web.goBack(); else moveTaskToBack(true);
    }

    // ---------------- fingerprint lock (the phone's own fingerprint / screen lock) ----------------
    boolean lockOn() { return prefs(this).getBoolean("lock", false); }

    @Override
    protected void onStart() {
        super.onStart();
        if (lockOn() && stoppedAt > 0 && SystemClock.elapsedRealtime() - stoppedAt > LOCK_GRACE_MS) {
            unlocked = false;
            cover.setVisibility(View.VISIBLE);
            askFingerprint();
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        stoppedAt = SystemClock.elapsedRealtime();
        CookieManager.getInstance().flush();
    }

    private int authenticators() {
        return Build.VERSION.SDK_INT >= 30
            ? BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL
            : BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    }

    private boolean canCheck() {
        return BiometricManager.from(this).canAuthenticate(authenticators()) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /** checks the fingerprint; then = what to do after a good check (null = just open the page) */
    private void checkFingerprint(String title, Runnable then, Runnable fail) {
        if (prompting) return;
        if (!canCheck()) { if (fail != null) fail.run(); return; }
        prompting = true;
        BiometricPrompt p = new BiometricPrompt(this, ContextCompat.getMainExecutor(this), new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult r) { prompting = false; then.run(); }
            @Override public void onAuthenticationError(int code, @NonNull CharSequence msg) { prompting = false; if (fail != null) fail.run(); }
        });
        BiometricPrompt.PromptInfo.Builder info = new BiometricPrompt.PromptInfo.Builder().setTitle(title).setAllowedAuthenticators(authenticators());
        p.authenticate(info.build());
    }

    private void askFingerprint() {
        if (!lockOn()) { cover.setVisibility(View.GONE); return; }
        if (unlocked) return;
        if (!canCheck()) { unlocked = true; cover.setVisibility(View.GONE); return; }   // no fingerprint / screen lock on the phone any more
        checkFingerprint("Moltrix", () -> { unlocked = true; cover.setVisibility(View.GONE); }, null);
    }

    private void jsCall(String fn, String arg) {
        runOnUiThread(() -> web.evaluateJavascript("window." + fn + " && window." + fn + "(" + arg + ")", null));
    }

    // ---------------- files ----------------
    private void saveFile(String name, String mime, byte[] data) throws Exception {
        name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (mime == null || mime.isEmpty() || mime.equals("application/octet-stream")) {
            String ext = MimeTypeMap.getFileExtensionFromUrl(name.replace(' ', '_'));
            String m = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase(Locale.ROOT));
            if (m != null) mime = m;
        }
        Uri uri;
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
            cv.put(MediaStore.Downloads.MIME_TYPE, mime);
            cv.put(MediaStore.Downloads.IS_PENDING, 1);
            uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) throw new Exception("Downloads folder not available");
            try (OutputStream o = getContentResolver().openOutputStream(uri)) { o.write(data); }
            cv.clear(); cv.put(MediaStore.Downloads.IS_PENDING, 0);
            getContentResolver().update(uri, cv, null, null);
        } else {
            File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            File f = new File(dir, name);
            try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
            uri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
        }
        final Uri fu = uri; final String fm = mime, fn = name;
        runOnUiThread(() -> {
            Toast.makeText(this, "⬇ " + fn, Toast.LENGTH_SHORT).show();
            Intent v = new Intent(Intent.ACTION_VIEW).setDataAndType(fu, fm).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent pi = PendingIntent.getActivity(this, fn.hashCode(), v, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            notifyNow(this, "downloads", "Downloads", fn.hashCode(), fn, "Saved in Downloads - tap to open", pi);
        });
    }

    private void shareFile(String name, String mime, byte[] data, String title) throws Exception {
        File dir = new File(getCacheDir(), "share");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        File f = new File(dir, name.replaceAll("[\\\\/:*?\"<>|]", "_"));
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
        Uri u = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
        Intent s = new Intent(Intent.ACTION_SEND).setType(mime == null || mime.isEmpty() ? "*/*" : mime)
            .putExtra(Intent.EXTRA_STREAM, u).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        if (title != null && !title.isEmpty()) s.putExtra(Intent.EXTRA_SUBJECT, title);
        runOnUiThread(() -> startActivity(Intent.createChooser(s, title)));
    }

    // ---------------- notifications ----------------
    static void notifyNow(Context c, String channel, String channelName, int id, String title, String body, PendingIntent tap) {
        NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(channel) == null)
            nm.createNotificationChannel(new NotificationChannel(channel, channelName, NotificationManager.IMPORTANCE_HIGH));
        if (tap == null) {
            Intent i = new Intent(c, MoltrixActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            tap = PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        }
        NotificationCompat.Builder nb = new NotificationCompat.Builder(c, channel)
            .setSmallIcon(R.drawable.ic_stat_moltrix).setColor(Color.parseColor("#1F3864"))
            .setContentTitle(title).setContentText(body).setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(tap);
        try { NotificationManagerCompat.from(c).notify(id, nb.build()); } catch (SecurityException ignored) { }
    }

    private void askNotifyPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
    }

    /** window.MoltrixApp - what the Moltrix page may ask this app to do */
    final class Bridge {
        @JavascriptInterface public String version() { return "2"; }
        @JavascriptInterface public void saveFile(String name, String mime, String b64) {
            try { MoltrixActivity.this.saveFile(name, mime, Base64.decode(b64, Base64.DEFAULT)); }
            catch (Exception e) { runOnUiThread(() -> Toast.makeText(MoltrixActivity.this, "Not saved: " + e.getMessage(), Toast.LENGTH_LONG).show()); }
        }
        @JavascriptInterface public void shareFile(String name, String mime, String b64, String title) {
            try { MoltrixActivity.this.shareFile(name, mime, Base64.decode(b64, Base64.DEFAULT), title); }
            catch (Exception e) { runOnUiThread(() -> Toast.makeText(MoltrixActivity.this, "Not shared: " + e.getMessage(), Toast.LENGTH_LONG).show()); }
        }
        @JavascriptInterface public void shareText(String text, String title) {
            Intent s = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            runOnUiThread(() -> startActivity(Intent.createChooser(s, title)));
        }
        @JavascriptInterface public boolean lockOn() { return MoltrixActivity.this.lockOn(); }
        @JavascriptInterface public boolean lockPossible() { return canCheck(); }
        /** switch the lock on / off - both only after a good fingerprint; the page hears back through window.mzNativeLock(on) */
        @JavascriptInterface public void setLock(boolean on) {
            runOnUiThread(() -> checkFingerprint(on ? "Switch the lock on" : "Switch the lock off", () -> {
                prefs(MoltrixActivity.this).edit().putBoolean("lock", on).apply();
                unlocked = true;
                jsCall("mzNativeLock", on ? "true" : "false");
            }, () -> jsCall("mzNativeLock", MoltrixActivity.this.lockOn() ? "true" : "false")));
        }
        @JavascriptInterface public boolean notifyOn() { return prefs(MoltrixActivity.this).getBoolean("notify", false) && !prefs(MoltrixActivity.this).getString("nkey", "").isEmpty(); }
        @JavascriptInterface public boolean notifyAllowed() { return NotificationManagerCompat.from(MoltrixActivity.this).areNotificationsEnabled(); }
        /** hourly check of the cloud sync's news (key = AES-256 key in base64, the same one the cloud sync uses) */
        @JavascriptInterface public void setNotify(boolean on, String key) {
            SharedPreferences.Editor e = prefs(MoltrixActivity.this).edit().putBoolean("notify", on);
            if (key != null && !key.isEmpty()) e.putString("nkey", key);
            e.apply();
            if (on) { runOnUiThread(MoltrixActivity.this::askNotifyPermission); NotifyWorker.schedule(MoltrixActivity.this); NotifyWorker.checkNow(MoltrixActivity.this); }
            else NotifyWorker.cancel(MoltrixActivity.this);
        }
        @JavascriptInterface public void notify(String title, String body) {
            notifyNow(MoltrixActivity.this, "app", "Moltrix", (int) (System.currentTimeMillis() & 0xffffff), title, body, null);
        }
        @JavascriptInterface public void setBars(String top, String bottom) {
            if (top == null || bottom == null || !top.matches("#[0-9a-fA-F]{6}") || !bottom.matches("#[0-9a-fA-F]{6}")) return;
            prefs(MoltrixActivity.this).edit().putString("barTop", top).putString("barBottom", bottom).apply();
            runOnUiThread(() -> applyBars(top, bottom));
        }
        /** games: landscape (either side) and full screen; false = back to normal */
        @JavascriptInterface public void gameMode(boolean on) {
            runOnUiThread(() -> {
                setRequestedOrientation(on ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                WindowInsetsControllerCompat w = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                if (on) {
                    w.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    w.hide(WindowInsetsCompat.Type.systemBars());
                } else w.show(WindowInsetsCompat.Type.systemBars());
            });
        }
        @JavascriptInterface public void askNotify() { runOnUiThread(MoltrixActivity.this::askNotifyPermission); }
    }
}
