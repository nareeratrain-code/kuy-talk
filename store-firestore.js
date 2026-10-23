// Firestore adapter (STORAGE=firestore). Same model as the Postgres adapter: in-memory working copy,
// debounced flush of only changed docs. Layout (all collections prefixed "kt_"):
//   kt_users/{id}            {j: JSON, g: geohash, lat, lng}     ← geo queries via geohash ranges
//   kt_sessions/{hash}       {j}                                 (maps of objects → one doc per key)
//   kt_messages/{mid~hash_n} {k: mid, o: order, j}               (maps of arrays → one doc per item)
//   kt_rooms/{room~hash_n}   {k: room, o, j}
//   kt_<array>/{hash_n}      {o, j}   likes, matches, moments, friends, blocks, reports, visits, consents, tickets, dataRequests, trafficLog
// Values are stored as JSON strings (j) so nested arrays / undefined never break Firestore's type rules.
const crypto=require('crypto');const geofire=require('geofire-common');const FB=require('./firebase');
const h=s=>crypto.createHash('sha1').update(s).digest('hex').slice(0,20);
const enc=k=>String(k).replace(/[\/~]/g,c=>c==='/'?'%2F':'%7E');
const OBJ=new Set(['users','sessions','pics']),MAPARR=new Set(['messages','rooms']);
async function init(S,blank){const fs=require('firebase-admin/firestore');const db0=fs.getFirestore(FB.admin());
 try{db0.settings({ignoreUndefinedProperties:true})}catch(e){}
 const db=JSON.parse(JSON.stringify(blank));const last=new Map();// docPath -> hash ; order per path
 const keys=new Set(Object.keys(blank));
 // load
 const extra=(await db0.listCollections()).map(c=>c.id).filter(id=>id.startsWith('kt_')).map(id=>id.slice(3));extra.forEach(k=>keys.add(k));
 await Promise.all([...keys].map(async K=>{const snap=await db0.collection('kt_'+K).get();if(snap.empty)return;
  if(OBJ.has(K)){db[K]={};snap.forEach(d=>{const x=d.data();db[K][x.k||d.id]=JSON.parse(x.j);last.set(K+'/'+d.id,{hs:h(x.j)})})}
  else if(MAPARR.has(K)){const g={};snap.forEach(d=>{const x=d.data();(g[x.k]=g[x.k]||[]).push([x.o,JSON.parse(x.j)]);last.set(K+'/'+d.id,{o:x.o})});db[K]={};for(const k in g)db[K][k]=g[k].sort((a,b)=>a[0]-b[0]).map(a=>a[1])}
  else{const L=[];snap.forEach(d=>{const x=d.data();if(x.o==null){db[K]=JSON.parse(x.j);return}L.push([x.o,JSON.parse(x.j)]);last.set(K+'/'+d.id,{o:x.o})});if(L.length)db[K]=L.sort((a,b)=>a[0]-b[0]).map(a=>a[1])}}));
 for(const k in blank)if(db[k]==null)db[k]=JSON.parse(JSON.stringify(blank[k]));
 let seq=0;const nextO=()=>Date.now()*1000+(seq=(seq+1)%1000);
 let t=null,busy=false,again=false;
 const flush=async()=>{if(busy){again=true;return}busy=true;try{const ops=[],seen=new Set();
  const arr=(K,prefix,k,list)=>{const cnt={};let prevO=0;for(const it of list){const j=JSON.stringify(it);if(j===undefined)continue;const hs=h(j);const n=cnt[hs]=(cnt[hs]||0)+1;const id=prefix+hs+'_'+n,p=K+'/'+id;seen.add(p);
    const L=last.get(p);if(L){prevO=L.o;continue}const o=Math.max(nextO(),prevO+1);prevO=o;last.set(p,{o});ops.push(['set',p,k!=null?{k,o,j}:{o,j}])}};
  for(const K of Object.keys(db)){const v=db[K];
   if(OBJ.has(K)){for(const [id,x] of Object.entries(v||{})){const j=JSON.stringify(x),hs=h(j),di=enc(id),p=K+'/'+di;seen.add(p);const L=last.get(p);if(L&&L.hs===hs)continue;last.set(p,{hs});const doc={k:id,j};
     if(K==='users'){const g=x&&x.geo&&!x.geo.paused&&x.geo.lat!=null?x.geo:null;doc.lat=g?g.lat:null;doc.lng=g?g.lng:null;doc.g=g?geofire.geohashForLocation([g.lat,g.lng]):null}ops.push(['set',p,doc])}}
   else if(MAPARR.has(K)){for(const [k,list] of Object.entries(v||{}))arr(K,enc(k)+'~',k,Array.isArray(list)?list:[])}
   else if(Array.isArray(v))arr(K,'',null,v);
   else{const j=JSON.stringify(v),p=K+'/_',hs=h(j);seen.add(p);const L=last.get(p);if(!(L&&L.hs===hs)){last.set(p,{hs});ops.push(['set',p,{j}])}}}
  for(const p of [...last.keys()])if(!seen.has(p)){last.delete(p);ops.push(['del',p])}
  for(let i=0;i<ops.length;i+=450){const b=db0.batch();for(const [op,p,d] of ops.slice(i,i+450)){const [K,...r]=p.split('/');const ref=db0.collection('kt_'+K).doc(r.join('/'));op==='set'?b.set(ref,d):b.delete(ref)}
   try{await b.commit()}catch(e){for(const [,p] of ops.slice(i))last.delete(p);throw e}}
 ;S.lastErr=null}catch(e){S.lastErr=String(e.message).slice(0,200);console.error('firestore flush failed',e.message)}finally{busy=false;if(again){again=false;flush()}}};
 S.db=db;S.kind='firestore';S.save=()=>{clearTimeout(t);t=setTimeout(flush,300)};S.flush=flush;S.firestore=db0;
 // geo query: geohash range scans on kt_users.g, then exact haversine
 S.nearby=async(lat,lng,km,limit=500)=>{const c=[lat,lng],B=geofire.geohashQueryBounds(c,km*1000);const out=new Map();
  await Promise.all(B.map(async([s,e])=>{const q=await db0.collection('kt_users').orderBy('g').startAt(s).endAt(e).limit(limit).get();q.forEach(d=>{const x=d.data();if(x.lat==null)return;const dk=geofire.distanceBetween([x.lat,x.lng],c);if(dk<=km)out.set(x.k||d.id,dk)})}));
  return [...out].map(([id,k])=>({id,km:k})).sort((a,b)=>a.km-b.km).slice(0,limit)};
 return S}
module.exports={init};
