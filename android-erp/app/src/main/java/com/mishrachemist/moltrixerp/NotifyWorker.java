package com.mishrachemist.moltrixerp;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

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
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Every 15 minutes - the shortest Android allows (also with Moltrix closed): reads the cloud WhatsApp sync's latest news and shows it as a Moltrix notification.
 * The news file is on GitHub, encrypted (AES-256-GCM) with a key that only this phone and the user's OneDrive know,
 * so nobody else can read it. Format: base64( 12-byte IV | ciphertext+tag ) of {"id": ms, "title": "...", "body": "..."}.
 */
public class NotifyWorker extends Worker {
    static final String URL_NEWS = "https://github.com/mishrachemist/mishrachemist.github.io/releases/download/moltrix-notify/n.bin";
    static final String NAME = "moltrix-notify";
    static final long MAX_AGE_MS = 6L * 3600 * 1000;      // older news is not shown any more

    public NotifyWorker(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    static void schedule(Context c) {
        Constraints k = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest r = new PeriodicWorkRequest.Builder(NotifyWorker.class, 15, TimeUnit.MINUTES).setConstraints(k).build();
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, r);
    }

    static void checkNow(Context c) {
        Constraints k = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager.getInstance(c).enqueueUniqueWork(NAME + "-now", ExistingWorkPolicy.REPLACE,
            new OneTimeWorkRequest.Builder(NotifyWorker.class).setConstraints(k).build());
    }

    static void cancel(Context c) {
        WorkManager.getInstance(c).cancelUniqueWork(NAME);
        WorkManager.getInstance(c).cancelUniqueWork(NAME + "-now");
    }

    @NonNull
    @Override
    public Result doWork() {
        Context c = getApplicationContext();
        SharedPreferences p = MoltrixActivity.prefs(c);
        String key = p.getString("nkey", "");
        if (!p.getBoolean("notify", false) || key.isEmpty()) return Result.success();
        try {
            HttpURLConnection h = (HttpURLConnection) new URL(URL_NEWS + "?t=" + System.currentTimeMillis()).openConnection();
            h.setConnectTimeout(20000); h.setReadTimeout(20000);
            h.setInstanceFollowRedirects(true);
            h.setUseCaches(false);
            int code = h.getResponseCode();
            if (code == 404) return Result.success();          // nothing sent yet
            if (code != 200) return Result.retry();
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            try (InputStream in = h.getInputStream()) { byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n); }
            byte[] all = Base64.decode(new String(o.toByteArray(), StandardCharsets.US_ASCII).trim(), Base64.DEFAULT);
            if (all.length < 29) return Result.success();
            Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
            ci.init(Cipher.DECRYPT_MODE, new SecretKeySpec(Base64.decode(key, Base64.DEFAULT), "AES"), new GCMParameterSpec(128, Arrays.copyOfRange(all, 0, 12)));
            JSONObject j = new JSONObject(new String(ci.doFinal(all, 12, all.length - 12), StandardCharsets.UTF_8));
            JSONObject w = j.optJSONObject("w");                     // production snapshot for the home-screen widget
            if (w != null) Widgets.set(c, "prod", w.toString());
            long id = j.optLong("id", 0), last = p.getLong("lastNewsId", 0);
            if (id <= last) return Result.success();
            p.edit().putLong("lastNewsId", id).apply();
            if (System.currentTimeMillis() - id > MAX_AGE_MS) return Result.success();
            MoltrixActivity.notifyNow(c, "sync", "WhatsApp sync", 7101, j.optString("title", "Moltrix"), j.optString("body", ""), null);
            return Result.success();
        } catch (javax.crypto.AEADBadTagException e) {
            return Result.success();                           // made with another key (notifications switched on again elsewhere)
        } catch (Exception e) {
            return Result.retry();
        }
    }
}
