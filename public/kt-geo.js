// Kuy Talk: GPS + PDPA consent + phone OTP + legal/settings pages
(function(){
const $=id=>document.getElementById(id),K=()=>window.KT,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=t=>window.showToast?showToast(t):alert(t);
const api=async(p,b,m)=>{const T=localStorage.kt_token;const r=await fetch('/api/'+p,{method:m||(b?'POST':'GET'),credentials:'same-origin',headers:{'content-type':'application/json',...(T?{'x-token':T}:{})},body:b&&JSON.stringify(b)});const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||'ผิดพลาด');e.j=j;e.status=r.status;throw e}return j};
const ME=()=>K().me()||{};
function sheet(html){$('koSheet')?.remove();const d=document.createElement('div');d.id='koSheet';d.className='ko-sheet-bg';d.style.zIndex=10050;d.innerHTML=`<div class="ko-sheet ko-full" role="dialog"><button class="ko-x" aria-label="ปิด" onclick="koClose()">✕</button><div class="ko-sheet-in">${html}</div></div>`;d.addEventListener('click',e=>{if(e.target===d)d.remove()});document.body.appendChild(d);requestAnimationFrame(()=>d.classList.add('on'))}
window.koClose=window.koClose||(()=>$('koSheet')?.remove());
const back='<button class="ko-link" onclick="koSettings()">‹ กลับไปตั้งค่า</button>';
const st=document.createElement('style');st.textContent=`.kg-cons{text-align:left;margin:10px 0 4px;font-size:12.5px;line-height:1.5}.kg-cons label{display:flex;gap:8px;align-items:flex-start;margin:6px 0;color:var(--text2,#ccc)}.kg-cons input{margin-top:3px;accent-color:#facc15;width:16px;height:16px;flex:none}.kg-cons a{color:#facc15}.kg-opt{opacity:.85}
.kg-phone{width:100%;margin-top:8px;padding:11px;border-radius:12px;border:1px solid #facc15;background:transparent;color:#facc15;font-weight:700;cursor:pointer}.kg-in{width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1px solid #333;background:#16161a;color:#fff;font-size:16px;margin:6px 0}
 .kg-dev{background:#3a2e05;border:1px dashed #facc15;border-radius:10px;padding:8px 10px;margin:8px 0;font-size:13px}.kg-dev b{font-size:20px;letter-spacing:4px;color:#facc15}.kg-ok{color:#4ade80;font-size:13px;margin:6px 0}.kg-link{display:block;width:100%;margin:10px 0 0;padding:8px;border:0;background:none;color:#facc15;font-weight:700;cursor:pointer;text-align:center}
#kgCookie{position:fixed;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:10040;max-width:560px;margin:0 auto;background:#1b1b20;border:1px solid #3a3a44;border-radius:14px;padding:10px 12px;font-size:12.5px;color:#ddd;display:flex;gap:10px;align-items:center;box-shadow:0 8px 30px #0008}#kgCookie a{color:#facc15}#kgCookie button{flex:none;background:#facc15;color:#111;border:0;border-radius:10px;padding:8px 12px;font-weight:700}
.kg-tbl{width:100%;font-size:12px;border-collapse:collapse}.kg-tbl td{border-bottom:1px solid #2a2a30;padding:5px 4px}.kg-login{background:linear-gradient(135deg,#facc15,#f59e0b)!important;color:#1a1200!important;font-weight:800;margin:8px 0 2px}.kg-signup{background:linear-gradient(135deg,#ef4444,#b91c1c)!important;border-color:#fecaca!important;color:#fff!important;font-weight:800;font-size:16px;padding:13px!important;margin:10px 0 4px;box-shadow:0 4px 14px #b91c1c55}.kg-login{font-size:16px;padding:13px!important}.kg-or{font-size:12px;color:#9ca3af;text-align:center;margin:6px 0 10px}.kg-sel{width:100%;padding:10px;border-radius:10px;background:#16161a;color:#fff;border:1px solid #333;margin:4px 0}`;document.head.appendChild(st);
// ---------- age gate: separate phone login and signup screens ----------
let hasSession=false;
const card=document.querySelector('#ageGate .ag-card');
if(card){const btn=card.querySelector('.ag-btn');const box=document.createElement('div');box.id='kgGate';
 box.innerHTML=`<div class="kg-cons" id="kgCons"><label><input type="checkbox" id="kgAge"> <span>ฉันยืนยันว่ามีอายุ <b>18 ปีบริบูรณ์ขึ้นไป</b></span></label>
 <label><input type="checkbox" id="kgTerms"> <span>ฉันยอมรับ <a href="/legal/terms.html" target="_blank">ข้อกำหนดการใช้งาน</a> และ <a href="/legal/community.html" target="_blank">บรรทัดฐานของชุมชน</a></span></label>
 <label><input type="checkbox" id="kgPriv"> <span>ฉันได้อ่าน <a href="/legal/privacy.html" target="_blank">นโยบายความเป็นส่วนตัว</a> และยินยอมให้ประมวลผลข้อมูลโปรไฟล์ซึ่งอาจบ่งชี้พฤติกรรมทางเพศ (ข้อมูลอ่อนไหว ม.26 PDPA)</span></label>
 <label class="kg-opt"><input type="checkbox" id="kgLoc"> <span>(ไม่บังคับ) ยินยอมให้ใช้ <b>ตำแหน่ง GPS</b> เพื่อแสดงคนใกล้คุณ — เก็บแบบคลาดเคลื่อน ~100–300 ม. และแสดงแค่ระยะทาง</span></label>
 <label class="kg-opt"><input type="checkbox" id="kgMkt"> <span>(ไม่บังคับ) รับข่าวสารและโปรโมชัน</span></label></div>
 <div id="kgPhoneOk"></div><button type="button" class="kg-phone" id="kgPhoneBtn">📱 ยืนยันเบอร์เพื่อสมัคร</button>`;
 const lg=document.createElement('div');lg.id='kgLoginTop';lg.innerHTML='<button type="button" class="kg-phone kg-login" id="kgLoginBtn">🔑 เข้าสู่ระบบด้วยเบอร์โทร</button><button type="button" class="kg-phone kg-signup" id="kgSignupBtn">🍄 สมัครบัญชีใหม่</button>';
 const sub=card.querySelector('.ag-sub');(sub||card.firstChild).after(lg);
 btn.parentNode.insertBefore(box,btn);
 const signupParts=[$('ktDob'),card.querySelector('label'),box,btn,card.querySelector('.ag-note')];
 const setSignup=on=>{signupParts.forEach(x=>{if(x)x.style.display=on?'':'none'});$('kgLoginTop').style.display=on?'none':'';if(on){$('kgSignupBack')?.remove();const b=document.createElement('button');b.id='kgSignupBack';b.type='button';b.className='kg-link';b.textContent='‹ กลับเข้าสู่ระบบ';b.onclick=()=>setSignup(false);lg.after(b)}else $('kgSignupBack')?.remove()};
 setSignup(false);
 $('kgPhoneBtn').onclick=()=>otpSheet(false);$('kgLoginBtn').onclick=()=>otpSheet(false);$('kgSignupBtn').onclick=()=>setSignup(true);
 window.KTShowSignup=setSignup;
 const note=card.querySelector('.ag-note');if(note)note.innerHTML='บริการสำหรับผู้มีอายุ 18 ปีขึ้นไปเท่านั้น · <a href="/legal/privacy.html" target="_blank" style="color:#facc15">ความเป็นส่วนตัว</a> · <a href="/legal/cookies.html" target="_blank" style="color:#facc15">คุกกี้</a>';
 api('me').then(m=>{hasSession=true;ktReturning(m)}).catch(()=>{});
 const prev=window.checkAge;window.checkAge=function(){if(!hasSession){const ok=$('kgAge').checked&&$('kgTerms').checked&&$('kgPriv').checked;if(!ok){$('ageError').textContent='⚠️ กรุณายืนยันอายุ 18+ และยอมรับข้อกำหนดกับนโยบายความเป็นส่วนตัว';return}
  window.KT_CONSENT={age18:true,terms:true,privacy:true,location:$('kgLoc').checked,marketing:$('kgMkt').checked}}
  return prev.apply(this,arguments)}}
// returning user: no DOB; only re-ask legal consent if the legal version changed
function ktReturning(m){const hide=()=>{['ktDob','kgLoginTop','kgPhoneBtn','kgPhoneOk'].forEach(i=>$(i)&&($(i).style.display='none'));const l=document.querySelector('#ageGate .ag-card>label');if(l)l.style.display='none';const b=document.querySelector('#ageGate .ag-btn');if(b)b.style.display='none'};
 if(m.legalOk){hide();$('kgCons').innerHTML=`<p class="kg-ok">✔ ยินดีต้อนรับกลับ ${esc(m.name)} — กำลังเข้าสู่แอป…</p>`;window.ktEnterApp&&window.ktEnterApp();return}
 hide();$('kgCons').innerHTML=`<p class="kg-ok">✔ ยินดีต้อนรับกลับ ${esc(m.name)}</p><p style="font-size:13px;margin:6px 0">ข้อกำหนดหรือนโยบายมีการปรับปรุง กรุณายืนยันอีกครั้ง</p>
 <label><input type="checkbox" id="kgAge"> <span>ฉันยืนยันว่ามีอายุ <b>18 ปีบริบูรณ์ขึ้นไป</b></span></label><label><input type="checkbox" id="kgTerms"> <span>ฉันยอมรับ <a href="/legal/terms.html" target="_blank">ข้อกำหนดการใช้งาน</a></span></label><label><input type="checkbox" id="kgPriv"> <span>ฉันได้อ่าน <a href="/legal/privacy.html" target="_blank">นโยบายความเป็นส่วนตัว</a></span></label>
 <button type="button" class="ag-btn" id="kgReAccept" style="width:100%;margin-top:8px">ยอมรับและเข้าใช้งาน</button>`;
 $('kgReAccept').onclick=async()=>{if(!($('kgAge').checked&&$('kgTerms').checked&&$('kgPriv').checked)){$('ageError').textContent='⚠️ กรุณายืนยันทั้ง 3 ข้อ';return}try{await api('consent/legal',{age18:true,terms:true,privacy:true});window.ktEnterApp()}catch(e){$('ageError').textContent=e.message}}}
// ---------- OTP (Firebase Phone Auth when configured, else server OTP) ----------
let cdT=null,FBS=null,CFG0=null;const FBV='13.1.0',GS='https://www.gstatic.com/firebasejs/'+FBV+'/';
async function fbInit(){if(FBS)return FBS;CFG0=CFG0||await api('config');const c=CFG0.firebase;if(!c)return null;
 const [A,m]=await Promise.all([import(GS+'firebase-app.js'),import(GS+'firebase-auth.js')]);const app=A.initializeApp(c,'kt');
 if(c.appCheckSiteKey){try{const AC=await import(GS+'firebase-app-check.js');AC.initializeAppCheck(app,{provider:new AC.ReCaptchaV3Provider(c.appCheckSiteKey),isTokenAutoRefreshEnabled:true})}catch(e){console.warn('app check',e)}}
 const auth=m.getAuth(app);auth.languageCode='th';if(c.authEmulator)m.connectAuthEmulator(auth,c.authEmulator,{disableWarnings:true});return FBS={m,auth,verifier:null,conf:null}}
const fbErr=e=>({'auth/invalid-phone-number':'เบอร์มือถือไม่ถูกต้อง','auth/too-many-requests':'ขอรหัสถี่เกินไป กรุณาลองใหม่ภายหลัง','auth/invalid-verification-code':'รหัสไม่ถูกต้อง','auth/code-expired':'รหัสหมดอายุ กรุณาขอรหัสใหม่','auth/quota-exceeded':'ระบบส่ง SMS เกินโควตา กรุณาลองใหม่ภายหลัง','auth/operation-not-allowed':'ยังไม่เปิดใช้การเข้าสู่ระบบด้วยเบอร์โทร หรือภูมิภาคนี้ไม่ได้รับอนุญาต','auth/captcha-check-failed':'ตรวจสอบ reCAPTCHA ไม่ผ่าน ลองใหม่อีกครั้ง','auth/network-request-failed':'เครือข่ายขัดข้อง'})[e&&e.code]||(e&&e.message)||'ผิดพลาด';
window.KTFB=()=>FBS;
function otpSheet(link){sheet(`<h3>📱 ${link?'ผูกเบอร์โทรศัพท์':'เข้าสู่ระบบด้วยเบอร์โทร'}</h3><p class="ko-sub">รองรับเบอร์มือถือไทย (+66) เราจะส่งรหัส 6 หลักทาง SMS รหัสหมดอายุใน 5 นาที</p>
 <input class="kg-in" id="kgTel" type="tel" inputmode="tel" autocomplete="tel" placeholder="08x-xxx-xxxx" maxlength="15"><button class="ko-btn" id="kgSend">ส่งรหัส OTP</button>
 <div id="kgStep2" style="display:none"><div id="kgDev"></div><input class="kg-in" id="kgCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="รหัส 6 หลัก"><button class="ko-btn" id="kgVerify">ยืนยันรหัส</button><button class="ko-link" id="kgResend" disabled>ส่งรหัสอีกครั้ง</button></div>
 <p class="ag-error" id="kgErr" style="min-height:16px"></p><div id="kgRc"></div><p class="ko-sub">ห้ามบอกรหัส OTP กับผู้อื่น ทีมงาน Kuy Talk จะไม่ขอรหัสจากคุณ</p>${link?back:''}`);
 const tel=()=>$('kgTel').value.replace(/[\s-]/g,''),er=t=>{$('kgErr').textContent=t||''};
 const send=async()=>{er();if(!/^(?:\+?66|0)[689]\d{8}$/.test(tel()))return er('เบอร์มือถือไทยไม่ถูกต้อง (เช่น 0812345678)');
  const fb=await fbInit().catch(e=>{console.warn('firebase unavailable, using server OTP',e&&e.code||e);return null});
  if(fb){try{if(!fb.verifier)fb.verifier=new fb.m.RecaptchaVerifier(fb.auth,'kgRc',{size:'invisible'});const d=tel().replace(/^(?:\+?66|0)/,'');
    fb.conf=await fb.m.signInWithPhoneNumber(fb.auth,'+66'+d,fb.verifier);$('kgStep2').style.display='block';$('kgDev').innerHTML=`<p class="kg-ok">ส่งรหัสไปที่ +66 ${d[0]}x-xxx-${esc(d.slice(-4))} แล้ว</p>`;$('kgCode').focus();cool(60)}
   catch(e){er(fbErr(e));try{fb.verifier&&fb.verifier.clear()}catch(x){}fb.verifier=null}return}
  try{const r=await api('otp/request',{phone:tel()});$('kgStep2').style.display='block';$('kgDev').innerHTML=r.devCode?`<div class="kg-dev">🧪 <b>โหมดทดสอบ</b> — ${esc(r.devNote||'')}<br>รหัสของคุณ: <b>${esc(r.devCode)}</b></div>`:`<p class="kg-ok">ส่งรหัสไปที่ ${esc(r.phone)} แล้ว</p>`;$('kgCode').focus();
   cool(r.cooldown||60)}catch(e){er(e.message)}};
 const cool=n=>{let s=n;const b=$('kgResend');b.disabled=true;clearInterval(cdT);const tick=()=>{if(!$('kgResend'))return clearInterval(cdT);b.textContent=s>0?`ส่งรหัสอีกครั้งใน ${s} วิ`:'ส่งรหัสอีกครั้ง';b.disabled=s>0;s--;if(s<-1)clearInterval(cdT)};tick();cdT=setInterval(tick,1000)};
 $('kgSend').onclick=send;$('kgResend').onclick=send;
 $('kgVerify').onclick=async()=>{er();try{const code=$('kgCode').value.trim();let r;const fb=FBS;
  if(fb&&fb.conf){if(!/^\d{6}$/.test(code))return er('กรุณากรอกรหัส 6 หลัก');let cred;try{cred=await fb.conf.confirm(code)}catch(e){return er(fbErr(e))}
   const idToken=await cred.user.getIdToken();try{r=await api('firebase/verify',{idToken,link:!!link})}finally{fb.m.signOut(fb.auth).catch(()=>{})}}
  else r=await api('otp/verify',{phone:tel(),code,link:!!link});
  if(link){K().setMe(r.me||r);toast('✔ ผูกเบอร์แล้ว');return koPhone()}
  if(r.token){K().setToken?K().setToken(r.token):localStorage.setItem('kt_token',r.token);hasSession=true;koClose();api('me').then(ktReturning).catch(e=>er(e.message))}
  else if(r.phoneTicket){window.KT_PTICKET=r.phoneTicket;koClose();window.KTShowSignup&&window.KTShowSignup(true);$('kgPhoneOk').innerHTML='<p class="kg-ok">✔ ไม่พบบัญชีเดิมที่ผูกกับเบอร์นี้ — ยืนยันเบอร์แล้ว กรุณากรอกข้อมูลเพื่อสมัครบัญชีใหม่</p>';$('kgPhoneBtn').style.display='none'}}catch(e){er(e.message)}}}
window.koPhone=()=>{const m=ME();sheet(`<h3>📱 เบอร์โทรศัพท์</h3>${m.phone?`<p>เบอร์ที่ผูกไว้: <b>${esc(m.phone)}</b></p><p class="ko-sub">ใช้เข้าสู่ระบบด้วย OTP บนอุปกรณ์อื่นได้</p><button class="ko-btn" onclick="koOtpLink()">เปลี่ยนเบอร์</button><button class="ko-link ko-danger" onclick="koUnlink()">ยกเลิกการผูกเบอร์</button>`:`<p class="ko-sub">ผูกเบอร์โทรเพื่อกู้คืนบัญชีและเข้าสู่ระบบบนอุปกรณ์อื่นได้</p><button class="ko-btn" onclick="koOtpLink()">ผูกเบอร์โทรศัพท์</button>`}${back}`)};
window.koOtpLink=()=>otpSheet(true);
window.koUnlink=async()=>{if(!confirm('ยกเลิกการผูกเบอร์?'))return;try{K().setMe(await api('phone/unlink',{}));koPhone()}catch(e){toast(e.message)}};
// ---------- location ----------
let watchT=null;
function locExplain(){sheet(`<h3>📍 ใช้ตำแหน่งเพื่อหาคนใกล้คุณ</h3><p>Kuy Talk จะขอสิทธิ์ตำแหน่งจากเบราว์เซอร์เพื่อ:</p><ul style="font-size:14px;line-height:1.7"><li>แสดงคนที่อยู่ใกล้และเรียงตามระยะทาง</li><li>กรองระยะ 1 / 5 / 10 / 25 / 50 / 100 km หรือทั้งประเทศ</li></ul>
 <p class="ko-sub">🔒 เราปัดพิกัดให้คลาดเคลื่อนประมาณ 100–300 เมตรก่อนบันทึก และ <b>ไม่แสดงพิกัดให้ใครเห็น</b> คนอื่นจะเห็นแค่ “1.2 km” หรือ “ในอำเภอ…” · ปิดหรือซ่อนระยะทางได้ทุกเมื่อในตั้งค่า · ถ้าไม่อนุญาต เราจะใช้จังหวัดของคุณแทน (<a href="/legal/privacy.html" target="_blank" style="color:#facc15">นโยบายความเป็นส่วนตัว</a>)</p>
 <button class="ko-btn" id="kgLocYes">อนุญาตตำแหน่ง</button><button class="ko-link" onclick="koLocNo()">ไม่ตอนนี้ (ใช้จังหวัด)</button>`);$('kgLocYes').onclick=()=>locGrant()}
window.koLocNo=()=>{localStorage.kt_loc_ask=Date.now();if(!ME().province)return provPick(false);koClose();toast('ใช้จังหวัดของคุณแสดงคนใกล้เคียง')};
function provPick(denied){const P=((K().cfg&&K().cfg())||{}).provinces||[];sheet(`<h3>🏙️ เลือกจังหวัดของคุณ</h3><p class="ko-sub">${denied?'ไม่ได้รับอนุญาตตำแหน่ง — ':''}เราจะแสดงคนในจังหวัดเดียวกันและใกล้เคียงแทน GPS (เปลี่ยนได้ในข้อมูลส่วนตัว)</p><select class="kg-sel" id="kgProv">${P.map(p=>`<option value="${esc(p.id)}">${esc(p.th||p.name||p.id)}</option>`).join('')}</select><button class="ko-btn" id="kgProvGo">บันทึก</button>`);
 $('kgProvGo').onclick=async()=>{try{K().setMe(await api('profile',{province:$('kgProv').value}));koClose();toast('📍 ใช้จังหวัดแสดงคนใกล้เคียงแล้ว');K().loadPeople().catch(()=>{})}catch(e){toast(e.message)}}}
window.koProvPick=provPick;
async function locGrant(){try{if(!(ME().consent||{}).location)K().setMe(await api('consent',{type:'location',granted:true}));koClose();await locUpdate(true)}catch(e){toast(e.message)}}
function locUpdate(verbose){return new Promise(res=>{if(!navigator.geolocation){verbose&&toast('อุปกรณ์นี้ไม่รองรับ GPS — ใช้จังหวัดแทน');return res()}
 navigator.geolocation.getCurrentPosition(async p=>{try{const r=await api('location',{lat:p.coords.latitude,lng:p.coords.longitude});K().setMe(r);if(verbose)toast(r.outsideTH?'📍 ตำแหน่งอยู่นอกประเทศไทย — ใช้จังหวัดแทน':'📍 อัปเดตตำแหน่งแล้ว: '+(r.geo&&r.geo.district?'อ.'+r.geo.district+' ':'')+(r.geo&&r.geo.provinceName||''));K().loadPeople&&K().loadPeople().catch(()=>{});dispatchEvent(new Event('kt:geo'))}catch(e){verbose&&toast(e.message)}res()},
  e=>{localStorage.kt_loc_ask=Date.now();if(!ME().province)provPick(e.code===1);else if(verbose)toast(e.code===1?'ไม่ได้รับอนุญาตตำแหน่ง — ใช้จังหวัดของคุณแทน (เปิดได้ในตั้งค่าเบราว์เซอร์)':'หาตำแหน่งไม่ได้ — ใช้จังหวัดแทน');res()},{enableHighAccuracy:false,timeout:15000,maximumAge:600000})})}
addEventListener('kt:loaded',()=>{const m=ME();if(!m.id)return;if(m.consent&&m.consent.location&&!(m.geo&&m.geo.paused))locUpdate(false);
 else if(!m.geo&&!(Date.now()-(+localStorage.kt_loc_ask||0)<3*864e5))setTimeout(locExplain,1500);
 clearInterval(watchT);watchT=setInterval(()=>{const x=ME();if(x.consent&&x.consent.location&&!(x.geo&&x.geo.paused)&&!document.hidden)locUpdate(false)},15*60000)});
window.koLocation=()=>{const m=ME(),g=m.geo,p=m.prefs||{},c=(m.consent||{}).location;sheet(`<h3>📍 ตำแหน่งและระยะทาง</h3>
 <p>${g&&!g.paused?`ตำแหน่งปัจจุบัน (โดยประมาณ): <b>${g.district?(g.province==='bangkok'?'เขต':'อ.')+esc(g.district)+' ':''}${esc(g.provinceName||'')}</b><br><span class="ko-sub">อัปเดต ${new Date(g.ts).toLocaleString('th-TH')}</span>`:g&&g.paused?'⏸️ หยุดใช้ตำแหน่งชั่วคราว — ใช้จังหวัดแทน':'ยังไม่ได้เปิด GPS — ใช้จังหวัดที่คุณเลือก'}</p>
 <div class="ko-grp"><label class="ko-li ko-tg"><span>🛰️</span><b>ยินยอมให้ใช้ตำแหน่ง GPS</b><input type="checkbox" ${c?'checked':''} onchange="koLocConsent(this.checked)"></label>
 ${g?`<label class="ko-li ko-tg"><span>⏸️</span><b>หยุดใช้ตำแหน่งชั่วคราว</b><input type="checkbox" ${g.paused?'checked':''} onchange="koLocPause(this.checked)"></label>`:''}
 <label class="ko-li ko-tg"><span>🙈</span><b>ซ่อนระยะทางของฉันจากคนอื่น</b><input type="checkbox" ${p.hideDist?'checked':''} onchange="koPref('hideDist',this.checked)"></label>
 ${c?'<button class="ko-li" onclick="koLocNow()"><span>🔄</span><b>อัปเดตตำแหน่งตอนนี้</b><i>›</i></button>':''}${g?'<button class="ko-li ko-danger" onclick="koLocDel()"><span>🗑️</span><b>ลบตำแหน่งที่บันทึกไว้</b><i>›</i></button>':''}</div>
 <p class="ko-sub">พิกัดถูกปัดให้คลาดเคลื่อน ~100–300 ม. ไม่มีใครเห็นพิกัดของคุณ</p>${back}`)};
window.koLocConsent=async v=>{try{K().setMe(await api('consent',{type:'location',granted:v}));if(v)await locUpdate(true);else toast('ถอนความยินยอมและลบตำแหน่งแล้ว');koLocation();K().loadPeople().catch(()=>{})}catch(e){toast(e.message)}};
window.koLocPause=async v=>{try{K().setMe(await api('location/pause',{paused:v}));toast(v?'หยุดใช้ตำแหน่งแล้ว':'กลับมาใช้ตำแหน่งแล้ว');if(!v)await locUpdate(false);koLocation()}catch(e){toast(e.message)}};
window.koLocNow=async()=>{await locUpdate(true);koLocation()};
window.koLocDel=async()=>{try{K().setMe(await api('location',null,'DELETE'));toast('ลบตำแหน่งแล้ว');koLocation()}catch(e){toast(e.message)}};
// ---------- legal ----------
const DOCS=[['terms','📄','ข้อกำหนดการใช้งาน'],['privacy','🔒','นโยบายความเป็นส่วนตัว (PDPA)'],['cookies','🍪','นโยบายคุกกี้'],['community','📜','บรรทัดฐานของชุมชน'],['payments','💳','การชำระเงินและการคืนเงิน'],['safety','🛡️','ความปลอดภัยในการนัดเจอ'],['deletion','🗑️','การลบบัญชีและคำขอข้อมูล']];
window.koLegal=async k=>{const map={guide:'community',cookie:'cookies'};k=map[k]||k;try{const h=await (await fetch('/legal/'+k+'.html')).text();const doc=new DOMParser().parseFromString(h,'text/html').getElementById('legalDoc');doc.querySelectorAll('.crumb,.lnav,hr').forEach(x=>x.remove());
 sheet(`<link rel="stylesheet" href="/legal/legal.css"><div class="legal" style="padding:0">${doc.innerHTML}</div><a class="ko-link" href="/legal/${k}.html" target="_blank">เปิดในหน้าใหม่ ↗</a><br>${back}`);$('koSheet').querySelector('.ko-sheet').style.background='#0e0e10'}catch(e){toast('โหลดเอกสารไม่สำเร็จ')}};
window.koLegalList=()=>sheet(`<h3>⚖️ เอกสารทางกฎหมาย</h3><div class="ko-grp">${DOCS.map(([k,i,t])=>`<button class="ko-li" onclick="koLegal('${k}')"><span>${i}</span><b>${t}</b><i>›</i></button>`).join('')}</div><p class="ko-sub">ฉบับร่าง — ควรให้ทนายความไทยตรวจทานก่อนเปิดให้บริการจริง</p>${back}`);
// ---------- FAQ ----------
const FAQ=[['ทำไมต้องอายุ 18+?','Kuy Talk เป็นบริการหาคู่สำหรับผู้ใหญ่ เราปิดบัญชีที่พบว่าอายุต่ำกว่า 18 ปีทันที'],['ระยะทางที่เห็นแม่นแค่ไหน?','เราปัดพิกัดให้คลาดเคลื่อน ~100–300 ม. จึงแสดงเป็นค่าประมาณ เช่น “1.2 km” หรือ “ในอำเภอ…” ไม่มีใครเห็นพิกัดจริงของคุณ'],['ปิดการแชร์ตำแหน่งยังไง?','ตั้งค่า › ตำแหน่งและระยะทาง: ถอนความยินยอม หยุดชั่วคราว หรือซ่อนระยะทาง'],['ไม่ได้รับ SMS OTP?','ตรวจเบอร์ให้ถูก รอ 60 วินาทีแล้วกดส่งใหม่ ขอได้ไม่เกิน 5 ครั้ง/ชั่วโมง'],['แมตช์คืออะไร?','เมื่อทั้งสองฝ่ายกดถูกใจกัน จะแชทกันได้'],['Crush / Turbo คืออะไร?','Crush 💎 คือไลก์พิเศษที่แจ้งอีกฝ่ายทันที Turbo ⚡ ดันโปรไฟล์ขึ้นก่อน 30 นาที'],['จ่ายเงินจริงไหม?','เวอร์ชันต้นแบบนี้เป็นระบบจำลองทั้งหมด ไม่มีการตัดเงินจริง'],['ยกเลิก Premium / ขอคืนเงิน?','ดูนโยบายการชำระเงิน หรือส่งเรื่องที่ฝ่ายบริการลูกค้า หัวข้อ “การชำระเงิน/คืนเงิน”'],['เจอคนหลอกให้โอนเงิน?','อย่าโอน กดรายงาน + บล็อก แจ้งธนาคารและตำรวจไซเบอร์ 1441'],['ดาวน์โหลดหรือลบข้อมูลของฉัน?','ตั้งค่า › การตั้งค่าความเป็นส่วนตัว › ดาวน์โหลดข้อมูล / ตั้งค่าบัญชี › ลบบัญชีถาวร']];
window.koFaq=()=>sheet(`<h3>❓ คำถามที่พบบ่อย</h3>${FAQ.map(([q,a])=>`<details style="border-bottom:1px solid #2a2a30;padding:8px 0"><summary style="cursor:pointer;font-weight:700">${q}</summary><p style="margin:6px 0 0;font-size:14px">${a}</p></details>`).join('')}<button class="ko-btn" onclick="koSupport()" style="margin-top:12px">ยังไม่ได้คำตอบ? ติดต่อฝ่ายบริการลูกค้า</button>${back}`);
window.koHelp=window.koFaq;
// ---------- support ----------
const TOP={account:'บัญชี/เข้าสู่ระบบ',payment:'การชำระเงิน/คืนเงิน',safety:'ความปลอดภัย/รายงานผู้ใช้',bug:'แจ้งปัญหาการใช้งาน',privacy:'ข้อมูลส่วนบุคคล (PDPA)',other:'อื่น ๆ'};
const STS={open:'รอดำเนินการ',pending:'รอดำเนินการ',progress:'กำลังดำเนินการ',done:'เสร็จสิ้น',resolved:'เสร็จสิ้น',rejected:'ปฏิเสธ'};
window.koSupport=async()=>{sheet(`<h3>🎧 ฝ่ายบริการลูกค้า</h3><p class="ko-sub">ทีมงานตอบกลับในแชท “Kuy Talk Team” ภายใน 1–2 วันทำการ</p>
 <select class="kg-sel" id="kgTop">${Object.entries(TOP).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><input class="kg-in" id="kgMail" type="email" placeholder="อีเมลติดต่อกลับ (ไม่บังคับ)"><textarea class="kg-in" id="kgMsg" rows="4" maxlength="2000" placeholder="อธิบายปัญหาของคุณ"></textarea><button class="ko-btn" id="kgSupGo">ส่งเรื่อง</button>
 <h4 style="margin:16px 0 4px">เรื่องที่ส่งแล้ว</h4><div id="kgMyT" class="ko-sub">กำลังโหลด…</div><button class="ko-link" onclick="koTeam()">💬 เปิดแชททีมงาน</button>${back}`);
 const load=async()=>{try{const L=await api('support');$('kgMyT').innerHTML=L.length?`<table class="kg-tbl">${L.map(t=>`<tr><td>${new Date(t.ts).toLocaleDateString('th-TH')}</td><td>${esc(t.topicLabel)}<br><span class="ko-sub">${esc(t.message.slice(0,60))}</span>${t.reply?`<br>↳ ${esc(t.reply)}`:''}</td><td>${STS[t.status]||esc(t.status)}</td></tr>`).join('')}</table>`:'ยังไม่มี'}catch(e){}};load();
 $('kgSupGo').onclick=async()=>{try{await api('support',{topic:$('kgTop').value,email:$('kgMail').value.trim(),message:$('kgMsg').value.trim()});$('kgMsg').value='';toast('✅ ส่งเรื่องแล้ว ทีมงานจะติดต่อกลับ');load()}catch(e){toast(e.message)}}};
// ---------- language (uses index.html i18n) ----------
const LANGS=[['th','🇹🇭','ไทย'],['en','🇬🇧','English']];
window.koLang=()=>{const cur=window.currentLang||'th';sheet(`<h3>🌐 ภาษา</h3><div class="ko-grp">${LANGS.map(([c,f,n])=>`<button class="ko-li" onclick="koSetLang('${c}')"><span>${f}</span><b>${n}</b><i>${cur===c?'✔':''}</i></button>`).join('')}</div><p class="ko-sub">English: แปลเมนูหลักแล้ว เนื้อหาบางส่วนยังเป็นภาษาไทย</p>${back}`)};
window.koSetLang=c=>{try{if(typeof selectLanguage==='function'){currentLang=c;applyTranslations()}}catch(e){}localStorage.kt_lang=c;document.documentElement.lang=c;toast(c==='th'?'เปลี่ยนเป็นภาษาไทยแล้ว':'Language: English');koLang()};
try{if(localStorage.kt_lang&&localStorage.kt_lang!=='th'&&typeof applyTranslations==='function'){currentLang=localStorage.kt_lang;applyTranslations()}}catch(e){}
// ---------- privacy settings ----------
const RQ={access:'ขอเข้าถึง/สำเนาข้อมูล (ม.30)',portability:'ขอโอนย้ายข้อมูล (ม.31)',correct:'ขอแก้ไขข้อมูล (ม.35)',delete:'ขอลบข้อมูล (ม.33)',restrict:'ขอระงับการใช้ข้อมูล (ม.34)',object:'คัดค้านการประมวลผล (ม.32)',withdraw:'ถอนความยินยอม (ม.19)',complaint:'ร้องเรียนเรื่องข้อมูลส่วนบุคคล'};
const CT={terms:'ข้อกำหนดการใช้งาน',privacy:'นโยบายความเป็นส่วนตัว',age18:'ยืนยันอายุ 18+',location:'ตำแหน่ง GPS',marketing:'ข่าวสารการตลาด'};
window.koPrivacy=async()=>{const p=ME().prefs||{},c=ME().consent||{};const tg=(k,t,ic,def=true)=>`<label class="ko-li ko-tg"><span>${ic}</span><b>${t}</b><input type="checkbox" ${(p[k]??def)?'checked':''} onchange="koPref('${k}',this.checked)"></label>`;
 sheet(`<h3>🛡️ การตั้งค่าความเป็นส่วนตัว</h3><div class="ko-grp">${tg('showOnline','แสดงสถานะออนไลน์','🟢')}${tg('readReceipts','แสดงว่าอ่านแล้ว','✔')}${tg('hideDist','ซ่อนระยะทางของฉัน','🙈',false)}${tg('showPremium','แสดงไอคอน Premium','👑')}
 <button class="ko-li" onclick="koLocation()"><span>📍</span><b>ตำแหน่งและระยะทาง</b><i>›</i></button><button class="ko-li" onclick="switchPage('settings',document.getElementById('nav-settings'));koClose()"><span>🚫</span><b>รายชื่อที่บล็อก</b><i>›</i></button></div>
 <h4 style="margin:14px 0 4px">ความยินยอม (PDPA)</h4><div class="ko-grp"><label class="ko-li ko-tg"><span>🛰️</span><b>ใช้ตำแหน่ง GPS</b><input type="checkbox" ${c.location?'checked':''} onchange="koLocConsent(this.checked)"></label><label class="ko-li ko-tg"><span>📣</span><b>รับข่าวสารการตลาด</b><input type="checkbox" ${c.marketing?'checked':''} onchange="koMkt(this.checked)"></label></div>
 <details><summary class="ko-sub" style="cursor:pointer">ประวัติความยินยอม</summary><div id="kgCLog" class="ko-sub">…</div></details>
 <h4 style="margin:14px 0 4px">สิทธิของเจ้าของข้อมูล</h4><div class="ko-grp"><button class="ko-li" onclick="koExport()"><span>⬇️</span><b>ดาวน์โหลดข้อมูลของฉัน (JSON)</b><i>›</i></button><button class="ko-li" onclick="koDataReq()"><span>📨</span><b>ส่งคำขอเกี่ยวกับข้อมูล</b><i>›</i></button><button class="ko-li" onclick="koLegal('privacy')"><span>🔒</span><b>นโยบายความเป็นส่วนตัว</b><i>›</i></button></div>${back}`);
 try{const r=await api('consent');$('kgCLog').innerHTML=`<table class="kg-tbl">${r.log.slice().reverse().map(x=>`<tr><td>${new Date(x.ts).toLocaleString('th-TH')}</td><td>${CT[x.type]||esc(x.type)}</td><td>${x.granted?'✔ ยินยอม':'✕ ไม่ยินยอม/ถอน'}</td><td>v${esc(x.ver)}</td></tr>`).join('')}</table>`}catch(e){}};
window.koMkt=async v=>{try{K().setMe(await api('consent',{type:'marketing',granted:v}));toast('บันทึกแล้ว')}catch(e){toast(e.message)}};
window.koExport=async()=>{try{const T=localStorage.kt_token;const r=await fetch('/api/data/export',{credentials:'same-origin',headers:T?{'x-token':T}:{}});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'ผิดพลาด');const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='kuytalk-my-data.json';document.body.appendChild(a);a.click();a.remove();toast('⬇️ ดาวน์โหลดข้อมูลแล้ว')}catch(e){toast(e.message)}};
window.koDataReq=async()=>{sheet(`<h3>📨 คำขอเกี่ยวกับข้อมูลส่วนบุคคล</h3><p class="ko-sub">เราจะดำเนินการภายใน 30 วันตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 และแจ้งผลในแชททีมงาน</p><select class="kg-sel" id="kgRq">${Object.entries(RQ).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><textarea class="kg-in" id="kgRqD" rows="3" maxlength="1000" placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"></textarea><button class="ko-btn" id="kgRqGo">ส่งคำขอ</button><h4 style="margin:14px 0 4px">คำขอของฉัน</h4><div id="kgRqL" class="ko-sub">…</div><button class="ko-link" onclick="koPrivacy()">‹ กลับ</button>`);
 const load=async()=>{try{const L=await api('data/requests');$('kgRqL').innerHTML=L.length?`<table class="kg-tbl">${L.map(r=>`<tr><td>${new Date(r.ts).toLocaleDateString('th-TH')}</td><td>${esc(r.label)}</td><td>${STS[r.status]||esc(r.status)}<br><span class="ko-sub">ครบกำหนด ${new Date(r.due).toLocaleDateString('th-TH')}</span></td></tr>`).join('')}</table>`:'ยังไม่มี'}catch(e){}};load();
 $('kgRqGo').onclick=async()=>{try{await api('data/request',{type:$('kgRq').value,detail:$('kgRqD').value});toast('✅ ส่งคำขอแล้ว');load()}catch(e){toast(e.message)}}};
// ---------- account ----------
window.koAccount=()=>{const m=ME();sheet(`<h3>⚙️ การตั้งค่าบัญชี</h3><div class="ko-grp"><button class="ko-li" onclick="koEdit()"><span>👤</span><b>แก้ไขข้อมูลส่วนตัว</b><i>›</i></button><button class="ko-li" onclick="koPhone()"><span>📱</span><b>เบอร์โทรศัพท์</b><i>${esc(m.phone||'ยังไม่ผูก')}</i></button><button class="ko-li" onclick="koLocation()"><span>📍</span><b>ตำแหน่งและระยะทาง</b><i>›</i></button><button class="ko-li" onclick="koLogoutAll()"><span>🔐</span><b>ออกจากระบบทุกอุปกรณ์</b><i>›</i></button></div>
 <div class="ko-grp"><button class="ko-li ko-danger" onclick="koDelete()"><span>🗑️</span><b>ลบบัญชีถาวร</b><i>›</i></button></div><p class="ko-sub">การลบบัญชีจะลบโปรไฟล์ แชท ตำแหน่ง และออกจากระบบทุกอุปกรณ์ทันที ข้อมูลจราจรทางคอมพิวเตอร์เก็บต่อ 90 วันตามกฎหมาย (<a href="/legal/deletion.html" target="_blank" style="color:#facc15">รายละเอียด</a>)</p>${back}`)};
window.koLogoutAll=async()=>{if(!confirm('ออกจากระบบทุกอุปกรณ์?'))return;try{await api('logout-all',{})}catch(e){}localStorage.removeItem('kt_token');location.href='/'};
window.koLogout=async()=>{try{await api('logout',{})}catch(e){}localStorage.removeItem('kt_token');location.href='/'};
window.koDelete=async()=>{if(!confirm('ลบบัญชีและข้อมูลทั้งหมดถาวร? ไม่สามารถกู้คืนได้'))return;try{await api('account/delete',{});localStorage.removeItem('kt_token');location.href='/'}catch(e){toast(e.message)}};
// ---------- settings menu ----------
const _set=window.koSettings;
window.koSettings=function(){_set();const s=$('koSheet');if(!s)return;const m=ME();const grps=s.querySelectorAll('.ko-grp');
 const it=(ic,t,fn,r='›')=>`<button class="ko-li" onclick="${fn}"><span>${ic}</span><b>${t}</b><i>${r}</i></button>`;
 s.querySelectorAll('.ko-li').forEach(b=>{const t=b.querySelector('b')&&b.querySelector('b').textContent;if(t==='SMS'){b.setAttribute('onclick','koPhone()');b.querySelector('b').textContent='เบอร์โทรศัพท์ (OTP)';b.querySelector('i').textContent=m.phone||'ผูกเบอร์'}
  if(t==='ติดต่อทีมงาน'){b.setAttribute('onclick','koSupport()');b.querySelector('b').textContent='ฝ่ายบริการลูกค้า'}if(t==='ศูนย์ช่วยเหลือ'){b.setAttribute('onclick','koFaq()');b.querySelector('b').textContent='คำถามที่พบบ่อย (FAQ)'}
  if(t==='ภาษา')b.querySelector('i').textContent=(window.currentLang||'th')==='en'?'English':'ไทย';if(t==='แนวทางชุมชน')b.querySelector('b').textContent='บรรทัดฐานของชุมชน'});
 if(grps[1])grps[1].insertAdjacentHTML('beforeend',it('📍','ตำแหน่งและระยะทาง','koLocation()',m.geo&&!m.geo.paused?'GPS':'จังหวัด'));
 if(grps[2])grps[2].insertAdjacentHTML('beforeend',it('💳','การชำระเงินและการคืนเงิน',"koLegal('payments')")+it('🛡️','ความปลอดภัยในการนัดเจอ',"koLegal('safety')")+it('⚖️','เอกสารทางกฎหมายทั้งหมด','koLegalList()'))};
// ---------- cookie notice ----------
if(!localStorage.kt_cookie){const c=document.createElement('div');c.id='kgCookie';c.innerHTML='<span>🍪 เราใช้คุกกี้ที่จำเป็นเพื่อให้คุณเข้าสู่ระบบได้อย่างปลอดภัย ไม่มีคุกกี้โฆษณา · <a href="/legal/cookies.html" target="_blank">นโยบายคุกกี้</a></span><button id="kgCookieOk">รับทราบ</button>';document.body.appendChild(c);$('kgCookieOk').onclick=()=>{localStorage.kt_cookie='1';c.remove()}}
// ---------- nearby distance steps ----------
st.textContent+=`.kg-steps{display:flex;gap:6px;overflow-x:auto;margin:0 0 12px;scrollbar-width:none}.kg-steps button{flex:none;padding:6px 12px;border-radius:999px;border:1px solid #3a3a44;background:#16161a;color:#ddd;font-size:12.5px;cursor:pointer}.kg-steps button.on{background:#facc15;color:#111;border-color:#facc15;font-weight:700}`;
const STEPS=[[1,'1 km'],[5,'5 km'],[10,'10 km'],[25,'25 km'],[50,'50 km'],[100,'100 km'],[0,'ทั้งประเทศ']];
function drawSteps(){const b=$('kgSteps');if(!b)return;const k=window.KT_KM||0;b.innerHTML=STEPS.map(([v,t])=>`<button class="${v===k?'on':''}" onclick="koKm(${v})">${t}</button>`).join('')}
window.koKm=v=>{window.KT_KM=v||0;drawSteps();K().loadPeople().catch(e=>toast(String(e)))};
addEventListener('kt:people',e=>{const L=e.detail||[],m=ME(),k=window.KT_KM;const src=m.geo&&!m.geo.paused?'📍 GPS':m.province?'🏙️ จังหวัด':'';
 document.querySelectorAll('.kg-cnt').forEach(x=>x.innerHTML=`พบ <b style="color:var(--red)">${L.length}</b> คน${k?` ในรัศมี ${k} km`:' ทั่วประเทศ'} ${src?'· '+src:''}${!m.geo&&!k?' · <a href="#" onclick="koLocation();return false" style="color:#facc15">เปิด GPS</a>':''}`);drawSteps()});
drawSteps();
window.KTGEO={locUpdate,locExplain,otpSheet};
})();
