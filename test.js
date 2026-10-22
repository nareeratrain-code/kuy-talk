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
const bot=await wait(sb,'room:msg',m=>m.bot,9000).catch(()=>null);ok(!!bot,'bot chats in popular room');
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
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0)})().catch(e=>{console.error('❌',e.message);process.exit(1)});
