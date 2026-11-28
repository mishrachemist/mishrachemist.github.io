package com.mishrachemist.moltrixerp;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/**
 * 28-Nov-2026: the job MacroDroid did - every WhatsApp notification on this phone is sent to the user's WhatsApp
 * Inbox Apps Script (the same Web app URL + TOKEN, the same three fields token / title / text), so MacroDroid is not
 * needed any more. The Apps Script keeps only the groups listed in it, as before.
 * Better than the macro: a message that can't be sent (no internet) waits in a queue on the phone and goes when the
 * internet is back; the same notification shown again by WhatsApp is sent once.
 * Needs "Notification access" for Moltrix (Android settings) - asked from the Moltrix page.
 */
public class WaCapture extends NotificationListenerService {
    static final String PREFS = "wa_capture";
    static final int MAX_QUEUE = 500;

    static SharedPreferences sp(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static boolean on(Context c) { SharedPreferences p = sp(c); return p.getBoolean("on", false) && !p.getString("url", "").isEmpty(); }
    static boolean allowed(Context c) { return NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName()); }

    static void set(Context c, boolean on, String url, String token) {
        SharedPreferences.Editor e = sp(c).edit().putBoolean("on", on);
        if (url != null && !url.trim().isEmpty()) e.putString("url", url.trim());
        if (token != null && !token.isEmpty()) e.putString("token", token);
        e.apply();
        if (on) Sender.kick(c);
    }

    static String status(Context c) {
        SharedPreferences p = sp(c);
        try {
            return new JSONObject().put("on", on(c)).put("allowed", allowed(c)).put("pending", queue(c).length())
                    .put("sent", p.getInt("sent", 0)).put("lastAt", p.getLong("lastAt", 0)).put("seenAt", p.getLong("seenAt", 0))
                    .put("lastErr", p.getString("lastErr", "")).toString();
        } catch (Exception e) { return "{}"; }
    }

    static synchronized JSONArray queue(Context c) {
        try { return new JSONArray(sp(c).getString("queue", "[]")); } catch (Exception e) { return new JSONArray(); }
    }
    static synchronized void saveQueue(Context c, JSONArray q) { sp(c).edit().putString("queue", q.toString()).apply(); }
    static synchronized void enqueue(Context c, String title, String text) {
        JSONArray q = queue(c);
        try { q.put(new JSONObject().put("t", title).put("x", text).put("at", System.currentTimeMillis())); } catch (Exception e) { return; }
        while (q.length() > MAX_QUEUE) q.remove(0);
        saveQueue(c, q);
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            String pkg = sbn.getPackageName();
            if (!"com.whatsapp".equals(pkg) && !"com.whatsapp.w4b".equals(pkg)) return;
            if (!on(this)) return;
            Notification n = sbn.getNotification();
            if (n == null || sbn.isOngoing() || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;   // "5 messages from 2 chats"
            Bundle x = n.extras;
            if (x == null) return;
            CharSequence t = x.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence txt = x.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence big = x.getCharSequence(Notification.EXTRA_BIG_TEXT);   // a long message in full
            String title = t == null ? "" : t.toString();
            String text = big != null && big.length() >= (txt == null ? 0 : txt.length()) ? big.toString() : txt == null ? "" : txt.toString();
            if (text.trim().isEmpty()) return;
            SharedPreferences p = sp(this);
            long now = System.currentTimeMillis();
            p.edit().putLong("seenAt", now).apply();
            // WhatsApp shows the same notification again (sound off, phone unlocked ...): the same title + text within
            // 10 minutes is sent once. The last 40 are remembered.
            String sig = Integer.toHexString((title + "\n" + text).hashCode()) + ":" + text.length();
            JSONObject seen;
            try { seen = new JSONObject(p.getString("seen", "{}")); } catch (Exception e) { seen = new JSONObject(); }
            if (now - seen.optLong(sig, 0) < 10 * 60000) return;
            seen.put(sig, now);
            if (seen.length() > 40) {
                JSONObject keep = new JSONObject();
                java.util.Iterator<String> it = seen.keys();
                while (it.hasNext()) { String k = it.next(); if (now - seen.optLong(k, 0) < 10 * 60000) keep.put(k, seen.optLong(k)); }
                seen = keep;
            }
            p.edit().putString("seen", seen.toString()).apply();
            enqueue(this, title, text);
            Sender.kick(this);
        } catch (Throwable e) { /* never let a bad notification stop the listener */ }
    }

    @Override public void onListenerConnected() { if (on(this)) Sender.kick(this); }

    /** sends the queue to the Inbox Apps Script, oldest first; no internet / an error = tried again later (WorkManager backoff) */
    public static class Sender extends Worker {
        static final String NAME = "moltrix-wa-capture";
        public Sender(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

        static void kick(Context c) {
            OneTimeWorkRequest r = new OneTimeWorkRequest.Builder(Sender.class)
                    .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build();
            WorkManager.getInstance(c).enqueueUniqueWork(NAME, ExistingWorkPolicy.APPEND_OR_REPLACE, r);
        }

        @NonNull @Override public Result doWork() {
            Context c = getApplicationContext();
            SharedPreferences p = sp(c);
            String url = p.getString("url", ""), token = p.getString("token", "");
            if (url.isEmpty()) return Result.success();
            while (true) {
                JSONArray q = queue(c);
                if (q.length() == 0) return Result.success();
                JSONObject m = q.optJSONObject(0);
                if (m == null) { q.remove(0); saveQueue(c, q); continue; }
                String err = post(url, token, m.optString("t"), m.optString("x"));
                if (err != null) { p.edit().putString("lastErr", err).apply(); return Result.retry(); }
                synchronized (WaCapture.class) {   // remove the one sent (new ones may have been added meanwhile)
                    JSONArray q2 = queue(c);
                    if (q2.length() > 0 && m.optLong("at") == q2.optJSONObject(0).optLong("at")) q2.remove(0);
                    saveQueue(c, q2);
                }
                p.edit().putInt("sent", p.getInt("sent", 0) + 1).putLong("lastAt", System.currentTimeMillis()).putString("lastErr", "").apply();
            }
        }

        /** the same request as the MacroDroid macro (POST, fields token / title / text); null = sent */
        static String post(String url, String token, String title, String text) {
            HttpURLConnection h = null;
            try {
                String body = "token=" + URLEncoder.encode(token, "UTF-8") + "&title=" + URLEncoder.encode(title, "UTF-8") + "&text=" + URLEncoder.encode(text, "UTF-8");
                h = (HttpURLConnection) new URL(url).openConnection();
                h.setInstanceFollowRedirects(true);
                h.setConnectTimeout(20000); h.setReadTimeout(30000);
                h.setRequestMethod("POST"); h.setDoOutput(true);
                h.setRequestProperty("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
                try (OutputStream o = h.getOutputStream()) { o.write(body.getBytes(StandardCharsets.UTF_8)); }
                int code = h.getResponseCode();
                if (code >= 200 && code < 400) {
                    try (InputStream in = h.getInputStream()) { byte[] b = new byte[512]; int n = in.read(b);
                        String s = n > 0 ? new String(b, 0, n, StandardCharsets.UTF_8) : "";
                        if (s.toLowerCase().contains("bad token") || s.toLowerCase().contains("unauthor")) return "the Inbox refused the TOKEN";
                    } catch (Exception e) { /* no body is fine */ }
                    return null;
                }
                return "HTTP " + code;
            } catch (Exception e) {
                return e.getClass().getSimpleName() + (e.getMessage() == null ? "" : ": " + e.getMessage());
            } finally { if (h != null) h.disconnect(); }
        }
    }
}
