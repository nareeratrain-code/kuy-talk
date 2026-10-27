// Kuy Talk – swipe deck, likes hub, visitors, profile/inventory, settings (Omi-style systems, our own design)
(function(){
const $=id=>document.getElementById(id),K=()=>window.KT,A=(...a)=>K().api(...a);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>window.showToast?showToast(m):alert(m);
const isImg=a=>/^data:image\/|^\/|^https?:/.test(a||'');
const GR=['linear-gradient(135deg,#f59e0b,#ef4444)','linear-gradient(135deg,#8b5cf6,#ec4899)','linear-gradient(135deg,#06b6d4,#3b82f6)','linear-gradient(135deg,#10b981,#14b8a6)','linear-gradient(135deg,#f97316,#eab308)','linear-gradient(135deg,#6366f1,#a855f7)'];
const gr=id=>GR[parseInt(String(id||'0').slice(0,4),16)%GR.length||0];
const pics=u=>{const p=(u.photos||[]).slice();if(!p.length&&isImg(u.avatar))p.push(u.avatar);return p};
const avEl=(u,cls='')=>isImg(u.avatar)?`<div class="ko-av ${cls}" style="background-image:url('${esc(TH(u.avatar,200))}')"></div>`:`<div class="ko-av ko-av-e ${cls}" style="background:${gr(u.id)}">${esc(u.avatar||'🙂')}</div>`;
const vb=u=>u.official?'<span class="kt-vb kt-off" title="บัญชีทางการ">✔</span>':u.verified?'<span class="kt-vb" title="ยืนยันตัวตนแล้ว">✔</span>':'';
const crown=u=>u.premium?'<span title="Premium">👑</span>':'';
const chips=u=>[u.zodiac&&`<span class="ko-chip">${esc(u.zodiac.sym)} ${esc(u.zodiac.name)}</span>`,u.provinceName&&`<span class="ko-chip">📍 ${esc(u.provinceName)}</span>`,(u.distLabel||u.dist!=null)&&`<span class="ko-chip">🧭 ${esc(u.distLabel||u.dist+' km')}</span>`,...(u.badges||[]).map(b=>`<span class="ko-chip ko-badge">${b==='ตอบไว'?'⚡':'💬'} ${esc(b)}</span>`)].filter(Boolean).join('');
let DECK=[],SHOP=null,ME=()=>K().me();
const setMe=m=>{K().setMe(m);renderTurboBtn()};
function prem(msg){sheet(`<div class="ko-up"><div class="ko-up-ic">👑</div><h3>${esc(msg)}</h3><p>Premium ปลดล็อกการดูคนที่ไลก์คุณ ผู้เยี่ยมชม ย้อนการปัด สถานะอ่านแล้ว ยกเลิกแมตช์ Crush ฟรีทุกวัน และ Turbo ฟรีทุกเดือน</p><button class="ko-btn" onclick="koGoSub()">ดูแพ็กเกจ Premium</button></div>`)}
window.koGoSub=()=>{closeSheet();switchPage('sub',$('nav-sub'))};
const err=e=>{const s=String(e);if(/Premium/.test(s))prem(s);else if(/ไม่มี (Crush|Turbo|คำชม)/.test(s))buy(/Crush/.test(s)?'crush':/Turbo/.test(s)?'turbo':'compliment',s);else toast(s)};
// ---------- sheet (bottom sheet / modal) ----------
function sheet(html,cls=''){closeSheet();const d=document.createElement('div');d.id='koSheet';d.className='ko-sheet-bg';d.innerHTML=`<div class="ko-sheet ${cls}" role="dialog"><button class="ko-x" aria-label="ปิด" onclick="koClose()">✕</button><div class="ko-sheet-in">${html}</div></div>`;d.addEventListener('click',e=>{if(e.target===d)closeSheet()});document.body.appendChild(d);requestAnimationFrame(()=>d.classList.add('on'));return d}
function closeSheet(){$('koSheet')?.remove()}window.koClose=closeSheet;
// ---------- pages + nav ----------
const main=$('main');
main.insertAdjacentHTML('beforeend',`<div id="pageDeck" class="page ko-page"></div><div id="pageLikes" class="page ko-page"></div><div id="pageMe" class="page ko-page"></div>`);
const nc=$('nav-chat');nc.insertAdjacentHTML('beforebegin',`<div class="nav-icon" onclick="switchPage('deck',this)" id="nav-deck"><span style="font-size:18px">🃏</span><span>ปัดการ์ด</span></div><div class="nav-icon" onclick="switchPage('likes',this)" id="nav-likes" style="position:relative"><span style="font-size:18px">💛</span><span>ไลก์</span><div class="nav-badge" id="likesBadge" style="display:none">0</div></div>`);
const np=$('nav-profile');if(np){np.setAttribute('onclick',"switchPage('me',this)")}
const ns=$('nav-settings');if(ns){ns.setAttribute('onclick',"switchPage('me',document.getElementById('nav-profile'));koSettings()")}
const PAGES={deck:['pageDeck',renderDeck],likes:['pageLikes',()=>renderLikes()],me:['pageMe',renderMe]};
const _sp=window.switchPage;
window.switchPage=function(name,nav){if(!PAGES[name])return _sp(name,nav);currentPage=name;document.querySelectorAll('.nav-icon').forEach(n=>n.classList.remove('active'));(nav||$('nav-'+(name==='me'?'profile':name)))?.classList.add('active');
 ['panelChat','panelNearby','panelRooms'].forEach(i=>$(i)&&($(i).style.display='none'));$('panelEmpty')&&($('panelEmpty').style.display='flex');
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(PAGES[name][0]).classList.add('active');PAGES[name][1]()};
// ---------- deck ----------
function renderTurboBtn(){const b=$('koTurbo');if(!b||!ME())return;const t=ME().turboUntil;b.classList.toggle('on',!!t);b.innerHTML=t?`⚡<small>${Math.max(1,Math.ceil((t-Date.now())/60000))}น.</small>`:'⚡'}
setInterval(renderTurboBtn,30000);
async function loadDeck(){DECK=await A('cards');drawDeck()}
function renderDeck(){$('pageDeck').innerHTML=`<div class="ko-top"><button class="ko-ic" id="koFilter" onclick="koFilters()" aria-label="ตัวกรอง">⚙️</button>
 <div class="ko-tabs"><button onclick="switchPage('nearby',document.getElementById('nav-nearby'))">ใกล้เคียง</button><button class="on">ปัดการ์ด</button></div><button class="ko-ic ko-turbo" id="koTurbo" onclick="koTurbo()" aria-label="Turbo">⚡</button></div>
 <div class="ko-deck" id="koDeck"><div class="ko-empty">กำลังโหลด… 🍄</div></div>
 <div class="ko-acts"><button class="ko-a ko-undo" onclick="koUndo()" title="ย้อนกลับ (Premium)">↺</button><button class="ko-a ko-nope" onclick="koSwipe('left')" title="ผ่าน">✕</button><button class="ko-a ko-cmp" onclick="koCompliment()" title="คำชมเชย">💬</button><button class="ko-a ko-like" onclick="koSwipe('right')" title="ถูกใจ">❤</button><button class="ko-a ko-crush" onclick="koSwipe('right',1)" title="Crush">💎</button></div>`;
 renderTurboBtn();loadDeck().catch(err)}
function cardHTML(u,i){const P=pics(u);return `<div class="ko-card" data-i="${i}" style="z-index:${10-i}">
 <div class="ko-ph" data-p="0">${P.length?P.map((p,j)=>`<div class="ko-img${j?'':' on'}" style="background-image:url('${esc(p)}')"></div>`).join(''):`<div class="ko-img on ko-img-e" style="background:${gr(u.id)}"><span>${esc(u.avatar||'🙂')}</span></div>`}</div>
 ${P.length>1?`<div class="ko-dots">${P.map((_,j)=>`<i class="${j?'':'on'}"></i>`).join('')}</div>`:''}
 ${u.verified?'<div class="ko-vbig" title="ยืนยันตัวตนแล้ว">✔</div>':''}${u.turbo?'<div class="ko-tchip">⚡ Turbo</div>':''}
 <div class="ko-stamp ko-st-l">ผ่าน</div><div class="ko-stamp ko-st-r">ถูกใจ</div>
 <div class="ko-info"><div class="ko-nm">${esc(u.name)} <span>${u.age}</span> ${vb(u)}${crown(u)}${u.online?'<i class="ko-on"></i>':''}</div><div class="ko-chips">${chips(u)}</div><div class="ko-bio">${esc(u.bio||'')}</div>
 <button class="ko-more" onclick="event.stopPropagation();koProfile('${u.id}')" aria-label="ดูโปรไฟล์">⌃</button></div></div>`}
function drawDeck(){const d=$('koDeck');if(!d)return;if(!DECK.length){d.innerHTML=`<div class="ko-empty"><div style="font-size:54px">🍄</div><b>หมดการ์ดแล้ว</b><p>ลองปรับตัวกรอง หรือกลับมาใหม่ภายหลัง</p><button class="ko-btn" onclick="koFilters()">ปรับตัวกรอง</button></div>`;return}
 d.innerHTML=DECK.slice(0,2).map(cardHTML).reverse().join('');bindTop()}
function bindTop(){const c=document.querySelector('#koDeck .ko-card[data-i="0"]');if(!c)return;let sx=0,sy=0,dx=0,drag=false,moved=false;
 c.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;drag=true;moved=false;sx=e.clientX;sy=e.clientY;dx=0;c.setPointerCapture(e.pointerId);c.style.transition='none'});
 c.addEventListener('pointermove',e=>{if(!drag)return;dx=e.clientX-sx;const dy=e.clientY-sy;if(Math.abs(dx)>6)moved=true;c.style.transform=`translate(${dx}px,${dy*.2}px) rotate(${dx/18}deg)`;c.querySelector('.ko-st-r').style.opacity=Math.max(0,dx/100);c.querySelector('.ko-st-l').style.opacity=Math.max(0,-dx/100)});
 const end=e=>{if(!drag)return;drag=false;c.style.transition='';if(Math.abs(dx)>100){koSwipe(dx>0?'right':'left');return}c.style.transform='';c.querySelectorAll('.ko-stamp').forEach(s=>s.style.opacity=0);
  if(!moved&&e.type==='pointerup'){const r=c.getBoundingClientRect(),ph=c.querySelector('.ko-ph'),imgs=ph.querySelectorAll('.ko-img');if(imgs.length>1){let p=+ph.dataset.p;p=e.clientX<r.left+r.width/2?Math.max(0,p-1):Math.min(imgs.length-1,p+1);ph.dataset.p=p;imgs.forEach((x,j)=>x.classList.toggle('on',j===p));c.querySelectorAll('.ko-dots i').forEach((x,j)=>x.classList.toggle('on',j===p))}}};
 c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end)}
let busy=false;
window.koSwipe=async function(dir,sup){const u=DECK[0];if(!u||busy)return;busy=true;const c=document.querySelector('#koDeck .ko-card[data-i="0"]');
 try{const r=await A('swipe',{to:u.id,dir,superlike:!!sup});setMe(r.me);if(c){c.style.transition='transform .35s ease,opacity .35s';c.style.transform=`translate(${dir==='right'?520:-520}px,${sup?-200:0}px) rotate(${dir==='right'?24:-24}deg)`;c.style.opacity=0}
  setTimeout(()=>{DECK.shift();drawDeck()},300);if(sup)toast('💎 ส่ง Crush ให้ '+u.name+' แล้ว!');if(r.match)matchPop(r.match)}catch(e){err(e)}finally{setTimeout(()=>busy=false,320)}};
window.koUndo=async function(){try{const r=await A('undo',{});setMe(r.me);DECK.unshift(r.user);drawDeck();toast('↺ ย้อนการปัดแล้ว')}catch(e){err(e)}};
function matchPop(m){K().loadChats().catch(()=>{});sheet(`<div class="ko-match"><div class="ko-mt">แมตช์แล้ว! 🎉</div><div class="ko-mav">${avEl(ME(),'ko-av-l')}<span class="ko-heart">💕</span>${avEl(m.other,'ko-av-l')}</div><p>คุณและ ${esc(m.other.name)} ถูกใจกันและกัน</p><button class="ko-btn" onclick="koClose();setTimeout(()=>{switchPage('chat',document.getElementById('nav-chat'));openChat('${m.id}')},400)">💬 ทักเลย</button><button class="ko-btn ko-ghost" onclick="koClose()">ปัดต่อ</button></div>`,'ko-dark')}
// compliment
window.koCompliment=function(uid){const u=uid?(findU(uid)):DECK[0];if(!u)return;const sug=['ยิ้มสวยมาก 😊','โปรไฟล์น่ารักจัง 🥰','ชอบสไตล์คุณมาก ✨','อยากรู้จักมากขึ้นนะ 👋'];const I=ME().inventory||{};
 sheet(`<h3>💬 ส่งคำชมเชยถึง ${esc(u.name)}</h3><p class="ko-sub">คำชมจะถูกส่งพร้อมไลก์ เพิ่มโอกาสแมตช์! คงเหลือ: <b>${I.compliment||0}</b>${ME().premium?' (+ฟรีวันละ 1 สำหรับ Premium)':''}</p>
 <div class="ko-sug">${sug.map(s=>`<button onclick="document.getElementById('koCmpT').value=this.textContent">${s}</button>`).join('')}</div><textarea id="koCmpT" maxlength="200" placeholder="เขียนคำชม…"></textarea><button class="ko-btn" id="koCmpGo">ส่งคำชม</button>`);
 $('koCmpGo').onclick=async()=>{try{const r=await A('compliment',{to:u.id,text:$('koCmpT').value});setMe(r.me);closeSheet();toast('💬 ส่งคำชมแล้ว!');if(!uid){DECK.shift();drawDeck()}if(r.match)setTimeout(()=>matchPop(r.match),300)}catch(e){err(e)}}};
const UC={};const findU=id=>UC[id]||DECK.find(x=>x.id===id);
// turbo
window.koTurbo=function(){const m=ME(),I=m.inventory||{};if(m.turboUntil){sheet(`<div class="ko-turbo-m"><div class="ko-bolt">⚡<b>10X</b></div><h2>Turbo กำลังทำงาน</h2><p>อีก ${Math.ceil((m.turboUntil-Date.now())/60000)} นาที โปรไฟล์คุณจะถูกแสดงเป็นอันดับต้นๆ</p></div>`,'ko-dark');return}
 sheet(`<div class="ko-turbo-m"><h2>Turbo ⚡</h2><p>ดันโปรไฟล์ของคุณขึ้นก่อนใครในการ์ดและหน้าใกล้เคียง 30 นาที — คนเห็นมากขึ้นสูงสุด 10 เท่า</p><div class="ko-bolt">⚡<b>10X</b></div><p class="ko-sub">Turbo คงเหลือ: <b>${I.turbo||0}</b>${m.premium?' · Premium ได้ฟรีเดือนละ 1':''}</p>
 <button class="ko-btn ko-pink" id="koTGo">⚡ ใช้ Turbo ทันที</button><button class="ko-btn ko-ghost" onclick="koBuy('turbo')">ซื้อเพิ่ม</button><button class="ko-link" onclick="koClose()">เอาไว้ก่อน</button></div>`,'ko-dark');
 $('koTGo').onclick=async()=>{try{setMe(await A('turbo',{}));closeSheet();toast('⚡ เปิด Turbo แล้ว 30 นาที!')}catch(e){err(e)}}};
// filters
window.koFilters=function(){const f=ME().filters||{},P=(K().cfg()||{}).provinces||[];const ages=Array.from({length:82},(_,i)=>i+18);const o=(v,sel)=>`<option value="${v}"${String(sel??'')===String(v)?' selected':''}>`;
 sheet(`<h3>⚙️ ตัวกรอง</h3><label>แสดง</label><div class="ko-seg" id="koFg">${[['','ทุกคน'],['f','ผู้หญิง'],['m','ผู้ชาย']].map(([v,t])=>`<button data-v="${v}" class="${(f.gender||'')===v?'on':''}">${t}</button>`).join('')}</div>
 <label>ช่วงอายุ</label><div class="ko-row"><select id="koAmin">${o('',f.ageMin)}ไม่ระบุ</option>${ages.map(a=>o(a,f.ageMin)+a+'</option>').join('')}</select><span>–</span><select id="koAmax">${o('',f.ageMax)}ไม่ระบุ</option>${ages.map(a=>o(a,f.ageMax)+a+'</option>').join('')}</select></div>
 <label>จังหวัด</label><select id="koFp">${o('',f.province)}ทุกจังหวัด</option>${P.map(p=>o(p.id,f.province)+esc(p.th)+'</option>').join('')}</select>
 <label>ระยะทาง (โดยประมาณ)</label><select id="koFd">${[['','ทั้งประเทศ'],[1,'1 km'],[5,'5 km'],[10,'10 km'],[25,'25 km'],[50,'50 km'],[100,'100 km']].map(([v,t])=>o(v,f.maxDist)+t+'</option>').join('')}</select>
 <button class="ko-btn" id="koFgo">บันทึกตัวกรอง</button><button class="ko-link" id="koFreset">ล้างตัวกรอง</button>`);
 document.querySelectorAll('#koFg button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#koFg button').forEach(x=>x.classList.remove('on'));b.classList.add('on')});
 const go=async body=>{try{setMe(await A('filters',body));closeSheet();if(currentPage==='deck')loadDeck();toast('บันทึกตัวกรองแล้ว')}catch(e){err(e)}};
 $('koFgo').onclick=()=>go({gender:document.querySelector('#koFg .on').dataset.v,ageMin:$('koAmin').value,ageMax:$('koAmax').value,province:$('koFp').value,maxDist:$('koFd').value});$('koFreset').onclick=()=>go({})};
// profile sheet (records a visit)
window.koProfile=async function(id){let u=findU(id);try{if(!u)u=await A('user/'+id);UC[id]=u}catch(e){return toast(e)}A('visit',{id}).catch(()=>{});const P=pics(u);
 sheet(`<div class="ko-pv">${P.length?`<div class="ko-pv-ph">${P.map(p=>`<img src="${esc(p)}" alt="">`).join('')}</div>`:`<div class="ko-pv-e" style="background:${gr(u.id)}">${esc(u.avatar||'🙂')}</div>`}
 <h2>${esc(u.name)} <span>${u.age||''}</span> ${vb(u)}${crown(u)}</h2><div class="ko-chips">${chips(u)}</div><p>${esc(u.bio||'')}</p>
 ${u.official?'':`<div class="ko-row ko-pv-a"><button class="ko-btn" onclick="koClose();koQuick('${u.id}','right')">❤ ถูกใจ</button><button class="ko-btn ko-pink" onclick="koClose();koQuick('${u.id}','right',1)">💎 Crush</button><button class="ko-btn ko-ghost" onclick="koClose();koCompliment('${u.id}')">💬 ชม</button></div>
 <button class="ko-link" onclick="koClose();openReportModal('${u.id}')">🚩 รายงาน / บล็อก</button>`}</div>`)};
window.koQuick=async function(id,dir,sup){if(DECK[0]&&DECK[0].id===id)return koSwipe(dir,sup);try{const r=await A('swipe',{to:id,dir,superlike:!!sup});setMe(r.me);DECK=DECK.filter(x=>x.id!==id);toast(sup?'💎 ส่ง Crush แล้ว':'❤ ถูกใจแล้ว');if(r.match)matchPop(r.match);if(currentPage==='likes')renderLikes()}catch(e){err(e)}};
const _opd=window.openProfileDrawer;if(_opd)window.openProfileDrawer=function(id){if(id&&typeof id==='string'&&!/^locked/.test(id))A('visit',{id}).catch(()=>{});return _opd.apply(this,arguments)};
// ---------- likes hub ----------
let LT='rec';
async function updLikesBadge(){try{const r=await A('likes/received');const b=$('likesBadge');if(b){b.textContent=r.newCount>99?'99+':r.newCount;b.style.display=r.newCount?'':'none'}return r}catch(e){}}
window.koLikesTab=t=>{LT=t;renderLikes()};
async function renderLikes(){const pg=$('pageLikes');pg.innerHTML=`<div class="ko-h">ไลก์ <span class="ko-sub">ใครสนใจคุณบ้าง</span></div><div class="ko-subtabs">${[['rec','คนที่กดไลก์ฉัน'],['given','คนที่ฉันกดไลก์'],['vis','ผู้เยี่ยมชม']].map(([k,t])=>`<button class="${LT===k?'on':''}" onclick="koLikesTab('${k}')">${t}</button>`).join('')}</div><div id="koLB" class="ko-lb"><div class="ko-empty">กำลังโหลด…</div></div>`;
 const B=$('koLB');try{
 if(LT==='rec'){const r=await A('likes/received?seen=1');updLikesBadge();
  B.innerHTML=`<div class="ko-sum"><b>${r.count}</b> คนกดไลก์คุณ${r.newCount?` · <span class="ko-new">ใหม่ ${r.newCount}</span>`:''}</div>`+(r.count?`<div class="ko-grid">${r.list.map(x=>x.blur?blurTile(x):likeTile(x,true)).join('')}</div>`:'<div class="ko-empty">ยังไม่มีใครกดไลก์ ลองเพิ่มรูปหรือเปิด Turbo ⚡</div>')+(r.premium||r.unlocked||!r.count?'':unlockCTA('ดูว่าใครกดไลก์คุณ'))}
 else if(LT==='given'){const L=await A('likes/given');L.forEach(x=>UC[x.id]=x);B.innerHTML=L.length?`<p class="ko-sub" style="padding:0 16px">ส่ง Crush 💎 เพื่อให้เขาเห็นคุณก่อนใคร และเพิ่มโอกาสแมตช์</p><div class="ko-grid">${L.map(x=>`<div class="ko-tile" onclick="koProfile('${x.id}')">${tileBg(x)}<div class="ko-tn">${esc(x.name)}, ${x.age} ${vb(x)}</div>${x.superlike?'<span class="ko-tb">💎</span>':''}<button class="ko-tbtn" onclick="event.stopPropagation();koQuick('${x.id}','right',1)">💎 ส่ง Crush</button></div>`).join('')}</div>`:'<div class="ko-empty">คุณยังไม่ได้กดไลก์ใคร ไปปัดการ์ดกัน! 🃏</div>'}
 else{const r=await A('visitors');B.innerHTML=`<div class="ko-stats3"><div><b>${r.stats.total}</b>ผู้เยี่ยมชม</div><div><b>${r.stats.repeat}</b>เข้าชมซ้ำ</div><div><b>${r.stats.friends}</b>เพื่อน</div></div>`+(r.list.length?`<div class="ko-grid">${r.list.map(x=>x.blur?blurTile(x,`👀 ${x.count} ครั้ง`):`<div class="ko-tile" onclick="koProfile('${x.id}')">${tileBg(x)}<div class="ko-tn">${esc(x.name)}, ${x.age} ${vb(x)}</div><span class="ko-tb">👀 ${x.count}</span></div>`).join('')}</div>`:'<div class="ko-empty">ยังไม่มีผู้เยี่ยมชม</div>')+(r.premium||r.unlocked||!r.list.length?'':unlockCTA('ดูว่าใครแวะมาดูโปรไฟล์คุณ'))}
 }catch(e){B.innerHTML=`<div class="ko-empty">${esc(e)}</div>`}}
const tileBg=x=>{const p=pics(x)[0];return p?`<div class="ko-tbg" style="background-image:url('${esc(p)}')"></div>`:`<div class="ko-tbg ko-tbg-e" style="background:${gr(x.id)}">${esc(x.avatar||'🙂')}</div>`};
const blurTile=(x,extra)=>`<div class="ko-tile ko-blur" onclick="prem0()"><div class="ko-tbg ko-tbg-b"></div><div class="ko-lock">🔒</div>${x.online?'<i class="ko-on ko-on-t"></i>':''}${x.isNew?'<span class="ko-tb ko-new">ใหม่</span>':''}${x.superlike?'<span class="ko-tb">💎</span>':''}${x.compliment?'<span class="ko-tb">💬</span>':''}${extra?`<div class="ko-tn">${extra}</div>`:''}</div>`;
window.prem0=()=>prem('ปลดล็อกด้วย Premium');
const likeTile=(x)=>{UC[x.id]=x;return `<div class="ko-tile" onclick="koProfile('${x.id}')">${tileBg(x)}${x.online?'<i class="ko-on ko-on-t"></i>':''}${x.isNew?'<span class="ko-tb ko-new">ใหม่</span>':''}<div class="ko-tn">${esc(x.name)}, ${x.age} ${vb(x)}${x.compliment&&x.compliment!==true?`<small>💬 ${esc(x.compliment)}</small>`:''}</div><div class="ko-tacts"><button onclick="event.stopPropagation();koQuick('${x.id}','left')">✕</button><button onclick="event.stopPropagation();koQuick('${x.id}','right')">❤</button></div></div>`};
const unlockCTA=t=>`<div class="ko-cta"><b>👑 ${t}</b><p>อัปเกรดเป็น Premium เพื่อปลดล็อกรายชื่อทั้งหมด</p><button class="ko-btn" onclick="koGoSub()">ปลดล็อกเลย</button></div>`;
// ---------- me ----------
async function renderMe(){const m=ME();if(!m)return;const pg=$('pageMe');const C=m.completion||{pct:0,missing:[]},I=m.inventory||{};const MISS={name:'ชื่อ',dob:'วันเกิด',gender:'เพศ',bio:'แนะนำตัว (10 ตัวอักษรขึ้นไป)',avatar:'รูปโปรไฟล์',photos2:'รูปอย่างน้อย 2 รูป',province:'จังหวัด',verified:'ยืนยันตัวตน'};
 pg.innerHTML=`<div class="ko-top"><div class="ko-h" style="padding:0">ฉัน</div><button class="ko-ic" onclick="koSettings()" aria-label="ตั้งค่า">⚙️</button></div>
 <div class="ko-mecard"><div class="ko-ring" style="--p:${C.pct}">${avEl(m,'ko-av-l')}<span>${C.pct}%</span></div><div><div class="ko-nm2">${esc(m.name)}, ${m.age} ${vb(m)}${m.premiumIcon?'👑':''}</div><div class="ko-chips">${chips(m)}</div>
 <div class="ko-row"><button class="ko-btn ko-sm" onclick="koEdit()">✏️ แก้ไขโปรไฟล์</button>${m.verified?'':`<button class="ko-btn ko-sm ko-ghost" onclick="koVerify()">${m.verifyStatus==='pending'?'⏳ รอตรวจสอบ':'✔ ยืนยันตัวตน'}</button>`}</div></div></div>
 ${C.missing.length?`<div class="ko-hint">โปรไฟล์สมบูรณ์ ${C.pct}% — เพิ่ม: ${C.missing.map(k=>MISS[k]).join(', ')}</div>`:''}
 <div class="ko-stats" id="koStats"><div><b>–</b>ได้รับไลก์</div><div><b>–</b>กดไลก์</div><div><b>–</b>ผู้เยี่ยมชม</div><div><b>–</b>Crush/คำชม</div></div>
 <div class="ko-likecard" id="koLikeCard"></div>
 <div class="ko-inv">${[['turbo','⚡','TURBO'],['crush','💎','CRUSH'],['compliment','💬','คำชมเชย']].map(([k,e,t])=>`<div class="ko-ii ko-ii-${k}"><div class="ko-ie">${e}</div><b>${I[k]||0}</b><small>${t}</small><button onclick="koBuy('${k}')">เพิ่ม</button></div>`).join('')}</div>
 <div class="ko-prem">${m.premium?`<b>👑 Premium ใช้งานอยู่</b><p>ถึง ${new Date(m.premiumUntil).toLocaleDateString('th-TH')}</p>`:`<b>👑 Kuy Talk Premium</b><p>ปลดล็อกทุกฟีเจอร์ เริ่มต้นเพียง 100 เหรียญ/30 วัน</p><button class="ko-btn" onclick="koGoSub()">อัปเกรด</button>`}</div>
 <table class="ko-ben"><tr><th>สิทธิประโยชน์</th><th>คุณ</th><th>👑</th></tr>${[['ดูว่าใครกดไลก์คุณ',0],['ดูผู้เยี่ยมชมโปรไฟล์',0],['ปัดขวาไม่จำกัด','100/วัน'],['Crush ฟรีทุกวัน',0],['คำชมเชยฟรีทุกวัน',0],['Turbo ฟรีทุกเดือน',0],['สถานะอ่านแล้ว',0],['ยกเลิกแมตช์',0],['ย้อนการปัด',0],['สุ่มคู่ (Lucky) ไม่จำกัด','1/วัน'],['ไอคอน Premium 👑',0]].map(([t,f])=>`<tr><td>${t}</td><td>${f?f:m.premium?'✔':'–'}</td><td class="ko-y">✔</td></tr>`).join('')}</table>
 <div class="ko-ref"><b>🎁 ชวนเพื่อน รับ 50 เหรียญ</b><p>รหัสของคุณ <code>${esc(m.refCode||'')}</code> — เพื่อนที่สมัครด้วยรหัสนี้ได้ 50 เหรียญ คุณก็ได้ 50 เหรียญ</p><div class="ko-row"><button class="ko-btn ko-sm" onclick="koShare()">แชร์ลิงก์ชวนเพื่อน</button>${m.referredBy?'':`<button class="ko-btn ko-sm ko-ghost" onclick="koRedeem()">ใส่รหัสเพื่อน</button>`}</div></div>
 <p class="ko-sub" style="text-align:center;padding:10px 0 90px">🪙 เหรียญ: <b>${m.coins}</b> · การชำระเงินทั้งหมดเป็นระบบจำลอง</p>`;
 try{const s=await A('me/stats');$('koStats').innerHTML=`<div><b>${s.likesReceived}</b>ได้รับไลก์</div><div><b>${s.likesGiven}</b>กดไลก์</div><div><b>${s.visitors}</b>ผู้เยี่ยมชม</div><div><b>${s.picks}</b>Crush/คำชม</div>`;
  const rate=s.likesGiven?Math.round(s.matches/s.likesGiven*100):0;$('koLikeCard').innerHTML=`<b>📊 สถิติไลก์</b><div class="ko-bar"><i style="width:${Math.min(100,rate)}%"></i></div><small>แมตช์ ${s.matches} ครั้งจากการกดไลก์ ${s.likesGiven} ครั้ง (อัตราแมตช์ ${rate}%)</small>`}catch(e){}}
// shop
window.koBuy=async function(k,why){try{SHOP=SHOP||await A('shop')}catch(e){return toast(e)}const it=SHOP.items[k],m=ME();
 sheet(`<h3>${it.label}</h3>${why?`<p class="ko-warn">${esc(why)}</p>`:''}<p class="ko-sub">มีอยู่ ${(m.inventory||{})[k]||0} · เหรียญของคุณ 🪙 ${m.coins}</p>
 <div class="ko-packs"><button onclick="koBuyGo('${k}',1)"><b>1 ชิ้น</b><span>🪙 ${it.coins}</span></button><button onclick="koBuyGo('${k}',5)"><b>5 ชิ้น</b><span>🪙 ${Math.round(it.coins*5*.8)}</span><em>ลด 20%</em></button></div>
 <button class="ko-link" onclick="koGoSub()">เติมเหรียญ (จำลอง) →</button>`)};
window.koBuyGo=async(k,q)=>{try{setMe(await A('shop/buy',{item:k,qty:q}));closeSheet();toast('✅ ซื้อสำเร็จ');if(currentPage==='me')renderMe()}catch(e){err(e)}};
window.koShare=async()=>{const url=location.origin+'/?ref='+encodeURIComponent(ME().refCode);try{if(navigator.share)await navigator.share({title:'Kuy Talk',text:'มาคุยกันใน Kuy Talk 🍄 ใช้รหัส '+ME().refCode+' รับ 50 เหรียญ',url});else{await navigator.clipboard.writeText(url);toast('คัดลอกลิงก์แล้ว')}}catch(e){prompt('คัดลอกลิงก์นี้',url)}};
window.koRedeem=()=>{sheet(`<h3>ใส่รหัสแนะนำ</h3><input id="koRefI" maxlength="12" placeholder="เช่น A1B2C3" style="text-transform:uppercase"><button class="ko-btn" id="koRefGo">รับ 50 เหรียญ</button>`);$('koRefGo').onclick=async()=>{try{setMe(await A('referral',{code:$('koRefI').value}));closeSheet();toast('🎁 รับ 50 เหรียญแล้ว!');renderMe()}catch(e){err(e)}}};
// image helper
const pickImg=(cap)=>window.ktPickImg?window.ktPickImg(cap):new Promise(res=>{const f=document.createElement('input');f.type='file';f.accept='image/*';if(cap)f.capture='user';f.onchange=()=>{const file=f.files[0];if(!file)return res(null);const im=new Image();im.onload=()=>{const s=Math.min(1,720/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.82))};im.onerror=()=>res(null);im.src=URL.createObjectURL(file)};f.click()});
// edit profile
window.koEdit=function(){const m=ME(),P=(K().cfg()||{}).provinces||[];const EM=['😎','🙂','🍄','🌸','🐱','🐶','🦊','🐼','🌈','⭐','🎮','☕'];
 sheet(`<h3>✏️ แก้ไขโปรไฟล์</h3><label>รูปภาพ (สูงสุด 4)</label><div class="ko-photos">${[0,1,2,3].map(i=>{const p=(m.photos||[])[i];return p?`<div class="ko-pslot" style="background-image:url('${esc(TH(p,400))}')"><button onclick="koDelPhoto(${i})" aria-label="ลบ">✕</button></div>`:`<button class="ko-pslot ko-padd" onclick="koAddPhoto()">＋</button>`}).join('')}</div>
 <label>อวตาร (ถ้าไม่มีรูป)</label><div class="ko-emo">${EM.map(e=>`<button class="${m.avatar===e?'on':''}" onclick="koAvatar('${e}')">${e}</button>`).join('')}</div>
 <label>ชื่อ</label><input id="koEn" maxlength="30" value="${esc(m.name)}"><label>แนะนำตัว</label><textarea id="koEb" maxlength="200">${esc(m.bio||'')}</textarea>
 <label>เพศ</label><select id="koEg">${[['x','ไม่ระบุ'],['f','หญิง'],['m','ชาย']].map(([v,t])=>`<option value="${v}"${m.gender===v?' selected':''}>${t}</option>`).join('')}</select>
 <label>วันเกิด (ราศีคำนวณอัตโนมัติ)</label><div class="kt-dob"><select id="koD"><option value="">วัน</option></select><select id="koM"><option value="">เดือน</option></select><select id="koY"><option value="">ปี</option></select></div><input type="hidden" id="koDob">
 <label>จังหวัด</label><select id="koEp"><option value="">ไม่ระบุ</option>${P.map(p=>`<option value="${p.id}"${m.province===p.id?' selected':''}>${esc(p.th)}</option>`).join('')}</select>
 <button class="ko-btn" id="koEgo">บันทึก</button>`);
 if(window.ktInitDob){ktInitDob($('koD'),$('koM'),$('koY'),$('koDob'));if(m.dob){const[y,mo,d]=m.dob.split('-');$('koY').value=+y;$('koM').value=+mo;$('koY').dispatchEvent(new Event('change'));$('koD').value=+d;$('koD').dispatchEvent(new Event('change'))}}
 $('koEgo').onclick=async()=>{try{setMe(await A('profile',{name:$('koEn').value,bio:$('koEb').value,gender:$('koEg').value,province:$('koEp').value,dob:$('koDob').value||undefined}));closeSheet();toast('บันทึกแล้ว ✨');renderMe()}catch(e){err(e)}}};
window.koAddPhoto=async()=>{const d=await pickImg();if(!d)return;try{setMe(await A('photos',{photo:d}));koEdit();renderMe()}catch(e){err(e)}};
window.koDelPhoto=async i=>{try{setMe(await A('photos/'+i,null,'DELETE'));koEdit();renderMe()}catch(e){err(e)}};
window.koAvatar=async e=>{try{setMe(await A('profile',{avatar:e}));koEdit();renderMe()}catch(x){err(x)}};
window.koVerify=function(){const m=ME();if(m.verifyStatus==='pending')return sheet('<h3>⏳ กำลังตรวจสอบ</h3><p>ทีมงานกำลังตรวจสอบเซลฟี่ของคุณ ผลจะแจ้งในแชท Kuy Talk Team</p>');
 sheet(`<h3>✔ ยืนยันตัวตน</h3><p>ถ่ายเซลฟี่ 1 รูป โดย <b>ชูสองนิ้ว ✌️ ข้างใบหน้า</b> ให้เห็นหน้าชัด ทีมงานจะเทียบกับรูปโปรไฟล์ เมื่อผ่านจะได้เครื่องหมาย <span class="kt-vb">✔</span></p>${m.verifyStatus==='rejected'?'<p class="ko-warn">ครั้งก่อนไม่ผ่าน กรุณาลองใหม่</p>':''}<p class="ko-sub">รูปเซลฟี่ใช้เพื่อการตรวจสอบเท่านั้น และจะถูกลบหลังตรวจเสร็จ</p><button class="ko-btn" id="koVgo">📷 ถ่าย/เลือกเซลฟี่</button>`);
 $('koVgo').onclick=async()=>{const d=await pickImg(true);if(!d)return;try{setMe(await A('verify',{selfie:d}));closeSheet();toast('ส่งคำขอยืนยันแล้ว ⏳');renderMe()}catch(e){err(e)}}};
// ---------- settings ----------
const DRAFT='<p class="ko-warn">⚠️ ฉบับร่าง (Draft) — ข้อความตัวอย่าง ยังไม่ใช่เอกสารทางกฎหมายจริง</p>';
const LEGAL={guide:['แนวทางชุมชน','<p>1. เคารพผู้อื่น ไม่คุกคาม ไม่ใช้ถ้อยคำหยาบคายหรือเหยียด</p><p>2. ห้ามแอบอ้างเป็นบุคคลอื่น ใช้รูปของตัวเองเท่านั้น</p><p>3. ห้ามเนื้อหาทางเพศอย่างโจ่งแจ้ง การขายบริการ หรือหลอกลวงทางการเงิน</p><p>4. ผู้ใช้ต้องมีอายุ 18 ปีขึ้นไป</p><p>5. พบสิ่งไม่เหมาะสม กดรายงานได้ทุกเมื่อ</p>'],
 privacy:['นโยบายความเป็นส่วนตัว','<p>เราเก็บข้อมูลที่คุณให้ (ชื่อ วันเกิด รูป ข้อความ) เพื่อให้บริการจับคู่และแชท เราไม่ขายข้อมูลให้บุคคลที่สาม คุณลบบัญชีและข้อมูลได้ที่ ตั้งค่า › บัญชี</p>'],
 terms:['ข้อกำหนดการใช้งาน','<p>การใช้ Kuy Talk ถือว่าคุณยอมรับแนวทางชุมชน เหรียญและไอเทมในต้นแบบนี้เป็นระบบจำลอง ไม่มีมูลค่าเงินจริง และไม่สามารถแลกคืนได้</p>'],
 cookie:['นโยบายคุกกี้','<p>เราใช้ localStorage เก็บโทเค็นการเข้าสู่ระบบและการตั้งค่าบนอุปกรณ์ของคุณเท่านั้น ไม่มีคุกกี้โฆษณาหรือการติดตามจากบุคคลที่สาม</p>']};
const SOON=t=>`koSoon('${t}')`;window.koSoon=t=>sheet(`<h3>${t}</h3><p>ยังไม่รองรับในเวอร์ชันต้นแบบนี้ 🍄</p><button class="ko-link" onclick="koSettings()">‹ กลับ</button>`);
window.koSettings=function(){const p=ME().prefs||{};const it=(ic,t,fn,r='›')=>`<button class="ko-li" onclick="${fn}"><span>${ic}</span><b>${t}</b><i>${r}</i></button>`;const tg=(k,t,def)=>`<label class="ko-li ko-tg"><span>🔔</span><b>${t}</b><input type="checkbox" ${(p[k]??def)?'checked':''} onchange="koPref('${k}',this.checked)"></label>`;
 sheet(`<h3>⚙️ ตั้งค่า</h3><div class="ko-grp">${it('📷','สแกน QR',SOON('สแกน QR'))}${it('🔄','กู้คืนการซื้อ','koRestore()')}${it('🎭','เปลี่ยนไอคอนแอป (ความเป็นส่วนตัว)',SOON('เปลี่ยนไอคอนแอป'))}<label class="ko-li ko-tg"><span>👑</span><b>แสดงไอคอน Premium</b><input type="checkbox" ${p.showPremium!==false?'checked':''} onchange="koPref('showPremium',this.checked)"></label></div>
 <div class="ko-grp">${it('🎁','ชวนเพื่อน','koShare()')}${it('🔗','เชื่อมบัญชี Google',SOON('เชื่อมบัญชี Google'))}${it('👤','ข้อมูลส่วนตัว','koEdit()')}${it('🔔','การแจ้งเตือน','koNotif()')}${it('📱','SMS',SOON('SMS'))}${it('🏷️','รหัสแนะนำ','koRedeem()',esc(ME().refCode||''))}</div>
 <div class="ko-grp">${it('💬','ติดต่อทีมงาน','koTeam()')}${it('❓','ศูนย์ช่วยเหลือ','koHelp()')}${it('🌐','ภาษา','koLang()','ไทย')}${it('📜','แนวทางชุมชน',"koLegal('guide')")}${it('🔒','นโยบายความเป็นส่วนตัว',"koLegal('privacy')")}${it('📄','ข้อกำหนดการใช้งาน',"koLegal('terms')")}${it('🍪','นโยบายคุกกี้',"koLegal('cookie')")}</div>
 <div class="ko-grp">${it('🛡️','ตั้งค่าความเป็นส่วนตัว','koPrivacy()')}${it('⚙️','ตั้งค่าบัญชี','koAccount()')}${it('📶','ทดสอบเครือข่าย','koNet()')}${it('🧠','แบบทดสอบบุคลิกภาพ',SOON('แบบทดสอบบุคลิกภาพ'))}</div>
 <div class="ko-grp">${it('🚪','ออกจากระบบ','koLogout()','')}</div><p class="ko-sub" style="text-align:center">Kuy Talk เวอร์ชัน 2.0.0 (ต้นแบบ)</p>`,'ko-full')};
const back='<button class="ko-link" onclick="koSettings()">‹ กลับไปตั้งค่า</button>';
window.koPref=async(k,v)=>{try{setMe(await A('prefs',{[k]:v}));toast('บันทึกแล้ว')}catch(e){err(e)}};
window.koLegal=k=>sheet(`<h3>${LEGAL[k][0]}</h3>${DRAFT}${LEGAL[k][1]}${back}`,'ko-full');
	window.koNotif=()=>{const p=ME().prefs||{};const t=(k,l)=>`<label class="ko-li ko-tg"><span>🔔</span><b>${l}</b><input type="checkbox" ${p[k]!==false?'checked':''} onchange="koPref('${k}',this.checked)"></label>`;sheet(`<h3>การแจ้งเตือน</h3><div class="ko-grp">${t('notif','เปิดการแจ้งเตือนในแอป')}${t('notifMsg','ข้อความใหม่')}${t('notifSound','เสียงแจ้งเตือนข้อความ')}${t('notifLike','ไลก์ / Crush / คำชม')}</div>${back}`,'ko-full')};
window.koPrivacy=()=>{const p=ME().prefs||{};sheet(`<h3>ความเป็นส่วนตัว</h3><div class="ko-grp"><label class="ko-li ko-tg"><span>👑</span><b>แสดงไอคอน Premium</b><input type="checkbox" ${p.showPremium!==false?'checked':''} onchange="koPref('showPremium',this.checked)"></label><button class="ko-li" onclick="switchPage('settings',document.getElementById('nav-settings'))"><span>🚫</span><b>รายชื่อที่บล็อก</b><i>›</i></button></div>${back}`,'ko-full')};
window.koLang=()=>sheet(`<h3>ภาษา</h3><div class="ko-grp"><button class="ko-li"><span>🇹🇭</span><b>ไทย</b><i>✔</i></button><button class="ko-li" onclick="koSoon('English')"><span>🇬🇧</span><b>English (เร็วๆ นี้)</b><i></i></button></div>${back}`,'ko-full');
window.koHelp=()=>sheet(`<h3>ศูนย์ช่วยเหลือ</h3><p><b>แมตช์คืออะไร?</b> เมื่อคุณและอีกฝ่ายกดถูกใจกัน จะแชทกันได้</p><p><b>Crush 💎</b> ไลก์พิเศษที่แจ้งเตือนอีกฝ่ายทันที</p><p><b>Turbo ⚡</b> ดันโปรไฟล์ขึ้นก่อน 30 นาที</p><p><b>เหรียญ</b> ในต้นแบบนี้เป็นระบบจำลอง ไม่มีการตัดเงินจริง</p><button class="ko-btn" onclick="koTeam()">💬 คุยกับทีมงาน</button>${back}`,'ko-full');
window.koTeam=()=>{closeSheet();const mid=Object.keys(K().chats).find(k=>K().chats[k].official);switchPage('chat',$('nav-chat'));if(mid)openChat(mid)};
window.koRestore=async()=>{try{await K().refresh();await K().loadChats();toast('🔄 ซิงก์การซื้อจากเซิร์ฟเวอร์แล้ว: 🪙 '+ME().coins+(ME().premium?' · 👑 Premium':''));renderMe()}catch(e){err(e)}};
window.koNet=async()=>{sheet('<h3>📶 ทดสอบเครือข่าย</h3><p id="koNetR">กำลังทดสอบ…</p>'+back,'ko-full');const t=[];for(let i=0;i<5;i++){const s=performance.now();try{await fetch('/healthz',{cache:'no-store'});t.push(performance.now()-s)}catch(e){}}
 const s=K().sock();const avg=t.length?Math.round(t.reduce((a,b)=>a+b)/t.length):null;$('koNetR')&&($('koNetR').innerHTML=`HTTP: ${avg!=null?avg+' ms ('+(avg<150?'ดีมาก 🟢':avg<400?'ปานกลาง 🟡':'ช้า 🔴')+')':'เชื่อมต่อไม่ได้ 🔴'}<br>เรียลไทม์ (Socket): ${s&&s.connected?'เชื่อมต่อแล้ว 🟢':'ไม่เชื่อมต่อ 🔴'}<br>วิดีโอคอล: ใช้ STUN สาธารณะ บางเครือข่ายอาจต้องใช้ TURN`)};
window.koAccount=()=>sheet(`<h3>ตั้งค่าบัญชี</h3><div class="ko-grp"><button class="ko-li" onclick="koEdit()"><span>👤</span><b>แก้ไขข้อมูลส่วนตัว</b><i>›</i></button><button class="ko-li ko-danger" onclick="koDelete()"><span>🗑️</span><b>ลบบัญชีถาวร</b><i>›</i></button></div>${back}`,'ko-full');
window.koDelete=async()=>{if(!confirm('ลบบัญชีและข้อมูลทั้งหมดถาวร? ไม่สามารถกู้คืนได้'))return;try{await A('account/delete',{});localStorage.removeItem('kt_token');location.href='/'}catch(e){err(e)}};
window.koLogout=()=>{if(!confirm('ออกจากระบบ? (บัญชีต้นแบบนี้ผูกกับเครื่อง — ถ้าออกแล้วจะกลับเข้าบัญชีเดิมไม่ได้)'))return;localStorage.removeItem('kt_token');location.href='/'};
// ---------- chat extras: stickers, read receipts, unmatch ----------
const ir=document.querySelector('#pageChatWin .input-row');if(ir){const b=document.createElement('button');b.className='emoji-btn ko-stkbtn';b.title='สติกเกอร์';b.innerHTML='<em class="ei">🍄</em>';b.onclick=e=>{e.stopPropagation();koStickers()};ir.insertBefore(b,ir.querySelector('.send-btn'))}
window.koStickers=function(){let p=$('koStk');if(p){p.remove();return}p=document.createElement('div');p.id='koStk';p.className='ko-stkp';const S=(K()&&K().STK)||{};p.innerHTML=Object.keys(S).map(k=>`<button onclick="koSendStk('${k}')"><span class="kt-stk-e">${S[k][0]}</span><small>${S[k][1]}</small></button>`).join('');document.querySelector('#pageChatWin .cw-input-area').appendChild(p)};
window.koSendStk=k=>{$('koStk')?.remove();const i=$('msgInput');i.value='[[sticker:'+k+']]';sendMessage()};
const ca=document.querySelector('#pageChatWin .cw-actions');if(ca)ca.insertAdjacentHTML('beforeend','<div class="cw-btn" id="koUnmatch" onclick="koUnmatch()" title="ยกเลิกแมตช์ (Premium)"><em class="ei">💔</em></div>');
window.koUnmatch=async()=>{const c=K().chats[currentChat];if(!c||c.official)return toast('ยกเลิกแมตช์กับทีมงานไม่ได้');if(!confirm('ยกเลิกแมตช์กับ '+(c.rawName||'')+'? แชทจะถูกลบทั้งหมด'))return;try{await A('unmatch',{mid:currentChat});toast('ยกเลิกแมตช์แล้ว');window.ktBackToList&&ktBackToList();await K().loadChats()}catch(e){err(e)}};
const _rm=window.renderMessages;window.renderMessages=function(){_rm.apply(this,arguments);const c=K().chats[currentChat];if(!c)return;const box=$('cwMessages');
 const mine=c.msgs.filter(m=>m.from==='me');const last=mine[mine.length-1];if(last&&c.peerRead&&last.ts&&c.peerRead>=last.ts-1000){const d=document.createElement('div');d.className='ko-read';d.textContent='อ่านแล้ว ✓✓';box.appendChild(d)}
 box.querySelectorAll('.msg-bubble,.bubble').forEach(b=>{if(b.querySelector('.kt-stk'))b.classList.add('ko-stk-bub')})};
const _oc=window.openChat;window.openChat=function(mid){const r=_oc.apply(this,arguments);const c=K().chats[mid],s=K().sock();if(c)$('cwName').innerHTML=c.name;if(s)s.emit('read',{mid});
 document.querySelectorAll('#pageChatWin .cw-actions .cw-btn').forEach(b=>{if(/startCall|startVideoCall|koUnmatch/.test(b.getAttribute('onclick')||''))b.style.display=c&&c.official?'none':''});
 A('read/'+mid).then(x=>{if(x.premium&&c){c.peerRead=x.peerReadAt;if(currentChat===mid)renderMessages()}}).catch(()=>{});return r};

// ---------- chat: photos, location, unsend, header menu, profile card ----------
const lon2x=(l,z)=>(l+180)/360*2**z,lat2y=(l,z)=>(1-Math.log(Math.tan(l*Math.PI/180)+1/Math.cos(l*Math.PI/180))/Math.PI)/2*2**z;
window.koLocCard=(lat,lng)=>{const z=15,x=lon2x(+lng,z),y=lat2y(+lat,z),tx=Math.floor(x),ty=Math.floor(y),px=Math.round((x-tx)*256),py=Math.round((y-ty)*256);const g=`https://www.google.com/maps?q=${+lat},${+lng}`;
 return `<a class="ko-loc" href="${g}" target="_blank" rel="noopener"><span class="ko-loc-map" style="background-image:url('https://tile.openstreetmap.org/${z}/${tx}/${ty}.png');background-position:${128-px}px ${70-py}px"><i>📍</i></span><span class="ko-loc-t">📍 ตำแหน่งที่แชร์<small>${(+lat).toFixed(5)}, ${(+lng).toFixed(5)} · เปิดใน Google Maps ↗</small></span><span class="ko-osm">© OpenStreetMap</span></a>`};
window.koViewImg=src=>{const d=document.createElement('div');d.className='ko-iv';d.innerHTML=`<img src="${esc(src)}" alt=""><button class="ko-x" aria-label="ปิด">✕</button>`;d.onclick=()=>d.remove();document.body.appendChild(d)};
const ia=document.querySelector('#pageChatWin .cw-input-area');
	if(ia){ia.insertAdjacentHTML('afterbegin',`<div class="ko-qs" id="koQs">${Object.keys((K()&&K().STK)||{}).slice(0,6).map(k=>`<button onclick="koSendStk('${k}')" title="${K().STK[k][1]}">${K().STK[k][0]}</button>`).join('')}</div><div class="ko-tools"><button onclick="koPhoto(false)" title="เลือกรูปจากคลังภาพ">📷 เลือกรูป</button><button onclick="koPhoto(false)" title="คลังภาพ">🖼️ รูปภาพ</button><button onclick="koSendLoc()" title="ตำแหน่ง">📍 ตำแหน่ง</button><button onclick="koStickers()" title="สติกเกอร์">🍄 สติกเกอร์</button></div>`)}
	window.koPhoto=async()=>{if(!currentChat)return;const mid=currentChat;const d=await pickImg(false);if(!d)return;const s=K().sock();if(!s||!s.connected)return toast('❌ ส่งรูปไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');s.emit('msg',{mid,photo:d});toast('🖼️ กำลังส่งรูป…')};
const roomSock=()=>{const s=K().sock();if(!s||!s.connected){toast('❌ ส่งไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');return null}return s};
window.koRoomPhoto=async()=>{const room=typeof currentRoom!=='undefined'&&currentRoom;if(!room)return;const d=await pickImg(false);if(!d)return;const s=roomSock();if(!s)return;s.emit('room:msg',{room,photo:d});toast('📷 กำลังส่งรูป…')};
window.koRoomLoc=()=>{const room=typeof currentRoom!=='undefined'&&currentRoom;if(!room)return;if(!navigator.geolocation)return toast('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');toast('📍 กำลังหาตำแหน่ง…');navigator.geolocation.getCurrentPosition(p=>{const s=roomSock();if(s)s.emit('room:msg',{room,loc:{lat:p.coords.latitude,lng:p.coords.longitude}})},e=>toast(e.code===1?'❌ ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — เปิดสิทธิ์ตำแหน่งในการตั้งค่าเบราว์เซอร์':'หาตำแหน่งไม่ได้ ลองอีกครั้ง'),{enableHighAccuracy:true,timeout:12000})};
window.koSendLoc=()=>{if(!currentChat)return;if(!navigator.geolocation)return toast('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');const mid=currentChat;toast('📍 กำลังหาตำแหน่ง…');
 navigator.geolocation.getCurrentPosition(p=>{const s=K().sock();if(!s||!s.connected)return toast('❌ ส่งตำแหน่งไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');s.emit('msg',{mid,loc:{lat:p.coords.latitude,lng:p.coords.longitude}})},e=>toast(e.code===1?'❌ ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — เปิดสิทธิ์ตำแหน่งในการตั้งค่าเบราว์เซอร์':'หาตำแหน่งไม่ได้ ลองอีกครั้ง'),{enableHighAccuracy:true,timeout:12000})};
window.koMsgMenu=i=>{const c=K().chats[currentChat],m=c&&c.msgs[i];if(!m||m.from!=='me'||m.deleted)return;if(!m.id)return toast('กำลังส่ง… ลองอีกครั้ง');
 sheet(`<h3>ข้อความของคุณ</h3><div class="ko-grp"><button class="ko-li ko-danger" id="koUns"><span>↩️</span><b>ยกเลิกการส่ง (ลบทั้งสองฝ่าย)</b><i></i></button>${m.raw&&!/^\[\[/.test(m.raw)&&!m.text.includes('<img')?`<button class="ko-li" onclick="navigator.clipboard&&navigator.clipboard.writeText(${esc(JSON.stringify(m.raw))});koClose();"><span>📋</span><b>คัดลอก</b><i></i></button>`:''}</div>`);
 $('koUns').onclick=()=>{K().sock().emit('unsend',{mid:currentChat,id:m.id});closeSheet()}};
const MUTE=()=>JSON.parse(localStorage.kt_mute||'{}');
window.koChatMenu=()=>{const c=K().chats[currentChat];if(!c)return;const mu=MUTE()[currentChat];
 sheet(`<div class="ko-row" style="margin-bottom:8px">${avEl(findU(c.uid)||{id:c.uid,avatar:'🙂'})}<h3 style="margin:0">${c.name}</h3></div><div class="ko-grp">
 <button class="ko-li" onclick="koClose();koProfile('${c.uid}')"><span>👤</span><b>ดูโปรไฟล์</b><i>›</i></button>
 <button class="ko-li" onclick="koMute()"><span>${mu?'🔔':'🔕'}</span><b>${mu?'เปิดการแจ้งเตือน':'ปิดการแจ้งเตือนแชทนี้'}</b><i></i></button>
 <button class="ko-li" onclick="koClear()"><span>🧹</span><b>ล้างแชท (เฉพาะฝั่งคุณ)</b><i></i></button>
 ${c.official?'':`<button class="ko-li" onclick="koClose();koUnmatch()"><span>💔</span><b>ยกเลิกแมตช์ ${ME().premium?'':'👑'}</b><i></i></button>
 <button class="ko-li ko-danger" onclick="koBlock('${c.uid}')"><span>🚫</span><b>บล็อก</b><i></i></button>
 <button class="ko-li ko-danger" onclick="koClose();openReportModal('${c.uid}')"><span>🚩</span><b>รายงาน</b><i></i></button>`}</div>`)};
window.koMute=()=>{const m=MUTE();m[currentChat]?delete m[currentChat]:m[currentChat]=1;localStorage.kt_mute=JSON.stringify(m);closeSheet();toast(m[currentChat]?'🔕 ปิดการแจ้งเตือนแชทนี้แล้ว':'🔔 เปิดการแจ้งเตือนแล้ว')};
window.koClear=async()=>{if(!confirm('ล้างข้อความทั้งหมดในแชทนี้ (เฉพาะฝั่งคุณ)?'))return;try{await A('chat/clear',{mid:currentChat});K().chats[currentChat].msgs.length=0;closeSheet();renderMessages();toast('🧹 ล้างแชทแล้ว')}catch(e){err(e)}};
window.koBlock=async uid=>{if(!confirm('บล็อกผู้ใช้นี้? จะไม่เห็นและส่งข้อความหากันได้'))return;try{await A('block',{id:uid});closeSheet();toast('🚫 บล็อกแล้ว');window.ktBackToList&&ktBackToList();await K().loadChats()}catch(e){err(e)}};
const mb=[...document.querySelectorAll('#pageChatWin .cw-actions .cw-btn')].find(b=>/openReportModal/.test(b.getAttribute('onclick')||''));if(mb){mb.setAttribute('onclick','koChatMenu()');mb.id='koMenuBtn';mb.title='เมนู'}
const _st=window.showToast;if(_st)window.showToast=function(t){const m=MUTE();for(const k in m){const c=K().chats[k];if(c&&typeof t==='string'&&t.startsWith('💬 ข้อความใหม่จาก')&&t.includes(c.name))return}return _st.apply(this,arguments)};
addEventListener('kt:sock',e=>e.detail.on('unsend',({mid,id})=>{const c=K().chats[mid];if(!c)return;const m=c.msgs.find(x=>x.id===id);if(m){m.deleted=true;m.text=K().fmtM({deleted:true});m.raw=''}if(currentChat===mid)renderMessages()}));
async function chatCard(){const c=K().chats[currentChat],box=$('cwMessages');if(!c||!box||box.querySelector('.ko-pcard'))return;let u=findU(c.uid);if(!u){try{u=await A('user/'+c.uid);UC[c.uid]=u}catch(e){return}}if(!K().chats[currentChat]||K().chats[currentChat].uid!==u.id||box.querySelector('.ko-pcard'))return;
 const d=document.createElement('div');d.className='ko-pcard';d.onclick=()=>koProfile(u.id);const P=pics(u);d.innerHTML=`${P[0]?`<div class="ko-pc-ph" style="background-image:url('${esc(TH(P[0],400))}')"></div>`:`<div class="ko-pc-ph ko-tbg-e" style="background:${gr(u.id)}">${esc(u.avatar||'🙂')}</div>`}<div class="ko-pc-i"><b>${esc(u.name)}${u.age?', '+u.age:''} ${vb(u)}</b><div class="ko-chips">${chips(u)}</div><small>${esc(u.bio||'')}</small><span class="ko-sub">${u.official?'บัญชีทางการของ Kuy Talk':'คุณแมตช์กันแล้ว ทักทายเลย 👋 · แตะเพื่อดูโปรไฟล์'}</span></div>`;box.prepend(d)}
const _rm2=window.renderMessages;window.renderMessages=function(){_rm2.apply(this,arguments);const c=K().chats[currentChat];if(!c)return;const rows=[...$('cwMessages').querySelectorAll('.msg-row')];
 rows.forEach((r,i)=>{const m=c.msgs[i];if(!m||m.from!=='me'||m.deleted)return;let t=null;r.addEventListener('contextmenu',e=>{e.preventDefault();koMsgMenu(i)});
  r.addEventListener('pointerdown',e=>{if(e.target.closest('a'))return;t=setTimeout(()=>{t=null;koMsgMenu(i)},550)});['pointerup','pointerleave','pointercancel','pointermove'].forEach(ev=>r.addEventListener(ev,e=>{if(ev==='pointermove'&&Math.abs(e.movementY)<4)return;clearTimeout(t)}))});
 chatCard()};
addEventListener('kt:sock',e=>{const s=e.detail;
 s.on('read',({mid,ts})=>{const c=K().chats[mid];if(c){c.peerRead=ts;if(currentChat===mid)renderMessages()}});
 s.on('unmatch',()=>K().loadChats());
 s.on('crush',d=>{toast('💎 มีคนส่ง Crush ให้คุณ!');updLikesBadge()});
 s.on('compliment',d=>{toast('💬 มีคนส่งคำชมให้คุณ!');updLikesBadge()});
 s.on('coins',()=>K().refresh().catch(()=>{}))});
addEventListener('kt:loaded',()=>{updLikesBadge();if(!window._ktFirst){window._ktFirst=1;if(currentPage==='chat'){try{if(typeof currentChat!=='undefined')currentChat=null}catch(e){}switchPage('nearby',$('nav-nearby'))}}});
setInterval(()=>{if(document.visibilityState==='visible'&&K().me())updLikesBadge()},45000);
})();
