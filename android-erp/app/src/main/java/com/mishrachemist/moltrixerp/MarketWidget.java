package com.mishrachemist.moltrixerp;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** B · Market: NIFTY (wide: + BANKNIFTY; large: 4 indices, VIX, Screener BUYs). Prices refresh every 15 min (WidgetWorker). */
public class MarketWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        for (int id : ids) Widgets.update(c, m, id, Widgets::market);
        WidgetWorker.schedule(c);
    }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { Widgets.update(c, m, id, Widgets::market); }
    @Override public void onEnabled(Context c) { WidgetWorker.schedule(c); WidgetWorker.now(c); }
    @Override public void onDisabled(Context c) { WidgetWorker.cancel(c); }
}
