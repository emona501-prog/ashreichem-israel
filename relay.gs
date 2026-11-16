/*  ממסר התראות למנהל – אשריכם ישראל
    מדביקים ב-script.google.com ← פרויקט חדש, ממלאים את המפתח למטה,
    ופורסים: Deploy ← New deployment ← Web app ← Execute as: Me ← Who has access: Anyone
    את הכתובת שמתקבלת (מסתיימת ב-/exec) מדביקים בלוח הניהול באפליקציה.            */

const OS_KEY = 'הדביקו_כאן_את_ה-REST_API_KEY_מ-OneSignal';   // נשאר פרטי אצלכם בלבד
const APP_ID = '8adb46b8-0320-45d3-a852-bf0ae8d0e0fb';
const APP_URL = 'https://emona501-prog.github.io/ashreichem-israel/';

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!['inbox', 'req', 'test'].includes(d.kind)) return out('bad');
    // הגנה מהצפה: עד 30 התראות ל-10 דקות
    const c = CacheService.getScriptCache(), n = +(c.get('n') || 0);
    if (n >= 30) return out('limit');
    c.put('n', String(n + 1), 600);
    const title = String(d.title || 'אשריכם ישראל').slice(0, 80);
    const body = String(d.body || '').slice(0, 160) || 'לחצו לצפייה';
    const r = UrlFetchApp.fetch('https://api.onesignal.com/notifications', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Key ' + OS_KEY },
      payload: JSON.stringify({
        app_id: APP_ID,
        filters: [{ field: 'tag', key: 'admin', relation: '=', value: '1' }],
        headings: { en: title, he: title }, contents: { en: body, he: body },
        url: APP_URL
      })
    });
    return out(r.getResponseCode() + ' ' + r.getContentText());
  } catch (err) { return out('err ' + err); }
}
function doGet() { return out('ok – הממסר פעיל'); }
function out(t) { return ContentService.createTextOutput(t); }
