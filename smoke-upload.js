const P=require('puppeteer-core');const B=process.env.BASE||'http://localhost:3000';const D='/workspace/fix-shots6/'+(process.env.TAG||'local')+'-';const sl=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const br=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});let f=0;const ok=(c,n)=>{if(!c)f++;console.log((c?'✅ ':'❌ ')+n)};
const pg=await br.newPage();pg.on('pageerror',e=>console.log('ERR',e.message));pg.on('response',r=>{if(/api\/(photos|profile)/.test(r.url()))console.log('  ',r.request().method(),r.url().replace(B,''),r.status())});
await pg.emulate({viewport:{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'});
const toasts=[];await pg.exposeFunction('_t',t=>toasts.push(t));
const clean=()=>pg.evaluate(()=>{document.getElementById('kgCookieOk')?.click();const s=document.getElementById('koSheet');if(s)s.remove()});
await pg.goto(B+'/',{waitUntil:'networkidle2',timeout:90000});
await pg.evaluate(async()=>{const j=await (await fetch('/api/signup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'ทดสอบรูป',gender:'f',dob:'1996-02-02',province:'bangkok',consent:{terms:true,privacy:true,age18:true}})})).json();if(j.token)localStorage.kt_token=j.token});
await pg.reload({waitUntil:'networkidle2'});await pg.waitForFunction(()=>window.KT&&KT.me());await pg.evaluate(()=>{const o=window.showToast;window.showToast=function(t){_t(String(t));return o&&o.apply(this,arguments)}});await sl(3500);await clean();
await pg.evaluate(()=>koEdit());await sl(1500);
for(const file of ['/tmp/big.jpg','/tmp/big.png']){const [fc]=await Promise.all([pg.waitForFileChooser(),pg.evaluate(()=>document.querySelector('.kp-add').click())]);await fc.accept([file]);await sl(9000);await clean()}
await pg.screenshot({path:D+'1-editor-after-upload.png'});
const n=await pg.evaluate(()=>document.querySelectorAll('.kp-slot:not(.kp-add)').length);ok(n===2,'2 photos in grid ('+n+')');
await pg.evaluate(()=>kpSave());await sl(1500);await pg.screenshot({path:D+'2-saved.png'});console.log('toasts',toasts);
await sl(2500);await pg.reload({waitUntil:'networkidle2'});await pg.waitForFunction(()=>window.KT&&KT.me());await sl(3500);await clean();
const m=await pg.evaluate(()=>KT.api('me'));ok(m.photos.length===2&&m.avatar===m.photos[0],'persist after reload, avatar = photo1');
const st=await pg.evaluate(async u=>(await fetch(u)).status,m.photos[0]);ok(st===200,'photo URL serves');
await pg.tap('#nav-profile');await sl(1500);await clean();await pg.screenshot({path:D+'3-me-after-reload.png'});await pg.evaluate(()=>koEdit());await sl(1500);await pg.screenshot({path:D+'4-editor-after-reload.png'});
if(process.env.CLEAN)await pg.evaluate(()=>KT.api('account/delete',{}));console.log(f?f+' FAILED':'ALL OK');await br.close();process.exit(f?1:0)})().catch(e=>{console.error(e);process.exit(1)});
