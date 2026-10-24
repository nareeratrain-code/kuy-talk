// Import a Kuy Talk JSON store into PostgreSQL.
// Usage: DATABASE_URL='postgresql://...' node scripts/migrate-to-postgres.js [data.json]
const fs=require('fs');
const path=require('path');
const {Pool}=require('pg');

const url=process.env.DATABASE_URL;
if(!url){console.error('DATABASE_URL is required');process.exit(1)}

const file=process.argv[2]||path.join(process.env.DATA_DIR||path.join(__dirname,'..'),'data.json');
if(!fs.existsSync(file)){console.error('JSON store not found:',file);process.exit(1)}

let db;
try{db=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){console.error('Cannot parse JSON store:',e.message);process.exit(1)}

const ssl=/sslmode=disable|localhost|127\.0\.0\.1/.test(url)?false:{rejectUnauthorized:false};
const pool=new Pool({connectionString:url,ssl,max:3});

async function main(){
  const c=await pool.connect();
  try{
    await c.query('begin');
    await c.query(`create table if not exists kt_users(
      id text primary key,
      data jsonb not null,
      lat double precision,
      lng double precision,
      updated timestamptz default now()
    )`);
    await c.query('create index if not exists kt_users_latlng on kt_users(lat,lng)');
    await c.query(`create table if not exists kt_kv(
      k text primary key,
      v jsonb not null,
      updated timestamptz default now()
    )`);

    const users=db.users||{};
    for(const [id,u] of Object.entries(users)){
      const g=u.geo&&!u.geo.paused?u.geo:null;
      await c.query(`insert into kt_users(id,data,lat,lng,updated)
        values($1,$2,$3,$4,now())
        on conflict(id) do update set data=$2,lat=$3,lng=$4,updated=now()`,
        [id,u,g?.lat??null,g?.lng??null]);
    }

    const messages=db.messages||{};
    for(const [mid,value] of Object.entries(messages)){
      await c.query(`insert into kt_kv(k,v,updated) values($1,$2,now())
        on conflict(k) do update set v=$2,updated=now()`,[`m:${mid}`,value]);
    }
    for(const [key,value] of Object.entries(db)){
      if(key==='users'||key==='messages')continue;
      await c.query(`insert into kt_kv(k,v,updated) values($1,$2,now())
        on conflict(k) do update set v=$2,updated=now()`,[key,value]);
    }
    await c.query('commit');
    console.log(`Migration complete: ${Object.keys(users).length} users, ${Object.keys(messages).length} message threads, ${Object.keys(db).length-2} shared collections`);
  }catch(e){await c.query('rollback').catch(()=>{});throw e}
  finally{c.release();await pool.end()}
}

main().catch(e=>{console.error('Migration failed:',e.message);process.exit(1)});
