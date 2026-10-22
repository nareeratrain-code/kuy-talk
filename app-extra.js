// GPS location, PDPA (consent / export / requests), support tickets, phone OTP login.
const crypto=require('crypto');
module.exports=function(X){const {app,db,save,auth,adminAuth,io,GEO,SMS,PROVN,gridPut,me,clean,limited,logConsent,newSession,tlog,sha,tokOf,userOfTok,id,DAY,TEAM,makeMatch,TICKETS,userByPhone}=X;
// ---------- location ----------
app.post('/api/location',auth,(req,res)=>{const u=req.u;if(limited('loc:'+u.id,20,60000))return res.status(429).json({error:'อัปเดตตำแหน่งถี่เกินไป'});
 if(!(u.consent&&u.consent.location))return res.status(403).json({error:'ต้องให้ความยินยอมการใช้ตำแหน่งก่อน',needConsent:true});
 const lat=+req.body.lat,lng=+req.body.lng;if(!(lat>=-90&&lat<=90&&lng>=-180&&lng<=180))return res.status(400).json({error:'พิกัดไม่ถูกต้อง'});
 const f=GEO.fuzz(lat,lng,u.id+':'+(u.geoSalt=u.geoSalt||crypto.randomBytes(4).toString('hex'))),r=GEO.reverse(f.lat,f.lng);
 u.geo={lat:f.lat,lng:f.lng,district:r?r.district:null,province:r?r.province:null,ts:Date.now(),paused:false};if(r)u.province=r.province;gridPut(u);save();
 res.json({...me(u),outsideTH:!r})});
app.post('/api/location/pause',auth,(req,res)=>{const u=req.u;if(u.geo){u.geo.paused=!!req.body.paused}else if(!req.body.paused)return res.status(400).json({error:'ยังไม่มีตำแหน่ง'});gridPut(u);save();res.json(me(u))});
app.delete('/api/location',auth,(req,res)=>{delete req.u.geo;gridPut(req.u);save();res.json(me(req.u))});
// ---------- PDPA ----------
app.get('/api/consent',auth,(req,res)=>res.json({current:req.u.consent||{},log:db.consents.filter(c=>c.uid===req.u.id).map(({type,granted,ver,ts})=>({type,granted,ver,ts}))}));
app.post('/api/consent',auth,(req,res)=>{const {type,granted}=req.body||{};if(!['location','marketing'].includes(type))return res.status(400).json({error:'ประเภทความยินยอมไม่ถูกต้อง'});
 logConsent(req.u,type,!!granted,req);if(type==='location'&&!granted){delete req.u.geo;gridPut(req.u)}save();res.json(me(req.u))});
app.get('/api/data/export',auth,(req,res)=>{const u=req.u,uid=u.id;if(limited('exp:'+uid,5,3600e3))return res.status(429).json({error:'ขอข้อมูลถี่เกินไป'});
 const {geoSalt,...profile}=u;const ms=db.matches.filter(m=>m.a===uid||m.b===uid);
 const out={exportedAt:new Date().toISOString(),note:'สำเนาข้อมูลส่วนบุคคลตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 มาตรา 30–31',profile,
  likesGiven:db.likes.filter(l=>l.from===uid),likesReceivedCount:db.likes.filter(l=>l.to===uid&&l.like).length,matches:ms.map(m=>({id:m.id,ts:m.ts,with:(db.users[m.a===uid?m.b:m.a]||{}).name||null})),
  messagesSent:ms.flatMap(m=>(db.messages[m.id]||[]).filter(x=>x.from===uid).map(x=>({mid:m.id,ts:x.ts,type:x.type||'text',text:x.deleted?'(ยกเลิกแล้ว)':x.text}))),
  moments:db.moments.filter(m=>m.uid===uid),reportsFiled:db.reports.filter(r=>r.by===uid).map(({target,...r})=>r),blocks:db.blocks.filter(b=>b.by===uid).map(b=>({ts:b.ts,reason:b.reason})),
  consents:db.consents.filter(c=>c.uid===uid),tickets:db.tickets.filter(t=>t.uid===uid),dataRequests:db.dataRequests.filter(t=>t.uid===uid),
  loginHistory:db.trafficLog.filter(t=>t.uid===uid).slice(-200)};
 db.dataRequests.push({id:id(),uid,type:'export',status:'done',ts:Date.now(),auto:true});save();tlog('data_export',req,uid);
 res.set('Content-Disposition','attachment; filename="kuytalk-my-data.json"');res.json(out)});
const RQ={access:'ขอเข้าถึง/รับสำเนาข้อมูล',portability:'ขอให้โอนย้ายข้อมูล',correct:'ขอแก้ไขข้อมูลให้ถูกต้อง',delete:'ขอลบ/ทำลายข้อมูล',restrict:'ขอระงับการใช้ข้อมูล',object:'คัดค้านการประมวลผล',withdraw:'ถอนความยินยอม',complaint:'ร้องเรียนเรื่องข้อมูลส่วนบุคคล'};
app.post('/api/data/request',auth,(req,res)=>{if(limited('dr:'+req.u.id,5,3600e3))return res.status(429).json({error:'ส่งคำขอถี่เกินไป'});const t=req.body.type;if(!RQ[t])return res.status(400).json({error:'ประเภทคำขอไม่ถูกต้อง'});
 const r={id:id(),uid:req.u.id,name:req.u.name,type:t,label:RQ[t],detail:clean(req.body.detail).slice(0,1000),status:'pending',ts:Date.now(),due:Date.now()+30*DAY};db.dataRequests.push(r);
 const m=makeMatch(req.u.id,TEAM);(db.messages[m.id]=db.messages[m.id]||[]).push({id:id(),from:TEAM,text:`📨 ได้รับคำขอ "${RQ[t]}" แล้ว (เลขที่ ${r.id.slice(0,8)}) เราจะดำเนินการภายใน 30 วันตามกฎหมาย`,ts:Date.now()});save();res.json({ok:true,id:r.id,due:r.due})});
app.get('/api/data/requests',auth,(req,res)=>res.json(db.dataRequests.filter(r=>r.uid===req.u.id).reverse()));
// ---------- support ----------
const TOPIC={account:'บัญชี/เข้าสู่ระบบ',payment:'การชำระเงิน/คืนเงิน',safety:'ความปลอดภัย/ผู้ใช้ไม่เหมาะสม',bug:'แจ้งปัญหาการใช้งาน',privacy:'ข้อมูลส่วนบุคคล',other:'อื่น ๆ'};
app.post('/api/support',auth,(req,res)=>{if(limited('sup:'+req.u.id,5,3600e3))return res.status(429).json({error:'ส่งถี่เกินไป กรุณารอสักครู่'});const msg=clean(req.body.message).slice(0,2000);if(msg.length<5)return res.status(400).json({error:'กรุณาอธิบายปัญหาอย่างน้อย 5 ตัวอักษร'});
 const email=String(req.body.email||'').trim().slice(0,120);if(email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))return res.status(400).json({error:'อีเมลไม่ถูกต้อง'});
 const t={id:id(),uid:req.u.id,name:req.u.name,topic:TOPIC[req.body.topic]?req.body.topic:'other',topicLabel:TOPIC[req.body.topic]||TOPIC.other,email:email||null,message:msg,status:'open',ts:Date.now()};db.tickets.push(t);save();res.json({ok:true,id:t.id})});
app.get('/api/support',auth,(req,res)=>res.json(db.tickets.filter(t=>t.uid===req.u.id).reverse()));
app.post('/api/admin/ticket',adminAuth,(req,res)=>{const t=db.tickets.find(x=>x.id===req.body.id)||db.dataRequests.find(x=>x.id===req.body.id);if(!t)return res.status(404).end();t.status=['open','pending','resolved','done','rejected'].includes(req.body.status)?req.body.status:'resolved';
 if(req.body.reply){const r=clean(req.body.reply).slice(0,1000);t.reply=r;const m=makeMatch(t.uid,TEAM);(db.messages[m.id]=db.messages[m.id]||[]).push({id:id(),from:TEAM,text:'💬 ทีมงานตอบกลับ: '+r,ts:Date.now()});io.to(t.uid).emit('msg',{mid:m.id,...db.messages[m.id].slice(-1)[0]})}save();res.json({ok:true})});
// ---------- phone OTP ----------
const OTP_SECRET=process.env.OTP_SECRET||crypto.randomBytes(32).toString('hex');
const OTP=new Map();const OTP_TTL=5*60000,COOLDOWN=60000,MAX_TRIES=5;
const normPhone=s=>{const d=String(s||'').replace(/[\s\-().]/g,'');const m=/^(?:\+?66|0)([689]\d{8})$/.exec(d);return m?'+66'+m[1]:null};
const hmac=(p,c)=>crypto.createHmac('sha256',OTP_SECRET).update(p+':'+c).digest();
setInterval(()=>{const n=Date.now();for(const [k,v] of OTP)if(v.exp<n-COOLDOWN)OTP.delete(k);for(const [k,v] of TICKETS)if(v.exp<n)TICKETS.delete(k)},60000).unref();
app.post('/api/otp/request',async(req,res)=>{const phone=normPhone(req.body&&req.body.phone);if(!phone)return res.status(400).json({error:'เบอร์มือถือไทยไม่ถูกต้อง (เช่น 0812345678 หรือ +66812345678)'});
 const o=OTP.get(phone);if(o&&Date.now()-o.sent<COOLDOWN)return res.status(429).json({error:'กรุณารอก่อนขอรหัสใหม่',retryIn:Math.ceil((COOLDOWN-(Date.now()-o.sent))/1000)});
 if(limited('otp-ph:'+phone,5,3600e3))return res.status(429).json({error:'ขอรหัสสำหรับเบอร์นี้ถี่เกินไป ลองใหม่ใน 1 ชั่วโมง'});
 if(limited('otp-ip:'+req.ip,10,3600e3))return res.status(429).json({error:'ขอรหัสถี่เกินไปจากเครือข่ายนี้'});
 const code=String(crypto.randomInt(0,1e6)).padStart(6,'0');OTP.set(phone,{h:hmac(phone,code),exp:Date.now()+OTP_TTL,tries:0,sent:Date.now()});
 try{await SMS.send(phone,`Kuy Talk: รหัส OTP ของคุณคือ ${code} (หมดอายุใน 5 นาที) ห้ามบอกรหัสนี้กับผู้อื่น`)}catch(e){OTP.delete(phone);console.error('sms failed',e.message);return res.status(502).json({error:'ส่ง SMS ไม่สำเร็จ กรุณาลองใหม่'})}
 tlog('otp_request',req,null);res.json({ok:true,phone:'+66 '+phone[3]+'x-xxx-'+phone.slice(-4),expiresIn:OTP_TTL/1000,cooldown:COOLDOWN/1000,...(SMS.devMode?{devCode:code,devNote:'โหมดทดสอบ: ยังไม่ได้ตั้งค่าผู้ให้บริการ SMS จึงแสดงรหัสบนหน้าจอ'}:{})})});
app.post('/api/otp/verify',(req,res)=>{const phone=normPhone(req.body&&req.body.phone),code=String(req.body&&req.body.code||'');
 if(limited('otpv-ip:'+req.ip,30,600000))return res.status(429).json({error:'ลองถี่เกินไป กรุณารอสักครู่'});
 if(!phone||!/^\d{6}$/.test(code))return res.status(400).json({error:'กรุณากรอกรหัส 6 หลัก'});const o=OTP.get(phone);
 if(!o||o.exp<Date.now()){OTP.delete(phone);return res.status(400).json({error:'รหัสหมดอายุหรือยังไม่ได้ขอรหัส'})}
 if(o.tries>=MAX_TRIES){OTP.delete(phone);return res.status(429).json({error:'กรอกรหัสผิดเกินกำหนด กรุณาขอรหัสใหม่'})}
 if(!crypto.timingSafeEqual(o.h,hmac(phone,code))){o.tries++;const left=MAX_TRIES-o.tries;if(left<=0)OTP.delete(phone);return res.status(400).json({error:'รหัสไม่ถูกต้อง'+(left>0?` (เหลือ ${left} ครั้ง)`:' — กรุณาขอรหัสใหม่'),left})}
 OTP.delete(phone);const cur=userOfTok(tokOf(req)),owner=userByPhone(phone);
 if(req.body.link){if(!cur||cur.bot)return res.status(401).json({error:'กรุณาเข้าสู่ระบบก่อน'});if(owner&&owner.id!==cur.id)return res.status(409).json({error:'เบอร์นี้ผูกกับบัญชีอื่นแล้ว'});cur.phone=phone;tlog('phone_link',req,cur.id);save();return res.json({linked:true,me:me(cur)})}
 if(owner){if(owner.banned)return res.status(403).json({error:'บัญชีนี้ถูกระงับ'});tlog('login_otp',req,owner.id);return res.json({token:newSession(owner.id,req,res),isNew:false})}
 const ticket=crypto.randomBytes(24).toString('hex');TICKETS.set(ticket,{phone,exp:Date.now()+15*60000});res.json({needSignup:true,phoneTicket:ticket})});
app.post('/api/phone/unlink',auth,(req,res)=>{delete req.u.phone;save();res.json(me(req.u))});
X.normPhone=normPhone;};
