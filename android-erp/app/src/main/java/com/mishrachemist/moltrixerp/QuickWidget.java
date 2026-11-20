package com.mishrachemist.moltrixerp;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.os.Bundle;

/** C · Quick buttons: Fetch, Production Update, Reports, F&O … (large: a big Fetch button with the last sync) */
public class QuickWidget extends AppWidgetProvider {
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) Widgets.update(c, m, id, Widgets::quick); }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { Widgets.update(c, m, id, Widgets::quick); }
}
