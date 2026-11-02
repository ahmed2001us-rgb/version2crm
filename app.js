if(typeof Dexie=='undefined'){document.body.innerHTML='<p style="padding:20px">Missing file vendor/dexie.min.js. See README step 3.</p>';throw new Error('Dexie missing')}
/* ---------- DB: IndexedDB, one object store per table ---------- */
const D={doctors:[],pharmacies:[],links:[],visits:[],products:[],feedback:[],meta:[]},S=Object.keys(D);let M=null,view='dash';const F={};
const db=new Dexie('RepCRM');
db.version(1).stores({doctors:'id,name,cls',pharmacies:'id,name',links:'id,doctorId,pharmacyId',visits:'id,doctorId,date,status',meta:'id'});
db.version(2).stores({products:'id,name',feedback:'id,doctorId,visitId,productId,pharmacyId,date'}).upgrade(tx=>tx.table('visits').toCollection().modify(v=>{if(!v.productIds)v.productIds=[]}));
const ready=()=>db.open();
const load=()=>Promise.all(S.map(async s=>{D[s]=await db.table(s).toArray()}));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const werr=e=>{console.error(e);toast('Save failed: '+(e&&e.message||e))};
function put(s,o){if(!o.id)o.id=uid();const i=D[s].findIndex(x=>x.id==o.id);i<0?D[s].push(o):D[s][i]=o;db.table(s).put(o).catch(werr);return o}
function del(s,id){D[s]=D[s].filter(x=>x.id!=id);db.table(s).delete(id).catch(werr)}
/* ---------- helpers ---------- */
const $=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0'),iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),P=s=>new Date(s+'T12:00:00'),add=(s,n)=>{const d=P(s);d.setDate(d.getDate()+n);return iso(d)},T=()=>iso(new Date());
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAYS=['Sat','Sun','Mon','Tue','Wed','Thu','Fri'],DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const toast=m=>{const t=$('t');t.textContent=m;t.className='s';clearTimeout(toast.h);toast.h=setTimeout(()=>t.className='',1400)};
const doc=id=>D.doctors.find(d=>d.id==id),ph=id=>D.pharmacies.find(p=>p.id==id);
const set=()=>D.meta.find(m=>m.id=='settings')||{id:'settings',A:3,B:2,C:1};
const tgt=d=>({A:3,B:2,C:1})[d.cls]||0;
const mdone=d=>D.visits.filter(v=>v.doctorId==d.id&&v.status=='done'&&v.date.slice(0,7)==T().slice(0,7)).length;
const overdueV=()=>D.visits.filter(v=>v.status=='planned'&&v.date<T());
const palert=p=>{const r=[];if(p.avail=='Out'||p.avail=='Low')r.push('stock '+p.avail.toLowerCase());if(p.fbDate&&P(T())-P(p.fbDate)>30*864e5)r.push('feedback over 30 days old');return r};
const opts=(a,v,all)=>(all?`<option value="">${all}</option>`:'')+a.map(x=>{const[k,l]=Array.isArray(x)?x:[x,x];return `<option value="${esc(k)}" ${k==v?'selected':''}>${esc(l)}</option>`}).join('');
const areas=()=>[...new Set(D.doctors.flatMap(d=>[].concat(d.area||[])).filter(Boolean))].sort();
const calc=d=>{const p=+d.patients||0,n=[].concat(d.days||[]).length,t=(p>10?1:0)+(p>15?1:0)+(n>=3?1:0)+(d.kol?1:0)+(d.adopt=='High'?1:0);return Math.max(1,Math.min(5,t))};
const clsOf=d=>{const s=calc(d);return d.kol||s>=4?'A':s>=2?'B':'C'};
const sec=(t,a)=>`<h3>${t} (${a.length})</h3>`+(a.join('')||'<p class=mu>Nothing here</p>');
/* ---------- rows ---------- */
const vrow=v=>{const d=doc(v.doctorId)||{name:'?',cls:'',area:''},od=v.status=='planned'&&v.date<T();return `<div class=row data-a=dv data-id="${esc(v.id)}"><div><b>${esc(d.name)}</b> <span class="b ${d.cls}">${d.cls}</span><small>${v.date} ${esc(v.time)} · ${esc(d.area)}${v.outcome?' · '+esc(v.outcome):''}</small></div><div class=r><input type=date value="${v.date}" data-r="${esc(v.id)}" style="width:130px;padding:4px" title="Reschedule"><span class="b ${od?'bad':v.status}">${od?'overdue':v.status}</span></div></div>`};
const drow=d=>{const dn=mdone(d),t=tgt(d),od=D.visits.filter(v=>v.doctorId==d.id&&v.status=='planned'&&v.date<T()).length;return `<div class=row data-a=dd data-id="${esc(d.id)}"><div><b>${esc(d.name)}</b> <span class="b ${d.cls}">${d.cls}</span><small>${esc(d.specialty)} · ${esc(d.area)} · score ${d.score||'-'} · ${Math.max(0,t-dn)} left</small></div><div class=r><span class="b ${dn>=t?'done':'planned'}">${dn}/${t}</span><span class="b ${d.adopt=='Low'?'bad':'done'}">${esc(d.adopt)}</span>${od?`<span class="b bad">${od} overdue</span>`:''}<button class=sm data-a=nv data-id="${esc(d.id)}">+Visit</button></div></div>`};
const prow=p=>{const n=D.links.filter(l=>l.pharmacyId==p.id).length;return `<div class=row data-a=dp data-id="${esc(p.id)}"><div><b>${esc(p.name)}</b><small>${esc(p.pharmacist)} · ${esc(p.address)} · ${n} doctor${n==1?'':'s'}</small></div><div class=r><span class="b ${p.avail=='In stock'?'done':'bad'}">${esc(p.avail||'?')}</span><span class=b>${esc(p.demand||'')}</span></div></div>`};
/* ---------- views ---------- */
const VIEW={},LST={};let PL={m:'day',d:T()};
VIEW.dash=()=>{const t=T(),docs=D.doctors,tv=D.visits.filter(v=>v.date==t&&v.status=='planned'),od=overdueV(),dn=docs.reduce((s,d)=>s+mdone(d),0),tg=docs.reduce((s,d)=>s+tgt(d),0),fu=D.visits.filter(v=>v.status=='done'&&v.next&&!v.fdone),pa=D.pharmacies.map(p=>[p,palert(p)]).filter(x=>x[1].length),C=c=>docs.filter(d=>d.cls==c).length;
return remind()+`<div class=grid><div class=card><small>Doctors</small><h2>${docs.length}</h2><small>A ${C('A')} · B ${C('B')} · C ${C('C')}</small></div><div class=card><small>Visits this month</small><h2>${dn}/${tg}</h2><div class=bar><i style="width:${tg?Math.min(100,dn/tg*100):0}%"></i></div></div><div class=card><small>Today</small><h2>${tv.length}</h2></div><div class="card ${od.length?'warn':''}"><small>Overdue</small><h2>${od.length}</h2></div></div>`
+sec('Today’s visits',tv.map(vrow))+sec('Overdue visits',od.map(vrow))
+sec('Pending follow-ups',fu.map(v=>`<div class=row data-a=dv data-id="${esc(v.id)}"><div><b>${esc((doc(v.doctorId)||{}).name)}</b><small>${esc(v.next)}${v.nextDate?' · by '+v.nextDate:''}</small></div></div>`))
+sec('Low-adoption doctors',docs.filter(d=>d.adopt=='Low').map(drow))
+sec('Pharmacy alerts',pa.map(([p,r])=>`<div class=row data-a=dp data-id="${esc(p.id)}"><div><b>${esc(p.name)}</b><small>${r.join(', ')}</small></div></div>`))};
const planRange=()=>{const{m,d}=PL;if(m=='day')return[d,d];if(m=='week'){const a=add(d,-((P(d).getDay()+1)%7));return[a,add(a,6)]}const f=d.slice(0,7)+'-01',l=new Date(+d.slice(0,4),+d.slice(5,7),0);return[f,iso(l)]};
LST.plan=()=>{const[a,b]=planRange(),pvv=v=>{const o=doc(v.doctorId);return o&&dpass(o)};
if(PL.m=='month'){const off=(P(a).getDay()+1)%7,n=+b.slice(8);let h=DAYS.map(x=>`<div class=h>${x}</div>`).join('')+'<div style="visibility:hidden"></div>'.repeat(off);for(let i=1;i<=n;i++){const x=a.slice(0,8)+pad(i),vs=D.visits.filter(v=>v.date==x&&pvv(v)),o=vs.some(v=>v.status=='planned'&&v.date<T());h+=`<div class="${x==T()?'today':''} ${o?'od':''}" data-a=day data-id="${esc(x)}">${i}${vs.length?`<i>${vs.length}</i>`:''}</div>`}return `<div class=cal>${h}</div>`}
const dls=`<datalist id=dl>${D.doctors.filter(dpass).slice(0,300).map(d=>`<option value="${esc(dlabel(d))}"></option>`).join('')}</datalist>`;
return dls+(PL.m=='day'?dayView(PL.d):weekView(a,b))+cand()};
VIEW.plan=()=>{const[a,b]=planRange(),sp=[...new Set(['GP','Nephro','Diabetology','ENDO',...D.doctors.map(d=>d.specialty).filter(Boolean)])];return `<div class=bar2>${['day','week','month'].map(m=>`<button class="btn ${PL.m==m?'on':''}" data-a=pm data-id="${esc(m)}">${m}</button>`).join('')}</div><div class=bar2><button class=btn data-a=pn data-id=-1>‹</button><button class=btn data-a=pn data-id=0>Today</button><button class=btn data-a=pn data-id=1>›</button><button class=btn data-a=nvv>+ Visit</button></div><small>${a}${a==b?'':' → '+b}</small>
<div class=bar2><input data-f=q placeholder="Search name, phone, brick…" value="${esc(F.q)}"><select data-f=area>${opts(areas(),F.area,'All bricks')}</select><select data-f=cls>${opts(['A','B','C'],F.cls,'All classes')}</select></div>
<div class=bar2><select data-f=sp>${opts(sp,F.sp,'All specialties')}</select><select data-f=ad>${opts(['High','Low'],F.ad,'All adoption')}</select><select data-f=need>${opts([['rem','Still needs visits this month'],['unc','Not visited this month'],['full','Fully served']],F.need,'All doctors')}</select></div>
<div id=lst>${LST.plan()}</div>`};
LST.doctors=()=>{const q=(F.q||'').toLowerCase(),r=D.doctors.filter(d=>(!q||[d.name,d.specialty,d.area,d.phone,d.address].join(' ').toLowerCase().includes(q))&&(!F.cls||d.cls==F.cls)&&(!F.area||[].concat(d.area||[]).includes(F.area))&&(!F.ad||d.adopt==F.ad)).sort((a,b)=>a.name.localeCompare(b.name));return r.length?r.map(drow).join(''):'<p class=mu>No doctors yet. Add one, or load sample data from the Data tab.</p>'};
VIEW.doctors=()=>`<div class=bar2><input data-f=q placeholder="Search doctors…" value="${esc(F.q)}" style="flex:3"><button class="btn pr" data-a=nd>+ Doctor</button></div><div class=bar2><select data-f=cls>${opts(['A','B','C'],F.cls,'Class')}</select><select data-f=area>${opts(areas(),F.area,'Area')}</select><select data-f=ad>${opts(['High','Low'],F.ad,'Adoption')}</select></div><div id=lst>${LST.doctors()}</div>`;
LST.pharm=()=>{const q=(F.q||'').toLowerCase(),r=D.pharmacies.filter(p=>!q||[p.name,p.address,p.pharmacist,p.phone].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));return r.length?r.map(prow).join(''):'<p class=mu>No pharmacies yet.</p>'};
VIEW.pharm=()=>`<div class=bar2><input data-f=q placeholder="Search pharmacies…" value="${esc(F.q)}" style="flex:3"><button class="btn pr" data-a=np>+ Pharmacy</button></div><div id=lst>${LST.pharm()}</div>`;
VIEW.data=()=>{const lb=set().lastBackup,T6=['doctors','pharmacies','products','visits','feedback','links'];return `<h3>Full backup (JSON)</h3><p>Last backup: <b>${lb?new Date(lb).toLocaleString():'never'}</b></p><div class=bar2><button class="btn pr" data-a=bk>Export full database</button><button class=btn data-a=cp>Copy backup text</button></div><small>Also keep a copy outside the phone (Google Drive, or email it to yourself).</small>
<h3>Restore / import JSON</h3><input type=file data-rst=1><textarea id=pt rows=2 placeholder="Or paste backup text here"></textarea><div class=bar2><button class=btn data-a=pst>Import pasted text</button></div><small>Nothing is overwritten without asking: you see how many records are new and how many already exist. To replace everything, erase first (bottom) and then import.</small>
<h3>Export one table (CSV)</h3><div class=bar2>${T6.map(t=>`<button class=btn data-a=ex data-id="${esc(t)}">${t}</button>`).join('')}<button class=btn data-a=xl>All tables → Excel</button></div>
<h3>Import CSV or Excel (.xlsx)</h3><div class=bar2><select id=it>${opts(['doctors','pharmacies','products','visits'])}</select><input type=file data-imp=1></div><small>Same column names as the export; for Excel the sheet named like the table is used (otherwise the first sheet). Existing rows are never overwritten without confirmation. Visits need a doctorName column.</small>
<h3>Obligatory visit frequency</h3><p>Class A = 3 · B = 2 · C = 1 visits per month (class comes from the potential score).</p>
<h3>Maintenance</h3><div class=bar2><button class=btn data-a=chk>Check data integrity</button><button class=btn data-a=smp>Load sample data</button><button class="btn dng" data-a=wipe>Erase everything</button></div>`};
function render(){$('nav').innerHTML=[['dash','Home'],['plan','Plan'],['doctors','Doctors'],['pharm','Pharma'],['prod','Products'],['fb','Feedback'],['rep','Reports'],['data','Backup']].map(([k,l])=>`<button data-a=tab data-id="${esc(k)}" class="${k==view?'on':''}">${l}</button>`).join('');$('app').innerHTML=VIEW[view]()}
/* ---------- forms / modal with autosave ---------- */
function fld(f,v){if(f.h)return `<h4>${f.h}</h4>`;const n=f.k,val=v[n]??'',L=`<label>${f.l}`;
if(f.t=='sel')return `${L}<select name=${n}>${opts(f.o,val)}</select></label>`;
if(f.t=='ta')return `${L}<textarea name=${n} rows=2>${esc(val)}</textarea></label>`;
if(f.t=='chk')return `<label class=chip><input type=checkbox name=${n} ${val?'checked':''}>${f.l}</label>`;
if(f.t=='prods'){const sel=[].concat(val||[]);return `<label>${f.l}</label>`+(D.products.length?`<div class=chips>${D.products.map(p=>`<label class=chip><input type=checkbox name=${n} value="${esc(p.id)}" ${sel.includes(p.id)?'checked':''}>${esc(p.name)}</label>`).join('')}</div>`:'<small>Add products in the Products tab.</small>')}
if(f.t=='dtimes'){const dt=v.dayTimes||{},ds=[].concat(val||[]);return `<label>${f.l}</label>`+DAYS.map(d=>`<div class=bar2 style="align-items:center;margin:2px 0"><label class=chip style="flex:0 0 80px;min-width:80px"><input type=checkbox name=${n} value=${d} ${ds.includes(d)?'checked':''}>${d}</label><input type=time name=t_${d} value="${dt[d]||v.time||''}"></div>`).join('')}
if(f.t=='bricks'){const sel=[].concat(val||[]),all=[...new Set([...areas(),...sel])];return `<label>${f.l}</label><div class=chips>${all.map(a=>`<label class=chip><input type=checkbox name=${n} value="${esc(a)}" ${sel.includes(a)?'checked':''}>${esc(a)}</label>`).join('')}</div><input name=${n}_new placeholder="Add new brick(s), comma separated">`}
if(f.t=='days')return `<label>${f.l}</label><div class=chips>${DAYS.map(d=>`<label class=chip><input type=checkbox name=${n} value=${d} ${(val||[]).includes(d)?'checked':''}>${d}</label>`).join('')}</div>`;
return `${L}<input name=${n} type=${f.t||'text'} value="${esc(val)}"></label>`}
function modal(title,store,rec,fields,o={}){M&&M.save();const el=$('m');el.hidden=false;
el.innerHTML=`<div class=sheet><header><b>${esc(title)}</b><button data-a=close>✕</button></header><form onsubmit="return false">${fields.map(f=>fld(f,rec)).join('')}${o.extra||''}</form><div class=foot>${o.actions||''}${rec.id?'<button class="btn dng" data-a=del>Delete</button>':''}<button class="btn pr" data-a=close>Done</button></div></div>`;
const form=el.querySelector('form');let t;
const col=()=>{const fd=new FormData(form),r={...rec};fields.forEach(f=>{if(!f.h)r[f.k]=f.t=='days'||f.t=='dtimes'||f.t=='prods'?fd.getAll(f.k):f.t=='bricks'?[...new Set([...fd.getAll(f.k),...String(fd.get(f.k+'_new')||'').split(',').map(s=>s.trim()).filter(Boolean)])]:f.t=='chk'?fd.has(f.k):(fd.get(f.k)??'')});if(r.days&&fields.some(f=>f.t=='dtimes')){r.dayTimes={};r.days.forEach(d=>r.dayTimes[d]=fd.get('t_'+d)||'');r.time=r.dayTimes[r.days[0]]||''}return[r,fd]};
const save=()=>{clearTimeout(t);const[r,fd]=col();if((o.req||[]).some(k=>!r[k]))return;o.pre&&o.pre(r);put(store,r);Object.assign(rec,r);o.post&&o.post(r,fd);toast('Saved ✓')};
form.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(save,400)});
form.addEventListener('change',e=>{clearTimeout(t);t=setTimeout(save,400);o.onch&&o.onch(e,col()[0])});
M={save,rec,store,close(){save();M=null;el.hidden=true;render()}}}
const dfields=[{k:'name',l:'Name'},{k:'specialty',l:'Specialty',t:'sel',o:['GP','Nephro','Diabetology','ENDO']},{k:'area',l:'Bricks (select one or more)',t:'bricks'},{k:'phone',l:'Phone',t:'tel'},{k:'address',l:'Address'},{k:'days',l:'Available days and appointment time (time can differ per day)',t:'dtimes'},{k:'patients',l:'Patients per day (above 10 = +1, above 15 = +1)',t:'number'},{k:'kol',l:'KOL (key opinion leader)',t:'chk'},{k:'adopt',l:'Product adoption',t:'sel',o:['High','Low']},{k:'needs',l:'Needs',t:'ta'},{k:'engage',l:'Engagement activities',t:'ta'}];
function docModal(r){const lk=D.links.filter(l=>l.doctorId==r.id).map(l=>l.pharmacyId),hist=D.visits.filter(v=>v.doctorId==r.id).sort((a,b)=>b.date.localeCompare(a.date));
const extra=[0,1,2,3].map(i=>`<label>Pharmacy ${i+1}<select name=ph${i}><option value="">—</option>${D.pharmacies.map(p=>`<option value="${esc(p.id)}" ${lk[i]==p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`).join('')+(r.id?`<h4>Visit history (${hist.length})</h4>`+hist.map(vrow).join(''):'');
modal(r.name||'New doctor','doctors',r,dfields,{req:['name'],extra:`<div class=card style="margin-top:10px">Potential score: <b id=sc>${calc(r)}</b>/5 → Class <b id=cl>${clsOf(r)}</b> → <b id=vm>${tgt({cls:clsOf(r)})}</b> obligatory visits/month<small>KOL = Class A · score 4–5 = A · 2–3 = B · 1 = C</small></div>`+extra,pre:d=>{d.score=calc(d);d.cls=clsOf(d)},onch:(e,c)=>{$('sc').textContent=calc(c);$('cl').textContent=clsOf(c);$('vm').textContent=tgt({cls:clsOf(c)})},actions:r.id?`<button class=btn data-a=nv data-id="${esc(r.id)}">+ Visit</button>`:'',
post:(d,fd)=>{const want=[...new Set([0,1,2,3].map(i=>fd.get('ph'+i)).filter(Boolean))];D.links.filter(l=>l.doctorId==d.id&&!want.includes(l.pharmacyId)).forEach(l=>del('links',l.id));want.forEach(p=>{if(!D.links.some(l=>l.doctorId==d.id&&l.pharmacyId==p))put('links',{doctorId:d.id,pharmacyId:p})})}})}
const pfields=[{k:'name',l:'Pharmacy name'},{k:'address',l:'Address'},{k:'pharmacist',l:'Pharmacist'},{k:'phone',l:'Phone',t:'tel'},{k:'avail',l:'Product availability',t:'sel',o:['In stock','Low','Out']},{k:'demand',l:'Demand',t:'sel',o:['High','Medium','Low']},{k:'feedback',l:'Prescription feedback',t:'ta'},{k:'fbDate',l:'Feedback date',t:'date'}];
function pharmModal(r){const ds=D.links.filter(l=>l.pharmacyId==r.id).map(l=>doc(l.doctorId)).filter(Boolean);modal(r.name||'New pharmacy','pharmacies',r,pfields,{req:['name'],extra:r.id?`<h4>Linked doctors (${ds.length})</h4>`+ds.map(d=>`<div class=row data-a=dd data-id="${esc(d.id)}"><b>${esc(d.name)}</b><span class="b ${d.cls}">${d.cls}</span></div>`).join(''):'<small>Link this pharmacy to doctors from each doctor’s profile (up to 4 per doctor; shared pharmacies are fine).</small>'})}
const pf=v=>{const d=doc(v.doctorId);if(!d)return v;const l=D.visits.filter(x=>x.doctorId==d.id&&x.status=='done'&&x.id!=v.id).sort((a,b)=>b.date.localeCompare(a.date))[0]||{};return{...v,pre_prev:l.post_fb||'',pre_obj:l.post_obj||'',pre_need:d.needs||'',pre_adopt:d.adopt||'Low',status:v.status||'planned'}};
function visitModal(r){if(!D.doctors.length)return toast('Add a doctor first');if(!r.doctorId)r=pf({...r,doctorId:[...D.doctors].sort((a,b)=>a.name.localeCompare(b.name))[0].id});
const f=[{k:'doctorId',l:'Doctor',t:'sel',o:[...D.doctors].sort((a,b)=>a.name.localeCompare(b.name)).map(d=>[d.id,d.name])},{k:'date',l:'Date',t:'date'},{k:'time',l:'Time',t:'time'},{k:'status',l:'Status',t:'sel',o:['planned','done','missed']},{k:'productIds',l:'Products discussed',t:'prods'},
{h:'Pre-call'},{k:'pre_prev',l:'Previous feedback',t:'ta'},{k:'pre_obj',l:'Objections',t:'ta'},{k:'pre_need',l:'Doctor needs',t:'ta'},{k:'pre_adopt',l:'Product adoption',t:'sel',o:['High','Low']},{k:'pre_goal',l:'Visit objective',t:'ta'},{k:'pre_eng',l:'Planned engagement',t:'ta'},
{h:'Post-call'},{k:'outcome',l:'Visit outcome',t:'sel',o:['','Positive','Neutral','Negative','Not met']},{k:'post_fb',l:'Doctor feedback',t:'ta'},{k:'post_obj',l:'Objections',t:'ta'},{k:'post_eng',l:'Engagement completed',t:'ta'},{k:'next',l:'Next action',t:'ta'},{k:'nextDate',l:'Follow-up date',t:'date'},{k:'fdone',l:'Follow-up done',t:'chk'}];
modal((doc(r.doctorId)||{}).name||'Visit','visits',r,f,{req:['doctorId','date'],extra:r.id?'<h4>Feedback ('+D.feedback.filter(f=>f.visitId==r.id).length+')</h4>'+D.feedback.filter(f=>f.visitId==r.id).map(frow).join(''):'',actions:r.id?`<button class=btn data-a=nfv data-id="${esc(r.id)}">+ Feedback</button>`:'',pre:v=>{if(v.outcome&&v.status=='planned')v.status='done';if(r.id&&v.slot&&r.date&&v.date!=r.date)v.slot=''},onch:(e,cur)=>{if(e.target.name=='doctorId'&&!cur.outcome&&!cur.post_fb)visitModal(pf(cur))}})}
/* ---------- actions ---------- */

const remind=()=>{if(!D.doctors.length)return'';const lb=set().lastBackup,n=lb?Math.floor((Date.now()-new Date(lb))/864e5):null;return n===null||n>=7?`<div class="card warn" style="margin-bottom:8px">⚠ ${lb?'Last backup was '+n+' days ago.':'You have never made a backup.'} <button class=sm data-a=bk>Back up now</button></div>`:''};
const net=()=>{const e=$('net');if(!e)return;const on=navigator.onLine,rdy=navigator.serviceWorker&&navigator.serviceWorker.controller;e.textContent=(on?'● Online':'○ Offline')+(rdy?' · offline-ready':'');e.className=on?'on':'off'};
addEventListener('online',net);addEventListener('offline',net);
const frow=f=>{const d=doc(f.doctorId)||{},p=D.products.find(x=>x.id==f.productId);return `<div class=row data-a=dfb data-id="${esc(f.id)}"><div><b>${esc(d.name)}</b> <span class=b>${esc(f.kind)}</span>${p?` <span class=b>${esc(p.name)}</span>`:''}<small>${f.date} · ${esc(f.text)}</small></div></div>`};
LST.prod=()=>{const q=(F.q||'').toLowerCase(),r=D.products.filter(p=>!q||(p.name+' '+(p.notes||'')).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));return r.length?r.map(p=>{const nv=D.visits.filter(v=>(v.productIds||[]).includes(p.id)).length,nf=D.feedback.filter(f=>f.productId==p.id).length;return `<div class=row data-a=dpr data-id="${esc(p.id)}"><div><b>${esc(p.name)}</b><small>${esc(p.notes)} · ${nv} visits · ${nf} feedback</small></div></div>`}).join(''):'<p class=mu>No products yet.</p>'};
VIEW.prod=()=>`<div class=bar2><input data-f=q placeholder="Search products…" value="${esc(F.q)}" style="flex:3"><button class="btn pr" data-a=npr>+ Product</button></div><div id=lst>${LST.prod()}</div>`;
LST.fb=()=>{const q=(F.q||'').toLowerCase(),r=D.feedback.filter(f=>{const d=doc(f.doctorId)||{},p=D.products.find(x=>x.id==f.productId)||{};return !q||[f.text,d.name,p.name,f.kind].join(' ').toLowerCase().includes(q)}).sort((a,b)=>b.date.localeCompare(a.date));return r.length?r.map(frow).join(''):'<p class=mu>No feedback yet.</p>'};
VIEW.fb=()=>`<div class=bar2><input data-f=q placeholder="Search feedback…" value="${esc(F.q)}" style="flex:3"><button class="btn pr" data-a=nfb>+ Feedback</button></div><div id=lst>${LST.fb()}</div>`;
function prodModal(r){modal(r.name||'New product','products',r,[{k:'name',l:'Product name'},{k:'notes',l:'Notes',t:'ta'}],{req:['name']})}
function fbModal(r){if(!D.doctors.length)return toast('Add a doctor first');if(!r.doctorId)r={...r,doctorId:D.doctors[0].id};
const dv=D.visits.filter(v=>v.doctorId==r.doctorId).sort((a,b)=>b.date.localeCompare(a.date)).map(v=>[v.id,v.date+' · '+v.status]);
modal('Feedback','feedback',r,[{k:'date',l:'Date',t:'date'},{k:'kind',l:'Source',t:'sel',o:['Doctor','Pharmacy']},{k:'doctorId',l:'Doctor',t:'sel',o:[...D.doctors].sort((a,b)=>a.name.localeCompare(b.name)).map(d=>[d.id,d.name])},{k:'visitId',l:'Visit (optional)',t:'sel',o:[['','—'],...dv]},{k:'pharmacyId',l:'Pharmacy (optional)',t:'sel',o:[['','—'],...D.pharmacies.map(p=>[p.id,p.name])]},{k:'productId',l:'Product (optional)',t:'sel',o:[['','—'],...D.products.map(p=>[p.id,p.name])]},{k:'text',l:'Feedback',t:'ta'}],{req:['doctorId','date','text'],onch:(e,c)=>{if(e.target.name=='doctorId')fbModal({...c,visitId:''})}})}
function cascade(store,rec){const id=rec.id;
if(store=='doctors'){D.links.filter(l=>l.doctorId==id).forEach(l=>del('links',l.id));D.visits.filter(v=>v.doctorId==id).forEach(v=>del('visits',v.id));D.feedback.filter(f=>f.doctorId==id).forEach(f=>del('feedback',f.id))}
if(store=='pharmacies'){D.links.filter(l=>l.pharmacyId==id).forEach(l=>del('links',l.id));D.feedback.filter(f=>f.pharmacyId==id).forEach(f=>put('feedback',{...f,pharmacyId:''}))}
if(store=='products'){D.visits.filter(v=>(v.productIds||[]).includes(id)).forEach(v=>put('visits',{...v,productIds:v.productIds.filter(x=>x!=id)}));D.feedback.filter(f=>f.productId==id).forEach(f=>put('feedback',{...f,productId:''}))}
if(store=='visits'){D.feedback.filter(f=>f.visitId==id).forEach(f=>put('feedback',{...f,visitId:''}))}
del(store,id)}
function checkIntegrity(){const e=[],has=(s,id)=>D[s].some(x=>x.id==id);
D.links.forEach(l=>{if(!has('doctors',l.doctorId)||!has('pharmacies',l.pharmacyId))e.push('Orphan pharmacy link '+l.id)});
D.doctors.forEach(d=>{if(D.links.filter(l=>l.doctorId==d.id).length>4)e.push('More than 4 pharmacies: '+d.name)});
D.visits.forEach(v=>{if(!has('doctors',v.doctorId))e.push('Visit without doctor '+v.id);(v.productIds||[]).forEach(p=>{if(!has('products',p))e.push('Visit '+v.id+' has missing product')})});
D.feedback.forEach(f=>{if(!has('doctors',f.doctorId))e.push('Feedback without doctor '+f.id);if(f.visitId&&!has('visits',f.visitId))e.push('Feedback '+f.id+' has missing visit');if(f.pharmacyId&&!has('pharmacies',f.pharmacyId))e.push('Feedback '+f.id+' has missing pharmacy');if(f.productId&&!has('products',f.productId))e.push('Feedback '+f.id+' has missing product')});return e}

let RP={mo:T().slice(0,7)};
const wdCount=(mo,upto)=>{const[y,m]=mo.split('-').map(Number),n=new Date(y,m,0).getDate();let c=0;for(let i=1;i<=n;i++){const d=mo+'-'+pad(i);if(upto&&d>upto)break;if([6,0,1,2,3].includes(P(d).getDay()))c++}return c};
const pct=(a,b)=>b?Math.round(a/b*1000)/10:0;
const dn=d=>D.visits.filter(v=>v.doctorId==d.id&&v.status=='done'&&v.date.slice(0,7)==RP.mo).length;
const grp=(docs,keys)=>{const m={};docs.forEach(d=>keys(d).forEach(k=>(m[k]=m[k]||[]).push(d)));return Object.keys(m).sort().map(k=>{const L=m[k],n=L.map(dn),cov=n.filter(x=>x>0).length,t=L.reduce((s,d)=>s+tgt(d),0),a=L.reduce((s,d,i)=>s+Math.min(n[i],tgt(d)),0);return[k,L.length,cov,pct(cov,L.length)+'%',n.reduce((s,x)=>s+x,0),t,pct(a,t)+'%']})};
const tbl=(h,r)=>`<div style="overflow-x:auto"><table class=tb><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(x=>`<tr>${x.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
const kv=(l,v,s,p)=>`<div class=card><small>${l}</small><h2>${v}</h2><small>${s||''}</small>${p!=null?`<div class=bar><i style="width:${Math.min(100,p)}%"></i></div>`:''}</div>`;
function repCalc(){const mo=RP.mo,s=set(),cur=mo==T().slice(0,7),ct=+s.callTarget||10,wdAll=+s['wd_'+mo]||wdCount(mo),el=cur?Math.min(wdAll,wdCount(mo,T())):wdAll,
V=D.visits.filter(v=>v.date.slice(0,7)==mo),done=V.filter(v=>v.status=='done'),missed=V.filter(v=>v.status=='missed').length,od=V.filter(v=>v.status=='planned'&&v.date<T()).length,pl=V.filter(v=>v.status=='planned'&&v.date>=T()).length,
N=D.doctors.length,cov=D.doctors.filter(d=>dn(d)>0),tg=D.doctors.reduce((a,d)=>a+tgt(d),0),ach=D.doctors.reduce((a,d)=>a+Math.min(dn(d),tgt(d)),0),full=D.doctors.filter(d=>tgt(d)>0&&dn(d)>=tgt(d)).length,
cpd=el?Math.round(done.length/el*10)/10:0,crp=pct(done.length,ct*el),covp=pct(cov.length,N),fcp=pct(ach,tg),cmp=pct(done.length,done.length+missed+od);
const sum=[['Month',mo],['Visits completed',done.length],['Working days counted',el],['Daily call target',ct],['Calls per working day',cpd],['Call rate % (done / target x days)',crp],['Total doctors',N],['Doctors covered',cov.length],['Coverage %',covp],['Obligatory visits',tg],['Frequency achievement %',fcp],['Doctors fully served',full],['Visits missed',missed],['Visits overdue',od],['Visits still planned',pl],['Completion %',cmp]];
return{mo,cur,ct,wdAll,el,V,done,missed,od,pl,N,cov,tg,ach,full,cpd,crp,covp,fcp,cmp,sum}}
VIEW.rep=()=>{const R=repCalc(),H=['Group','Doctors','Covered','Coverage','Visits','Target','Achieved'];
const oc=['Positive','Neutral','Negative','Not met'].map(o=>[o,R.done.filter(v=>v.outcome==o).length]),days={};R.done.forEach(v=>days[v.date]=(days[v.date]||0)+1);const mx=Math.max(1,...Object.values(days));
const unc=D.doctors.filter(d=>!dn(d)).sort((a,b)=>(a.cls||'').localeCompare(b.cls||'')||a.name.localeCompare(b.name)),hp=D.doctors.filter(d=>d.score>=4),pa=D.pharmacies.map(p=>[p,palert(p)]).filter(x=>x[1].length);
const avgv=R.cov.length?Math.round(R.done.length/R.cov.length*10)/10:0;
return `<div class=bar2><input type=month data-rp=mo value="${R.mo}"><label style="margin:0">Daily call target<input type=number min=1 data-rp=ct value="${R.ct}"></label><label style="margin:0">Working days in month<input type=number min=1 data-rp=wd value="${R.wdAll}"></label></div><small>Working days default to Sat–Wed; change the number for holidays. ${R.cur?'Current month: rates use the '+R.el+' working days elapsed so far.':''}</small>
<div class=grid style="margin-top:8px">${kv('Call rate',R.done.length+' visits',R.cpd+' calls/day · '+R.crp+'% of '+R.ct+'/day × '+R.el+' days',R.crp)}${kv('Coverage',R.covp+'%',R.cov.length+' of '+R.N+' doctors visited',R.covp)}${kv('Frequency achievement',R.fcp+'%',R.ach+' of '+R.tg+' obligatory visits · '+R.full+' doctors fully served',R.fcp)}${kv('Completion rate',R.cmp+'%',R.done.length+' done · '+R.missed+' missed · '+R.od+' overdue · '+R.pl+' planned',R.cmp)}${kv('Visits per covered doctor',avgv,'average in the month')}${kv('High-potential coverage',pct(hp.filter(d=>dn(d)>0).length,hp.length)+'%',hp.filter(d=>dn(d)>0).length+' of '+hp.length+' doctors with score 4–5')}</div>
<h3>By class</h3>${tbl(H,grp(D.doctors,d=>[d.cls||'?']))}
<h3>By specialty</h3>${tbl(H,grp(D.doctors,d=>[d.specialty||'?']))}
<h3>By brick</h3>${tbl(H,grp(D.doctors,d=>[].concat(d.area&&d.area.length?d.area:['?'])))}
<h3>By adoption</h3>${tbl(H,grp(D.doctors,d=>[(d.adopt||'?')+' adoption']))}
<h3>Visit outcomes</h3>${tbl(['Outcome','Visits','Share'],oc.map(([o,n])=>[o,n,pct(n,R.done.length)+'%']))}
<h3>Products</h3>${tbl(['Product','Visits discussing','Feedback entries'],D.products.map(p=>[p.name,R.done.filter(v=>(v.productIds||[]).includes(p.id)).length,D.feedback.filter(f=>f.productId==p.id&&f.date.slice(0,7)==R.mo).length]))}
<h3>Pharmacies</h3>${tbl(['Metric','Value'],[['Pharmacies',D.pharmacies.length],['Linked to at least one doctor',D.pharmacies.filter(p=>D.links.some(l=>l.pharmacyId==p.id)).length],['Stock / feedback alerts',pa.length],['Feedback entries this month',D.feedback.filter(f=>f.date.slice(0,7)==R.mo&&f.pharmacyId).length]])}
<h3>Visits per day</h3>${Object.keys(days).sort().map(d=>`<div style="display:flex;gap:8px;align-items:center;font-size:12px"><span style="width:84px">${d}</span><div class=bar style="flex:1;margin:2px 0"><i style="width:${days[d]/mx*100}%"></i></div><b>${days[d]}</b></div>`).join('')||'<p class=mu>No completed visits this month.</p>'}
<h3>Not yet visited this month (${unc.length})</h3>${unc.map(drow).join('')||'<p class=mu>Everyone has been covered ✓</p>'}
<div class=bar2 style="margin-top:12px"><button class=btn data-a=rpx>Export these metrics (CSV)</button></div>`};

/* ---- planner: day sheet with 10 slots, weekly grid, validation ---- */
const SLOTS=10;
const dmeta=d=>D.meta.find(m=>m.id=='plan_'+d)||{id:'plan_'+d,type:'long',start:'09:00'};
const sTime=(m,n)=>{const[h,i]=(m.start||'09:00').split(':').map(Number),t=h*60+i+(n-1)*30;return pad(Math.floor(t/60)%24)+':'+pad(t%60)};
const dlabel=d=>d.name+' · '+(d.cls||'?')+' · '+[].concat(d.area||[]).join('/');
const slotV=(d,n)=>D.visits.find(v=>v.date==d&&+v.slot==n);
const mcount=(d,mo)=>D.visits.filter(v=>v.doctorId==d.id&&v.status=='done'&&v.date.slice(0,7)==mo).length;
const dpass=d=>{const q=(F.q||'').toLowerCase(),mo=PL.d.slice(0,7),c=mcount(d,mo);return(!q||[d.name,d.specialty,d.phone,d.address,[].concat(d.area||[]).join(' ')].join(' ').toLowerCase().includes(q))&&(!F.cls||d.cls==F.cls)&&(!F.area||[].concat(d.area||[]).includes(F.area))&&(!F.sp||d.specialty==F.sp)&&(!F.ad||d.adopt==F.ad)&&(!F.need||(F.need=='rem'?c<tgt(d):F.need=='unc'?c==0:c>=tgt(d)))};
const pr=()=>{if(view=='plan'&&$('lst'))$('lst').innerHTML=LST.plan()};
const daySum=d=>{const vs=D.visits.filter(v=>v.date==d&&v.slot);return{pl:vs.length,dn:vs.filter(v=>v.status=='done').length,ms:vs.filter(v=>v.status=='missed').length,ct:+set().callTarget||10}};
const retime=d=>D.visits.filter(v=>v.date==d&&v.slot&&v.status=='planned').forEach(v=>put('visits',{...v,time:sTime(dmeta(d),+v.slot)}));
function cellEdit(t){const[d,n]=t.dataset.cell.split('|'),sl=+n,cur=slotV(d,sl),val=t.value.trim();
if(!val){if(cur){if(cur.status=='done'&&!confirm('This visit is marked as done. Remove it?'))return pr();cascade('visits',cur)}return pr()}
const dc=D.doctors.find(x=>dlabel(x)==val)||D.doctors.find(x=>x.name.toLowerCase()==val.toLowerCase());
if(!dc){toast('Pick a doctor from the list');return pr()}
if(cur&&cur.doctorId==dc.id)return pr();
if(D.visits.some(v=>v.date==d&&v.doctorId==dc.id)){toast('Already planned on this day');return pr()}
const tm=cur?cur.time:sTime(dmeta(d),sl);if(cur)cascade('visits',cur);put('visits',pf({doctorId:dc.id,date:d,slot:sl,time:tm,status:'planned'}));pr()}
function planChange(t){const k=t.dataset;
if(k.cell)cellEdit(t);
else if(k.ctime){const[d,n]=k.ctime.split('|'),v=slotV(d,+n);if(v&&t.value)put('visits',{...v,time:t.value});pr()}
else if(k.chk){const v=D.visits.find(x=>x.id==k.chk);if(v){put('visits',{...v,status:t.checked?'done':(dmeta(v.date).closed?'missed':'planned')});pr()}}
else if(k.dtype){put('meta',{...dmeta(k.dtype),type:t.value,start:t.value=='pm'?'14:00':'09:00'});retime(k.dtype);pr()}
else if(k.dstart){put('meta',{...dmeta(k.dstart),start:t.value||'09:00'});retime(k.dstart);pr()}}
const cand=()=>{const mo=PL.d.slice(0,7),r=D.doctors.filter(dpass).sort((a,b)=>((tgt(b)-mcount(b,mo))-(tgt(a)-mcount(a,mo)))||(a.cls||'').localeCompare(b.cls||'')||a.name.localeCompare(b.name));
return `<h3>Doctors to plan (${r.length}) · "+ Add" goes to ${PL.d}</h3>`+r.slice(0,60).map(d=>`<div class=row><div><b>${esc(d.name)}</b> <span class="b ${d.cls}">${d.cls}</span><small>${esc(d.specialty)} · ${esc([].concat(d.area||[]).join(', '))} · ${mcount(d,mo)}/${tgt(d)} this month</small></div><button class=sm data-a=addc data-id="${esc(d.id)}">+ Add</button></div>`).join('')+(r.length>60?'<p class=mu>Refine the filters to see the rest.</p>':'')};
const dayView=d=>{const m=dmeta(d),sm=daySum(d),mo=d.slice(0,7),old=RP.mo;RP.mo=mo;const R=repCalc();RP.mo=old;let rows='';
for(let n=1;n<=SLOTS;n++){const v=slotV(d,n),dc=v&&doc(v.doctorId);rows+=`<tr><td>${n}</td><td>${v?`<input type=time data-ctime="${d}|${n}" value="${esc(v.time)}">`:sTime(m,n)}</td><td><input list=dl data-cell="${d}|${n}" value="${dc?esc(dlabel(dc)):''}" placeholder="Choose doctor…"></td><td class=mu>${dc?esc(dc.specialty)+' · score '+(dc.score||'-')+' · '+mcount(dc,mo)+'/'+tgt(dc)+' this month':''}</td><td><input type=checkbox data-chk="${v?v.id:''}" ${v&&v.status=='done'?'checked':''} ${v?'':'disabled'}></td><td>${v?`<span class="b ${v.status}">${v.status}</span> <button class=sm data-a=dv data-id="${esc(v.id)}">📝</button>`:''}</td></tr>`}
const other=D.visits.filter(v=>v.date==d&&!v.slot);
return `<h3>${DN[P(d).getDay()]} ${d}</h3><div class=bar2><select data-dtype="${d}">${opts([['long','Long day'],['pm','PM day']],m.type)}</select><label style="margin:0">Plan starts at<input type=time data-dstart="${d}" value="${m.start}"></label></div><div style="overflow-x:auto"><table class="tb pt"><tr><th>#</th><th>Time</th><th>Doctor</th><th>Info</th><th>Visited ✓</th><th></th></tr>${rows}</table></div>
<div class=bar2 style="margin-top:8px"><button class=btn data-a=cld data-id="${esc(d)}">Close day: unchecked → missed</button></div>
<div class=grid>${kv('Visits made today',sm.dn+'/'+sm.pl,pct(sm.dn,sm.pl)+'% of the plan',pct(sm.dn,sm.pl))}${kv('Day call rate',pct(sm.dn,sm.ct)+'%',sm.dn+' of '+sm.ct+' calls/day target',pct(sm.dn,sm.ct))}${kv('Month call rate',R.crp+'%',R.done.length+' visits · '+R.cpd+' per day',R.crp)}${kv('Month coverage',R.covp+'%',R.cov.length+' of '+R.N+' doctors visited',R.covp)}</div>`+(other.length?`<h3>Other visits this day (${other.length})</h3>`+other.map(vrow).join(''):'')};
const weekView=(a,b)=>{const days=[];for(let x=a;x<=b;x=add(x,1))if([6,0,1,2,3].includes(P(x).getDay())||D.visits.some(v=>v.date==x&&v.slot)||x==PL.d)days.push(x);
let h='<tr><th>#</th>'+days.map(x=>`<th class="${x==PL.d?'sel':''}" data-a=pday data-id="${esc(x)}">${DN[P(x).getDay()]}<br><small>${x.slice(5)}</small></th>`).join('')+'</tr><tr><td></td>'+days.map(x=>{const m=dmeta(x);return `<td><select data-dtype="${x}">${opts([['long','Long day'],['pm','PM day']],m.type)}</select><input type=time data-dstart="${x}" value="${m.start}"></td>`}).join('')+'</tr>';
for(let n=1;n<=SLOTS;n++)h+=`<tr><td>${n}</td>`+days.map(x=>{const v=slotV(x,n),dc=v&&doc(v.doctorId);return `<td><input list=dl data-cell="${x}|${n}" value="${dc?esc(dlabel(dc)):''}" placeholder="—"><label class=chip style="margin:2px 0"><input type=checkbox data-chk="${v?v.id:''}" ${v&&v.status=='done'?'checked':''} ${v?'':'disabled'}>✓ <small>${v?esc(v.time):sTime(dmeta(x),n)}</small></label></td>`}).join('')+'</tr>';
h+='<tr><td>Σ</td>'+days.map(x=>{const s=daySum(x);return `<td><b>${s.dn}/${s.pl}</b> <button class=sm data-a=cld data-id="${esc(x)}">Close day</button></td>`}).join('')+'</tr>';
const vs=D.visits.filter(v=>v.date>=a&&v.date<=b&&v.slot),dd=vs.filter(v=>v.status=='done'),ct=+set().callTarget||10,cv=new Set(dd.map(v=>v.doctorId)).size,N=D.doctors.length;
return `<div style="overflow-x:auto"><table class="tb pt">${h}</table></div><small>Tap a day header to choose where "+ Add" puts doctors.</small><div class=grid style="margin-top:8px">${kv('Week visits made',dd.length+'/'+vs.length,pct(dd.length,vs.length)+'% of plan',pct(dd.length,vs.length))}${kv('Week call rate',pct(dd.length,ct*5)+'%',dd.length+' of '+ct*5+' ('+ct+'/day × 5 days)',pct(dd.length,ct*5))}${kv('Week coverage',pct(cv,N)+'%',cv+' of '+N+' doctors',pct(cv,N))}</div>`};
const ACT={tab(id){view=id;Object.keys(F).forEach(k=>delete F[k]);render()},dv:id=>visitModal(D.visits.find(v=>v.id==id)),dd:id=>docModal(doc(id)),dp:id=>pharmModal(ph(id)),
nd:()=>docModal({cls:'B',score:1,adopt:'Low',days:[],area:[]}),np:()=>pharmModal({avail:'In stock',demand:'Medium'}),
nv(id){const d=doc(id);visitModal(pf({doctorId:id,date:T(),time:(d.dayTimes||{})[DN[P(T()).getDay()]]||d.time||'',status:'planned'}))},nvv:()=>visitModal({date:PL.d,status:'planned'}),
pm(id){PL.m=id;render()},pn(id){id=+id;if(!id)PL.d=T();else if(PL.m=='month'){const d=P(PL.d);PL.d=iso(new Date(d.getFullYear(),d.getMonth()+id,1))}else PL.d=add(PL.d,id*(PL.m=='week'?7:1));render()},day(id){PL={m:'day',d:id};render()},
close:()=>M&&M.close(),pday:id=>{PL.d=id;pr()},
cld(id){const vs=D.visits.filter(v=>v.date==id&&v.slot&&v.status=='planned');if(!confirm('Close '+id+'? '+vs.length+' unchecked planned visit(s) will be marked MISSED. You can still tick them later.'))return;vs.forEach(v=>put('visits',{...v,status:'missed'}));put('meta',{...dmeta(id),closed:true});toast('Day closed ✓');pr()},
addc(id){const d=PL.d;if(D.visits.some(v=>v.date==d&&v.doctorId==id))return toast('Already planned that day');for(let n=1;n<=SLOTS;n++)if(!slotV(d,n)){put('visits',pf({doctorId:id,date:d,slot:n,time:sTime(dmeta(d),n),status:'planned'}));pr();return toast('Added to slot '+n)}toast('All 10 slots are full')},dpr:id=>prodModal(D.products.find(x=>x.id==id)),npr:()=>prodModal({}),dfb:id=>fbModal(D.feedback.find(x=>x.id==id)),nfb:()=>fbModal({date:T(),kind:'Doctor'}),nfv(id){const v=D.visits.find(x=>x.id==id);fbModal({date:T(),kind:'Doctor',doctorId:v.doctorId,visitId:v.id})},chk(){const i=checkIntegrity();alert(i.length?i.length+' problem(s):\n'+i.slice(0,15).join('\n'):'No problems found ✓')},
del(id,b){if(!M.armed){M.armed=1;b.textContent='Tap again to delete';return}const{store,rec}=M;cascade(store,rec);M=null;$('m').hidden=true;render()},
ex(t){dl(t+'.csv',new Blob([csv(rowsOf(t))],{type:'text/csv'}))},
async bk(){const r=await saveFile('rep-crm-backup-'+T()+'.json',new Blob([backupJSON()],{type:'application/json'}));if(r=='cancelled')return toast('Cancelled');put('meta',{...set(),lastBackup:new Date().toISOString()});toast(r=='shared'?'Backup shared ✓':'Backup downloaded ✓');render()},
cp(){const t=backupJSON();navigator.clipboard?navigator.clipboard.writeText(t).then(()=>{put('meta',{...set(),lastBackup:new Date().toISOString()});toast('Backup text copied ✓');render()},()=>toast('Copy blocked by the browser')):toast('Clipboard not available')},
pst(){restoreText($('pt').value)},
xl(){const sh={};['doctors','pharmacies','products','visits','feedback','links'].forEach(t=>sh[t]=rowsOf(t));dl('rep-crm-'+T()+'.xlsx',xlsxBlob(sh))},
rpx(){const R=repCalc();dl('report-'+RP.mo+'.csv',new Blob([csv(R.sum.map(([metric,value])=>({metric,value})))],{type:'text/csv'}))},
smp:sample,
async wipe(id,b){if(!b.dataset.a2){b.dataset.a2=1;b.textContent='Tap again to erase all';return}if(!confirm('Erase ALL data on this device? Make a backup first. This cannot be undone.'))return;await clearAll();toast('Erased');render()}};
const flat=r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,Array.isArray(v)?v.join('|'):v]));
const rowsOf=t=>t=='visits'?D.visits.map(v=>({...v,doctorName:(doc(v.doctorId)||{}).name||''})):D[t];
const csv=rows=>{const ks=[...new Set(rows.flatMap(Object.keys))];return[ks,...rows.map(r=>ks.map(k=>r[k]))].map(r=>r.map(c=>{c=Array.isArray(c)?c.join('|'):(c??'');return/[",\n]/.test(c)?'"'+String(c).replace(/"/g,'""')+'"':c}).join(',')).join('\n')};
async function saveFile(name,blob){try{const f=new File([blob],name,{type:blob.type||'application/octet-stream'});if(navigator.canShare&&/Android|iPhone|iPad/i.test(navigator.userAgent)&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return'shared'}}catch(e){if(e&&e.name=='AbortError')return'cancelled'}
const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},60000);return'download'}
const dl=(n,b)=>saveFile(n,b);
const backupJSON=()=>JSON.stringify({app:'rep-crm',schema:2,exported:new Date().toISOString(),data:D});
const clearAll=async()=>{await Promise.all(S.map(s=>db.table(s).clear()));S.forEach(s=>D[s]=[])};
const AL={'patients':'patients','kol':'kol','name':'name','specialty':'specialty','area':'area','phone':'phone','address':'address','cls':'cls','days':'days','time':'time','adopt':'adopt','needs':'needs','engage':'engage','pharmacist':'pharmacist','avail':'avail','demand':'demand','feedback':'feedback','notes':'notes','date':'date','status':'status','doctor':'name','doctor name':'name','speciality':'specialty','brick':'area','bricks':'area','mobile':'phone','class':'cls','patient count':'patients','patients per day':'patients','adoption':'adopt','available days':'days','appointment time':'time','engagement':'engage','availability':'avail','feedback date':'fbDate'};
const SP=s=>{s=String(s||'').toLowerCase();return s.includes('endo')?'ENDO':s.includes('nephr')?'Nephro':s.includes('diab')?'Diabetology':'GP'};
const KEY=k=>AL[String(k).trim().toLowerCase()]||String(k).trim();
function parseCSV(t){t=t.replace(/^\uFEFF/,'');const fl=t.split(/\r?\n/)[0]||'',dl=(fl.match(/;/g)||[]).length>(fl.match(/,/g)||[]).length?';':',',rows=[];let r=[],c='',q=false;for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}else if(ch=='"')q=true;else if(ch==dl){r.push(c);c=''}else if(ch=='\n'||ch=='\r'){if(ch=='\r'&&t[i+1]=='\n')i++;r.push(c);rows.push(r);r=[];c=''}else c+=ch}if(c||r.length){r.push(c);rows.push(r)}const h=rows.shift()||[];return rows.filter(x=>x.some(Boolean)).map(x=>Object.fromEntries(h.map((k,i)=>[k.trim(),x[i]??''])))}
async function imp(file,t){try{let rows;if(/\.csv$/i.test(file.name))rows=parseCSV(await file.text());else if(/\.xlsx$/i.test(file.name))rows=await xlsxRows(file,t);else return toast('Please choose a .csv or .xlsx file');rows=rows.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[KEY(k),v])));rows.forEach(r=>{['date','nextDate','fbDate'].forEach(k=>{if(/^\d+(\.\d+)?$/.test(String(r[k]))&&+r[k]>20000)r[k]=new Date(Math.round((+r[k]-25569)*864e5)).toISOString().slice(0,10)});if(/^0?\.\d+$/.test(String(r.time||''))){const m=Math.round(+r.time*1440);r.time=pad(Math.floor(m/60))+':'+pad(m%60)}});const ops=[];
rows.forEach(r=>{if(t=='visits'){const d=D.doctors.find(x=>x.name==r.doctorName);if(!d||!r.date)return;delete r.doctorName;r.doctorId=d.id;r.productIds=String(r.productIds||'').split('|').filter(Boolean);r.fdone=r.fdone===true||r.fdone=='true';const ex=D.visits.find(v=>v.id==r.id);r.id=ex?ex.id:(r.id||'');ops.push(['visits',{...(ex||{}),...r},!!ex]);return}
if(!r.name)return;const L=D[t],ex=L.find(x=>x.id==r.id)||L.find(x=>x.name==r.name);r.id=ex?ex.id:(r.id||'');
if(t=='doctors'){r.days=String(r.days||'').split(/[|,;]/).map(s=>s.trim()).filter(Boolean);r.days=r.days.map(s=>s.slice(0,3)).map(s=>s[0].toUpperCase()+s.slice(1).toLowerCase());r.area=String(r.area||'').split(/[|;,]/).map(s=>s.trim()).filter(Boolean);r.patients=+r.patients||0;r.kol=/^(y|yes|true|1|x|✓)/i.test(String(r.kol).trim());r.adopt=/^h/i.test(r.adopt)?'High':'Low';r.specialty=SP(r.specialty);r.score=calc(r);r.cls=clsOf(r)}ops.push([t,{...(ex||{}),...r},!!ex])});const cf=ops.filter(o=>o[2]).length;let ow=false;if(cf)ow=confirm(cf+' of '+ops.length+' rows match records that already exist.\n\nOK = overwrite them with the CSV values.\nCancel = keep existing records and only add new rows.');let c=0;ops.forEach(([s,o,e])=>{if(!e||ow){put(s,o);c++}});toast('Imported '+c+' rows'+(cf&&!ow?' ('+cf+' existing kept)':''));render()}catch(e){toast('Import failed: '+(e&&e.message||'bad file'))}}
async function restore(file){return restoreText(await file.text())}
async function restoreText(txt){try{const j=JSON.parse(txt),X=j.data||j;if(!X.doctors||!X.visits)throw 0;
const plan=S.map(s=>{const L=(X[s]||[]).filter(o=>s!='meta'||/^plan_/.test(o.id||''));return{s,L,ex:L.filter(o=>o.id&&D[s].some(x=>x.id==o.id))}});
const cf=plan.reduce((n,p)=>n+p.ex.length,0),nw=plan.reduce((n,p)=>n+p.L.length,0)-cf;
if(!confirm('This backup has '+nw+' new and '+cf+' already existing records.\n\nOK = add the '+nw+' new records.\nCancel = import nothing.'))return;
plan.forEach(p=>p.L.forEach(o=>{if(!o.id||!D[p.s].some(x=>x.id==o.id))put(p.s,o)}));
if(cf&&confirm('Overwrite the '+cf+' existing records with the versions from the backup?\n\nCancel = keep your current versions.'))plan.forEach(p=>p.ex.forEach(o=>put(p.s,o)));
toast('Import complete');render()}catch(e){toast('Import failed: '+(e&&e.message||'not a valid backup file'))}}
function sample(){const N=[['Mona Hassan','Cardiology','Nasr City'],['Ahmed Fathy','Internal Medicine','Heliopolis'],['Sara Khaled','Pediatrics','Maadi'],['Omar Nabil','Endocrinology','Nasr City'],['Heba Samir','Family Medicine','Heliopolis'],['Tarek Adel','Cardiology','Maadi'],['Dina Magdy','Neurology','Dokki'],['Karim Salah','Internal Medicine','Dokki'],['Laila Mostafa','Pediatrics','Nasr City'],['Youssef Ramy','Endocrinology','Maadi'],['Nour Ashraf','Family Medicine','Dokki'],['Hany Zaki','Cardiology','Heliopolis']],C='AAABBBBCCCCB',Ph=['El Ezaby','Seif','Misr','Roshdy','Al Nour','Care'].map((n,i)=>put('pharmacies',{name:n+' Pharmacy',address:'St. '+(i+10)+', Cairo',pharmacist:'Pharm. '+['Amr','Rana','Samy','Hoda','Wael','Mai'][i],phone:'0100000'+(1000+i),avail:['In stock','In stock','Low','In stock','Out','In stock'][i],demand:['High','Medium','Low'][i%3],feedback:i%2?'Prescribed steadily':'',fbDate:add(T(),-(i*9))}));
const Pr=['Product A','Product B','Product C'].map(n=>put('products',{name:n,notes:'Sample product'}));N.forEach((n,i)=>{const d=put('doctors',{name:'Dr. '+n[0],specialty:['GP','Nephro','Diabetology'][i%3],area:i%4==0?[n[2],'Zamalek']:[n[2]],phone:'0111000'+(2000+i),address:n[2]+' Clinic '+(i+1),cls:C[i],days:['Sat','Mon','Wed'].slice(0,2+i%2),time:['10:00','12:30','17:00'][i%3],patients:[40,25,15,8][i%4],kol:i%5==0,score:1,adopt:i%3?'High':'Low',target:'',needs:i%2?'Clinical samples, dosing data':'Patient leaflets',engage:i%2?'Dinner meeting':'Journal club'});
[i%6,(i+2)%6].forEach(p=>put('links',{doctorId:d.id,pharmacyId:Ph[p].id}));
const vd=put('visits',{productIds:[Pr[i%3].id],doctorId:d.id,date:add(T(),-(3+i)),time:d.time,status:'done',pre_prev:'',pre_adopt:d.adopt,pre_goal:'Introduce new indication',outcome:['Positive','Neutral','Negative'][i%3],post_fb:'Interested, asked for studies',post_obj:i%2?'Price':'',next:i%4==0?'Send clinical study':'',nextDate:add(T(),2)});put('feedback',{date:vd.date,kind:'Doctor',doctorId:d.id,visitId:vd.id,productId:Pr[i%3].id,pharmacyId:'',text:'Wants more clinical data'});
put('visits',{doctorId:d.id,date:add(T(),(i%6)-2),time:d.time,status:'planned',pre_prev:'Interested, asked for studies',pre_adopt:d.adopt,pre_goal:'Follow up'})});D.doctors.slice().forEach(d=>put('doctors',{...d,score:calc(d),cls:clsOf(d)}));toast('Sample data loaded');render()}
/* ---------- events ---------- */
document.addEventListener('click',e=>{const t=e.target;if(t.matches('input,select,textarea'))return;const b=t.closest('[data-a]');if(b&&ACT[b.dataset.a])ACT[b.dataset.a](b.dataset.id,b)});
document.addEventListener('input',e=>{const t=e.target;if(t.dataset.f){F[t.dataset.f]=t.value;if(view!='dash')$('lst').innerHTML=LST[view]()}});
document.addEventListener('change',async e=>{const t=e.target;
if(t.dataset.f&&t.tagName=='SELECT'){F[t.dataset.f]=t.value;$('lst').innerHTML=LST[view]()}
if(t.dataset.r){const v=D.visits.find(x=>x.id==t.dataset.r);if(v&&t.value){put('visits',{...v,date:t.value,slot:''});toast('Rescheduled ✓');render()}}
if(t.dataset.t){put('meta',{...set(),[t.dataset.t]:+t.value||0});toast('Target saved ✓')}
if(t.dataset.cell||t.dataset.ctime||t.dataset.chk!==undefined||t.dataset.dtype||t.dataset.dstart)planChange(t);
if(t.dataset.rp){const k=t.dataset.rp;if(k=='mo'){if(t.value)RP.mo=t.value}else if(k=='ct')put('meta',{...set(),callTarget:+t.value||10});else if(k=='wd')put('meta',{...set(),['wd_'+RP.mo]:+t.value||0});render()}
if(t.dataset.imp&&t.files[0]){await imp(t.files[0],$('it').value);t.value=''}
if(t.dataset.rst&&t.files[0]){await restore(t.files[0]);t.value=''}});
net();navigator.storage&&navigator.storage.persist&&navigator.storage.persist();window.appReady=ready().then(load).then(()=>D.doctors.slice().forEach(d=>{const s=calc(d);{const c=clsOf(d);if(d.score!=s||d.cls!=c)put('doctors',{...d,score:s,cls:c})}})).then(()=>{render();net()}).catch(e=>{$('app').innerHTML='<p>Could not open local database: '+esc(e&&e.message)+'</p>'});

if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(net).catch(e=>console.warn('SW',e)));
navigator.serviceWorker&&navigator.serviceWorker.addEventListener('controllerchange',net);

addEventListener('error',e=>toast('Error: '+e.message));addEventListener('unhandledrejection',e=>toast('Error: '+(e.reason&&e.reason.message||e.reason)));

/* ---- Excel (.xlsx) without any library: tiny zip writer/reader (reader uses the browser's built-in DecompressionStream) ---- */
const crcT=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=u=>{let c=-1;for(let i=0;i<u.length;i++)c=crcT[(c^u[i])&255]^(c>>>8);return(c^-1)>>>0};
function zipStore(files){const enc=new TextEncoder(),parts=[],cd=[];let off=0;
for(const[name,txt]of files){const nb=enc.encode(name),d=enc.encode(txt),c=crc32(d),lh=new DataView(new ArrayBuffer(30));
lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(12,0x21,true);lh.setUint32(14,c,true);lh.setUint32(18,d.length,true);lh.setUint32(22,d.length,true);lh.setUint16(26,nb.length,true);
parts.push(new Uint8Array(lh.buffer),nb,d);
const ch=new DataView(new ArrayBuffer(46));ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(14,0x21,true);ch.setUint32(16,c,true);ch.setUint32(20,d.length,true);ch.setUint32(24,d.length,true);ch.setUint16(28,nb.length,true);ch.setUint32(42,off,true);
cd.push(new Uint8Array(ch.buffer),nb);off+=30+nb.length+d.length}
const cdSize=cd.reduce((s,x)=>s+x.length,0),e=new DataView(new ArrayBuffer(22));e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cdSize,true);e.setUint32(16,off,true);
return[...parts,...cd,new Uint8Array(e.buffer)]}
const colL=i=>{let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
const xesc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
function sheetXml(rows){const ks=[...new Set(rows.flatMap(Object.keys))],all=[ks,...rows.map(r=>ks.map(k=>{const v=r[k];return Array.isArray(v)?v.join('|'):v}))];
return'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+all.map((r,i)=>`<row r="${i+1}">`+r.map((v,j)=>v===undefined||v===null||v===''?'':typeof v=='number'&&isFinite(v)?`<c r="${colL(j)}${i+1}"><v>${v}</v></c>`:`<c r="${colL(j)}${i+1}" t="inlineStr"><is><t xml:space="preserve">${xesc(v)}</t></is></c>`).join('')+'</row>').join('')+'</sheetData></worksheet>'}
function xlsxBlob(sheets){const H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',N='http://schemas.openxmlformats.org/',names=Object.keys(sheets),files=[
['[Content_Types].xml',H+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+names.map((n,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')+'</Types>'],
['_rels/.rels',H+`<Relationships xmlns="${N}package/2006/relationships"><Relationship Id="rId1" Type="${N}officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
['xl/workbook.xml',H+`<workbook xmlns="${N}spreadsheetml/2006/main" xmlns:r="${N}officeDocument/2006/relationships"><sheets>`+names.map((n,i)=>`<sheet name="${xesc(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>'],
['xl/_rels/workbook.xml.rels',H+`<Relationships xmlns="${N}package/2006/relationships">`+names.map((n,i)=>`<Relationship Id="rId${i+1}" Type="${N}officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+'</Relationships>'],
...names.map((n,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheetXml(sheets[n])])];
return new Blob(zipStore(files),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}
async function unzip(buf){const u=new Uint8Array(buf),dv=new DataView(buf),dec=new TextDecoder(),out={};let e=u.length-22;while(e>=0&&dv.getUint32(e,true)!=0x06054b50)e--;if(e<0)throw new Error('Not a valid .xlsx file');
const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);
for(let i=0;i<n;i++){const m=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true),name=dec.decode(u.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;
if(!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name))continue;
const ds=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true);let data=u.subarray(ds,ds+cs);
if(m==8){if(typeof DecompressionStream=='undefined')throw new Error('This browser cannot read .xlsx; use CSV');data=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())}
out[name]=dec.decode(data)}return out}
async function xlsxRows(file,want){const f=await unzip(await file.arrayBuffer()),X=s=>new DOMParser().parseFromString(s,'application/xml'),wb=X(f['xl/workbook.xml']),rel=X(f['xl/_rels/workbook.xml.rels']),shs=[...wb.getElementsByTagName('sheet')];
const pick=shs.find(s=>s.getAttribute('name').toLowerCase()==want)||shs[0],rid=pick.getAttribute('r:id')||pick.getAttributeNS(N_R,'id'),
tg=[...rel.getElementsByTagName('Relationship')].find(r=>r.getAttribute('Id')==rid).getAttribute('Target').replace(/^\//,''),path=tg.startsWith('xl/')?tg:'xl/'+tg,
ss=f['xl/sharedStrings.xml']?[...X(f['xl/sharedStrings.xml']).getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(t=>t.textContent).join('')):[],grid=[];
[...X(f[path]).getElementsByTagName('c')].forEach(c=>{const m=(c.getAttribute('r')||'').match(/^([A-Z]+)(\d+)$/);if(!m)return;let ci=0;for(const ch of m[1])ci=ci*26+ch.charCodeAt(0)-64;ci--;const ri=+m[2]-1,t=c.getAttribute('t'),ve=c.getElementsByTagName('v')[0];let v='';
if(t=='s')v=ss[+ve.textContent];else if(t=='inlineStr')v=[...c.getElementsByTagName('t')].map(x=>x.textContent).join('');else if(ve)v=ve.textContent;(grid[ri]=grid[ri]||[])[ci]=v});
const hdr=(grid[0]||[]).map(h=>String(h||'').trim());return grid.slice(1).filter(Boolean).map(r=>Object.fromEntries(hdr.map((h,i)=>[h,r[i]??'']).filter(x=>x[0])))}
const N_R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
