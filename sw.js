/* Rep CRM service worker. All paths are RELATIVE so it works under /<repo-name>/ on GitHub Pages.
   To publish an update: change VERSION below, then upload the files again. */
const VERSION='repcrm-v6';
const ASSETS=['./','./index.html','./app.js','./shim.js','./vendor/dexie.min.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./selftest.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(c=>Promise.all(ASSETS.map(a=>c.add(a).catch(()=>console.warn('not cached:',a))))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==VERSION).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(caches.match(r,{ignoreSearch:true}).then(hit=>{
    const net=fetch(r).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(VERSION).then(c=>c.put(r,cp))}return res}).catch(()=>null);
    if(hit){try{e.waitUntil(net)}catch(_){}return hit}            // cache first, refresh in background
    return net.then(res=>res||(r.mode==='navigate'?caches.match('./index.html'):Response.error()));
  }));
});
