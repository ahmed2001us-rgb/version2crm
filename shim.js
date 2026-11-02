/* Fallback used ONLY if dexie.min.js is not next to this file. Same database name, stores and indexes as Dexie,
   so data is identical and real Dexie can open it later. */
if(typeof Dexie=='undefined'){window.Dexie=class{
constructor(n){this.name=n;this.vs=[];this.verno=0}
version(v){const o={v,s:{},up:null};this.vs.push(o);this.verno=Math.max(this.verno,v);return{stores(s){Object.assign(o.s,s);return this},upgrade(f){o.up=f;return this}}}
open(){return new Promise((ok,no)=>{const all={};this.vs.sort((a,b)=>a.v-b.v).forEach(o=>Object.assign(all,o.s));const r=indexedDB.open(this.name,this.verno*10);
r.onupgradeneeded=e=>{const d=r.result,tx=r.transaction;for(const[n,sc]of Object.entries(all)){const[pk,...ix]=sc.split(',').map(x=>x.trim()),st=d.objectStoreNames.contains(n)?tx.objectStore(n):d.createObjectStore(n,{keyPath:pk});ix.forEach(i=>{if(i&&!st.indexNames.contains(i))st.createIndex(i,i)})}
const wrap={table:n=>({toCollection:()=>({modify:f=>new Promise(res=>{tx.objectStore(n).openCursor().onsuccess=ev=>{const c=ev.target.result;if(c){const v=c.value;f(v);c.update(v);c.continue()}else res()}})})})};
this.vs.forEach(o=>{if(o.up&&e.oldVersion>0&&e.oldVersion<o.v*10)o.up(wrap)})};
r.onsuccess=()=>{this.db=r.result;ok(this)};r.onerror=()=>no(r.error)})}
table(n){const me=this,rq=(m,f)=>new Promise((ok,no)=>{const t=me.db.transaction(n,m),q=f(t.objectStore(n));t.oncomplete=()=>ok(q.result);t.onerror=t.onabort=()=>no(t.error)});
return{toArray:()=>rq('readonly',s=>s.getAll()),get:k=>rq('readonly',s=>s.get(k)),put:o=>rq('readwrite',s=>s.put(o)),delete:k=>rq('readwrite',s=>s.delete(k)),clear:()=>rq('readwrite',s=>s.clear())}}}}
