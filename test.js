// Kuy Talk integration test: node test.js  (server must be running on :3000)
const {io}=require('socket.io-client');const B=process.env.BASE||'http://localhost:3000';
const p=(u,b,t,m)=>fetch(B+'/api/'+u,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-token':t||''},body:b&&JSON.stringify(b)}).then(async r=>{const j=await r.json().catch(()=>({}));return Array.isArray(j)?j:{status:r.status,...j}});
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
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0)})().catch(e=>{console.error('❌',e.message);process.exit(1)});
