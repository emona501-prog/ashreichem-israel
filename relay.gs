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
    if (!['inbox', 'req', 'test', 'rem', 'cancel', 'mny', 'ad', 'live', 'liveq'].includes(d.kind)) return out({ err: 'bad' });
    const c = CacheService.getScriptCache();

    // ביטול תזכורת מתוזמנת
    if (d.kind === 'cancel') {
      if (!/^[\w-]{10,64}$/.test(String(d.id || ''))) return out({ err: 'id' });
      UrlFetchApp.fetch('https://api.onesignal.com/notifications/' + d.id + '?app_id=' + APP_ID,
        { method: 'delete', muteHttpExceptions: true, headers: { Authorization: 'Key ' + OS_KEY } });
      return out({ ok: 1 });
    }

    // מניין מתארגן – התראה לכל המשתמשים. הנוסח נבנה כאן מתוך המאגר (לא מהטלפון), כדי שאי אפשר יהיה לנצל
    if (d.kind === 'mny') return out(mnyPush(String(d.id || ''), c));

    // מודעה – התראה לכל המשתמשים. רק המנהל יכול לסמן pushReq במודעה (לפי כללי המאגר), והנוסח נלקח מהמודעה עצמה
    if (d.kind === 'ad') return out(adPush(String(d.id || ''), c));

    // דיווח חי ממניין – למי שסימן ⭐ את בית הכנסת ולא ביטל דיווחים
    if (d.kind === 'live') return out(livePush(String(d.id || ''), c));
    if (d.kind === 'liveq') return out(liveQPush(String(d.id || ''), c));

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
const FS = 'https://firestore.googleapis.com/v1/projects/ashreichem-israel/databases/(default)/documents/';
function fsVal(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return +v.integerValue;
  if (v.doubleValue !== undefined) return +v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fsVal);
  if (v.mapValue) { const o = {}, f = v.mapValue.fields || {}; Object.keys(f).forEach(k => o[k] = fsVal(f[k])); return o; }
  return null;
}
function fsGet(path) {
  const r = UrlFetchApp.fetch(FS + path, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  const f = (JSON.parse(r.getContentText()).fields) || {}, o = {};
  Object.keys(f).forEach(k => o[k] = fsVal(f[k]));
  return o;
}
function mnyPush(id, c) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return { err: 'id' };
  if (c.get('m' + id)) return { err: 'dup' };                       // כל מניין – התראה אחת בלבד
  const m = fsGet('minyanim/' + id); if (!m) return { err: 'nf' };
  const now = Date.now();
  if (m.cx || !(m.at > now - 10 * 6e4 && m.at < now + 36 * 36e5) || !(m.cr > now - 30 * 6e4)) return { err: 'old' };
  const h = +(c.get('mh') || 0); if (h >= 8) return { err: 'limit' };      // עד 8 מניינים בשעה
  const ku = 'mu' + m.uid, u = +(c.get(ku) || 0); if (u >= 3) return { err: 'limit' };  // עד 3 ליום לכל מארגן
  c.put('m' + id, '1', 86400); c.put('mh', String(h + 1), 3600); c.put(ku, String(u + 1), 86400);
  let pl = String(m.place || '');
  if (m.sid) { const s = fsGet('shuls/' + m.sid); if (s && s.name) pl = String(s.name).split(/ [–-] /)[0]; }
  const t = Utilities.formatDate(new Date(m.at), 'Asia/Jerusalem', 'HH:mm');
  const day = Utilities.formatDate(new Date(m.at), 'Asia/Jerusalem', 'yyyyMMdd') === Utilities.formatDate(new Date(), 'Asia/Jerusalem', 'yyyyMMdd') ? 'היום' : 'מחר';
  const n = Object.keys(m.j || {}).length || 1;
  const title = ('🙋 מתארגן מניין – ' + String(m.t || 'תפילה')).slice(0, 80);
  const body = (day + ' ב-' + t + (pl ? ' · ' + pl : '') + ' · חסרים עוד ' + Math.max(1, 10 - n) + ' – לחצו להצטרף').slice(0, 160);
  const msg = { app_id: APP_ID, headings: { en: title, he: title }, contents: { en: body, he: body }, url: APP_URL + '?m=' + id,
    filters: [{ field: 'tag', key: 'nomny', relation: 'not_exists' }], ttl: Math.max(600, Math.round((m.at - now) / 1000) + 600) };
  const r = UrlFetchApp.fetch('https://api.onesignal.com/notifications', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Key ' + OS_KEY }, payload: JSON.stringify(msg) });
  const j = JSON.parse(r.getContentText() || '{}');
  return { code: r.getResponseCode(), id: j.id || '' };
}
function livePush(id, c) {
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(id)) return { err: 'id' };
  const v = fsGet('live/' + id); if (!v) return { err: 'nf' };
  const now = Date.now(); if (!(+v.at > now - 3 * 6e4)) return { err: 'old' };
  const L = {"wait": "⏳ עוד לא התחילו", "late": "🕐 מתעכבים", "soon": "🕒 מתחילים בעוד כמה דקות", "start": "▶️ התחילו עכשיו", "pzd": "🎶 בפסוקי דזמרה", "shma": "📖 בקריאת שמע", "amida": "🧍 בעמידה", "torah": "📜 בקריאת התורה", "end": "✅ סיימו", "nomin": "⚠️ חסרים למניין"}[v.st]; if (!L) return { err: 'st' };
  const kd = 'l' + id + '_' + v.st; if (c.get(kd)) return { err: 'dup' };
  const kc = 'lc' + id, n = +(c.get(kc) || 0); if (n >= 4) return { err: 'limit' };             // עד 4 התראות לכל מניין ביום
  const kh = 'lh', h = +(c.get(kh) || 0); if (h >= 30) return { err: 'limit' };                // עד 30 בשעה בכל האפליקציה
  const ku = 'lu' + v.uid, u = +(c.get(ku) || 0); if (u >= 6) return { err: 'limit' };         // עד 6 לכל משתמש ביום
  c.put(kd, '1', 3 * 3600); c.put(kc, String(n + 1), 86400); c.put(kh, String(h + 1), 3600); c.put(ku, String(u + 1), 86400);
  const s = fsGet('shuls/' + v.sid) || {}; const nm = String(s.name || 'בית הכנסת').split(/ [–-] /)[0];
  const p = (s.prayers || []).find(function (x) { return x && x.id === v.pid; }) || {};
  const title = ('🔴 דיווח חי · ' + nm).slice(0, 80);
  const body = ((p.t ? p.t + ' ' + (p.tm || '') + ': ' : '') + L + ' (דווח ע״י מתפלל)').slice(0, 160);
  const msg = { app_id: APP_ID, headings: { en: title, he: title }, contents: { en: body, he: body }, url: APP_URL,
    filters: [{ field: 'tag', key: 'f_' + v.sid, relation: '=', value: '1' }, { field: 'tag', key: 'nolive', relation: 'not_exists' }], ttl: 1800 };
  if (v.qsub && +v.qat && +v.at > +v.qat && +v.at - +v.qat < 30 * 6e4 && !c.get('qa' + id + v.qat)) {   // תשובה למי ששאל
    c.put('qa' + id + v.qat, '1', 3600);
    const t2 = ('💬 ענו לשאלה שלך · ' + nm).slice(0, 80), b2 = ((p.t ? p.t + ' ' + (p.tm || '') + ': ' : '') + L).slice(0, 160);
    UrlFetchApp.fetch('https://api.onesignal.com/notifications', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Key ' + OS_KEY }, payload: JSON.stringify({ app_id: APP_ID, headings: { en: t2, he: t2 }, contents: { en: b2, he: b2 }, url: APP_URL, include_subscription_ids: [String(v.qsub)], ttl: 1800 }) });
  }
  const r = UrlFetchApp.fetch('https://api.onesignal.com/notifications', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Key ' + OS_KEY }, payload: JSON.stringify(msg) });
  const j = JSON.parse(r.getContentText() || '{}');
  return { code: r.getResponseCode(), id: j.id || '' };
}
function liveQPush(id, c) {
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(id)) return { err: 'id' };
  const v = fsGet('live/' + id); if (!v || !v.q) return { err: 'nf' };
  const now = Date.now(); if (!(+v.qat > now - 3 * 6e4)) return { err: 'old' };
  const kd = 'q' + id + '_' + v.qat; if (c.get(kd)) return { err: 'dup' };
  const kc = 'qc' + id, n = +(c.get(kc) || 0); if (n >= 3) return { err: 'limit' };             // עד 3 שאלות לכל מניין ביום
  const kh = 'lh', h = +(c.get(kh) || 0); if (h >= 30) return { err: 'limit' };
  c.put(kd, '1', 3600); c.put(kc, String(n + 1), 86400); c.put(kh, String(h + 1), 3600);
  const s = fsGet('shuls/' + v.sid) || {}; const nm = String(s.name || 'בית הכנסת').split(/ [–-] /)[0];
  const p = (s.prayers || []).find(function (x) { return x && x.id === v.pid; }) || {};
  const title = ('❓ שאלה למתפללי ' + nm).slice(0, 80);
  const body = ((p.t ? p.t + ' ' + (p.tm || '') + ': ' : '') + String(v.q).slice(0, 40) + ' – אתם שם? לחצו לענות').slice(0, 160);
  const msg = { app_id: APP_ID, headings: { en: title, he: title }, contents: { en: body, he: body }, url: APP_URL,
    filters: [{ field: 'tag', key: 'f_' + v.sid, relation: '=', value: '1' }, { field: 'tag', key: 'nolive', relation: 'not_exists' }], ttl: 1200 };
  const r = UrlFetchApp.fetch('https://api.onesignal.com/notifications', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Key ' + OS_KEY }, payload: JSON.stringify(msg) });
  const j = JSON.parse(r.getContentText() || '{}');
  return { code: r.getResponseCode(), id: j.id || '' };
}
function adPush(id, c) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return { err: 'id' };
  const a = fsGet('ads/' + id); if (!a || a.st !== 'ok') return { err: 'nf' };
  const now = Date.now(), rq = +a.pushReq || 0;
  if (!(rq > now - 10 * 6e4 && rq <= now + 6e4)) return { err: 'old' };            // רק בקשה טרייה מהמנהל
  if (c.get('a' + id + '_' + rq)) return { err: 'dup' };
  const dn = +(c.get('ad') || 0); if (dn >= 6) return { err: 'limit' };              // עד 6 התראות מודעה ביום
  c.put('a' + id + '_' + rq, '1', 21600); c.put('ad', String(dn + 1), 86400);
  const title = ('📢 ' + String(a.title || 'מודעה חדשה')).slice(0, 80);
  const body = (String(a.text || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'לחצו לצפייה במודעה');
  const msg = { app_id: APP_ID, headings: { en: title, he: title }, contents: { en: body, he: body }, url: APP_URL + '?ad=' + id,
    included_segments: ['Total Subscriptions'], ttl: 86400 };
  const r = UrlFetchApp.fetch('https://api.onesignal.com/notifications', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Key ' + OS_KEY }, payload: JSON.stringify(msg) });
  const j = JSON.parse(r.getContentText() || '{}');
  return { code: r.getResponseCode(), id: j.id || '' };
}
function doGet() { return out({ ok: 'הממסר פעיל' }); }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
