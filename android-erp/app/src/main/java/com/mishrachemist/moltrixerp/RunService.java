package com.mishrachemist.moltrixerp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/**
 * Keeps the app alive while an ERP entry runs: a foreground service (a notification shows the progress)
 * and a CPU wake lock, so the run goes on with the screen locked or another app in front.
 */
public class RunService extends Service {
    static final String CH_RUN = "run", CH_DONE = "done";
    static final int ID_RUN = 1, ID_DONE = 2;
    private PowerManager.WakeLock wl;

    static void start(Context c, String text) {
        Intent i = new Intent(c, RunService.class).putExtra("text", text);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    static void stop(Context c) { c.stopService(new Intent(c, RunService.class)); }

    /** progress line in the running notification */
    static void update(Context c, String text) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(ID_RUN, build(c, CH_RUN, "Moltrix ERP - entry chal rahi hai", text, true));
    }

    /** result when the run ends (stays after the service stops) */
    static void done(Context c, String title, String text) {
        channels(c);
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(ID_DONE, build(c, CH_DONE, title, text, false));
    }

    private static void channels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null || Build.VERSION.SDK_INT < 26) return;
        nm.createNotificationChannel(new NotificationChannel(CH_RUN, "ERP entry running", NotificationManager.IMPORTANCE_LOW));
        nm.createNotificationChannel(new NotificationChannel(CH_DONE, "ERP entry result", NotificationManager.IMPORTANCE_DEFAULT));
    }

    private static Notification build(Context c, String ch, String title, String text, boolean ongoing) {
        PendingIntent pi = PendingIntent.getActivity(c, 0,
                new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, ch) : new Notification.Builder(c);
        return b.setSmallIcon(ongoing ? android.R.drawable.stat_notify_sync : android.R.drawable.stat_sys_upload_done)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(pi)
                .setOngoing(ongoing)
                .setOnlyAlertOnce(true)
                .setAutoCancel(!ongoing)
                .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        channels(this);
        String text = intent != null && intent.getStringExtra("text") != null ? intent.getStringExtra("text") : "shuru…";
        Notification n = build(this, CH_RUN, "Moltrix ERP - entry chal rahi hai", text, true);
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID_RUN, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(ID_RUN, n);
        if (wl == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MoltrixERP:run");
            wl.setReferenceCounted(false);
            wl.acquire(3 * 60 * 60 * 1000L);   // 3 h at most
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (wl != null && wl.isHeld()) wl.release();
        wl = null;
        stopForeground(true);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
