/* Rep CRM service worker. Relative paths only (works under /<repo>/ on GitHub Pages).
   Strategy: network-first (always the newest files when online), cache fallback (works fully offline). */
const VERSION='repcrm-v12';
const ASSETS=['./','./index.html','./app.js','./shim.js','./vendor/dexie.min.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./selftest.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(c=>Promise.all(ASSETS.map(a=>c.add(new Request(a,{cache:'reload'})).catch(()=>console.warn('not cached:',a))))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==VERSION).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
const fresh=r=>new Promise((ok,no)=>{const t=setTimeout(()=>no('timeout'),6000);fetch(r,{cache:'no-cache'}).then(x=>{clearTimeout(t);ok(x)},e=>{clearTimeout(t);no(e)})});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fresh(r).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(VERSION).then(c=>c.put(r,cp))}return res})
    .catch(()=>caches.match(r,{ignoreSearch:true}).then(h=>h||(r.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>l.length?l[0].focus():clients.openWindow('./')))});
