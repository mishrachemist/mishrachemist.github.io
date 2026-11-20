package com.mishrachemist.moltrixerp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.Calendar;

/**
 * Wakes the gamma watch at 10:58 IST on the next weekday (exact alarm, so Android lets it start the
 * foreground service). Also books the alarm again after the phone restarts.
 */
public class GammaAlarm extends BroadcastReceiver {
    static boolean on(Context c) { return MoltrixActivity.prefs(c).getBoolean("gwOn", false); }

    private static PendingIntent pi(Context c) {
        return PendingIntent.getBroadcast(c, 77, new Intent(c, GammaAlarm.class).setAction("com.mishrachemist.moltrixerp.GAMMA"),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        if (!on(c)) { am.cancel(pi(c)); return; }
        Calendar t = Calendar.getInstance(GammaService.IST);
        Calendar now = (Calendar) t.clone();
        t.set(Calendar.HOUR_OF_DAY, 10); t.set(Calendar.MINUTE, 58); t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
        if (!t.after(now)) t.add(Calendar.DAY_OF_MONTH, 1);
        while (t.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY || t.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) t.add(Calendar.DAY_OF_MONTH, 1);
        long when = t.getTimeInMillis();
        if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi(c));
        else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi(c));
    }

    static void cancel(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pi(c));
    }

    @Override
    public void onReceive(Context c, Intent i) {
        String a = i == null ? null : i.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) { schedule(c); return; }
        if (!on(c)) return;
        try { GammaService.start(c); }
        catch (Exception e) {   // Android refused to start it from the background: ask the person to open the app
            MoltrixActivity.notifyNow(c, GammaService.CH_HIT, "Gamma alerts", 3101, "⚡ Gamma watch", "Open Moltrix to start today's gamma watch.", null);
            schedule(c);
        }
    }
}
