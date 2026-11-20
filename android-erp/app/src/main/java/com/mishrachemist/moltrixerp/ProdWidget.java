package com.mishrachemist.moltrixerp;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** A · Production: today's billet MT and heats (wide: + month; large: + last 7 days) */
public class ProdWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) Widgets.update(c, m, id, Widgets::prod); }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { Widgets.update(c, m, id, Widgets::prod); }
}
