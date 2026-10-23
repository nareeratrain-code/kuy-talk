const express=require('express'),http=require('http'),fs=require('fs'),crypto=require('crypto'),path=require('path');
// --- env ---
const ENVF=path.join(__dirname,'.env');if(fs.existsSync(ENVF))for(const l of fs.readFileSync(ENVF,'utf8').split('\n')){const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2]}
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'';
const PROVINCES=require('./provinces');const PROV=new Set(PROVINCES.map(p=>p.id));
const app=express(),srv=http.createServer(app),io=require('socket.io')(srv,{maxHttpBufferSize:3e6});
app.use(require('compression')());app.use(express.json({limit:'4mb'}));app.set('trust proxy',1);app.get('/healthz',(req,res)=>res.send('ok'));
// --- admin (basic auth) ---
function adminAuth(req,res,next){const h=req.headers.authorization||'';const [u,p]=Buffer.from(h.split(' ')[1]||'','base64').toString().split(':');
 const ok=ADMIN_PASSWORD&&p&&p.length===ADMIN_PASSWORD.length&&crypto.timingSafeEqual(Buffer.from(p),Buffer.from(ADMIN_PASSWORD));
 if(!ok){res.set('WWW-Authenticate','Basic realm="Kuy Talk Admin"');return res.status(401).send('ต้องใช้รหัสผู้ดูแล')}next()}
app.get(['/admin','/admin.html'],adminAuth,(req,res)=>res.sendFile(path.join(__dirname,'admin','admin.html')));
app.use(express.static(path.join(__dirname,'public'),{setHeaders:(res,f)=>{res.setHeader('Cache-Control',/\.(html|js|css|webmanifest)$/.test(f)?'no-cache':'public, max-age=604800')}}));
// --- db ---
const PX=require('./profile-ext');const store=require('./store'),GEO=require('./geo'),SMS=require('./sms');const db=store.db,save=store.save;
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
const ZOD=[['มังกร','♑',120],['กุมภ์','♒',219],['มีน','♓',321],['เมษ','♈',420],['พฤษภ','♉',521],['เมถุน','♊',621],['กรกฎ','♋',723],['สิงห์','♌',823],['กันย์','♍',923],['ตุลย์','♎',1023],['พิจิก','♏',1122],['ธนู','♐',1222],['มังกร','♑',1300]];
const zodiacOf=dob=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dob||'');if(!m)return null;const md=+m[2]*100+ +m[3];const z=ZOD.find(z=>md<z[2]);return{name:'ราศี'+z[0],sym:z[1]}};
const ageOf=dob=>{const d=new Date(dob+'T00:00:00Z');if(isNaN(d))return NaN;const n=new Date();let a=n.getUTCFullYear()-d.getUTCFullYear();if(n.getUTCMonth()<d.getUTCMonth()||(n.getUTCMonth()===d.getUTCMonth()&&n.getUTCDate()<d.getUTCDate()))a--;return a};
const PROVN=Object.fromEntries(PROVINCES.map(p=>[p.id,p.th]));
const turboOn=u=>!!(u&&u.turboUntil>Date.now());
const pub=u=>u&&({id:u.id,name:u.name,age:u.age,gender:u.gender,bio:u.bio,avatar:u.avatar,bot:!!u.bot,premium:isPrem(u)&&!(u.prefs&&u.prefs.showPremium===false),
 zodiac:zodiacOf(u.dob),province:u.province||null,provinceName:PROVN[u.province]||null,verified:!!u.verified,official:!!u.official,photos:(u.photos||[]).slice(0,9),turbo:turboOn(u),badges:u.badges||[],...PX.pubExt(u)});
const completion=u=>{const c=[['name',!!u.name],['dob',!!u.dob],['gender',u.gender!=='x'],['bio',(u.bio||'').length>=10],['avatar',/^(data:|\/api\/pic\/)/.test(u.avatar||'')||(u.photos||[]).length>0],['photos2',(u.photos||[]).length>=2],['province',!!u.province],['verified',!!u.verified]];return{pct:Math.round(c.filter(x=>x[1]).length/c.length*100),missing:c.filter(x=>!x[1]).map(x=>x[0])}};
// real distance: fuzzed GPS (never exact) → else province centroid fallback
const locOf=u=>u.geo&&!u.geo.paused&&u.geo.lat!=null?u.geo:(u.province?{...GEO.provCentroid(u.province),approx:true}:null);
const distOf=(a,b)=>{const p=locOf(a),q=locOf(b);if(!p||!q||p.lat==null||q.lat==null)return null;return Math.round(GEO.hav(p.lat,p.lng,q.lat,q.lng)*10)/10};
const distOut=(u,x)=>{if(x.prefs&&x.prefs.hideDist)return{dist:null,distLabel:'ซ่อนระยะทาง'};const d=distOf(u,x);if(d==null)return{dist:null,distLabel:x.province?'จ.'+PROVN[x.province]:null};
 const a=locOf(u),b=locOf(x),same=!a.approx&&!b.approx&&u.geo.district&&u.geo.district===x.geo.district&&u.geo.province===x.geo.province;
 return{dist:d,distLabel:(a.approx||b.approx)&&!same&&u.province===x.province?'จ.'+PROVN[x.province]:GEO.label(d,same,x.geo&&x.geo.district,x.geo&&x.geo.province),approx:!!(a.approx||b.approx)}};
const grid=new GEO.Grid();const gridPut=u=>{const l=locOf(u);if(l&&!u.official)grid.put(u.id,l.lat,l.lng);else grid.del(u.id)};
const today=()=>new Date().toISOString().slice(0,10);
const blocked=(a,b)=>db.blocks.some(x=>(x.by===a&&x.target===b)||(x.by===b&&x.target===a));
const maskPhone=p=>p?'+66 '+p[3]+'x-xxx-'+p.slice(-4):null;
const legalOk=u=>u.legalVer===LEGAL_VER||db.consents.some(c=>c.uid===u.id&&c.type==='terms'&&c.granted&&c.ver===LEGAL_VER);
const me=u=>({...pub(u),legalOk:legalOk(u),phone:maskPhone(u.phone),consent:u.consent||{},geo:u.geo?{district:u.geo.district||null,province:u.geo.province||null,provinceName:PROVN[u.geo.province]||null,paused:!!u.geo.paused,ts:u.geo.ts}:null,locSource:u.geo&&!u.geo.paused?'gps':u.province?'province':null,dob:u.dob||null,inventory:u.inventory||{turbo:0,crush:0,compliment:0},turboUntil:turboOn(u)?u.turboUntil:null,refCode:u.refCode,referredBy:!!u.referredBy,filters:u.filters||{},prefs:u.prefs||{},completion:completion(u),verifyStatus:u.verified?'approved':(u.verifyReq&&u.verifyReq.status)||null,premiumIcon:isPrem(u),coins:u.coins,premium:isPrem(u),premiumUntil:isPrem(u)?u.premiumUntil:null,unlimited:isPrem(u),swipesUsed:u.swipes,free:FREE_SWIPES,swipesLeft:isPrem(u)?'∞':Math.max(0,FREE_SWIPES-u.swipes),luckyLeft:isPrem(u)?'∞':(u.luckyDate===today()?0:1)});
// --- sessions (random token, stored hashed; httpOnly cookie + x-token header for API clients) ---
const sha=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const cookieOf=(h,k)=>{const m=new RegExp('(?:^|;\\s*)'+k+'=([^;]+)').exec(h||'');return m?decodeURIComponent(m[1]):null};
const SESSION_DAYS=180;
function newSession(uid,req,res){const tok=crypto.randomBytes(32).toString('hex');db.sessions[sha(tok)]={uid,ts:Date.now(),exp:Date.now()+SESSION_DAYS*DAY};
 if(res)res.append('Set-Cookie',`kt_s=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}${req&&(req.secure||req.headers['x-forwarded-proto']==='https')?'; Secure':''}`);save();return tok}
const tokOf=req=>req.headers['x-token']||cookieOf(req.headers.cookie,'kt_s');
const userOfTok=t=>{if(!t)return null;const s=db.sessions[sha(t)];if(!s||s.exp<Date.now())return null;return db.users[s.uid]||null};
// traffic log (พ.ร.บ.คอมพิวเตอร์ ม.26: keep ≥ 90 days); pruned after 90 days
const tlog=(ev,req,uid)=>{db.trafficLog.push({ts:Date.now(),ev,uid:uid||null,ip:req&&(req.ip||req.handshake?.address)||null,ua:String(req&&req.headers&&req.headers['user-agent']||'').slice(0,160)});if(db.trafficLog.length>200000)db.trafficLog.splice(0,20000)};
setInterval(()=>{const lim=Date.now()-91*DAY;const n=db.trafficLog.length;db.trafficLog=db.trafficLog.filter(x=>x.ts>lim);for(const [k,v] of Object.entries(db.sessions))if(v.exp<Date.now()||!db.users[v.uid])delete db.sessions[k];if(n!==db.trafficLog.length)save()},36e5).unref();
const TICKETS=new Map();const userByPhone=p=>Object.values(db.users).find(u=>u.phone&&u.phone===p);
// sliding renewal: once a session is >1 day old, push expiry back to a full SESSION_DAYS and refresh the cookie
function renewSession(req,res){const t=tokOf(req);if(!t)return;const s=db.sessions[sha(t)];if(!s||s.exp<Date.now())return;if(s.exp-Date.now()>(SESSION_DAYS-1)*DAY)return;
 s.exp=Date.now()+SESSION_DAYS*DAY;if(!req.headers['x-token']||cookieOf(req.headers.cookie,'kt_s')===t)res.append('Set-Cookie',`kt_s=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}${req.secure||req.headers['x-forwarded-proto']==='https'?'; Secure':''}`);save()}
function auth(req,res,next){const u=userOfTok(tokOf(req));if(!u||u.bot)return res.status(401).json({error:'กรุณาสมัครก่อน'});if(u.banned)return res.status(403).json({error:'บัญชีนี้ถูกระงับ'});
 if(u.swipeDate!==today()){u.swipeDate=today();u.swipes=0;save()}if(!u.teamOk){u.teamOk=1;teamWelcome(u);save()}req.u=u;renewSession(req,res);next()}
const matchOf=(a,b)=>db.matches.find(m=>(m.a===a&&m.b===b)||(m.a===b&&m.b===a));
function makeMatch(a,b){let m=matchOf(a,b);if(m)return m;m={id:id(),a,b,ts:Date.now()};db.matches.push(m);io.to(b).emit('match',{id:m.id,other:pub(db.users[a])});io.to(a).emit('match',{id:m.id,other:pub(db.users[b])});save();return m}
const others=u=>Object.values(db.users).filter(x=>x.id!==u.id&&!x.banned&&!x.official&&!blocked(u.id,x.id));
const rankT=(a,b)=>(turboOn(b)-turboOn(a));
const newRef=()=>{let c;do c=crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();while(Object.values(db.users).some(u=>u.refCode===c));return c};
const inv=u=>u.inventory=u.inventory||{turbo:0,crush:0,compliment:0};
// official team account + migrations
const TEAM='kuytalk-team';
if(!db.users[TEAM])db.users[TEAM]={id:TEAM,name:'Kuy Talk Team',age:0,gender:'x',bio:'ทีมงาน Kuy Talk อย่างเป็นทางการ 🍄',avatar:'🍄',bot:true,official:true,verified:true};
{const pv=['bangkok','chiangmai','khonkaen','phuket','chonburi','bangkok','nonthaburi','songkhla'],bd=['badge-fast','badge-chat'];let i=0;
 for(const u of Object.values(db.users)){if(u.bot&&!u.official&&!u.province){const y=new Date().getFullYear()-u.age;u.dob=`${y}-${String(1+i*3%12).padStart(2,'0')}-${String(3+i*5%25).padStart(2,'0')}`;u.province=pv[i%pv.length];u.verified=i%2===0;u.badges=i%3===0?['ตอบไว','สายแชท']:i%3===1?['ตอบไว']:['สายแชท'];i++}
  if(!u.bot&&!u.refCode)u.refCode=newRef()}}
{const EXTRA=[['ฟ้าใส','f','ชอบทะเลและซูชิ 🌊'],['ภูมิ','m','วิ่งมาราธอน 🏃'],['ข้าวหอม','f','ทาสแมว 3 ตัว 🐈'],['ไนซ์','m','บาริสต้า ☕'],['มิ้นท์','f','สายคาเฟ่ฮอปปิ้ง 🍰'],['โอ๊ต','m','ช่างภาพอิสระ 📸'],['เอิร์น','f','ครูภาษาอังกฤษ 📚'],['ปั้น','m','เชฟร้านอาหารอีสาน 🌶️'],['ใบบัว','f','ชอบปลูกต้นไม้ 🌿'],['ต้า','m','นักปั่นจักรยาน 🚴'],['จูน','f','นักดนตรีกลางคืน 🎸'],['เต้','m','วิศวกร ชอบเดินป่า 🏕️'],['แก้ม','f','พยาบาล ใจดี 💉'],['ก้อง','m','เล่นบาสทุกเย็น 🏀'],['พิม','f','อ่านนิยาย 📖'],['ณัฐ','m','ขายของออนไลน์ 📦'],['ขิม','f','สายบุญ ชอบเที่ยววัด 🙏'],['แบงค์','m','นักดำน้ำ 🤿'],['ปุยฝ้าย','f','นักวาดภาพประกอบ 🎨'],['โจ้','m','ชาวสวนทุเรียน 🌳'],['หมิว','f','แอร์โฮสเตส ✈️'],['ตั้ม','m','ติวเตอร์คณิต ➗']];
 const bots=Object.values(db.users).filter(u=>u.bot&&!u.official);let i=bots.length;
 if(bots.length<20)for(const [name,gender,bio] of EXTRA){const k=id(),age=20+(i*7)%15,y=new Date().getFullYear()-age;db.users[k]={id:k,name,age,gender,bio,avatar:gender==='f'?'🌸':'🙂',bot:true,dob:`${y}-${String(1+i%12).padStart(2,'0')}-${String(1+i*3%27).padStart(2,'0')}`,verified:i%2===1,badges:i%2?['ตอบไว']:['สายแชท'],seed:i};i++}
 let j=0;for(const u of Object.values(db.users)){if(!u.bot||u.official||u.geo)continue;let p;
  if(u.province&&u.seed==null){const ds=GEO.D.filter(d=>d[1]===u.province);const d=ds[(j*13)%ds.length];p={lat:d[2]+((j*17)%10-5)/1000,lng:d[3]+((j*29)%10-5)/1000}}else p=GEO.randomPoint(101+j*37);
  const f=GEO.fuzz(p.lat,p.lng,u.id),r=GEO.reverse(f.lat,f.lng);u.geo={...f,district:r&&r.district,province:r&&r.province,ts:Date.now()};if(r)u.province=r.province;j++}
 for(const u of Object.values(db.users))gridPut(u);save()}
const WELCOME=['ยินดีต้อนรับสู่ Kuy Talk 🍄 ขอบคุณที่มาร่วมเป็นส่วนหนึ่งของเรา!','เคล็ดลับ: เพิ่มรูปอย่างน้อย 2 รูปและยืนยันตัวตน ✅ จะช่วยให้แมตช์ง่ายขึ้นมาก','ใช้ Crush 💎 กับคนที่ถูกใจเป็นพิเศษ หรือเปิด Turbo ⚡ เพื่อให้คนเห็นโปรไฟล์คุณมากขึ้น 10 เท่า','พบปัญหาหรือเจอผู้ใช้ไม่เหมาะสม พิมพ์บอกทีมงานในแชทนี้ได้เลย หรือกดรายงานในโปรไฟล์ 🙏'];
function teamWelcome(u){const m=makeMatch(u.id,TEAM);if(!(db.messages[m.id]||[]).length)db.messages[m.id]=WELCOME.map((t,i)=>({from:TEAM,text:t,ts:Date.now()+i}));}
// --- account ---
const LEGAL_VER='2026-10-23';
function logConsent(u,type,granted,req){if(type==='terms'&&granted)u.legalVer=LEGAL_VER;(u.consent=u.consent||{})[type]=!!granted;db.consents.push({uid:u.id,type,granted:!!granted,ver:LEGAL_VER,ts:Date.now(),ip:req&&req.ip||null,ua:String(req&&req.headers['user-agent']||'').slice(0,120)})}
app.post('/api/signup',(req,res)=>{if(limited('signup:'+req.ip,+process.env.SIGNUP_PER_MIN||10,60000))return res.status(429).json({error:'สมัครถี่เกินไป'});let {name,age,gender,bio,avatar,dob,province,ref,consent,phoneTicket}=req.body||{};
 consent=consent||{};if(!consent.terms||!consent.privacy||!consent.age18)return res.status(400).json({error:'กรุณายอมรับข้อกำหนดการใช้งาน นโยบายความเป็นส่วนตัว และยืนยันว่าอายุ 18 ปีขึ้นไป',needConsent:true});
 let phone=null;if(phoneTicket){const t=TICKETS.get(phoneTicket);if(!t||t.exp<Date.now())return res.status(400).json({error:'การยืนยันเบอร์หมดอายุ กรุณาขอ OTP ใหม่'});if(userByPhone(t.phone))return res.status(409).json({error:'เบอร์นี้มีบัญชีแล้ว'});phone=t.phone;TICKETS.delete(phoneTicket)}if(dob!=null){if(!/^\d{4}-\d{2}-\d{2}$/.test(dob))return res.status(400).json({error:'วันเกิดไม่ถูกต้อง'});age=ageOf(dob);if(!(age>=18))return res.status(400).json({error:'ต้องมีอายุ 18 ปีขึ้นไป'})}if(!name||!(+age>=18)||+age>120)return res.status(400).json({error:'ต้องกรอกชื่อและอายุ 18+'});
 const av=typeof avatar==='string'&&(avatar.length<16||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))&&avatar.length<600000?avatar:'🙂';
 const i=crypto.randomBytes(12).toString('hex');db.users[i]={phone,id:i,name:clean(name).slice(0,30)||'ผู้ใช้',age:+age,gender:['m','f','x'].includes(gender)?gender:'x',bio:clean(bio).slice(0,200),avatar:av,coins:50,swipes:0,swipeDate:today(),created:Date.now(),dob:dob||null,province:PROV.has(province)?province:null,photos:[],inventory:{turbo:0,crush:1,compliment:1},refCode:newRef(),prefs:{showPremium:true,notif:true}};
 const nu=db.users[i];for(const k of ['terms','privacy','age18'])logConsent(nu,k,true,req);logConsent(nu,'location',!!consent.location,req);logConsent(nu,'marketing',!!consent.marketing,req);
 teamWelcome(nu);gridPut(nu);let refOk=false;if(ref)refOk=applyRef(nu,String(ref));tlog('signup',req,i);const token=newSession(i,req,res);save();res.json({token,refOk})});
const REF_BONUS=50;
function applyRef(u,code){code=code.trim().toUpperCase();const r=Object.values(db.users).find(x=>!x.bot&&x.refCode===code);if(!r||r.id===u.id||u.referredBy)return false;u.referredBy=r.id;u.coins+=REF_BONUS;r.coins+=REF_BONUS;io.to(r.id).emit('coins',r.coins);
 const m=makeMatch(r.id,TEAM);(db.messages[m.id]=db.messages[m.id]||[]).push({from:TEAM,text:`🎉 มีเพื่อนใช้รหัสแนะนำของคุณ! รับ ${REF_BONUS} เหรียญ`,ts:Date.now()});return true}
app.post('/api/logout',(req,res)=>{const t=tokOf(req);if(t)delete db.sessions[sha(t)];res.append('Set-Cookie','kt_s=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');save();res.json({ok:true})});
app.post('/api/logout-all',auth,(req,res)=>{for(const [k,v] of Object.entries(db.sessions))if(v.uid===req.u.id)delete db.sessions[k];io.in(req.u.id).disconnectSockets(true);res.append('Set-Cookie','kt_s=; Path=/; HttpOnly; Max-Age=0');save();res.json({ok:true})});
app.post('/api/consent/legal',auth,(req,res)=>{const c=req.body||{};if(!c.terms||!c.privacy||!c.age18)return res.status(400).json({error:'กรุณายอมรับข้อกำหนดและนโยบาย'});for(const k of ['terms','privacy','age18'])logConsent(req.u,k,true,req);tlog('consent_legal',req,req.u.id);save();res.json(me(req.u))});
app.get('/api/me',auth,(req,res)=>res.json(me(req.u)));
app.post('/api/profile',auth,(req,res)=>{const u=req.u,{name,bio,gender,province,dob,avatar}=req.body;if(name)u.name=clean(name).slice(0,30);if(bio!=null)u.bio=clean(bio).slice(0,200);
 if(['m','f','x'].includes(gender))u.gender=gender;if(province===''||PROV.has(province)){u.province=province||null;gridPut(u)}
 if(dob){if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!(ageOf(dob)>=18))return res.status(400).json({error:'ต้องมีอายุ 18 ปีขึ้นไป'});u.dob=dob;u.age=ageOf(dob)}
 if(typeof avatar==='string'&&(avatar.length<16||(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar)&&avatar.length<600000)))u.avatar=avatar;save();res.json(me(u))});
app.get('/api/config',(req,res)=>res.json({storage:store.kind,storageErr:store.lastErr||null,fbKey:!!require('./firebase').serviceAccount(),smsDev:SMS.devMode,firebase:require('./app-extra').firebaseClientConfig(),legalVer:LEGAL_VER,distSteps:[1,5,10,25,50,100,0],packs:PACKS,prices:PRICES,free:FREE_SWIPES,premiumDays:PREMIUM_DAYS,provinces:PROVINCES}));
app.get('/api/user/:id',auth,(req,res)=>{const t=db.users[req.params.id];if(!t||blocked(req.u.id,t.id))return res.status(404).json({error:'ไม่พบ'});res.json(pub(t))});
// --- swipe / match ---
const passF=(u,x)=>{const f=u.filters||{};if(f.gender&&x.gender!==f.gender)return false;if(f.ageMin&&x.age<f.ageMin)return false;if(f.ageMax&&x.age>f.ageMax)return false;if(f.province&&x.province!==f.province)return false;if(f.maxDist&&!f.outside&&(distOf(u,x)??1e9)>f.maxDist)return false;return PX.extraPass(u,x)};
// candidate pool: spatial index (grid in memory, or indexed SQL bbox query on Postgres) when a distance limit applies
async function pool(u,km){const l=locOf(u);if(!km||!l)return others(u).filter(x=>PX.visibleTo(db,u,x));let ids;
 if(store.nearby){try{ids=(await store.nearby(l.lat,l.lng,km,2000)).map(r=>r.id)}catch(e){ids=null}}
 const B=new Set(ids||[]);for(const i of grid.near(l.lat,l.lng,km))B.add(i);// grid covers rows not yet flushed to SQL
 for(const x of Object.values(db.users))if(!x.geo||x.geo.paused)B.add(x.id);// province-only users still filtered by centroid distance
 return [...B].map(i=>db.users[i]).filter(x=>x&&x.id!==u.id&&!x.banned&&!x.official&&!blocked(u.id,x.id)&&PX.visibleTo(db,u,x))}
const rankD=u=>{const D=new Map();return[(a,b)=>rankT(a,b)||((D.get(a.id)??D.set(a.id,distOf(u,a)??1e9).get(a.id))-(D.get(b.id)??D.set(b.id,distOf(u,b)??1e9).get(b.id))),D]};
app.get('/api/cards',auth,async(req,res)=>{const u=req.u,seen=new Set(db.likes.filter(l=>l.from===u.id).map(l=>l.to));const km=req.query.all||(u.filters||{}).outside?0:(u.filters||{}).maxDist;const [cmp]=rankD(u);
 res.json((await pool(u,km)).filter(x=>!seen.has(x.id)&&(req.query.all||passF(u,x))).sort(cmp).slice(0,200).map(x=>({...pub(x),...distOut(u,x),online:x.bot||isOnline(x.id)})))});
app.get('/api/people',auth,async(req,res)=>{const u=req.u,km=+req.query.km||0;const [cmp]=rankD(u);const f=u.filters||{};res.json((await pool(u,km)).filter(x=>!km||(distOf(u,x)??1e9)<=km).filter(x=>(!f.gender||x.gender===f.gender)&&(!f.ageMin||x.age>=f.ageMin)&&(!f.ageMax||x.age<=f.ageMax)&&PX.extraPass(u,x)).sort(cmp).slice(0,300).map(x=>{const m=matchOf(u.id,x.id);return{...pub(x),...distOut(u,x),online:x.bot||isOnline(x.id),liked:db.likes.some(l=>l.from===u.id&&l.to===x.id&&l.like),mid:m&&m.id}}))});
app.post('/api/swipe',auth,(req,res)=>{const u=req.u,{to,dir,superlike}=req.body,t=db.users[to];if(!t||t.id===u.id||blocked(u.id,to))return res.status(404).json({error:'ไม่พบ'});
 if(!isPrem(u)&&u.swipes>=FREE_SWIPES)return res.status(402).json({error:`กดหัวใจ/ปัดฟรีครบ ${FREE_SWIPES} ครั้งวันนี้แล้ว`});
 if(superlike&&!useItem(u,'crush'))return res.status(402).json({error:'ไม่มี Crush 💎 เหลือ — ซื้อเพิ่มได้ที่หน้า ฉัน'});
 u.swipes++;db.likes=db.likes.filter(l=>!(l.from===u.id&&l.to===to));const like=dir==='right'||!!superlike;db.likes.push({from:u.id,to,like,superlike:!!superlike,ts:Date.now(),prevMatch:!!matchOf(u.id,to)});u.lastSwipe={to,ts:Date.now()};if(superlike)io.to(to).emit('crush',{from:pub(u)});let match=null;
 if(like){const back=t.bot?(superlike||Math.random()<0.7):db.likes.some(l=>l.from===to&&l.to===u.id&&l.like);
  if(t.bot&&back)db.likes.push({from:to,to:u.id,like:true,ts:Date.now()});
  if(back)match=makeMatch(u.id,to)}
 save();res.json({match:match&&{id:match.id,other:pub(t)},me:me(u)})});
app.get('/api/matches',auth,(req,res)=>res.json(db.matches.filter(m=>(m.a===req.u.id||m.b===req.u.id)).map(m=>({m,o:db.users[m.a===req.u.id?m.b:m.a]})).filter(x=>x.o&&!x.o.banned&&!blocked(req.u.id,x.o.id)).map(({m,o})=>({id:m.id,other:pub(o),last:(db.messages[m.id]||[]).slice(-1)[0]}))));
app.get('/api/messages/:mid',auth,(req,res)=>{const m=db.matches.find(x=>x.id===req.params.mid);if(!m||(m.a!==req.u.id&&m.b!==req.u.id))return res.status(404).end();const cl=(m.cleared||{})[req.u.id]||0;res.json((db.messages[m.id]||[]).filter(x=>x.ts>cl))});
app.post('/api/chat/clear',auth,(req,res)=>{const m=db.matches.find(x=>x.id===req.body.mid);if(!m||(m.a!==req.u.id&&m.b!==req.u.id))return res.status(404).end();(m.cleared=m.cleared||{})[req.u.id]=Date.now();save();res.json({ok:true})});
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

// --- Omi-style systems ---
const SHOP={turbo:{coins:60,label:'Turbo ⚡'},crush:{coins:20,label:'Crush 💎'},compliment:{coins:15,label:'คำชมเชย 💬'}};
const TURBO_MIN=30;
const month=()=>today().slice(0,7);
// consume one item; Premium gets daily free crush/compliment and monthly free turbo
function useItem(u,k){const I=inv(u);if(isPrem(u)){if(k==='turbo'&&u.freeTurbo!==month()){u.freeTurbo=month();return true}if(k!=='turbo'&&(u.freeItem||{})[k]!==today()){u.freeItem={...(u.freeItem||{}),[k]:today()};return true}}
 if(I[k]>0){I[k]--;return true}return false}
app.get('/api/shop',auth,(req,res)=>res.json({items:SHOP,turboMinutes:TURBO_MIN,me:me(req.u)}));
app.post('/api/shop/buy',auth,(req,res)=>{const u=req.u,k=req.body.item,q=[1,5].includes(+req.body.qty)?+req.body.qty:1,it=SHOP[k];if(!it)return res.status(400).json({error:'ไม่มีสินค้านี้'});
 const cost=Math.round(it.coins*q*(q===5?0.8:1));if(u.coins<cost)return res.status(402).json({error:'เหรียญไม่พอ'});u.coins-=cost;inv(u)[k]+=q;save();res.json(me(u))});
app.post('/api/turbo',auth,(req,res)=>{const u=req.u;if(turboOn(u))return res.status(400).json({error:'Turbo กำลังทำงานอยู่'});if(!useItem(u,'turbo'))return res.status(402).json({error:'ไม่มี Turbo ⚡ เหลือ'});u.turboUntil=Date.now()+TURBO_MIN*60000;save();res.json(me(u))});
app.post('/api/undo',auth,(req,res)=>{const u=req.u;if(!isPrem(u))return res.status(402).json({error:'ย้อนการปัดเป็นสิทธิ์ Premium 👑'});
 const L=db.likes.filter(l=>l.from===u.id).sort((a,b)=>b.ts-a.ts)[0];if(!L||Date.now()-L.ts>36e5)return res.status(404).json({error:'ไม่มีการปัดให้ย้อน'});
 db.likes.splice(db.likes.indexOf(L),1);const m=matchOf(u.id,L.to);if(m&&!L.prevMatch&&!(db.messages[m.id]||[]).some(x=>x.from===u.id)){db.matches.splice(db.matches.indexOf(m),1);delete db.messages[m.id];db.likes=db.likes.filter(l=>!(l.from===L.to&&l.to===u.id&&db.users[L.to]?.bot))}
 u.swipes=Math.max(0,u.swipes-1);save();res.json({user:{...pub(db.users[L.to]),...distOut(u,db.users[L.to])},me:me(u)})});
app.post('/api/compliment',auth,(req,res)=>{const u=req.u,t=db.users[req.body.to],text=clean(req.body.text).slice(0,200);if(!t||t.id===u.id||t.official||blocked(u.id,t.id))return res.status(404).json({error:'ไม่พบ'});if(!text)return res.status(400).json({error:'เขียนคำชมก่อนนะ'});
 if(!useItem(u,'compliment'))return res.status(402).json({error:'ไม่มีคำชมเชย 💬 เหลือ'});db.likes=db.likes.filter(l=>!(l.from===u.id&&l.to===t.id));db.likes.push({from:u.id,to:t.id,like:true,compliment:text,ts:Date.now()});
 let match=null;const back=t.bot?true:db.likes.some(l=>l.from===t.id&&l.to===u.id&&l.like);if(back){if(t.bot)db.likes.push({from:t.id,to:u.id,like:true,ts:Date.now()});match=makeMatch(u.id,t.id);(db.messages[match.id]=db.messages[match.id]||[]).push({from:u.id,text:'💬 '+text,ts:Date.now()});
  if(t.bot)setTimeout(()=>{if(!db.messages[match.id])return;const r={id:id(),from:t.id,text:'ขอบคุณสำหรับคำชมนะ 🥰',ts:Date.now()};db.messages[match.id].push(r);save();io.to(u.id).emit('msg',{mid:match.id,...r})},1500)}
 io.to(t.id).emit('compliment',{from:pub(u),text});save();res.json({match:match&&{id:match.id,other:pub(t)},me:me(u)})});
const blurOut=(x,extra)=>({blur:true,online:x.bot||isOnline(x.id),...extra});
app.get('/api/likes/received',auth,(req,res)=>{const u=req.u,P=isPrem(u),mine=new Set(db.likes.filter(l=>l.from===u.id).map(l=>l.to));
 const L=db.likes.filter(l=>l.to===u.id&&l.like&&!mine.has(l.from)&&db.users[l.from]&&!db.users[l.from].banned&&!blocked(u.id,l.from)).sort((a,b)=>b.ts-a.ts);const seenAt=u.likesSeenAt||0;
 const list=L.map(l=>{const x=db.users[l.from],e={superlike:!!l.superlike,compliment:l.compliment?(P?l.compliment:true):null,isNew:l.ts>seenAt,ts:l.ts};return P?{...pub(x),...distOut(u,x),online:x.bot||isOnline(x.id),...e}:blurOut(x,e)});
 if(req.query.seen){u.likesSeenAt=Date.now();save()}res.json({premium:P,count:L.length,newCount:L.filter(l=>l.ts>seenAt).length,list})});
app.get('/api/likes/given',auth,(req,res)=>{const u=req.u;res.json(db.likes.filter(l=>l.from===u.id&&l.like&&db.users[l.to]&&!matchOf(u.id,l.to)&&!blocked(u.id,l.to)).sort((a,b)=>b.ts-a.ts).map(l=>({...pub(db.users[l.to]),superlike:!!l.superlike,compliment:!!l.compliment,ts:l.ts})))});
app.post('/api/visit',auth,(req,res)=>{const u=req.u,t=db.users[req.body.id];if(!t||t.id===u.id)return res.json({ok:false});const last=db.visits.filter(v=>v.by===u.id&&v.target===t.id).pop();
 if(!last||Date.now()-last.ts>5*60000){db.visits.push({by:u.id,target:t.id,ts:Date.now()});if(db.visits.length>20000)db.visits.splice(0,5000);io.to(t.id).emit('visit',{});save()}res.json({ok:true})});
app.get('/api/visitors',auth,(req,res)=>{const u=req.u,P=isPrem(u),V=db.visits.filter(v=>v.target===u.id&&db.users[v.by]&&!blocked(u.id,v.by));const by={};for(const v of V){(by[v.by]=by[v.by]||{n:0,ts:0}).n++;by[v.by].ts=Math.max(by[v.by].ts,v.ts)}
 const ids=Object.keys(by).sort((a,b)=>by[b].ts-by[a].ts);const isF=x=>{const f=fr(u.id,x);return f&&f.status==='accepted'};
 res.json({premium:P,stats:{total:ids.length,visits:V.length,repeat:ids.filter(i=>by[i].n>1).length,friends:ids.filter(isF).length},list:ids.map(i=>{const x=db.users[i],e={count:by[i].n,ts:by[i].ts,friend:!!isF(i)};return P?{...pub(x),...e}:blurOut(x,e)})})});
app.get('/api/me/stats',auth,(req,res)=>{const u=req.u.id;res.json({likesReceived:db.likes.filter(l=>l.to===u&&l.like).length,likesGiven:db.likes.filter(l=>l.from===u&&l.like).length,visitors:new Set(db.visits.filter(v=>v.target===u).map(v=>v.by)).size,
 picks:db.likes.filter(l=>l.to===u&&(l.superlike||l.compliment)).length,matches:db.matches.filter(m=>(m.a===u||m.b===u)&&m.b!==TEAM&&m.a!==TEAM).length})});
app.post('/api/unmatch',auth,(req,res)=>{const u=req.u,m=db.matches.find(x=>x.id===req.body.mid);if(!m||(m.a!==u.id&&m.b!==u.id))return res.status(404).json({error:'ไม่พบ'});const o=m.a===u.id?m.b:m.a;if(o===TEAM)return res.status(400).json({error:'ยกเลิกแมตช์กับทีมงานไม่ได้'});
 if(!isPrem(u))return res.status(402).json({error:'ยกเลิกแมตช์เป็นสิทธิ์ Premium 👑'});
 db.matches.splice(db.matches.indexOf(m),1);delete db.messages[m.id];db.likes=db.likes.filter(l=>!((l.from===u.id&&l.to===o)||(l.from===o&&l.to===u.id)));db.friends=db.friends.filter(f=>!((f.a===u.id&&f.b===o)||(f.a===o&&f.b===u.id)));io.to(o).emit('unmatch',{mid:m.id});save();res.json({ok:true})});
app.get('/api/read/:mid',auth,(req,res)=>{const u=req.u,m=db.matches.find(x=>x.id===req.params.mid);if(!m||(m.a!==u.id&&m.b!==u.id))return res.status(404).end();if(!isPrem(u))return res.json({premium:false,peerReadAt:null});const o=m.a===u.id?m.b:m.a;res.json({premium:true,peerReadAt:(m.read||{})[o]||null})});
app.post('/api/filters',auth,(req,res)=>{const b=req.body||{},n=(v,lo,hi)=>{v=parseInt(v);return v>=lo&&v<=hi?v:null};const f={gender:['m','f'].includes(b.gender)?b.gender:'',ageMin:n(b.ageMin,18,99),ageMax:n(b.ageMax,18,99),province:PROV.has(b.province)?b.province:'',maxDist:n(b.maxDist,1,1000)};
 if(f.ageMin&&f.ageMax&&f.ageMin>f.ageMax)[f.ageMin,f.ageMax]=[f.ageMax,f.ageMin];req.u.filters=f;save();res.json(me(req.u))});
app.post('/api/prefs',auth,(req,res)=>{const p=req.u.prefs=req.u.prefs||{};for(const k of ['showPremium','notif','notifMsg','notifLike','hideAge','sms','hideDist','readReceipts','showOnline'])if(typeof req.body[k]==='boolean')p[k]=req.body[k];if(['th','en'].includes(req.body.lang))p.lang=req.body.lang;if(req.body.hideDist!=null)gridPut(req.u);save();res.json(me(req.u))});
app.post('/api/referral',auth,(req,res)=>{if(limited('ref:'+req.u.id,5,60000))return res.status(429).json({error:'ลองถี่เกินไป'});if(req.u.referredBy)return res.status(400).json({error:'คุณใช้รหัสแนะนำไปแล้ว'});if(!applyRef(req.u,String(req.body.code||'')))return res.status(400).json({error:'รหัสไม่ถูกต้อง'});save();res.json(me(req.u))});
const IMG=x=>typeof x==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x)&&x.length<700000;
// chat photos are stored as separate pic docs (keeps message docs far below Firestore's 1MB doc limit)
const chatPic=(uid,d)=>{db.pics=db.pics||{};const k=crypto.randomBytes(10).toString('hex');db.pics[k]={uid,d,ts:Date.now(),chat:1};return '/api/pic/'+k};
const mkExtra=(uid,photo,loc)=>{if(photo){if(!IMG(photo))return 'bad';return {type:'photo',photo:chatPic(uid,photo)}}if(loc){const lat=+loc.lat,lng=+loc.lng;if(!(lat>=-90&&lat<=90&&lng>=-180&&lng<=180))return 'bad';return {type:'loc',lat:Math.round(lat*1e5)/1e5,lng:Math.round(lng*1e5)/1e5}}return null};
setTimeout(()=>{let n=0;for(const [mid,arr] of Object.entries(db.messages||{}))for(const m of arr||[])if(m&&/^data:/.test(m.photo||'')){m.photo=chatPic(m.from,m.photo);n++}if(n){console.log('migrated chat photos',n);save()}},0);
app.post('/api/verify',auth,(req,res)=>{const u=req.u;if(u.verified)return res.status(400).json({error:'ยืนยันแล้ว'});if(!IMG(req.body.selfie))return res.status(400).json({error:'กรุณาถ่ายเซลฟี่'});u.verifyReq={photo:req.body.selfie,ts:Date.now(),status:'pending'};save();res.json(me(u))});
app.post('/api/account/delete',auth,(req,res)=>{const u=req.u.id;for(const [k,p] of Object.entries(db.pics||{}))if(p.uid===u)delete db.pics[k];delete db.users[u];db.likes=db.likes.filter(l=>l.from!==u&&l.to!==u);const ms=db.matches.filter(m=>m.a===u||m.b===u);ms.forEach(m=>delete db.messages[m.id]);db.matches=db.matches.filter(m=>!ms.includes(m));db.friends=db.friends.filter(f=>f.a!==u&&f.b!==u);db.moments=db.moments.filter(m=>m.uid!==u);db.visits=db.visits.filter(v=>v.by!==u&&v.target!==u);db.friends=db.friends.filter(f=>f.a!==u&&f.b!==u);db.blocks=db.blocks.filter(b=>b.by!==u);
 for(const [k,v] of Object.entries(db.sessions))if(v.uid===u)delete db.sessions[k];grid.del(u);db.consents.push({uid:u,type:'account_deleted',granted:false,ver:LEGAL_VER,ts:Date.now()});tlog('account_delete',req,u);
 res.append('Set-Cookie','kt_s=; Path=/; HttpOnly; Max-Age=0');io.in(u).disconnectSockets(true);save();res.json({ok:true})});
PX({app,db,save,auth,me,clean,limited,isPrem});require('./app-extra')({TICKETS,userByPhone,app,db,save,auth,adminAuth,io,GEO,SMS,PROVN,grid,gridPut,locOf,me,pub,clean,limited,logConsent,newSession,tlog,sha,tokOf,userOfTok,id,DAY,TEAM,makeMatch,isOnline:(...a)=>isOnline(...a)});
app.post('/api/admin/verify',adminAuth,(req,res)=>{const u=db.users[req.body.id];if(!u||!u.verifyReq)return res.status(404).end();u.verifyReq.status=req.body.approve?'approved':'rejected';u.verified=!!req.body.approve;const m=makeMatch(u.id,TEAM);(db.messages[m.id]=db.messages[m.id]||[]).push({from:TEAM,text:req.body.approve?'✅ ยืนยันตัวตนสำเร็จ! โปรไฟล์ของคุณมีเครื่องหมายยืนยันแล้ว':'❌ คำขอยืนยันตัวตนไม่ผ่าน กรุณาถ่ายเซลฟี่ใหม่ให้เห็นหน้าชัดเจน',ts:Date.now()});u.verifyReq.photo=null;save();res.json({ok:true})});
// --- admin api ---
app.get('/api/admin/overview',adminAuth,(req,res)=>{const U=Object.values(db.users).filter(u=>!u.bot);res.json({users:U.map(u=>({...pub(u),banned:!!u.banned,coins:u.coins,created:u.created,online:isOnline(u.id),reportsAgainst:db.reports.filter(r=>r.target===u.id).length})),
 tickets:db.tickets.slice(-200).reverse(),dataRequests:db.dataRequests.slice(-200).reverse(),consentLog:db.consents.length,trafficLog:db.trafficLog.length,storage:store.kind,sms:SMS.provider,reports:db.reports.slice().reverse().map(r=>({...r,byName:db.users[r.by]?.name,targetName:db.users[r.target]?.name})),stats:{users:U.length,online:U.filter(u=>isOnline(u.id)).length,matches:db.matches.length,moments:db.moments.length,pending:db.reports.filter(r=>r.status==='pending').length},verifies:Object.values(db.users).filter(u=>u.verifyReq&&u.verifyReq.status==='pending').map(u=>({id:u.id,name:u.name,avatar:u.avatar,photo:u.verifyReq.photo,ts:u.verifyReq.ts}))})});
app.post('/api/admin/ban',adminAuth,(req,res)=>{const u=db.users[req.body.id];if(!u||u.bot)return res.status(404).end();u.banned=!!req.body.banned;save();if(u.banned)io.in(u.id).disconnectSockets(true);res.json({ok:true})});
app.post('/api/admin/report',adminAuth,(req,res)=>{const r=db.reports.find(x=>x.id===req.body.id);if(!r)return res.status(404).end();r.status=['pending','resolved','dismissed'].includes(req.body.status)?req.body.status:'resolved';save();res.json({ok:true})});
// --- sockets ---
const online=new Map();const isOnline=uid=>(online.get(uid)||0)>0;
let queue=[];const rand={};
const roomCount=pid=>(io.sockets.adapter.rooms.get('room:'+pid)?.size||0)+(HOT.includes(pid)?2:0);
const HOT=['bangkok','chiangmai','khonkaen','phuket','chonburi','nakhonratchasima','songkhla','udonthani'];
const counts=()=>Object.fromEntries(PROVINCES.map(p=>[p.id,roomCount(p.id)]));
let countT=null;const pushCounts=()=>{clearTimeout(countT);countT=setTimeout(()=>io.emit('room:counts',counts()),300)};
function roomPost(pid,u,text,isBot,extra){const msg={id:id(),uid:u.id,name:u.name,avatar:u.avatar,bot:!!isBot,text,ts:Date.now(),...(extra||{})};const r=db.rooms[pid]=db.rooms[pid]||[];r.push(msg);if(r.length>100)r.splice(0,r.length-100);save();
 for(const sid of io.sockets.adapter.rooms.get('room:'+pid)||[]){const s=io.sockets.sockets.get(sid);if(s&&!blocked(s.uid,u.id))s.emit('room:msg',{room:pid,...msg})}}
// bots chat in popular rooms that have humans
setInterval(()=>{const live=HOT.filter(p=>io.sockets.adapter.rooms.get('room:'+p)?.size);if(!live.length)return;const p=pick(live);const b=pick(Object.values(db.users).filter(u=>u.bot&&!u.official));roomPost(p,b,pick(ROOM_BOT),true)},Number(process.env.ROOM_BOT_MS||25000));
io.on('connection',s=>{const u=userOfTok(s.handshake.auth.token||cookieOf(s.handshake.headers.cookie,'kt_s'));if(!u||u.bot||u.banned)return s.disconnect();s.uid=u.id;s.join(u.id);online.set(u.id,(online.get(u.id)||0)+1);s.emit('room:counts',counts());
 const flood=(k,n,w)=>{if(limited(k+':'+u.id,n,w)){s.emit('err','ส่งข้อความเร็วเกินไป กรุณารอสักครู่ ⏳');return true}return false};
 s.on('msg',({mid,text,photo,loc}={})=>{if(flood('msg',8,8000))return;const m=db.matches.find(x=>x.id===mid);text=clean(text);
  if(!m||(m.a!==u.id&&m.b!==u.id))return s.emit('err','ส่งไม่สำเร็จ: ไม่พบห้องแชทนี้');
  let extra=null;if(photo||loc){extra=mkExtra(u.id,photo,loc);if(extra==='bad')return s.emit('err',photo?'❌ ส่งรูปไม่สำเร็จ: รูปใหญ่เกินไปหรือไฟล์ไม่ถูกต้อง':'❌ ส่งตำแหน่งไม่สำเร็จ');text=photo?(text||'📷 รูปภาพ'):'📍 ตำแหน่ง'}
  if(!text)return;const o=m.a===u.id?m.b:m.a;if(blocked(u.id,o))return s.emit('err','ไม่สามารถส่งข้อความถึงผู้ใช้นี้ได้');if(db.users[o]&&(db.users[o].prefs||{}).verifiedOnly&&!u.verified&&!u.official)return s.emit('err','ผู้ใช้นี้รับข้อความเฉพาะจากผู้ที่ยืนยันรูปแล้ว ✔');
  const msg={id:id(),from:u.id,text,ts:Date.now(),...(extra||{})};(db.messages[mid]=db.messages[mid]||[]).push(msg);save();io.to(u.id).to(o).emit('msg',{mid,...msg});
  if(db.users[o].bot){io.to(u.id).emit('typing',{mid});setTimeout(()=>{if(!db.messages[mid]||!db.matches.includes(m))return;m.read=m.read||{};m.read[o]=Date.now();if(isPrem(u))io.to(u.id).emit('read',{mid,ts:m.read[o]});const st=/^\[\[sticker:\w+\]\]$/.test(text);const r={id:id(),from:o,text:db.users[o].official?'ขอบคุณที่ติดต่อทีมงาน Kuy Talk 🍄 เราได้รับข้อความแล้ว และจะตอบกลับโดยเร็ว (นี่คือข้อความอัตโนมัติ)':st?'[[sticker:'+pick(['love','haha','hi','wow'])+']]':pick(REPLIES),ts:Date.now()};db.messages[mid].push(r);save();io.to(u.id).emit('msg',{mid,...r})},1200+Math.random()*1500)}});
 s.on('unsend',({mid,id:x}={})=>{const m=db.matches.find(y=>y.id===mid);if(!m||(m.a!==u.id&&m.b!==u.id))return;const g=(db.messages[mid]||[]).find(y=>y.id===x&&y.from===u.id);if(!g)return;Object.assign(g,{deleted:true,text:'',photo:null,lat:null,lng:null,type:null});save();io.to(m.a).to(m.b).emit('unsend',{mid,id:x})});
 s.on('read',({mid}={})=>{const m=db.matches.find(x=>x.id===mid);if(!m||(m.a!==u.id&&m.b!==u.id))return;m.read=m.read||{};m.read[u.id]=Date.now();const o=m.a===u.id?m.b:m.a;if(isPrem(db.users[o]))io.to(o).emit('read',{mid,ts:m.read[u.id]});save()});
 s.on('typing',({mid}={})=>{const m=db.matches.find(x=>x.id===mid);if(!m||(m.a!==u.id&&m.b!==u.id)||limited('ty:'+u.id,4,3000))return;const o=m.a===u.id?m.b:m.a;if(!blocked(u.id,o))io.to(o).emit('typing',{mid})});
 // random chat
 const leave=()=>{queue=queue.filter(q=>q.s!==s);const r=rand[s.id];if(r){clearTimeout(r.t);delete rand[s.id];if(r.peer){delete rand[r.peer.id];r.peer.emit('rand:ended')}}};
 s.on('rand:join',({filter}={})=>{leave();if(limited('rj:'+u.id,10,30000))return s.emit('err','สุ่มถี่เกินไป');if(filter){if(!['m','f'].includes(filter))filter='';else{if(u.coins<PRICES.filter)return s.emit('err','เหรียญไม่พอสำหรับตัวกรองเพศ');u.coins-=PRICES.filter;save();s.emit('coins',u.coins)}}
  const ok=(a,b,f)=>!f||b.gender===f;
  const i=queue.findIndex(q=>ok(u,q.u,filter)&&ok(q.u,u,q.filter)&&!blocked(u.id,q.u.id)&&q.u.id!==u.id);
  if(i>=0){const q=queue.splice(i,1)[0];clearTimeout(q.t);rand[s.id]={peer:q.s};rand[q.s.id]={peer:s};s.emit('rand:paired',pub(q.u));q.s.emit('rand:paired',pub(u));return}
  const entry={s,u,filter};entry.t=setTimeout(()=>{queue=queue.filter(q=>q!==entry);const bots=Object.values(db.users).filter(b=>b.bot&&!b.official&&(!filter||b.gender===filter)&&!blocked(u.id,b.id));const b=pick(bots);if(!b)return s.emit('err','ไม่พบคู่สนทนา');rand[s.id]={bot:b};s.emit('rand:paired',pub(b));setTimeout(()=>rand[s.id]?.bot===b&&s.emit('rand:msg',{text:'หวัดดี 👋 '+pick(REPLIES)}),1000)},4000);queue.push(entry);s.emit('rand:waiting')});
 s.on('rand:msg',text=>{if(flood('rm',8,8000))return;const r=rand[s.id];text=clean(text);if(!r||!text)return;if(r.peer)r.peer.emit('rand:msg',{text});else{const b=r.bot;setTimeout(()=>rand[s.id]?.bot===b&&s.emit('rand:msg',{text:pick(REPLIES)}),1000+Math.random()*1500)}});
 s.on('rand:leave',leave);
 // province rooms
 s.on('room:join',pid=>{if(!PROV.has(pid))return;if(s.room)s.leave('room:'+s.room);s.room=pid;s.join('room:'+pid);s.emit('room:history',{room:pid,msgs:(db.rooms[pid]||[]).filter(m=>!blocked(u.id,m.uid))});pushCounts()});
 s.on('room:leave',()=>{if(s.room){s.leave('room:'+s.room);s.room=null;pushCounts()}});
 s.on('room:msg',({room,text,photo,loc}={})=>{if(!s.room||room!==s.room)return s.emit('err','ส่งไม่สำเร็จ: กรุณาเข้าห้องใหม่อีกครั้ง');if(flood('room',5,8000))return;if(limited('room1:'+u.id,1,700))return s.emit('err','พิมพ์ช้าลงหน่อยนะ');text=clean(text);let extra=null;if(photo||loc){if((photo&&flood('roomph',6,60000)))return;extra=mkExtra(u.id,photo,loc);if(extra==='bad')return s.emit('err',photo?'❌ ส่งรูปไม่สำเร็จ: รูปใหญ่เกินไปหรือไฟล์ไม่ถูกต้อง':'❌ ส่งตำแหน่งไม่สำเร็จ');text=photo?'📷 รูปภาพ':'📍 ตำแหน่ง'}if(!text)return;roomPost(room,u,text.slice(0,500),false,extra)});
 s.on('room:typing',()=>{if(s.room&&!limited('rt:'+u.id,3,3000))s.to('room:'+s.room).emit('room:typing',{room:s.room,uid:u.id,name:u.name})});
 // WebRTC call signaling (matched users only)
 const peerOf=mid=>{const m=db.matches.find(x=>x.id===mid);if(!m||(m.a!==u.id&&m.b!==u.id))return null;const o=m.a===u.id?m.b:m.a;return blocked(u.id,o)?null:o};
 s.on('call:offer',({mid,sdp,video}={})=>{const o=peerOf(mid);if(!o)return;if(db.users[o].bot)return s.emit('call:end',{mid,reason:'bot'});if(!isOnline(o))return s.emit('call:end',{mid,reason:'offline'});io.to(o).emit('call:offer',{mid,sdp,video:!!video,from:pub(u)})});
 for(const ev of ['call:answer','call:ice','call:end','call:reject'])s.on(ev,(d={})=>{const o=peerOf(d.mid);if(o)io.to(o).emit(ev,d)});
 s.on('disconnect',()=>{leave();online.set(u.id,(online.get(u.id)||1)-1);pushCounts()})});
const PORT=process.env.PORT||3000;srv.listen(PORT,()=>console.log('Kuy Talk listening '+PORT+' · storage='+store.kind+' · sms='+SMS.provider));
for(const sg of ['SIGTERM','SIGINT'])process.on(sg,async()=>{try{await store.flush()}catch(e){}process.exit(0)});
