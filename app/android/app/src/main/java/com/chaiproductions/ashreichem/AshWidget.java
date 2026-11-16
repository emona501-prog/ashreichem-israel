package com.chaiproductions.ashreichem;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/** ווידג'ט "אשריכם ישראל – המניין הקרוב": שחרית / מנחה / ערבית הקרובים באזור, ספירה לאחור, זמני היום ושבת.
 *  האפליקציה שולחת נתונים ליומיים קדימה, כך שהווידג'ט ממשיך להתעדכן לבד גם בלי לפתוח אותה.
 *  שלושה גדלים – קטן, בינוני וגדול – לפי הגודל שקובעים במסך הבית. */
public class AshWidget extends AppWidgetProvider {
    public static final String PREFS = "ash_widget";
    public static final String TICK = "com.chaiproductions.ashreichem.WIDGET_TICK";
    static final String[] TYPES = { "שחרית", "מנחה", "ערבית" };
    static final String[] DAYN = { "ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת" };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) updateOne(ctx, mgr, id);
        scheduleNext(ctx);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle opts) {
        updateOne(ctx, mgr, id);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent.getAction();
        if (TICK.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) updateAll(ctx);
    }

    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, AshWidget.class));
        for (int id : ids) updateOne(ctx, mgr, id);
        if (ids.length > 0) scheduleNext(ctx);
    }

    private static PendingIntent act(Context ctx, String a, int req) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction("bp.w." + a);
        i.putExtra("wact", a);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static JSONObject data(Context ctx) {
        try {
            String s = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", "");
            if (s == null || s.isEmpty()) return null;
            return new JSONObject(s);
        } catch (Exception e) { return null; }
    }

    private static String hm(long t) { return new SimpleDateFormat("HH:mm", Locale.US).format(new Date(t)); }

    private static long dayStart(long t) {
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(t);
        c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static String dayLabel(long t, long now) {
        long d = Math.round((dayStart(t) - dayStart(now)) / 86400000.0);
        if (d <= 0) return "היום";
        if (d == 1) return "מחר";
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(t);
        return "יום " + DAYN[c.get(Calendar.DAY_OF_WEEK) - 1];
    }

    /** התפילה הקרובה מסוג מסוים (מתחשבים בתפילה שהתחילה לפני רגע) */
    private static JSONObject nextOf(JSONArray pr, String type, long now) throws Exception {
        if (pr == null) return null;
        for (int k = 0; k < pr.length(); k++) {
            JSONObject p = pr.getJSONObject(k);
            if ((type == null || type.equals(p.optString("n"))) && p.optLong("t", 0) > now - 60000L) return p;
        }
        return null;
    }

    static void updateOne(Context ctx, AppWidgetManager mgr, int id) {
        int size = 1; // 0 קטן, 1 בינוני, 2 גדול
        try {
            Bundle o = mgr.getAppWidgetOptions(id);
            int h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110);
            int hmax = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, h);
            int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            int hh = Math.max(h, Math.min(hmax, h + 40));
            size = (hh < 100 || w < 200) ? 0 : (hh < 230 ? 1 : 2);
        } catch (Exception e) { }
        int layout = size == 0 ? R.layout.widget_small : (size == 1 ? R.layout.widget_medium : R.layout.widget_large);
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), layout);
        rv.setOnClickPendingIntent(R.id.w_root, act(ctx, "now", 1));
        long now = System.currentTimeMillis();
        JSONObject d = data(ctx);
        try {
            if (d == null) {
                rv.setTextViewText(R.id.w_heb, "אשריכם ישראל");
                rv.setTextViewText(R.id.w_zl, "פתחו את האפליקציה פעם אחת לטעינת הזמנים");
                rv.setViewVisibility(R.id.w_cd, View.GONE);
                mgr.updateAppWidget(id, rv);
                return;
            }
            // תאריך (מתחלף בחצות) ושבת / חג
            JSONArray days = d.optJSONArray("days");
            JSONObject day = null;
            if (days != null) for (int k = 0; k < days.length(); k++) { JSONObject x = days.getJSONObject(k); if (x.optLong("from", 0) <= now) day = x; }
            if (day == null && days != null && days.length() > 0) day = days.getJSONObject(0);
            rv.setTextViewText(R.id.w_heb, day != null ? day.optString("heb", "אשריכם ישראל") : "אשריכם ישראל");
            String tag = day != null ? day.optString("tag", "") : "";
            if (size > 0) { rv.setTextViewText(R.id.w_tag, tag); rv.setViewVisibility(R.id.w_tag, tag.isEmpty() ? View.GONE : View.VISIBLE); }

            JSONArray pr = d.optJSONArray("pr");
            // התפילה הקרובה מכולן + ספירה לאחור
            JSONObject nx = null;
            if (pr != null) for (int k = 0; k < pr.length(); k++) { JSONObject p = pr.getJSONObject(k); if (p.optLong("t", 0) > now) { nx = p; break; } }
            if (nx != null) {
                long t = nx.optLong("t");
                boolean today = dayStart(t) == dayStart(now);
                String when = today ? "" : " (" + dayLabel(t, now) + ")";
                if (size == 0) {
                    rv.setTextViewText(R.id.w_zl, nx.optString("n") + " · " + hm(t) + when);
                    rv.setTextViewText(R.id.w_sl, nx.optString("s"));
                } else {
                    rv.setTextViewText(R.id.w_zl, "🕍 הקרוב: " + nx.optString("n") + " " + hm(t) + when + " · " + nx.optString("s"));
                }
                if (t - now < 12L * 3600000L) {
                    rv.setViewVisibility(R.id.w_cd, View.VISIBLE);
                    rv.setChronometer(R.id.w_cd, SystemClock.elapsedRealtime() + (t - now), "בעוד %s", true);
                    rv.setChronometerCountDown(R.id.w_cd, true);
                } else rv.setViewVisibility(R.id.w_cd, View.GONE);
            } else {
                rv.setTextViewText(R.id.w_zl, "פתחו את האפליקציה לעדכון הזמנים");
                if (size == 0) rv.setTextViewText(R.id.w_sl, "");
                rv.setViewVisibility(R.id.w_cd, View.GONE);
            }

            if (size > 0) {
                rv.setOnClickPendingIntent(R.id.w_zrow, act(ctx, "now", 2));
                int[][] ids = {
                    { R.id.c1, R.id.p1_l, R.id.p1_t, R.id.p1_s, R.id.p1_d },
                    { R.id.c2, R.id.p2_l, R.id.p2_t, R.id.p2_s, R.id.p2_d },
                    { R.id.c3, R.id.p3_l, R.id.p3_t, R.id.p3_s, R.id.p3_d } };
                for (int k = 0; k < 3; k++) {
                    JSONObject p = nextOf(pr, TYPES[k], now);
                    rv.setTextViewText(ids[k][1], TYPES[k]);
                    if (p != null) {
                        long t = p.optLong("t");
                        rv.setTextViewText(ids[k][2], hm(t));
                        rv.setTextViewText(ids[k][3], p.optString("s"));
                        String dl = dayLabel(t, now);
                        if (t <= now) dl = "עכשיו";
                        rv.setTextViewText(ids[k][4], dl);
                        String sid = p.optString("id", "");
                        rv.setOnClickPendingIntent(ids[k][0], act(ctx, sid.matches("[A-Za-z0-9_-]+") ? "shul:" + sid : "now", 20 + k));
                    } else {
                        rv.setTextViewText(ids[k][2], "—"); rv.setTextViewText(ids[k][3], ""); rv.setTextViewText(ids[k][4], "");
                        rv.setOnClickPendingIntent(ids[k][0], act(ctx, "now", 20 + k));
                    }
                }

                // סרגל מתחלף: עוד מניינים, זמני היום הקרובים, שבת / חג
                List<String> tick = new ArrayList<>(); List<String> tAct = new ArrayList<>();
                if (nx != null && pr != null) {
                    StringBuilder more = new StringBuilder(); int c = 0;
                    for (int k = 0; k < pr.length() && c < 3; k++) {
                        JSONObject p = pr.getJSONObject(k); long t = p.optLong("t");
                        if (t > nx.optLong("t") && p.optString("n").equals(nx.optString("n")) && dayStart(t) == dayStart(nx.optLong("t"))) { more.append(c == 0 ? "" : " · ").append(hm(t)); c++; }
                    }
                    if (c > 0) { tick.add("עוד " + nx.optString("n") + ": " + more); tAct.add("now"); }
                }
                JSONArray zm = d.optJSONArray("zm");
                if (zm != null) { int c = 0; for (int k = 0; k < zm.length() && c < 3; k++) { JSONObject z = zm.getJSONObject(k); long t = z.optLong("t", 0); if (t > now) { tick.add("🕰️ " + z.optString("n") + " " + hm(t) + (dayStart(t) == dayStart(now) ? "" : " (" + dayLabel(t, now) + ")")); tAct.add("zmanim"); c++; } } }
                String shabLine = "";
                JSONObject sh = d.optJSONObject("shab");
                if (sh != null && sh.optLong("o", 0) > now && sh.optLong("c", 0) - now < 6L * 86400000L) {
                    shabLine = "🕯️ " + sh.optString("par", "שבת") + " · הדלקה " + hm(sh.optLong("c")) + " · צאת " + hm(sh.optLong("o"));
                    if (size == 1) { tick.add(shabLine); tAct.add("shabbat"); }
                }
                if (!tag.isEmpty() && size == 1 && shabLine.isEmpty()) { tick.add("✡️ " + tag); tAct.add("shabbat"); }
                if (tick.isEmpty()) { tick.add("✦ אשריכם ישראל – בתי הכנסת באזור"); tAct.add("shuls"); }
                rv.removeAllViews(R.id.w_flip);
                for (int k = 0; k < tick.size(); k++) {
                    RemoteViews it = new RemoteViews(ctx.getPackageName(), R.layout.widget_tick);
                    it.setTextViewText(R.id.w_tick_t, tick.get(k));
                    it.setOnClickPendingIntent(R.id.w_tick_t, act(ctx, tAct.get(k), 40 + k));
                    rv.addView(R.id.w_flip, it);
                }

                if (size == 2) {
                    // זמני היום (של היום הנוכחי)
                    JSONArray zd = d.optJSONArray("zd");
                    JSONArray zl = null;
                    if (zd != null) for (int k = 0; k < zd.length(); k++) { JSONObject x = zd.getJSONObject(k); if (x.optLong("from", 0) <= now) zl = x.optJSONArray("z"); }
                    int[][] zids = { { R.id.z1_l, R.id.z1_t }, { R.id.z2_l, R.id.z2_t }, { R.id.z3_l, R.id.z3_t }, { R.id.z4_l, R.id.z4_t }, { R.id.z5_l, R.id.z5_t } };
                    for (int k = 0; k < 5; k++) {
                        if (zl != null && k < zl.length()) {
                            JSONArray z = zl.getJSONArray(k);
                            long t = z.optLong(1, 0);
                            rv.setTextViewText(zids[k][0], z.optString(0));
                            rv.setTextViewText(zids[k][1], t > 0 ? hm(t) : "—");
                            rv.setTextColor(zids[k][1], t > 0 && t < now ? 0x99E3ECF7 : 0xFFF6EFDC);
                        } else { rv.setTextViewText(zids[k][0], ""); rv.setTextViewText(zids[k][1], ""); }
                    }
                    rv.setOnClickPendingIntent(R.id.w_zgrid, act(ctx, "zmanim", 5));
                    if (shabLine.isEmpty() && !tag.isEmpty()) shabLine = "✡️ " + tag;
                    rv.setTextViewText(R.id.w_shab, shabLine);
                    rv.setViewVisibility(R.id.w_shab, shabLine.isEmpty() ? View.GONE : View.VISIBLE);
                    rv.setOnClickPendingIntent(R.id.w_shab, act(ctx, "shabbat", 6));
                    rv.setOnClickPendingIntent(R.id.b_now, act(ctx, "shuls", 10));
                    rv.setOnClickPendingIntent(R.id.b_zm, act(ctx, "zmanim", 11));
                    rv.setOnClickPendingIntent(R.id.b_shab, act(ctx, "shabbat", 12));
                    rv.setOnClickPendingIntent(R.id.b_alon, act(ctx, "alonim", 13));
                }
            }
        } catch (Exception e) { }
        mgr.updateAppWidget(id, rv);
    }

    /** רענון בזמן הקרוב: אחרי שהתפילה / הזמן הבא עובר, בחצות, ולכל המאוחר בעוד חצי שעה */
    static void scheduleNext(Context ctx) {
        try {
            long now = System.currentTimeMillis(); long next = now + 30L * 60000L;
            JSONObject d = data(ctx);
            if (d != null) {
                for (String key : new String[] { "pr", "zm" }) {
                    JSONArray a = d.optJSONArray(key);
                    if (a != null) for (int k = 0; k < a.length(); k++) { long t = a.getJSONObject(k).optLong("t", 0) + (key.equals("pr") ? 60000L : 0); if (t > now + 5000) { next = Math.min(next, t + 3000); break; } }
                }
                JSONArray days = d.optJSONArray("days");
                if (days != null) for (int k = 0; k < days.length(); k++) { long t = days.getJSONObject(k).optLong("from", 0); if (t > now + 5000) { next = Math.min(next, t + 3000); break; } }
            }
            Intent i = new Intent(ctx, AshWidget.class); i.setAction(TICK);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 77, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am != null) am.setAndAllowWhileIdle(AlarmManager.RTC, next, pi);
        } catch (Exception e) { }
    }
}
