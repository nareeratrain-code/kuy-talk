// Kuy Talk integration test: node test.js  (server must be running on :3000)
const {io}=require('socket.io-client');const B=process.env.BASE||'http://localhost:3000';
const p=(u,b,t,m)=>{if(u==='signup'&&b&&!b.consent)b={...b,consent:{terms:true,privacy:true,age18:true}};return fetch(B+'/api/'+u,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-token':t||''},body:b&&JSON.stringify(b)}).then(async r=>{const j=await r.json().catch(()=>({}));return Array.isArray(j)?j:{status:r.status,...j}})};
const wait=(s,ev,f=()=>true,ms=6000)=>new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('timeout '+ev)),ms);const h=d=>{if(f(d)){clearTimeout(t);s.off(ev,h);res(d)}};s.on(ev,h)});
let pass=0,fail=0;const ok=(c,n)=>{c?pass++:fail++;console.log((c?'✅':'❌')+' '+n)};
(async()=>{
const a=(await p('signup',{name:'TestA',age:20,gender:'m'})).token,b=(await p('signup',{name:'TestB',age:21,gender:'f'})).token;
const meA=await p('me',null,a),meB=await p('me',null,b);
await p('swipe',{to:meB.id,dir:'right'},a);const r=await p('swipe',{to:meA.id,dir:'right'},b);ok(!!r.match,'mutual like → match');
const sa=io(B,{auth:{token:a}}),sb=io(B,{auth:{token:b}});await Promise.all([wait(sa,'connect'),wait(sb,'connect')]);
let w=wait(sb,'msg');sa.emit('msg',{mid:r.match.id,text:'hello <b>match</b>'});const got=await w;ok(got.text.includes('hello')&&!got.text.includes('<b>'),'DM realtime + server sanitises HTML');
// random chat
w=wait(sa,'rand:paired');sa.emit('rand:join',{});sb.emit('rand:join',{});const pr=await w;ok(pr.id===meB.id,'random chat pairs two humans');
w=wait(sb,'rand:msg');sa.emit('rand:msg','hi random');ok((await w).text==='hi random','random chat message');sa.emit('rand:leave');
// coins
ok((await p('topup',{pack:'p1'},a)).coins===150,'mock top-up');
// province rooms
const cfg=await p('config');ok(cfg.provinces.length===77,'77 provinces');
w=wait(sb,'room:history');sa.emit('room:join','bangkok');sb.emit('room:join','bangkok');await w;
const cnt=await wait(sa,'room:counts',c=>c.bangkok>=4);ok(cnt.bangkok>=4,'room online count ('+cnt.bangkok+' incl. 2 bot presence)');
w=wait(sb,'room:typing');sa.emit('room:typing');ok((await w).name==='TestA','room typing indicator');
w=wait(sb,'room:msg',m=>m.uid===meA.id);sa.emit('room:msg',{room:'bangkok',text:'สวัสดีกรุงเทพ fuck <script>'});const rm=await w;ok(rm.text.includes('****')&&!rm.text.includes('<'),'room msg realtime + swear filter + sanitise: '+rm.text);
const bot=await wait(sb,'room:msg',m=>m.bot,30000).catch(()=>null);ok(!!bot,'bot chats in popular room');
let errs=0;sa.on('err',()=>errs++);for(let i=0;i<10;i++)sa.emit('room:msg',{room:'bangkok',text:'flood '+i});await new Promise(r=>setTimeout(r,800));ok(errs>0,'room flood protection');
const sc=io(B,{auth:{token:a}});w=wait(sc,'room:history');sc.emit('room:join','bangkok');const hist=await w;ok(hist.msgs.some(m=>m.text.startsWith('สวัสดีกรุงเทพ')),'room history saved ('+hist.msgs.length+')');sc.close();
// moments
const mo=await p('moments',{text:'โมเมนต์แรก <i>x</i>'},a);ok(mo.id&&!mo.text.includes('<'),'post moment');
ok((await p(`moments/${mo.id}/like`,{},b)).likes===1,'like moment');
ok((await p(`moments/${mo.id}/comment`,{text:'สวยมาก'},b)).comments.length===1,'comment moment');
ok((await p('moments',null,b)).some(m=>m.id===mo.id),'feed shows real users');
// friends
w=wait(sb,'friend');ok((await p('friends/request',{id:meB.id},a)).status==='pending','friend request');await w;
ok((await p('friends',null,b)).incoming.some(u=>u.id===meA.id),'incoming request listed');
await p('friends/respond',{id:meA.id,accept:true},b);ok((await p('friends',null,a)).friends.some(u=>u.id===meB.id),'friend accepted');
// lucky / shake
const lk=await p('lucky',{},a);ok(lk.mid&&lk.user,'lucky spin pairs a profile');ok((await p('lucky',{},a)).status===402,'lucky limited 1/day (free)');
ok((await p('shake',{},a)).mid,'shake-to-match');
// report & block
ok((await p('report',{id:meB.id,category:'spam',severity:'medium',detail:'test'},a)).ok,'report stored');
await p('block',{id:meB.id},a);
ok(!(await p('matches',null,a)).some(m=>m.other.id===meB.id),'blocked user hidden from matches');
ok(!(await p('people',null,b)).some(u=>u.id===meA.id),'blocker hidden from blocked user');
const e=wait(sb,'err');sb.emit('msg',{mid:r.match.id,text:'still there?'});ok(/ไม่สามารถ/.test(await e),'blocked user cannot message');
await p('unblock',{id:meB.id},a);ok((await p('matches',null,a)).some(m=>m.other.id===meB.id),'unblock restores');
// premium expiry
const pm=await p('subscribe',{},a);ok(pm.premium&&Math.round((pm.premiumUntil-Date.now())/864e5)===30,'premium 30 days');
// admin protected
ok((await fetch(B+'/api/admin/overview')).status===401,'admin API requires password');
ok((await fetch(B+'/admin')).status===401,'admin page requires password');
const pw=(require('fs').readFileSync(__dirname+'/.env','utf8').match(/ADMIN_PASSWORD=(.*)/)||[])[1];const H={authorization:'Basic '+Buffer.from('admin:'+pw).toString('base64')};
const ov=await (await fetch(B+'/api/admin/overview',{headers:H})).json();ok(ov.reports&&ov.reports.some(x=>x.target===meB.id),'admin sees real reports');
await fetch(B+'/api/admin/ban',{method:'POST',headers:{...H,'content-type':'application/json'},body:JSON.stringify({id:meB.id,banned:true})});ok((await p('me',null,b)).status===403,'admin ban blocks account');

// ---- Omi-style systems ----
const PNG0='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const y=new Date().getFullYear()-25;
ok((await p('signup',{name:'Kid',dob:`${new Date().getFullYear()-15}-01-01`})).status===400,'signup rejects under-18 DOB (server)');
const c=(await p('signup',{name:'OmiC',dob:`${y}-04-05`,gender:'f',province:'chiangmai'})).token,d=(await p('signup',{name:'OmiD',dob:`${y}-08-01`,gender:'m',ref:'NOPE00'})).token;
let mc=await p('me',null,c),md=await p('me',null,d);
ok(mc.zodiac&&mc.zodiac.name==='ราศีเมษ'&&md.zodiac.name==='ราศีสิงห์','zodiac auto from DOB');ok(mc.age===25&&mc.provinceName==='เชียงใหม่','age from DOB + province on profile');
ok(mc.completion.pct>0&&mc.completion.missing.includes('verified'),'profile completion % ('+mc.completion.pct+'%)');
const tm=(await p('matches',null,c)).find(m=>m.other.official);ok(tm&&tm.last&&tm.other.verified,'official Kuy Talk Team chat with welcome');
ok(!(await p('cards',null,c)).some(x=>x.official),'team account not in deck');
// referral
const eT=(await p('signup',{name:'OmiE',age:22,ref:mc.refCode})).token;ok((await p('me',null,eT)).coins===100&&(await p('me',null,c)).coins===100,'referral code gives both +50 coins');
ok((await p('referral',{code:mc.refCode},eT)).status===400,'referral only once');
// visitors (blurred for free)
await p('visit',{id:mc.id},d);await new Promise(r=>setTimeout(r,10));let vs=await p('visitors',null,c);ok(vs.stats.total===1&&vs.list[0].blur&&!vs.list[0].name,'visitor tracked + blurred for free user');
// likes received blurred, given list
await p('swipe',{to:mc.id,dir:'right'},d);let lr=await p('likes/received',null,c);ok(lr.count===1&&lr.list[0].blur&&!lr.list[0].id,'likes-received blurred for free (no identity leak)');
ok((await p('likes/given',null,d)).some(x=>x.id===mc.id),'likes-given list');
// crush inventory
ok((await p('swipe',{to:(await p('cards',null,d)).find(x=>x.bot).id,dir:'right',superlike:true},d)).me.inventory.crush===0,'Crush consumes inventory');
const bot2=(await p('cards',null,d)).find(x=>x.bot);ok((await p('swipe',{to:bot2.id,dir:'right',superlike:true},d)).status===402,'no Crush left → 402');
ok((await p('shop/buy',{item:'crush',qty:5},d)).status===402,'shop needs coins');await p('topup',{pack:'p2'},d);const bought=await p('shop/buy',{item:'crush',qty:5},d);ok(bought.inventory.crush===5&&bought.coins===350-80,'buy 5 Crush with coins (20% off)');
// compliment
const bot3=(await p('cards',null,d)).find(x=>x.bot);const cp=await p('compliment',{to:bot3.id,text:'ยิ้มสวย <b>'},d);ok(cp.match&&cp.me.inventory.compliment===0,'compliment consumes item & bot matches');
ok((await p('compliment',{to:mc.id,text:'hi'},d)).status===402,'compliment needs item');
// turbo
ok((await p('turbo',{},d)).status===402,'Turbo needs item');await p('shop/buy',{item:'turbo'},d);const tu=await p('turbo',{},d);ok(tu.turboUntil>Date.now(),'Turbo activates (timed)');
const cardsC=await p('cards',null,c);{const ix=cardsC.findIndex(x=>x.id===md.id);ok(ix>=0&&cardsC.slice(0,ix+1).every(x=>x.turbo)&&!cardsC.slice(0,ix).some(x=>!x.turbo),'Turbo user ranked first in deck')};
// premium gates
ok((await p('undo',{},d)).status===402,'undo is Premium-only');ok((await p('unmatch',{mid:cp.match.id},d)).status===402,'unmatch is Premium-only');
ok((await p('read/'+cp.match.id,null,d)).peerReadAt===null,'read receipts hidden for free');
await p('subscribe',{},c);lr=await p('likes/received',null,c);ok(lr.list[0].id===md.id&&lr.list[0].name==='OmiD','Premium unlocks likes-received');
vs=await p('visitors',null,c);ok(vs.list[0].id===md.id,'Premium unlocks visitors');
const bc=(await p('cards',null,c)).find(x=>x.bot);await p('swipe',{to:bc.id,dir:'left'},c);const un=await p('undo',{},c);ok(un.user&&un.user.id===bc.id,'Premium undo last swipe');
ok((await p('swipe',{to:bc.id,dir:'right',superlike:true},c)).me.inventory.crush===1,'Premium daily free Crush (inventory untouched)');
const pmX=(await p('matches',null,c)).find(m=>m.other.id===bc.id);
if(pmX){const sc2=io(B,{auth:{token:c}});await wait(sc2,'connect');const rr=wait(sc2,'read',x=>x.mid===pmX.id,8000);sc2.emit('msg',{mid:pmX.id,text:'[[sticker:hi]]'});const sr=await wait(sc2,'msg',m=>m.mid===pmX.id&&m.from===bc.id,8000);ok(/^\[\[sticker:\w+\]\]$/.test(sr.text),'sticker message + bot sticker reply');
 ok(!!(await rr),'read receipt event for Premium');ok((await p('read/'+pmX.id,null,c)).peerReadAt>0,'read receipt via API for Premium');
 let w2=wait(sc2,'msg',m=>m.mid===pmX.id&&m.type==='photo'&&m.from!==bc.id);sc2.emit('msg',{mid:pmX.id,photo:PNG0});const ph=await w2;ok(ph.photo===PNG0&&ph.id,'photo message delivered realtime');
 w2=wait(sc2,'msg',m=>m.mid===pmX.id&&m.type==='loc');sc2.emit('msg',{mid:pmX.id,loc:{lat:13.7563,lng:100.5018}});const lc=await w2;ok(lc.lat===13.7563&&lc.lng===100.5018,'location message');
 let bad=0;sc2.once('err',()=>bad++);sc2.emit('msg',{mid:pmX.id,photo:'data:text/html;base64,AAAA'});await new Promise(r=>setTimeout(r,400));ok(bad===1,'rejects non-image photo');
 w2=wait(sc2,'unsend');sc2.emit('unsend',{mid:pmX.id,id:ph.id});await w2;const hm=await p('messages/'+pmX.id,null,c);const g=hm.find(x=>x.id===ph.id);ok(g.deleted&&!g.photo,'unsend removes photo for both');
 const botMsg=hm.find(x=>x.from===bc.id);sc2.emit('unsend',{mid:pmX.id,id:botMsg&&botMsg.id});await new Promise(r=>setTimeout(r,300));ok(!(await p('messages/'+pmX.id,null,c)).find(x=>x.id===(botMsg&&botMsg.id)).deleted,'cannot unsend other\'s message');
 await p('chat/clear',{mid:pmX.id},c);ok((await p('messages/'+pmX.id,null,c)).length===0,'clear chat (own side)');
 ok((await p('unmatch',{mid:pmX.id},c)).ok&&!(await p('matches',null,c)).some(m=>m.id===pmX.id),'Premium unmatch removes chat');sc2.close()}else ok(false,'bot match for read test');
ok((await p('unmatch',{mid:tm.id},c)).status===400,'cannot unmatch team chat');
// filters
await p('filters',{gender:'m',ageMin:30,ageMax:20},c);const fl=await p('cards',null,c);ok(fl.every(x=>x.gender==='m'&&x.age>=20&&x.age<=30),'filters (gender + age range, swapped bounds)');
await p('filters',{province:'chiangmai'},d);ok((await p('cards',null,d)).every(x=>x.province==='chiangmai'),'province filter');
// prefs, photos, profile, verify
const pp=await p('prefs',{showPremium:false},c);ok(pp.premium===true&&(await p('user/'+mc.id,null,d)).premium===false,'hide Premium icon pref (others no longer see crown)');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
ok((await p('photos',{photo:'javascript:x'},c)).status===400,'rejects bad photo');ok((await p('photos',{photo:PNG},c)).photos.length===1,'photo upload');
ok((await p('profile',{dob:`${y+10}-01-01`},c)).status===400,'profile DOB 18+ enforced');
await p('verify',{selfie:PNG},c);const ov2=await (await fetch(B+'/api/admin/overview',{headers:H})).json();ok(ov2.verifies.some(v=>v.id===mc.id),'verify request reaches admin');
await fetch(B+'/api/admin/verify',{method:'POST',headers:{...H,'content-type':'application/json'},body:JSON.stringify({id:mc.id,approve:true})});ok((await p('me',null,c)).verified,'admin approves → verified badge');
ok((await p('me/stats',null,c)).likesReceived>=1,'profile stats');
ok((await p('account/delete',{},eT)).ok&&(await p('me',null,eT)).status===401,'account delete');

// ---------- sessions / PDPA / GPS / OTP ----------
{const RUN=Date.now()%1e6;const sl=ms=>new Promise(r=>setTimeout(r,ms));
ok((await p('signup',{name:'NoC',age:22,consent:{terms:true}})).status===400,'signup requires terms+privacy+18+ consent');
const r0=await fetch(B+'/api/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Ck',age:25,consent:{terms:true,privacy:true,age18:true,marketing:true}})});const ck=r0.headers.get('set-cookie')||'';const t0=(await r0.json()).token;
ok(/kt_s=/.test(ck)&&/HttpOnly/i.test(ck),'session token set as httpOnly cookie');
const m0=await p('me',null,t0);ok(m0.id!==t0&&(await p('me',null,m0.id)).status===401,'public user id is not a session token');
ok((await fetch(B+'/api/me',{headers:{cookie:'kt_s='+t0}})).status===200,'cookie session authenticates');
const cl=await p('consent',null,t0);ok(['terms','privacy','age18','location','marketing'].every(k=>cl.log.some(x=>x.type===k))&&cl.current.marketing===true&&cl.current.location===false,'consent log records separate location & marketing choices');
await p('consent',{type:'marketing',granted:false},t0);ok((await p('consent',null,t0)).log.filter(x=>x.type==='marketing').length===2,'withdraw marketing consent logged');
ok((await p('location',{lat:13.7563,lng:100.5018},t0)).status===403,'location blocked without location consent');
const mk=async(n,lat,lng)=>{const t=(await p('signup',{name:n,age:24,consent:{terms:true,privacy:true,age18:true,location:true}})).token;const m=await p('location',{lat,lng},t);return{t,m}};
const L1=await mk('GeoBKK'+RUN,13.7583,100.4961),L2=await mk('GeoNon'+RUN,13.8621,100.5144),L3=await mk('GeoCM'+RUN,18.7883,98.9853),L4=await mk('GeoNear'+RUN,13.7590,100.4972);
ok(L1.m.geo&&L1.m.geo.district==='พระนคร'&&L1.m.geo.province==='bangkok'&&L1.m.province==='bangkok','reverse geocode offline → เขตพระนคร, กรุงเทพฯ');
ok(L3.m.geo.provinceName==='เชียงใหม่','reverse geocode → เชียงใหม่');
const pp=await p('people',null,L1.t),raw=JSON.stringify(pp);const i2=pp.findIndex(x=>x.name==='GeoNon'+RUN),i3=pp.findIndex(x=>x.name==='GeoCM'+RUN),x2=pp[i2],x4=pp.find(x=>x.name==='GeoNear'+RUN);
ok(!/"lat"|"lng"|13\.75|100\.49/.test(raw),'no coordinates exposed to other users');
ok(i2>=0&&i3>i2&&Math.abs(x2.dist-11.8)<1.5&&Math.abs(pp[i3].dist-582)<10,'nearby ordered by real haversine distance ('+(x2&&x2.dist)+' km, '+(pp[i3]&&pp[i3].dist)+' km)');
ok(x4&&/^ในเขต พระนคร$/.test(x4.distLabel),'same district label "'+(x4&&x4.distLabel)+'"');
ok(/km$/.test(x2.distLabel),'distance label "'+x2.distLabel+'"');
await p('filters',{maxDist:25},L1.t);const cd=await p('cards',null,L1.t);ok(cd.some(x=>x.name==='GeoNon'+RUN)&&!cd.some(x=>x.name==='GeoCM'+RUN)&&cd.every(x=>x.dist==null||x.dist<=25),'distance filter 25 km (spatial index)');
await p('filters',{maxDist:0},L1.t);ok((await p('cards',null,L1.t)).some(x=>x.name==='GeoCM'+RUN),'ทั้งประเทศ shows nationwide');
await p('prefs',{hideDist:true},L2.t);ok((await p('people',null,L1.t)).find(x=>x.name==='GeoNon'+RUN).distLabel==='ซ่อนระยะทาง','hide distance setting');
const pz=await p('location/pause',{paused:true},L1.t);ok(pz.locSource==='province'&&pz.geo.paused,'pause location → province fallback');
const dn=await mk('NoGPS'+RUN,0,0);await p('location',{},dn.t);await p('profile',{province:'phuket'},dn.t);ok((await p('people',null,dn.t)).find(x=>x.name==='GeoCM'+RUN).dist>500,'permission denied → province centroid distance');
// OTP
ok((await p('otp/request',{phone:'12345'})).status===400&&(await p('otp/request',{phone:'0212345678'})).status===400,'rejects invalid / non-mobile Thai numbers');
const ph='08'+String(Date.now()).slice(-8);const o1=await p('otp/request',{phone:ph});ok(o1.ok&&/^\d{6}$/.test(o1.devCode)&&o1.expiresIn===300,'OTP 6 digits, 5-min expiry, dev code only in console mode');
const o2=await p('otp/request',{phone:'+66'+ph.slice(1)});ok(o2.status===429&&o2.retryIn>0,'resend cooldown (+66 normalised to same number)');
const bad=await p('otp/verify',{phone:ph,code:o1.devCode==='000000'?'111111':'000000'});ok(bad.status===400&&bad.left===4,'wrong code counts attempts');
const v1=await p('otp/verify',{phone:ph,code:o1.devCode});ok(v1.needSignup&&v1.phoneTicket,'new number → signup ticket');
ok((await p('otp/verify',{phone:ph,code:o1.devCode})).status===400,'OTP single-use');
const sp=await p('signup',{name:'PhoneU',age:23,phoneTicket:v1.phoneTicket});const ms=await p('me',null,sp.token);ok(/^\+66 \dx-xxx-\d{4}$/.test(ms.phone),'signup with verified phone (masked '+ms.phone+')');
await sl(o1.cooldown*1000+200);const o3=await p('otp/request',{phone:ph});const v3=await p('otp/verify',{phone:ph,code:o3.devCode});ok(v3.token&&(await p('me',null,v3.token)).id===ms.id,'OTP login returns session for existing phone account');
ok((await p('logout',{},v3.token)).ok&&(await p('me',null,v3.token)).status===401,'logout revokes session');
const ph2='09'+String(Date.now()+7).slice(-8);const o4=await p('otp/request',{phone:ph2});let last;for(let k=0;k<5;k++)last=await p('otp/verify',{phone:ph2,code:o4.devCode==='999999'?'888888':'999999'});
ok((await p('otp/verify',{phone:ph2,code:o4.devCode})).status===400,'attempt limit (5) invalidates OTP');
const ph3='06'+String(Date.now()+9).slice(-8);const o5=await p('otp/request',{phone:ph3});const lk=await p('otp/verify',{phone:ph3,code:o5.devCode,link:true},t0);ok(lk.linked&&lk.me.phone,'link existing token account to phone');
await sl(o5.cooldown*1000+200);const o6=await p('otp/request',{phone:ph3});const v6=await p('otp/verify',{phone:ph3,code:o6.devCode});ok(v6.token&&(await p('me',null,v6.token)).id===m0.id,'login by linked phone → same account');
// data rights, support, admin
const ex=await fetch(B+'/api/data/export',{headers:{'x-token':t0}});const exj=await ex.json();ok(/attachment/.test(ex.headers.get('content-disposition')||'')&&exj.profile.name==='Ck'&&!exj.profile.geoSalt&&exj.consents.length>=5,'PDPA data export (JSON download)');
const dr=await p('data/request',{type:'correct',detail:'ขอแก้ชื่อ'},t0);ok(dr.ok&&dr.due>Date.now(),'data subject request saved (30-day due)');
ok((await p('support',{topic:'payment',email:'a@b.co',message:'ทดสอบติดต่อฝ่ายบริการลูกค้า'},t0)).ok,'customer service ticket');
ok((await p('support',{topic:'bug',message:'x'},t0)).status===400,'support validates message');
const ov3=await (await fetch(B+'/api/admin/overview',{headers:H})).json();ok(ov3.tickets.some(t=>t.uid===m0.id)&&ov3.dataRequests.some(r=>r.id===dr.id)&&ov3.trafficLog>0&&ov3.consentLog>0,'admin sees tickets, data requests, consent & traffic logs');
const dd=await p('account/delete',{},v6.token);ok(dd.ok&&(await p('me',null,t0)).status===401,'account delete revokes all sessions');
await sl(o6.cooldown*1000+200);const o7=await p('otp/request',{phone:ph3});ok((await p('otp/verify',{phone:ph3,code:o7.devCode})).needSignup,'deleted account frees phone number');
// ---------- Firebase Phone Auth (auth emulator) — runs when FB_AUTH_EMU=host:port ----------
if(process.env.FB_AUTH_EMU){const E='http://'+process.env.FB_AUTH_EMU,PJ=process.env.FIREBASE_PROJECT_ID||'demo-kuytalk',J=(u,b)=>fetch(u,{method:b?'POST':'GET',headers:{'content-type':'application/json'},body:b&&JSON.stringify(b)}).then(r=>r.json());
 const fbTok=async ph=>{const s=await J(E+'/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=fake',{phoneNumber:ph,recaptchaToken:'x'});const codes=(await J(E+'/emulator/v1/projects/'+PJ+'/verificationCodes')).verificationCodes;const c=codes.filter(x=>x.sessionInfo===s.sessionInfo).pop();return (await J(E+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=fake',{sessionInfo:s.sessionInfo,code:c.code})).idToken};
 const cf=await p('config');ok(cf.firebase&&cf.firebase.apiKey&&!JSON.stringify(cf).includes('private_key'),'config exposes only public Firebase web config');
 const fph='+66'+(9e8+Math.floor(Math.random()*9e7));const ft=await fbTok(fph);ok((await p('firebase/verify',{idToken:'garbage'})).status===401,'firebase: forged ID token rejected');
 const fv=await p('firebase/verify',{idToken:ft});ok(fv.needSignup&&fv.phoneTicket,'firebase: new phone → signup ticket');
 const fs1=await p('signup',{name:'FbUser'+RUN,age:24,gender:'f',phoneTicket:fv.phoneTicket});const fm=await p('me',null,fs1.token);ok(fm.phone&&fm.phone.endsWith(fph.slice(-4)),'firebase: signup links phone');
 const fv2=await p('firebase/verify',{idToken:await fbTok(fph)});ok(fv2.token&&(await p('me',null,fv2.token)).id===fm.id,'firebase: same phone logs in to same account');
 const other=(await p('signup',{name:'FbLink'+RUN,age:30,gender:'m'})).token;ok((await p('firebase/verify',{idToken:await fbTok(fph),link:true},other)).status===409,'firebase: link refuses phone owned by other account');
 const fph2='+66'+(8e8+Math.floor(Math.random()*9e7));const lk=await p('firebase/verify',{idToken:await fbTok(fph2),link:true},other);ok(lk.linked,'firebase: link phone to existing account');
 const us=await J(E+'/identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=fake',{phoneNumber:'+14155550100',recaptchaToken:'x'});
 if(us.sessionInfo){const c=(await J(E+'/emulator/v1/projects/'+PJ+'/verificationCodes')).verificationCodes.filter(x=>x.sessionInfo===us.sessionInfo).pop();const ut=(await J(E+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=fake',{sessionInfo:us.sessionInfo,code:c.code})).idToken;ok((await p('firebase/verify',{idToken:ut})).status===400,'firebase: non-Thai number rejected')}}
}
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0)})().catch(e=>{console.error('❌',e.message);process.exit(1)});
