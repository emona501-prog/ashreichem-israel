/*  ממסר התראות – אשריכם ישראל
    מדביקים ב-script.google.com ← פרויקט חדש, ממלאים את המפתח למטה,
    ופורסים: Deploy ← New deployment ← Web app ← Execute as: Me ← Who has access: Anyone
    את הכתובת שמתקבלת (מסתיימת ב-/exec) מדביקים בלוח הניהול באפליקציה.
    עדכון גרסה: Deploy ← Manage deployments ← ✏️ ← Version: New version ← Deploy (הכתובת נשארת אותה כתובת). */

const OS_KEY = 'הדביקו_כאן_את_ה-REST_API_KEY_מ-OneSignal';   // נשאר פרטי אצלכם בלבד
const APP_ID = '8adb46b8-0320-45d3-a852-bf0ae8d0e0fb';
const APP_URL = 'https://emona501-prog.github.io/ashreichem-israel/';

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!['inbox', 'req', 'test', 'rem', 'cancel'].includes(d.kind)) return out({ err: 'bad' });
    const c = CacheService.getScriptCache();

    // ביטול תזכורת מתוזמנת
    if (d.kind === 'cancel') {
      if (!/^[\w-]{10,64}$/.test(String(d.id || ''))) return out({ err: 'id' });
      UrlFetchApp.fetch('https://api.onesignal.com/notifications/' + d.id + '?app_id=' + APP_ID,
        { method: 'delete', muteHttpExceptions: true, headers: { Authorization: 'Key ' + OS_KEY } });
      return out({ ok: 1 });
    }

    const title = String(d.title || 'אשריכם ישראל').slice(0, 80);
    const body = String(d.body || '').slice(0, 160) || 'לחצו לצפייה';
    const msg = { app_id: APP_ID, headings: { en: title, he: title }, contents: { en: body, he: body }, url: APP_URL };

    if (d.kind === 'rem') {
      // תזכורת אישית למכשיר אחד, בזמן שנקבע (עד 3 ימים קדימה)
      const sub = String(d.sub || ''), at = new Date(d.at);
      if (!/^[\w-]{20,64}$/.test(sub) || isNaN(at) || at - Date.now() > 3 * 864e5 || at < Date.now()) return out({ err: 'rem' });
      const k = 'r' + sub, n = +(c.get(k) || 0);            // עד 40 תזכורות למכשיר ביום
      if (n >= 40) return out({ err: 'limit' });
      c.put(k, String(n + 1), 21600);
      msg.include_subscription_ids = [sub];
      msg.send_after = at.toISOString();
    } else {
      // התראות למנהל – עד 30 ל-10 דקות
      const n = +(c.get('n') || 0);
      if (n >= 30) return out({ err: 'limit' });
      c.put('n', String(n + 1), 600);
      msg.filters = [{ field: 'tag', key: 'admin', relation: '=', value: '1' }];
    }
    const r = UrlFetchApp.fetch('https://api.onesignal.com/notifications', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Key ' + OS_KEY }, payload: JSON.stringify(msg)
    });
    const j = JSON.parse(r.getContentText() || '{}');
    return out({ code: r.getResponseCode(), id: j.id || '' });
  } catch (err) { return out({ err: String(err) }); }
}
function doGet() { return out({ ok: 'הממסר פעיל' }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
