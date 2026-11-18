// התראות דחיפה (OneSignal)
try{importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js')}catch(e){}
// אשריכם ישראל – עבודה גם בלי אינטרנט. תמיד מנסה קודם את הגרסה החדשה מהרשת.
const C='ashreichem-v103';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./favicon.png','./learning.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>{swClear();return self.clients.claim()}))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
});

// ניקוי התראות ומספר על האייקון – גם מתוך ה-Service Worker עצמו
function swClear(){try{self.registration.getNotifications().then(ns=>ns.forEach(n=>n.close()))}catch(e){}try{self.navigator.clearAppBadge&&self.navigator.clearAppBadge().catch(()=>{})}catch(e){}}
self.addEventListener('message',e=>{if(e.data&&e.data.t==='clear')swClear()});
