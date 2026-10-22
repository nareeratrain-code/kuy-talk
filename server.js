const express=require('express'),http=require('http'),fs=require('fs'),crypto=require('crypto'),path=require('path');
// --- env ---
const ENVF=path.join(__dirname,'.env');if(fs.existsSync(ENVF))for(const l of fs.readFileSync(ENVF,'utf8').split('\n')){const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2]}
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'';
const PROVINCES=require('./provinces');const PROV=new Set(PROVINCES.map(p=>p.id));
const app=express(),srv=http.createServer(app),io=require('socket.io')(srv,{maxHttpBufferSize:3e6});
app.use(express.json({limit:'4mb'}));app.set('trust proxy',1);app.get('/healthz',(req,res)=>res.send('ok'));
// --- admin (basic auth) ---
function adminAuth(req,res,next){const h=req.headers.authorization||'';const [u,p]=Buffer.from(h.split(' ')[1]||'','base64').toString().split(':');
 const ok=ADMIN_PASSWORD&&p&&p.length===ADMIN_PASSWORD.length&&crypto.timingSafeEqual(Buffer.from(p),Buffer.from(ADMIN_PASSWORD));
 if(!ok){res.set('WWW-Authenticate','Basic realm="Kuy Talk Admin"');return res.status(401).send('ต้องใช้รหัสผู้ดูแล')}next()}
app.get(['/admin','/admin.html'],adminAuth,(req,res)=>res.sendFile(path.join(__dirname,'admin','admin.html')));
app.use(express.static(path.join(__dirname,'public')));
// --- db ---
const DATA_DIR=process.env.DATA_DIR||__dirname;fs.mkdirSync(DATA_DIR,{recursive:true});const DB=path.join(DATA_DIR,'data.json');
const blank={users:{},likes:[],matches:[],messages:{},rooms:{},moments:[],friends:[],blocks:[],reports:[]};
let db=Object.assign({},blank,fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB)):{});
let saveT=null;const save=()=>{clearTimeout(saveT);saveT=setTimeout(()=>fs.writeFileSync(DB,JSON.stringify(db)),200)};
const id=()=>crypto.randomBytes(8).toString('hex');
const FREE_SWIPES=100,DAY=864e5,PREMIUM_DAYS=30;
const PRICES={premium:100,likesme:30,superlike:5,filter:10};
const PACKS=[{id:'p1',coins:100,thb:35},{id:'p2',coins:300,thb:99},{id:'p3',coins:1000,thb:290}];
const BOTS=[['มายด์',22,'f','ชอบคาเฟ่ แมว และดูซีรีส์ 🐱','🌸'],['ต้นกล้า',25,'m','สายเที่ยวภูเขา ⛰️ หาเพื่อนคุย','🏔️'],['แพรว',24,'f','นักร้องคาราโอเกะตัวยง 🎤','🎤'],['บอส',27,'m','โปรแกรมเมอร์ ชอบเล่นเกม 🎮','🎮'],['ใบเตย',23,'f','รักการทำอาหาร 🍜','🍜'],['เจ',26,'m','ฟิตเนส + กาแฟ ☕','💪'],['น้ำหวาน',21,'f','ชอบถ่ายรูป 📷','📷'],['กัปตัน',29,'m','นักบินฝึกหัด ✈️','✈️']];
if(!Object.values(db.users).some(u=>u.bot)){BOTS.forEach(([name,age,gender,bio,avatar])=>{const i=id();db.users[i]={id:i,name,age,gender,bio,avatar,bot:true}});
 const bs=Object.values(db.users).filter(u=>u.bot);
 ['วันนี้อากาศดีมาก ไปคาเฟ่กันไหม ☕','เพิ่งกลับจากเที่ยวเชียงใหม่ หนาวมาก ⛰️','ใครชอบร้องเพลงบ้าง 🎤','ทำต้มยำกุ้งครั้งแรก อร่อยกว่าที่คิด 🍜'].forEach((t,i)=>db.moments.push({id:id(),uid:bs[i*2].id,text:t,photo:null,ts:Date.now()-i*36e5,likes:[],comments:[]}));save()}
const REPLIES=['สวัสดีค่า/ครับ 😊','วันนี้เป็นไงบ้าง?','จริงเหรอ น่าสนใจมาก!','ชอบทำอะไรตอนว่างๆ?','555 ตลกดี','อยู่แถวไหนเหรอ?','ยินดีที่ได้รู้จักนะ 💕','กินข้าวยัง?','เล่าต่อสิ อยากรู้ 👀'];
const ROOM_BOT=['มีใครอยู่แถวนี้บ้าง 👋','คืนนี้ไปกินอะไรดี?','ร้านกาแฟแถวนี้ร้านไหนดีคะ ☕','รถติดมากวันนี้ 😩','ใครว่างไปวิ่งเย็นนี้บ้าง 🏃','ฝนตกอีกแล้ว ☔','ยินดีต้อนรับคนมาใหม่นะ 😊'];
const pick=a=>a[Math.floor(Math.random()*a.length)];
// --- text safety ---
const BAD=['เหี้ย','สัส','ควาย','แม่ง','เย็ด','fuck','shit','bitch','asshole'];
const clean=t=>{t=String(t??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/[<>]/g,c=>c==='<'?'‹':'›').trim().slice(0,1000);for(const w of BAD)t=t.split(w).join('*'.repeat([...w].length));return t};
// per-key rate limiter: max n events / win ms
const buckets=new Map();const limited=(k,n=6,win=8000)=>{const now=Date.now();const a=(buckets.get(k)||[]).filter(t=>now-t<win);if(a.length>=n){buckets.set(k,a);return true}a.push(now);buckets.set(k,a);return false};
// --- helpers ---
const isPrem=u=>!!(u&&u.premiumUntil&&u.premiumUntil>Date.now());
const pub=u=>u&&({id:u.id,name:u.name,age:u.age,gender:u.gender,bio:u.bio,avatar:u.avatar,bot:!!u.bot,premium:isPrem(u)});
const today=()=>new Date().toISOString().slice(0,10);
const blocked=(a,b)=>db.blocks.some(x=>(x.by===a&&x.target===b)||(x.by===b&&x.target===a));
const me=u=>({...pub(u),coins:u.coins,premium:isPrem(u),premiumUntil:isPrem(u)?u.premiumUntil:null,unlimited:isPrem(u),swipesUsed:u.swipes,free:FREE_SWIPES,swipesLeft:isPrem(u)?'∞':Math.max(0,FREE_SWIPES-u.swipes),luckyLeft:isPrem(u)?'∞':(u.luckyDate===today()?0:1)});
function auth(req,res,next){const u=db.users[req.headers['x-token']];if(!u||u.bot)return res.status(401).json({error:'กรุณาสมัครก่อน'});if(u.banned)return res.status(403).json({error:'บัญชีนี้ถูกระงับ'});
 if(u.swipeDate!==today()){u.swipeDate=today();u.swipes=0;save()}req.u=u;next()}
const matchOf=(a,b)=>db.matches.find(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a));
function makeMatch(a,b){let m=matchOf(a,b);if(m)return m;m={id:id(),a,b,ts:Date.now()};db.matches.push(m);io.to(b).emit('match',{id:m.id,other:pub(db.users[a])});io.to(a).emit('match',{id:m.id,other:pub(db.users[b])});save();return m}
const others=u=>Object.values(db.users).filter(x=>x.id!==u.id&&!x.banned&&!blocked(u.id,x.id));
// --- account ---
app.post('/api/signup',(req,res)=>{if(limited('signup:'+req.ip,10,60000))return res.status(429).json({error:'สมัครถี่เกินไป'});const {name,age,gender,bio,avatar}=req.body||{};if(!name||!(+age>=18)||+age>120)return res.status(400).json({error:'ต้องกรอกชื่อและอายุ 18+'});
 const av=typeof avatar==='string'&&(avatar.length<16||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))&&avatar.length<600000?avatar:'🙂';
 const i=crypto.randomBytes(16).toString('hex');db.users[i]={id:i,name:clean(name).slice(0,30)||'ผู้ใช้',age:+age,gender:['m','f','x'].includes(gender)?gender:'x',bio:clean(bio).slice(0,200),avatar:av,coins:50,swipes:0,swipeDate:today(),created:Date.now()};save();res.json({token:i})});
app.get('/api/me',auth,(req,res)=>res.json(me(req.u)));
app.post('/api/profile',auth,(req,res)=>{const u=req.u,{name,bio}=req.body;if(name)u.name=clean(name).slice(0,30);if(bio!=null)u.bio=clean(bio).slice(0,200);save();res.json(me(u))});
app.get('/api/config',(req,res)=>res.json({packs:PACKS,prices:PRICES,free:FREE_SWIPES,premiumDays:PREMIUM_DAYS,provinces:PROVINCES}));
app.get('/api/user/:id',auth,(req,res)=>{const t=db.users[req.params.id];if(!t||blocked(req.u.id,t.id))return res.status(404).json({error:'ไม่พบ'});res.json(pub(t))});
// --- swipe / match ---
app.get('/api/cards',auth,(req,res)=>{const seen=new Set(db.likes.filter(l=>l.from===req.u.id).map(l=>l.to));res.json(others(req.u).filter(u=>!seen.has(u.id)).map(pub))});
app.get('/api/people',auth,(req,res)=>{const u=req.u;res.json(others(u).map(x=>{const m=matchOf(u.id,x.id);return{...pub(x),liked:db.likes.some(l=>l.from===u.id&&l.to===x.id&&l.like),mid:m&&m.id}}))});
app.post('/api/swipe',auth,(req,res)=>{const u=req.u,{to,dir,superlike}=req.body,t=db.users[to];if(!t||t.id===u.id||blocked(u.id,to))return res.status(404).json({error:'ไม่พบ'});
 if(!isPrem(u)&&u.swipes>=FREE_SWIPES)return res.status(402).json({error:`กดหัวใจ/ปัดฟรีครบ ${FREE_SWIPES} ครั้งวันนี้แล้ว`});
 if(superlike){if(u.coins<PRICES.superlike)return res.status(402).json({error:'เหรียญไม่พอ'});u.coins-=PRICES.superlike}
 u.swipes++;db.likes=db.likes.filter(l=>!(l.from===u.id&&l.to===to));const like=dir==='right'||!!superlike;db.likes.push({from:u.id,to,like,superlike:!!superlike,ts:Date.now()});let match=null;
 if(like){const back=t.bot?(superlike||Math.random()<0.7):db.likes.some(l=>l.from===to&&l.to===u.id&&l.like);
  if(t.bot&&back)db.likes.push({from:to,to:u.id,like:true,ts:Date.now()});
  if(back)match=makeMatch(u.id,to)}
 save();res.json({match:match&&{id:match.id,other:pub(t)},me:me(u)})});
app.get('/api/matches',auth,(req,res)=>res.json(db.matches.filter(m=>(m.a===req.u.id||m.b===req.u.id)).map(m=>({m,o:db.users[m.a===req.u.id?m.b:m.a]})).filter(x=>x.o&&!x.o.banned&&!blocked(req.u.id,x.o.id)).map(({m,o})=>({id:m.id,other:pub(o),last:(db.messages[m.id]||[]).slice(-1)[0]}))));
app.get('/api/messages/:mid',auth,(req,res)=>{const m=db.matches.find(x=>x.id===req.params.mid);if(!m||(m.a!==req.u.id&&m.b!==req.u.id))return res.status(404).end();res.json(db.messages[m.id]||[])});
app.post('/api/likes-me',auth,(req,res)=>{const u=req.u;if(!isPrem(u)){if(u.coins<PRICES.likesme)return res.status(402).json({error:'เหรียญไม่พอ'});u.coins-=PRICES.likesme;save()}
 const mine=new Set(db.likes.filter(l=>l.from===u.id).map(l=>l.to));res.json({me:me(u),list:db.likes.filter(l=>l.to===u.id&&l.like&&!mine.has(l.from)&&db.users[l.from]&&!blocked(u.id,l.from)).map(l=>({...pub(db.users[l.from]),superlike:l.superlike}))})});
// lucky (1 free/day, premium unlimited) & shake: pair with a random non-matched profile
function randomPair(u){const pool=others(u).filter(x=>!matchOf(u.id,x.id));const t=pick(pool.length?pool:others(u));if(!t)return null;const m=makeMatch(u.id,t.id);return{user:pub(t),mid:m.id}}
app.post('/api/lucky',auth,(req,res)=>{const u=req.u;if(!isPrem(u)&&u.luckyDate===today())return res.status(402).json({error:'ใช้สิทธิ์สุ่มฟรีวันนี้แล้ว! อัพเกรด Premium เพื่อสุ่มไม่จำกัด'});u.luckyDate=today();const r=randomPair(u);save();if(!r)return res.status(404).json({error:'ยังไม่มีคนให้สุ่ม'});res.json({...r,me:me(u)})});
app.post('/api/shake',auth,(req,res)=>{if(limited('shake:'+req.u.id,5,60000))return res.status(429).json({error:'เขย่าถี่เกินไป รอสักครู่'});const r=randomPair(req.u);if(!r)return res.status(404).json({error:'ยังไม่มีคนใกล้ๆ'});res.json(r)});
// --- coins / premium (SIMULATED payments only) ---
const grantPremium=u=>{u.premiumUntil=Math.max(Date.now(),u.premiumUntil||0)+PREMIUM_DAYS*DAY};
app.post('/api/topup',auth,(req,res)=>{const p=PACKS.find(x=>x.id===req.body.pack);if(!p)return res.status(400).end();req.u.coins+=p.coins;save();res.json(me(req.u))});
app.post('/api/subscribe',auth,(req,res)=>{grantPremium(req.u);save();res.json(me(req.u))});// simulated ฿50 / 30 days
app.post('/api/buy',auth,(req,res)=>{const u=req.u;if(!['premium','unlimited'].includes(req.body.item))return res.status(400).end();if(u.coins<PRICES.premium)return res.status(402).json({error:'เหรียญไม่พอ'});u.coins-=PRICES.premium;grantPremium(u);save();res.json(me(u))});
// --- block / report ---
app.get('/api/blocks',auth,(req,res)=>res.json(db.blocks.filter(b=>b.by===req.u.id).map(b=>({...pub(db.users[b.target]),reason:b.reason,ts:b.ts})).filter(x=>x.id)));
app.post('/api/block',auth,(req,res)=>{const t=db.users[req.body.id];if(!t||t.id===req.u.id)return res.status(404).json({error:'ไม่พบผู้ใช้'});if(!db.blocks.some(b=>b.by===req.u.id&&b.target===t.id))db.blocks.push({by:req.u.id,target:t.id,reason:clean(req.body.reason).slice(0,100),ts:Date.now()});save();res.json({ok:true})});
app.post('/api/unblock',auth,(req,res)=>{db.blocks=db.blocks.filter(b=>!(b.by===req.u.id&&b.target===req.body.id));save();res.json({ok:true})});
app.post('/api/report',auth,(req,res)=>{if(limited('report:'+req.u.id,10,3600e3))return res.status(429).json({error:'รายงานถี่เกินไป'});const t=db.users[req.body.id];if(!t)return res.status(404).json({error:'ไม่พบผู้ใช้'});
 const r={id:id(),by:req.u.id,target:t.id,category:clean(req.body.category).slice(0,60)||'other',severity:['low','medium','high','critical'].includes(req.body.severity)?req.body.severity:'low',detail:clean(req.body.detail).slice(0,1000),context:clean(req.body.context).slice(0,100),status:'pending',ts:Date.now()};db.reports.push(r);save();res.json({ok:true,id:r.id})});
// --- moments ---
const momentOut=(m,u)=>({id:m.id,user:pub(db.users[m.uid]),text:m.text,photo:m.photo,ts:m.ts,likes:m.likes.length,liked:m.likes.includes(u.id),comments:m.comments.filter(c=>db.users[c.uid]&&!blocked(u.id,c.uid)).map(c=>({user:pub(db.users[c.uid]),text:c.text,ts:c.ts}))});
app.get('/api/moments',auth,(req,res)=>res.json(db.moments.filter(m=>db.users[m.uid]&&!db.users[m.uid].banned&&!blocked(req.u.id,m.uid)).sort((a,b)=>b.ts-a.ts).slice(0,100).map(m=>momentOut(m,req.u))));
app.post('/api/moments',auth,(req,res)=>{if(limited('post:'+req.u.id,5,60000))return res.status(429).json({error:'โพสต์ถี่เกินไป'});const text=clean(req.body.text).slice(0,500);const ph=req.body.photo;
 const photo=typeof ph==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(ph)&&ph.length<1.5e6?ph:null;if(!text&&!photo)return res.status(400).json({error:'เขียนอะไรสักหน่อยนะ'});
 const m={id:id(),uid:req.u.id,text,photo,ts:Date.now(),likes:[],comments:[]};db.moments.push(m);if(db.moments.length>500)db.moments.shift();save();res.json(momentOut(m,req.u))});
app.post('/api/moments/:id/like',auth,(req,res)=>{const m=db.moments.find(x=>x.id===req.params.id);if(!m)return res.status(404).end();const i=m.likes.indexOf(req.u.id);i>=0?m.likes.splice(i,1):m.likes.push(req.u.id);save();res.json(momentOut(m,req.u))});
app.post('/api/moments/:id/comment',auth,(req,res)=>{if(limited('cmt:'+req.u.id,8,60000))return res.status(429).json({error:'คอมเมนต์ถี่เกินไป'});const m=db.moments.find(x=>x.id===req.params.id);const text=clean(req.body.text).slice(0,300);if(!m||!text)return res.status(400).end();m.comments.push({uid:req.u.id,text,ts:Date.now()});
 const owner=db.users[m.uid];if(owner&&owner.bot&&Math.random()<0.6)setTimeout(()=>{m.comments.push({uid:owner.id,text:pick(['ขอบคุณน้า 💕','555 ใช่เลย','จริงด้วย!']),ts:Date.now()});save()},1500);save();res.json(momentOut(m,req.u))});
app.delete('/api/moments/:id',auth,(req,res)=>{db.moments=db.moments.filter(m=>!(m.id===req.params.id&&m.uid===req.u.id));save();res.json({ok:true})});
// --- friends ---
const fr=(a,b)=>db.friends.find(f=>(f.a===a&&f.b===b)||(f.a===b&&f.b===a));
app.get('/api/friends',auth,(req,res)=>{const u=req.u.id,L=db.friends.filter(f=>(f.a===u||f.b===u)&&!blocked(f.a,f.b));const o=f=>pub(db.users[f.a===u?f.b:f.a]);
 res.json({friends:L.filter(f=>f.status==='accepted').map(f=>({...o(f),mid:(matchOf(f.a,f.b)||{}).id,online:isOnline(f.a===u?f.b:f.a)})),incoming:L.filter(f=>f.status==='pending'&&f.b===u).map(o),outgoing:L.filter(f=>f.status==='pending'&&f.a===u).map(o)})});
app.post('/api/friends/request',auth,(req,res)=>{const u=req.u,t=db.users[req.body.id];if(!t||t.id===u.id||blocked(u.id,t.id))return res.status(404).json({error:'ไม่พบผู้ใช้'});if(!matchOf(u.id,t.id))return res.status(400).json({error:'เพิ่มเพื่อนได้เฉพาะคนที่แมตช์กันแล้ว'});
 let f=fr(u.id,t.id);if(!f){f={a:u.id,b:t.id,status:'pending',ts:Date.now()};db.friends.push(f)}else if(f.status==='pending'&&f.b===u.id)f.status='accepted';
 if(t.bot)f.status='accepted';save();io.to(t.id).emit('friend',{from:pub(u),status:f.status});res.json({status:f.status})});
app.post('/api/friends/respond',auth,(req,res)=>{const f=db.friends.find(f=>f.a===req.body.id&&f.b===req.u.id&&f.status==='pending');if(!f)return res.status(404).end();if(req.body.accept)f.status='accepted';else db.friends.splice(db.friends.indexOf(f),1);save();io.to(f.a).emit('friend',{from:pub(req.u),status:req.body.accept?'accepted':'declined'});res.json({ok:true})});
app.post('/api/friends/remove',auth,(req,res)=>{db.friends=db.friends.filter(f=>!((f.a===req.u.id&&f.b===req.body.id)||(f.b===req.u.id&&f.a===req.body.id)));save();res.json({ok:true})});
// --- admin api ---
app.get('/api/admin/overview',adminAuth,(req,res)=>{const U=Object.values(db.users).filter(u=>!u.bot);res.json({users:U.map(u=>({...pub(u),banned:!!u.banned,coins:u.coins,created:u.created,online:isOnline(u.id),reportsAgainst:db.reports.filter(r=>r.target===u.id).length})),
 reports:db.reports.slice().reverse().map(r=>({...r,byName:db.users[r.by]?.name,targetName:db.users[r.target]?.name})),stats:{users:U.length,online:U.filter(u=>isOnline(u.id)).length,matches:db.matches.length,moments:db.moments.length,pending:db.reports.filter(r=>r.status==='pending').length}})});
app.post('/api/admin/ban',adminAuth,(req,res)=>{const u=db.users[req.body.id];if(!u||u.bot)return res.status(404).end();u.banned=!!req.body.banned;save();if(u.banned)io.in(u.id).disconnectSockets(true);res.json({ok:true})});
app.post('/api/admin/report',adminAuth,(req,res)=>{const r=db.reports.find(x=>x.id===req.body.id);if(!r)return res.status(404).end();r.status=['pending','resolved','dismissed'].includes(req.body.status)?req.body.status:'resolved';save();res.json({ok:true})});
// --- sockets ---
const online=new Map();const isOnline=uid=>(online.get(uid)||0)>0;
let queue=[];const rand={};
const roomCount=pid=>(io.sockets.adapter.rooms.get('room:'+pid)?.size||0)+(HOT.includes(pid)?2:0);
const HOT=['bangkok','chiangmai','khonkaen','phuket','chonburi','nakhonratchasima','songkhla','udonthani'];
const counts=()=>Object.fromEntries(PROVINCES.map(p=>[p.id,roomCount(p.id)]));
let countT=null;const pushCounts=()=>{clearTimeout(countT);countT=setTimeout(()=>io.emit('room:counts',counts()),300)};
function roomPost(pid,u,text,isBot){const msg={id:id(),uid:u.id,name:u.name,avatar:u.avatar,bot:!!isBot,text,ts:Date.now()};const r=db.rooms[pid]=db.rooms[pid]||[];r.push(msg);if(r.length>100)r.splice(0,r.length-100);save();
 for(const sid of io.sockets.adapter.rooms.get('room:'+pid)||[]){const s=io.sockets.sockets.get(sid);if(s&&!blocked(s.uid,u.id))s.emit('room:msg',{room:pid,...msg})}}
// bots chat in popular rooms that have humans
setInterval(()=>{const live=HOT.filter(p=>io.sockets.adapter.rooms.get('room:'+p)?.size);if(!live.length)return;const p=pick(live);const b=pick(Object.values(db.users).filter(u=>u.bot));roomPost(p,b,pick(ROOM_BOT),true)},Number(process.env.ROOM_BOT_MS||25000));
io.on('connection',s=>{const u=db.users[s.handshake.auth.token];if(!u||u.bot||u.banned)return s.disconnect();s.uid=u.id;s.join(u.id);online.set(u.id,(online.get(u.id)||0)+1);s.emit('room:counts',counts());
 const flood=(k,n,w)=>{if(limited(k+':'+u.id,n,w)){s.emit('err','ส่งข้อความเร็วเกินไป กรุณารอสักครู่ ⏳');return true}return false};
 s.on('msg',({mid,text}={})=>{if(flood('msg',8,8000))return;const m=db.matches.find(x=>x.id===mid);text=clean(text);if(!m||(m.a!==u.id&&m.b!==u.id)||!text)return;const o=m.a===u.id?m.b:m.a;if(blocked(u.id,o))return s.emit('err','ไม่สามารถส่งข้อความถึงผู้ใช้นี้ได้');
  const msg={from:u.id,text,ts:Date.now()};(db.messages[mid]=db.messages[mid]||[]).push(msg);save();io.to(u.id).to(o).emit('msg',{mid,...msg});
  if(db.users[o].bot){io.to(u.id).emit('typing',{mid});setTimeout(()=>{const r={from:o,text:pick(REPLIES),ts:Date.now()};db.messages[mid].push(r);save();io.to(u.id).emit('msg',{mid,...r})},1200+Math.random()*1500)}});
 s.on('typing',({mid}={})=>{const m=db.matches.find(x=>x.id===mid);if(!m||(m.a!==u.id&&m.b!==u.id)||limited('ty:'+u.id,4,3000))return;const o=m.a===u.id?m.b:m.a;if(!blocked(u.id,o))io.to(o).emit('typing',{mid})});
 // random chat
 const leave=()=>{queue=queue.filter(q=>q.s!==s);const r=rand[s.id];if(r){clearTimeout(r.t);delete rand[s.id];if(r.peer){delete rand[r.peer.id];r.peer.emit('rand:ended')}}};
 s.on('rand:join',({filter}={})=>{leave();if(limited('rj:'+u.id,10,30000))return s.emit('err','สุ่มถี่เกินไป');if(filter){if(!['m','f'].includes(filter))filter='';else{if(u.coins<PRICES.filter)return s.emit('err','เหรียญไม่พอสำหรับตัวกรองเพศ');u.coins-=PRICES.filter;save();s.emit('coins',u.coins)}}
  const ok=(a,b,f)=>!f||b.gender===f;
  const i=queue.findIndex(q=>ok(u,q.u,filter)&&ok(q.u,u,q.filter)&&!blocked(u.id,q.u.id)&&q.u.id!==u.id);
  if(i>=0){const q=queue.splice(i,1)[0];clearTimeout(q.t);rand[s.id]={peer:q.s};rand[q.s.id]={peer:s};s.emit('rand:paired',pub(q.u));q.s.emit('rand:paired',pub(u));return}
  const entry={s,u,filter};entry.t=setTimeout(()=>{queue=queue.filter(q=>q!==entry);const bots=Object.values(db.users).filter(b=>b.bot&&(!filter||b.gender===filter)&&!blocked(u.id,b.id));const b=pick(bots);if(!b)return s.emit('err','ไม่พบคู่สนทนา');rand[s.id]={bot:b};s.emit('rand:paired',pub(b));setTimeout(()=>rand[s.id]?.bot===b&&s.emit('rand:msg',{text:'หวัดดี 👋 '+pick(REPLIES)}),1000)},4000);queue.push(entry);s.emit('rand:waiting')});
 s.on('rand:msg',text=>{if(flood('rm',8,8000))return;const r=rand[s.id];text=clean(text);if(!r||!text)return;if(r.peer)r.peer.emit('rand:msg',{text});else{const b=r.bot;setTimeout(()=>rand[s.id]?.bot===b&&s.emit('rand:msg',{text:pick(REPLIES)}),1000+Math.random()*1500)}});
 s.on('rand:leave',leave);
 // province rooms
 s.on('room:join',pid=>{if(!PROV.has(pid))return;if(s.room)s.leave('room:'+s.room);s.room=pid;s.join('room:'+pid);s.emit('room:history',{room:pid,msgs:(db.rooms[pid]||[]).filter(m=>!blocked(u.id,m.uid))});pushCounts()});
 s.on('room:leave',()=>{if(s.room){s.leave('room:'+s.room);s.room=null;pushCounts()}});
 s.on('room:msg',({room,text}={})=>{if(!s.room||room!==s.room)return;if(flood('room',5,8000))return;if(limited('room1:'+u.id,1,700))return s.emit('err','พิมพ์ช้าลงหน่อยนะ');text=clean(text);if(!text)return;roomPost(room,u,text.slice(0,500))});
 s.on('room:typing',()=>{if(s.room&&!limited('rt:'+u.id,3,3000))s.to('room:'+s.room).emit('room:typing',{room:s.room,uid:u.id,name:u.name})});
 // WebRTC call signaling (matched users only)
 const peerOf=mid=>{const m=db.matches.find(x=>x.id===mid);if(!m||(m.a!==u.id&&m.b!==u.id))return null;const o=m.a===u.id?m.b:m.a;return blocked(u.id,o)?null:o};
 s.on('call:offer',({mid,sdp,video}={})=>{const o=peerOf(mid);if(!o)return;if(db.users[o].bot)return s.emit('call:end',{mid,reason:'bot'});if(!isOnline(o))return s.emit('call:end',{mid,reason:'offline'});io.to(o).emit('call:offer',{mid,sdp,video:!!video,from:pub(u)})});
 for(const ev of ['call:answer','call:ice','call:end','call:reject'])s.on(ev,(d={})=>{const o=peerOf(d.mid);if(o)io.to(o).emit(ev,d)});
 s.on('disconnect',()=>{leave();online.set(u.id,(online.get(u.id)||1)-1);pushCounts()})});
const PORT=process.env.PORT||3000;srv.listen(PORT,()=>console.log('Kuy Talk listening '+PORT));
