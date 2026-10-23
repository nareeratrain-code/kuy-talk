const P=require('puppeteer-core');const B=process.env.BASE||'http://localhost:3000';const D='/workspace/fix-shots10/'+(process.env.TAG||'local')+'-';const sl=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{require('fs').mkdirSync('/workspace/fix-shots10',{recursive:true});const br=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});let f=0;const ok=(c,n)=>{if(!c)f++;console.log((c?'✅ ':'❌ ')+n)};
const mk=async n=>{const ctx=await br.createBrowserContext();const pg=await ctx.newPage();pg.on('pageerror',e=>console.log('ERR',e.message));await pg.emulate({viewport:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'});
 pg.T=[];await pg.exposeFunction('_t',t=>pg.T.push(t));await pg.goto(B+'/',{waitUntil:'networkidle2',timeout:90000});await pg.evaluate(async n=>{const j=await (await fetch('/api/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:n,gender:'f',dob:'1996-02-02',province:'bangkok',consent:{terms:true,privacy:true,age18:true}})})).json();localStorage.kt_token=j.token},n);return pg};
const boot=async pg=>{await pg.reload({waitUntil:'networkidle2'});await pg.waitForFunction(()=>window.KT&&KT.me(),{timeout:60000});await pg.evaluate(()=>{const o=window.showToast;window.showToast=function(t){_t(String(t));return o&&o.apply(this,arguments)}});await sl(4000);await pg.evaluate(()=>{document.getElementById('kgCookieOk')?.click();document.querySelectorAll('#koSheet,.ko-sheet-bg').forEach(x=>x.remove())})};
const pg=await mk('ทดสอบทุกช่อง');await boot(pg);await pg.evaluate(()=>koEdit());await sl(2000);
const F=await pg.evaluate(()=>KTPF.F);const exp={};let n=0;
const row=t=>pg.evaluate(t=>{const r=[...document.querySelectorAll('#kpPage .kp-row')].find(x=>x.querySelector('b').textContent===t);if(!r)return false;r.click();return true},t);
const back=async()=>{await pg.evaluate(()=>document.querySelector('#kpPage .kp-back').click());await sl(1600)};
const okBtn=async()=>{await pg.evaluate(()=>document.getElementById('kpOk').click());await sl(1600)};
// option pickers (incl. interests via its button)
for(const [k,fd] of Object.entries(F)){if(k==='interests')await pg.evaluate(()=>[...document.querySelectorAll('#kpPage .kp-addbtn')].find(b=>/ความสนใจ/.test(b.textContent)).click());else if(!(await row(fd.t))){ok(false,'row '+fd.t);continue}
 await sl(400);const pick=fd.multi?fd.o.slice(1,3):[fd.o[1]];for(const o of pick){await pg.evaluate(o=>[...document.querySelectorAll('.kp-opts button')].find(b=>b.dataset.o===o).click(),o);await sl(150)}
 exp[k]=fd.multi?pick:pick[0];if(n++%2)await okBtn();else await back()}
await pg.screenshot({path:D+'1-after-pickers.png'});
const TX=[['ซีรีส์ที่กำลังดู','series','Squid Game'],['ทีมโปรด','team','ลิเวอร์พูล'],['เกมที่เล่น','games','ROV'],['เพลง/ศิลปินที่ชอบ','music','Bodyslam'],['ส่วนสูง (ซม.)','height','168'],['ชื่อผู้ใช้ Instagram','social','kt_test.1'],['ตำแหน่งงาน','job','วิศวกร'],['บริษัท','company','KuyCorp'],['สถานศึกษา','school','จุฬาฯ']];
const rowLabel={ 'ส่วนสูง (ซม.)':'ส่วนสูง','ชื่อผู้ใช้ Instagram':'Instagram'};
for(const [t,k,v] of TX){ok(await row(rowLabel[t]||t),'row '+t);await sl(400);await pg.type('#kpT',v);exp[k]=k==='height'?+v:v;if(n++%2)await okBtn();else await back()}
ok(await row('หนังที่ชอบ'),'row movies');await sl(400);const mv=await pg.evaluate(()=>{const b=[...document.querySelectorAll('[data-m]')].slice(0,2);const v=b.map(x=>x.dataset.m);b[0].click();return v});await sl(200);await pg.evaluate(m=>document.querySelector(`[data-m="${m}"]`).click(),mv[1]);await sl(200);exp.movies=mv;await back();
await pg.evaluate(()=>[...document.querySelectorAll('#kpPage .kp-addbtn')].find(b=>/ประโยค/.test(b.textContent)).click());await sl(400);const pq=await pg.evaluate(()=>{const b=document.querySelector('[data-q]');const q=b.dataset.q;b.click();return q});await sl(300);await pg.type('#kpPa','ชอบเดินเขา');exp.prompts=[{q:pq,a:'ชอบเดินเขา'}];await back();
await pg.evaluate(()=>document.getElementById('kpBio').scrollIntoView({block:'center'}));await sl(300);await pg.tap('#kpBio');await pg.type('#kpBio','ไบโอทดสอบ');exp.bio='ไบโอทดสอบ';await sl(3000);
await pg.screenshot({path:D+'2-editor-filled.png'});
const errs=pg.T.filter(t=>/❌/.test(t));console.log('saves',pg.T.filter(t=>t==='✅ บันทึกแล้ว').length,'errors',errs);ok(!errs.length,'no save errors');
await boot(pg);const m=await pg.evaluate(()=>KT.api('me'));const d={...m.details,bio:m.bio};
for(const [k,v] of Object.entries(exp))ok(JSON.stringify(d[k])===JSON.stringify(v),`server ${k} = ${JSON.stringify(d[k])}`);
await pg.evaluate(()=>koEdit());await sl(2500);const txt=await pg.evaluate(()=>document.getElementById('kpPage').innerText+' '+document.getElementById('kpBio').value);
const shown=v=>[].concat(v).every(x=>txt.includes(typeof x==='object'?x.a:String(x)));for(const [k,v] of Object.entries(exp))ok(shown(v),'editor shows '+k);
const emptyRows=await pg.evaluate(()=>[...document.querySelectorAll('#kpPage .kp-row')].filter(r=>r.querySelector('i em')).map(r=>r.querySelector('b').textContent));console.log('rows still เพิ่ม:',emptyRows);
await pg.screenshot({path:D+'3-editor-after-reload.png'});for(let y=1;y<5;y++){await pg.evaluate(y=>document.querySelector('#kpPage .kp-body').scrollTop=y*700,y);await sl(300);await pg.screenshot({path:D+`3-editor-after-reload-${y}.png`})}
await pg.evaluate(()=>kpTab('prev'));await sl(1200);const pv=await pg.evaluate(()=>document.getElementById('kpPage').innerText);const miss=Object.entries(exp).filter(([k,v])=>![].concat(v).every(x=>pv.includes(typeof x==='object'?x.a:String(x)))).map(([k])=>k);console.log('preview missing',miss);ok(!miss.length,'preview shows all');await pg.screenshot({path:D+'4-preview.png'});
const id=await pg.evaluate(()=>KT.me().id);const o=await mk('ทดสอบผู้ชม');await boot(o);await o.evaluate(id=>koProfile(id),id);await sl(2500);const ov=await o.evaluate(()=>document.body.innerText);const miss2=Object.entries(exp).filter(([k,v])=>![].concat(v).every(x=>ov.includes(typeof x==='object'?x.a:String(x)))).map(([k])=>k);console.log('other-user view missing',miss2);ok(!miss2.length,'other user sees all');await o.screenshot({path:D+'5-other-user-view.png'});
if(process.env.CLEAN)for(const p of [pg,o])console.log('deleted',await p.evaluate(()=>KT.api('account/delete',{}).then(()=>1,e=>String(e))));
console.log(f?'FAIL '+f:'ALL OK');await br.close()})().catch(e=>{console.error(e);process.exit(1)});
