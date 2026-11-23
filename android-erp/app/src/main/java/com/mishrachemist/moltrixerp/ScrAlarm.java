package com.mishrachemist.moltrixerp;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.Calendar;

/**
 * Background Screener (F&O → Screener → Background scan): wakes ScrService for one scan at every
 * 15-minute slot from 09:30 to 14:45 IST on weekdays (exact alarm, so Android lets it start the
 * foreground service). Each alarm books the next slot; also booked again after the phone restarts.
 */
public class ScrAlarm extends BroadcastReceiver {
    static final int FIRST_MIN = 9 * 60 + 30, LAST_MIN = 14 * 60 + 45, STEP_MIN = 15;

    static boolean on(Context c) { return MoltrixActivity.prefs(c).getBoolean("scrBgOn", false); }

    private static PendingIntent pi(Context c) {
        return PendingIntent.getBroadcast(c, 78, new Intent(c, ScrAlarm.class).setAction("com.mishrachemist.moltrixerp.SCR"),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** the next slot strictly after now (weekdays, 09:30 … 14:45 every 15 min) */
    static long next() {
        Calendar now = Calendar.getInstance(GammaService.IST);
        Calendar t = (Calendar) now.clone();
        t.set(Calendar.SECOND, 0); t.set(Calendar.MILLISECOND, 0);
        int m = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE) + 1;
        int slot = m <= FIRST_MIN ? FIRST_MIN : FIRST_MIN + ((m - FIRST_MIN + STEP_MIN - 1) / STEP_MIN) * STEP_MIN;
        if (slot > LAST_MIN) { t.add(Calendar.DAY_OF_MONTH, 1); slot = FIRST_MIN; }
        t.set(Calendar.HOUR_OF_DAY, slot / 60); t.set(Calendar.MINUTE, slot % 60);
        while (t.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY || t.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY) {
            t.add(Calendar.DAY_OF_MONTH, 1); t.set(Calendar.HOUR_OF_DAY, FIRST_MIN / 60); t.set(Calendar.MINUTE, FIRST_MIN % 60);
        }
        return t.getTimeInMillis();
    }

    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        if (!on(c)) { am.cancel(pi(c)); return; }
        long when = next();
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
        schedule(c);   // book the next slot first, so one failed scan never stops the chain
        try { ScrService.start(c); }
        catch (Exception e) {   // Android refused to start it from the background
            MoltrixActivity.prefs(c).edit().putString("scrStatus", GammaService.hm(System.currentTimeMillis()) + " · Android did not allow the scan - open Moltrix once").apply();
        }
    }
}
