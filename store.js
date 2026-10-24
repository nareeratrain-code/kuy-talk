// Storage: Postgres when DATABASE_URL is set (rows per user / per chat + geo columns),
// otherwise a local JSON file. The app keeps a working copy in memory; save() flushes
// only changed entries (debounced).
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const blank={users:{},pics:{},likes:[],matches:[],messages:{},rooms:{},moments:[],friends:[],blocks:[],reports:[],visits:[],sessions:{},consents:[],tickets:[],dataRequests:[],trafficLog:[]};
const S={db:null,kind:'json',pool:null,save:()=>{},nearby:null,ready:false,lastErr:null};
const h=s=>crypto.createHash('sha1').update(s).digest('base64');
async function init(){const URL=process.env.DATABASE_URL;let KIND=(process.env.STORAGE||'').trim().toLowerCase();
 const required=['1','true','yes','on'].includes(String(process.env.REQUIRE_PERSISTENT_DB||'').trim().toLowerCase());
 if(!KIND&&!URL&&require('./firebase').serviceAccount())KIND='firestore';
 if(KIND==='firestore'){try{await require('./store-firestore').init(S,blank)}catch(e){S.lastErr='firestore init: '+String(e.message).slice(0,200);if(required)throw new Error('Persistent database is required, but Firestore failed to initialise: '+e.message);console.error('firestore init failed, falling back to json:',e.message);KIND='json'}}
 if(S.kind==='firestore'){}
 else if(URL&&KIND!=='json'){const {Pool}=require('pg');const ssl=/sslmode=disable|localhost|127\.0\.0\.1/.test(URL)?false:{rejectUnauthorized:false};
  const pool=S.pool=new Pool({connectionString:URL,ssl,max:5});
  await pool.query(`create table if not exists kt_users(id text primary key,data jsonb not null,lat double precision,lng double precision,updated timestamptz default now());
   create index if not exists kt_users_latlng on kt_users(lat,lng);
   create table if not exists kt_kv(k text primary key,v jsonb not null,updated timestamptz default now());`);
  const db=JSON.parse(JSON.stringify(blank));const last=new Map();
  for(const r of (await pool.query('select id,data from kt_users')).rows){db.users[r.id]=r.data;last.set('u:'+r.id,h(JSON.stringify(r.data)))}
  for(const r of (await pool.query('select k,v from kt_kv')).rows){if(r.k.startsWith('m:'))db.messages[r.k.slice(2)]=r.v;else db[r.k]=r.v;last.set(r.k,h(JSON.stringify(r.v)))}
  for(const k in blank)if(db[k]==null)db[k]=JSON.parse(JSON.stringify(blank[k]));
  S.db=db;S.kind='postgres';let t=null,busy=false,again=false;
  const flush=async()=>{if(busy){again=true;return}busy=true;try{const seen=new Set(),q=[];
   for(const [id,u] of Object.entries(db.users)){const k='u:'+id,s=JSON.stringify(u),hs=h(s);seen.add(k);if(last.get(k)!==hs){last.set(k,hs);const g=u.geo&&!u.geo.paused?u.geo:null;q.push(['insert into kt_users(id,data,lat,lng,updated) values($1,$2,$3,$4,now()) on conflict(id) do update set data=$2,lat=$3,lng=$4,updated=now()',[id,s,g?g.lat:null,g?g.lng:null]])}}
   const kv=(k,v)=>{const s=JSON.stringify(v),hs=h(s);seen.add(k);if(last.get(k)!==hs){last.set(k,hs);q.push(['insert into kt_kv(k,v,updated) values($1,$2,now()) on conflict(k) do update set v=$2,updated=now()',[k,s]])}};
   for(const k in db)if(k!=='users'&&k!=='messages')kv(k,db[k]);for(const [mid,v] of Object.entries(db.messages))kv('m:'+mid,v);
   for(const k of [...last.keys()])if(!seen.has(k)){last.delete(k);q.push(k.startsWith('u:')?['delete from kt_users where id=$1',[k.slice(2)]]:['delete from kt_kv where k=$1',[k]])}
   if(q.length){const c=await pool.connect();try{await c.query('begin');for(const [s,a] of q)await c.query(s,a);await c.query('commit')}catch(e){await c.query('rollback').catch(()=>{});for(const k of last.keys())last.set(k,'');throw e}finally{c.release()}}
  }catch(e){console.error('db flush failed',e.message)}finally{busy=false;if(again){again=false;flush()}}};
  S.save=()=>{clearTimeout(t);t=setTimeout(flush,300)};S.flush=flush;
  // SQL geo query (bounding box on indexed lat/lng, then exact haversine)
  S.nearby=async(lat,lng,km,limit=500)=>{const dl=km/111,dg=km/(111*Math.cos(lat*Math.PI/180));
   const r=await pool.query(`select id,(6371*2*asin(sqrt(power(sin(radians(lat-$1)/2),2)+cos(radians($1))*cos(radians(lat))*power(sin(radians(lng-$2)/2),2)))) as km from kt_users
    where lat between $1-$3 and $1+$3 and lng between $2-$4 and $2+$4 order by km limit $5`,[lat,lng,dl,dg,limit]);return r.rows.filter(x=>x.km<=km)};
 }else{if(required)throw new Error('Persistent database is required: set DATABASE_URL to a PostgreSQL connection string or configure STORAGE=firestore');const DIR=process.env.DATA_DIR||__dirname;fs.mkdirSync(DIR,{recursive:true});const F=path.join(DIR,'data.json');
  const db=Object.assign(JSON.parse(JSON.stringify(blank)),fs.existsSync(F)?JSON.parse(fs.readFileSync(F)):{});for(const k in blank)if(db[k]==null)db[k]=JSON.parse(JSON.stringify(blank[k]));
  S.db=db;let t=null;const flush=()=>{fs.writeFileSync(F+'.tmp',JSON.stringify(db));fs.renameSync(F+'.tmp',F)};S.save=()=>{clearTimeout(t);t=setTimeout(flush,200)};S.flush=async()=>flush()}
 S.ready=true;return S}
module.exports=S;module.exports.init=init;
