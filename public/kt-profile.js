// Kuy Talk – rich profile editor (9 photos, bio, prompts, favourites, lifestyle), discovery settings, rich profile view
(function(){
const $=id=>document.getElementById(id),K=()=>window.KT,A=(...a)=>K().api(...a),ME=()=>K().me();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>window.showToast?showToast(m):alert(m);
const PF=()=>window.KTPF||{F:{},PROMPTS:{},MOVIES:[],MAXP:9};
const CP=()=>{try{return currentPage}catch(e){return null}};const ORIG_EDIT=window.koEdit;
const setMe=m=>{K().setMe(m)};
const GR=['linear-gradient(135deg,#f59e0b,#ef4444)','linear-gradient(135deg,#8b5cf6,#ec4899)','linear-gradient(135deg,#06b6d4,#3b82f6)','linear-gradient(135deg,#10b981,#14b8a6)'];
const gr=id=>GR[parseInt(String(id||'0').slice(0,4),16)%GR.length||0];
const isImg=a=>/^data:image\/|^\/|^https?:/.test(a||'');
const pics=u=>{const p=(u.photos||[]).slice();if(!p.length&&isImg(u.avatar))p.push(u.avatar);return p};
// full-screen page layer
function page(title,html,onBack){let d=$('kpPage');if(!d){d=document.createElement('div');d.id='kpPage';d.className='kp-page';document.body.appendChild(d)}
 d.innerHTML=`<div class="kp-hd"><button class="kp-back" aria-label="กลับ">‹</button><b>${title}</b><span></span></div><div class="kp-body">${html}</div>`;d.querySelector('.kp-back').onclick=onBack||closePage;d.classList.add('on');d.querySelector('.kp-body').scrollTop=0;return d}
function closePage(){const d=$('kpPage');if(d)d.remove();if(CP()==='me')switchPage('me',$('nav-profile'))}window.kpClose=closePage;
// image compress ~1080 long edge, JPEG
const pick=()=>new Promise(res=>{const f=document.createElement('input');f.type='file';f.accept='image/jpeg,image/png,image/webp,image/*';f.style.cssText='position:fixed;left:-9999px;opacity:0';document.body.appendChild(f);
 f.onchange=async()=>{const file=f.files[0];f.remove();if(!file)return res(null);
  if(/heic|heif/i.test(file.type+file.name)&&!/jpe?g|png|webp/i.test(file.type))toast('⏳ กำลังแปลงไฟล์ HEIC…');
  let src;try{src=await createImageBitmap(file)}catch(e){src=await new Promise(r=>{const im=new Image();im.onload=()=>r(im);im.onerror=()=>r(null);im.src=URL.createObjectURL(file)})}
  if(!src){toast('❌ เปิดไฟล์รูปนี้ไม่ได้ กรุณาเลือกรูป JPG หรือ PNG');return res(null)}
  const W=src.width,H=src.height;let q=.85,mx=1280,out='';for(let t=0;t<6;t++){const sc=Math.min(1,mx/Math.max(W,H)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(W*sc));c.height=Math.max(1,Math.round(H*sc));const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(src,0,0,c.width,c.height);out=c.toDataURL('image/jpeg',q);if(out.length<450000&&/^data:image\/jpeg/.test(out))break;mx*=.8;q=Math.max(.6,q-.07)}
  if(!/^data:image\/jpeg/.test(out)||out.length>650000){toast('❌ ย่อรูปไม่สำเร็จ ลองเลือกรูปอื่น');return res(null)}res(out)};f.click()});
window.ktPickImg=()=>pick();const upErr=e=>{const s=String(e&&e.message||e);toast('❌ บันทึกรูปไม่สำเร็จ: '+(/fetch|network|Failed/i.test(s)?'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง':s))};
// ---------- editor ----------
let TAB='edit',D=null;
function draft(){const m=ME(),d=m.details||{};D={bio:m.bio||'',...JSON.parse(JSON.stringify(d))};return D}
window.koEdit=async function(){try{setMe(await A('me'))}catch(e){}draft();TAB='edit';renderEdit()};
function chipsOf(k){const f=PF().F[k],v=D[k];if(!f)return '';return f.multi?(v&&v.length?v.join(', '):''):(v||'')}
const row=(ic,t,val,fn)=>`<button class="kp-row" onclick="${fn}"><span class="kp-ic">${ic}</span><b>${t}</b><i>${val?esc(val):'<em>เพิ่ม</em>'}</i><s>›</s></button>`;
function renderEdit(){const m=ME(),P=m.photos||[],F=PF().F;
 const body=TAB==='prev'?`<div class="kp-prevwrap">${viewHTML({...m,bio:D.bio,details:D},true)}</div>`:`
 <div class="kp-sec"><h4>รูปของฉัน</h4><p class="kp-sub">แตะรูปเพื่อเปลี่ยน/ลบ · กดค้างแล้วลากเพื่อจัดลำดับ · รูปแรกคือรูปหลัก</p>
 <div class="kp-grid">${Array.from({length:PF().MAXP},(_,i)=>P[i]?`<div class="kp-slot" style="background-image:url('${esc(P[i])}')" onclick="kpPhotoMenu(${i})">${i===0?'<span class="kp-main">รูปหลัก</span>':`<span class="kp-n">${i+1}</span>`}<button class="kp-del" onclick="event.stopPropagation();kpDel(${i})" aria-label="ลบ">✕</button></div>`:`<button class="kp-slot kp-add" onclick="kpAdd()" aria-label="เพิ่มรูป"><span>＋</span></button>`).join('')}</div>
 <p class="kp-sub">เพิ่มรูปได้สูงสุด ${PF().MAXP} รูป (${P.length}/${PF().MAXP}) รูปถูกย่อขนาดอัตโนมัติก่อนอัปโหลด</p></div>
 <div class="kp-sec"><h4>ประวัติส่วนตัว <small id="kpBc">${D.bio.length}/500</small></h4><textarea id="kpBio" maxlength="500" placeholder="เล่าเรื่องตัวเองสั้นๆ ให้คนอื่นรู้จัก 🍄">${esc(D.bio)}</textarea>
 <div class="kp-tip"><b>💡 เคล็ดลับ</b><ul><li>บอกสิ่งที่ชอบทำวันหยุด</li><li>ใส่อารมณ์ขันนิดๆ</li><li>ไม่ต้องใส่เบอร์โทรหรือ LINE ID เพื่อความปลอดภัย</li></ul></div></div>
 <div class="kp-sec"><h4>ประโยคชวนรู้จัก <small>${(D.prompts||[]).length}/3</small></h4>${(D.prompts||[]).map((p,i)=>`<div class="kp-prompt" onclick="kpPrompt(${i})"><small>${esc(p.q)}</small><b>${esc(p.a)}</b></div>`).join('')}${(D.prompts||[]).length<3?`<button class="kp-addbtn" onclick="kpPrompt(-1)">＋ เลือกประโยคชวนรู้จัก</button>`:''}</div>
 <div class="kp-sec"><h4>ความสนใจ</h4><div class="kp-chips">${(D.interests||[]).map(x=>`<span>${esc(x)}</span>`).join('')||'<em class="kp-sub">ยังไม่ได้เลือก</em>'}</div><button class="kp-addbtn" onclick="kpPick('interests')">แก้ไขความสนใจ</button></div>
 <div class="kp-sec"><h4>ของโปรด</h4>
  ${row('🎬','หนังที่ชอบ',(D.movies||[]).join(', '),'kpMovies()')}${row('📺','ซีรีส์ที่กำลังดู',D.series,"kpText('series','ซีรีส์ที่กำลังดู',100)")}${row('⚽','ทีมโปรด',D.team,"kpText('team','ทีมโปรด',100)")}${row('🎮','เกมที่เล่น',D.games,"kpText('games','เกมที่เล่น',100)")}${row('🎵','เพลง/ศิลปินที่ชอบ',D.music,"kpText('music','เพลง/ศิลปินที่ชอบ',100)")}</div>
 <div class="kp-sec"><h4>ความสัมพันธ์</h4>${['goal','rel'].map(k=>row(F[k].ic,F[k].t,chipsOf(k),`kpPick('${k}')`)).join('')}</div>
 <div class="kp-sec"><h4>ข้อมูลพื้นฐาน</h4>${row('📏','ส่วนสูง',D.height?D.height+' ซม.':'',"kpText('height','ส่วนสูง (ซม.)',3,1)")}${['langs','zodiac','edu','family','comm','love'].map(k=>row(F[k].ic,F[k].t,chipsOf(k),`kpPick('${k}')`)).join('')}</div>
 <div class="kp-sec"><h4>ไลฟ์สไตล์</h4>${['pets','drink','smoke','exercise'].map(k=>row(F[k].ic,F[k].t,chipsOf(k),`kpPick('${k}')`)).join('')}${row('📸','Instagram',D.social?'@'+D.social:'',"kpText('social','ชื่อผู้ใช้ Instagram',30)")}</div>
 <div class="kp-sec"><h4>งานและการศึกษา</h4>${row('💼','ตำแหน่งงาน',D.job,"kpText('job','ตำแหน่งงาน',50)")}${row('🏢','บริษัท',D.company,"kpText('company','บริษัท',50)")}${row('🏫','สถานศึกษา',D.school,"kpText('school','สถานศึกษา',50)")}</div>
 <div class="kp-sec"><h4>ข้อมูลทั่วไป</h4>${row('👤','ชื่อ เพศ วันเกิด จังหวัด','','kpBasic()')}</div><div style="height:90px"></div>`;
 const d=page('แก้ไขโปรไฟล์',`<div class="kp-tabs"><button class="${TAB==='edit'?'on':''}" onclick="kpTab('edit')">แก้ไข</button><button class="${TAB==='prev'?'on':''}" onclick="kpTab('prev')">ดูตัวอย่าง</button></div>${body}<div class="kp-savebar"><button class="ko-btn" onclick="kpSave()">💾 บันทึก</button></div>`,async()=>{await kpSave(true);closePage()});
 initDrag();const b=$('kpBio');if(b)b.oninput=()=>{D.bio=b.value;$('kpBc').textContent=b.value.length+'/500'}}
window.kpTab=t=>{const b=$('kpBio');if(b)D.bio=b.value;TAB=t;renderEdit()};
let saving=null;window.kpSave=async(silent)=>{const b=$('kpBio');if(b)D.bio=b.value;if(saving)return saving;const btn=document.querySelector('.kp-savebar:not(.kp-inline) .ko-btn');if(btn&&!silent){btn.disabled=true;btn.textContent='⏳ กำลังบันทึก…'}if(!silent)toast('⏳ กำลังบันทึก…');
 saving=(async()=>{try{const body={};for(const [k,v] of Object.entries(D))if(v!==undefined)body[k]=v;const r=await A('profile/details',body);setMe(r);const d=r.details||{};D={bio:r.bio||'',...JSON.parse(JSON.stringify(d))};if(!silent){toast('✅ บันทึกแล้ว');if(TAB==='edit'){const y=(document.querySelector('.ko-page-body,.ko-pg-b')||{}).scrollTop;renderEdit()}}return true}catch(e){toast('❌ บันทึกไม่สำเร็จ: '+(/fetch|Failed|network/i.test(String(e&&e.message||e))?'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง':(e&&e.message||e)));return false}finally{saving=null;if(btn&&btn.isConnected){btn.disabled=false;btn.textContent='💾 บันทึก'}}})();return saving};
const sub=(title,html)=>page(title,html,()=>renderEdit());
window.kpAdd=async()=>{const d=await pick();if(!d)return;toast('⏳ กำลังอัปโหลดรูป…');try{const b=$('kpBio');if(b)D.bio=b.value;setMe(await A('photos',{photo:d}));renderEdit();toast('✅ บันทึกรูปแล้ว')}catch(e){upErr(e)}};
window.kpDel=async i=>{if(!confirm('ลบรูปนี้?'))return;try{setMe(await A('photos/'+i,null,'DELETE'));renderEdit();toast('🗑️ ลบรูปแล้ว')}catch(e){upErr(e)}};
const order=async o=>{try{setMe(await A('photos/order',{order:o}));renderEdit();toast('✅ บันทึกลำดับรูปแล้ว')}catch(e){upErr(e)}};
// long-press + drag reorder (pointer events; works with touch on Android Chrome)
let dragJust=0;const initDrag=()=>{const g=document.querySelector('.kp-grid');if(!g||g._dz)return;g._dz=1;let st=null;
 const slots=()=>[...g.querySelectorAll('.kp-slot:not(.kp-add)')];
 const end=async commit=>{if(!st)return;clearTimeout(st.t);const s=st;st=null;slots().forEach(x=>x.classList.remove('kp-over'));if(!s.on)return;s.el.classList.remove('kp-drag');s.el.style.transform='';dragJust=Date.now();
  if(commit&&s.to!=null&&s.to!==s.from){const o=[...Array(slots().length).keys()];o.splice(s.from,1);o.splice(s.to,0,s.from);toast('⏳ กำลังบันทึกลำดับรูป…');await order(o)}};
 g.addEventListener('pointerdown',e=>{const el=e.target.closest('.kp-slot:not(.kp-add)');if(!el||e.target.closest('.kp-del'))return;const from=slots().indexOf(el);
  st={el,from,to:null,x:e.clientX,y:e.clientY,on:false,id:e.pointerId,t:setTimeout(()=>{if(!st)return;st.on=true;el.classList.add('kp-drag');navigator.vibrate&&navigator.vibrate(30)},e.pointerType==='mouse'?150:350)}});
 g.addEventListener('pointermove',e=>{if(!st||e.pointerId!==st.id)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;if(!st.on){if(Math.hypot(dx,dy)>10){clearTimeout(st.t);st=null}return}
  st.el.style.transform=`translate(${dx}px,${dy}px) scale(1.06)`;const ss=slots();let to=null;ss.forEach((x,k)=>{const r=x.getBoundingClientRect();const hit=x!==st.el&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;x.classList.toggle('kp-over',hit);if(hit)to=k});st.to=to});
 g.addEventListener('touchmove',e=>{if(st&&st.on)e.preventDefault()},{passive:false});
 g.addEventListener('pointerup',()=>end(true));g.addEventListener('pointercancel',()=>{if(st&&st.on)return;end(false)});
 g.addEventListener('contextmenu',e=>{if(e.target.closest('.kp-slot'))e.preventDefault()});
 g.addEventListener('click',e=>{if(Date.now()-dragJust<400){e.stopPropagation();e.preventDefault()}},true)};
window.kpPhotoMenu=i=>{const n=(ME().photos||[]).length;window.koClose&&koClose();const s=document.createElement('div');s.id='koSheet';s.className='ko-sheet-bg on';
 s.innerHTML=`<div class="ko-sheet" style="z-index:3001"><div class="ko-sheet-in"><h3>รูปที่ ${i+1}</h3><div class="ko-grp">${i?`<button class="ko-li" data-a="main"><span>⭐</span><b>ตั้งเป็นรูปหลัก</b><i></i></button><button class="ko-li" data-a="up"><span>⬅️</span><b>เลื่อนไปข้างหน้า</b><i></i></button>`:''}${i<n-1?`<button class="ko-li" data-a="down"><span>➡️</span><b>เลื่อนไปข้างหลัง</b><i></i></button>`:''}<button class="ko-li" data-a="rep"><span>🔄</span><b>เปลี่ยนรูป</b><i></i></button><button class="ko-li ko-danger" data-a="del"><span>🗑️</span><b>ลบรูป</b><i></i></button></div></div></div>`;
 s.onclick=async e=>{const a=e.target.closest('[data-a]');s.remove();if(!a)return;const o=[...Array(n).keys()];
  if(a.dataset.a==='main'){o.splice(i,1);o.unshift(i);order(o)}else if(a.dataset.a==='up'){[o[i-1],o[i]]=[o[i],o[i-1]];order(o)}else if(a.dataset.a==='down'){[o[i+1],o[i]]=[o[i],o[i+1]];order(o)}
  else if(a.dataset.a==='del')kpDel(i);else{const d=await pick();if(!d)return;toast('⏳ กำลังอัปโหลดรูป…');try{setMe(await A('photos',{photo:d,at:i}));renderEdit();toast('✅ เปลี่ยนรูปแล้ว')}catch(x){upErr(x)}}};document.body.appendChild(s)};
window.kpPick=k=>{const f=PF().F[k],multi=f.multi;let sel=multi?[...(D[k]||[])]:D[k];
 const draw=()=>sub(f.ic+' '+f.t,`<p class="kp-sub">${multi?`เลือกได้สูงสุด ${multi} อย่าง (${sel.length}/${multi})`:'เลือก 1 อย่าง'}</p><div class="kp-opts">${f.o.map(o=>`<button class="${(multi?sel.includes(o):sel===o)?'on':''}" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>
  <div class="kp-savebar"><button class="ko-btn" id="kpOk">ตกลง</button>${multi?'':'<button class="ko-link" id="kpClr">ไม่ระบุ</button>'}</div>`);
 draw();const bind=()=>{document.querySelectorAll('.kp-opts button').forEach(b=>b.onclick=()=>{const o=b.dataset.o;if(multi){if(sel.includes(o))sel=sel.filter(x=>x!==o);else if(sel.length<multi)sel.push(o);else return toast('เลือกได้สูงสุด '+multi)}else sel=sel===o?null:o;draw();bind()});
  $('kpOk').onclick=()=>{D[k]=sel;renderEdit()};if($('kpClr'))$('kpClr').onclick=()=>{D[k]=null;renderEdit()}};bind()};
window.kpText=(k,t,max,num)=>{sub(t,`<input id="kpT" ${num?'type="number" inputmode="numeric" min="120" max="230"':''} maxlength="${max}" value="${esc(D[k]??'')}" placeholder="${esc(t)}"><div class="kp-savebar"><button class="ko-btn" id="kpOk">ตกลง</button></div>`);const i=$('kpT');i.focus();$('kpOk').onclick=()=>{D[k]=num?(+i.value||null):i.value.trim().replace(k==='social'?/^@/:/$^/,'');renderEdit()}};
window.kpMovies=()=>{let sel=[...(D.movies||[])],q='';const all=PF().MOVIES;
 const draw=()=>{const L=all.filter(x=>!q||x.toLowerCase().includes(q.toLowerCase()));sub('🎬 หนังที่ชอบ',`<p class="kp-sub">เลือกได้สูงสุด 6 เรื่อง (${sel.length}/6)</p><input id="kpMq" placeholder="🔍 ค้นหาหรือพิมพ์ชื่อหนัง" value="${esc(q)}">
  <div class="kp-chips kp-sel">${sel.map(x=>`<span data-r="${esc(x)}">🎬 ${esc(x)} ✕</span>`).join('')}</div>
  <div class="kp-movies">${q&&!all.some(x=>x===q)?`<button data-m="${esc(q)}">➕ เพิ่ม “${esc(q)}”</button>`:''}${L.map(x=>`<button data-m="${esc(x)}" class="${sel.includes(x)?'on':''}">🎞️ ${esc(x)}</button>`).join('')}</div><div class="kp-savebar"><button class="ko-btn" id="kpOk">ตกลง</button></div>`);
  const i=$('kpMq');i.oninput=()=>{q=i.value;const p=i.selectionStart;draw();const j=$('kpMq');j.focus();j.setSelectionRange(p,p)};
  document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{const m=b.dataset.m.slice(0,40);if(sel.includes(m))sel=sel.filter(x=>x!==m);else if(sel.length<6)sel.push(m);else return toast('เลือกได้สูงสุด 6 เรื่อง');q='';draw()});
  document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{sel=sel.filter(x=>x!==b.dataset.r);draw()});$('kpOk').onclick=()=>{D.movies=sel;renderEdit()}};draw()};
window.kpPrompt=i=>{const P=PF().PROMPTS,cats=Object.keys(P);let cat=cats[0];const cur=i>=0?D.prompts[i]:null;
 const ans=q=>{sub('ประโยคชวนรู้จัก',`<div class="kp-prompt"><small>${esc(q)}</small></div><textarea id="kpPa" maxlength="150" placeholder="เขียนคำตอบของคุณ…">${esc(cur&&cur.q===q?cur.a:'')}</textarea><p class="kp-sub" id="kpPc"></p><div class="kp-savebar"><button class="ko-btn" id="kpOk">ตกลง</button>${i>=0?'<button class="ko-link" id="kpRm">ลบประโยคนี้</button>':''}</div>`);
  const t=$('kpPa'),c=()=>$('kpPc').textContent=t.value.length+'/150';c();t.oninput=c;t.focus();
  $('kpOk').onclick=()=>{const a=t.value.trim();if(!a)return toast('กรุณาเขียนคำตอบ');D.prompts=D.prompts||[];if(i>=0)D.prompts[i]={q,a};else D.prompts.push({q,a});renderEdit()};if($('kpRm'))$('kpRm').onclick=()=>{D.prompts.splice(i,1);renderEdit()}};
 const draw=()=>{sub('เลือกประโยคชวนรู้จัก',`<div class="kp-cats">${cats.map(c=>`<button class="${c===cat?'on':''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div><div class="kp-plist">${P[cat].map(q=>`<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`);
  document.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{cat=b.dataset.c;draw()});document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>ans(b.dataset.q))};
 if(cur)ans(cur.q);else draw()};
window.kpBasic=async()=>{await kpSave(true);closePage();window.koEditBasic&&koEditBasic()};
// ---------- rich view ----------
const unit=()=>(ME()&&ME().prefs||{}).unit==='mi';
const distTxt=u=>u.dist!=null?(unit()?(u.dist*0.621).toFixed(1)+' ไมล์':u.dist+' km'):'';
function viewHTML(u,preview){const P=pics(u),d=u.details||{},F=PF().F;const ch=(arr)=>arr.filter(Boolean).map(x=>`<span>${x}</span>`).join('');
 const basics=ch([d.height&&'📏 '+d.height+' ซม.',...['zodiac','edu','family','comm','love'].map(k=>d[k]&&F[k].ic+' '+esc(d[k])),...(d.langs||[]).map(x=>'🗣️ '+esc(x))]);
 const life=ch(['pets','drink','smoke','exercise'].map(k=>d[k]&&F[k].ic+' '+esc(d[k])));
 return `<div class="kp-view"><div class="kp-car" data-p="0">${P.length?P.map((p,j)=>`<div class="kp-cimg${j?'':' on'}" style="background-image:url('${esc(p)}')"></div>`).join(''):`<div class="kp-cimg on kp-ce" style="background:${gr(u.id)}">${esc(u.avatar||'🙂')}</div>`}
 ${P.length>1?`<div class="kp-cdots">${P.map((_,j)=>`<i class="${j?'':'on'}"></i>`).join('')}</div>`:''}<div class="kp-cov"><h2>${esc(u.name)} <span>${u.age||''}</span>${u.verified?' <span class="kt-vb">✔</span>':''}</h2>
 ${d.job||d.company?`<div>💼 ${esc([d.job,d.company].filter(Boolean).join(' · '))}</div>`:''}${d.school?`<div>🏫 ${esc(d.school)}</div>`:''}${u.provinceName?`<div>📍 ${esc(u.provinceName)}${distTxt(u)?' · '+distTxt(u):''}</div>`:''}</div></div>
 <div class="kp-vb">${d.goal?`<div class="kp-card"><small>💘 เป้าหมายการเดท</small><b>${esc(d.goal)}</b>${d.rel?`<div class="kp-sub">🔍 ${esc(d.rel)}</div>`:''}</div>`:''}
 ${u.bio?`<div class="kp-card"><small>เกี่ยวกับฉัน</small><p>${esc(u.bio)}</p></div>`:''}
 ${(d.prompts||[]).map(p=>`<div class="kp-card kp-pc"><small>${esc(p.q)}</small><b>${esc(p.a)}</b></div>`).join('')}
 ${basics?`<div class="kp-card"><small>ข้อมูลพื้นฐาน</small><div class="kp-chips">${basics}</div></div>`:''}
 ${life?`<div class="kp-card"><small>ไลฟ์สไตล์</small><div class="kp-chips">${life}</div></div>`:''}
 ${(d.interests||[]).length?`<div class="kp-card"><small>ความสนใจ</small><div class="kp-chips">${d.interests.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`:''}
 ${(d.movies||[]).length||d.series||d.team||d.games||d.music?`<div class="kp-card"><small>ของโปรด</small><div class="kp-chips">${ch([...(d.movies||[]).map(x=>'🎬 '+esc(x)),d.series&&'📺 '+esc(d.series),d.team&&'⚽ '+esc(d.team),d.games&&'🎮 '+esc(d.games),d.music&&'🎵 '+esc(d.music)])}</div></div>`:''}
 ${d.social?`<div class="kp-card"><small>Instagram</small><b>📸 @${esc(d.social)}</b></div>`:''}
 ${preview||u.official?'':`<div class="kp-acts"><button class="ko-btn" onclick="kpClose();koQuick('${u.id}','right')">❤ ถูกใจ</button><button class="ko-btn ko-pink" onclick="kpClose();koQuick('${u.id}','right',1)">💎 Crush</button><button class="ko-btn ko-ghost" onclick="kpClose();koCompliment('${u.id}')">💬 ชม</button></div>
 <button class="ko-link" onclick="kpClose();openReportModal('${u.id}')">🚩 รายงาน / บล็อก ${esc(u.name)}</button>`}</div></div>`}
document.addEventListener('click',e=>{const c=e.target.closest('.kp-car');if(!c)return;const im=c.querySelectorAll('.kp-cimg');if(im.length<2)return;const r=c.getBoundingClientRect();let p=+c.dataset.p;p=e.clientX<r.left+r.width/2?Math.max(0,p-1):Math.min(im.length-1,p+1);c.dataset.p=p;im.forEach((x,j)=>x.classList.toggle('on',j===p));c.querySelectorAll('.kp-cdots i').forEach((x,j)=>x.classList.toggle('on',j===p))});
window.koProfile=async function(id){let u;try{u=await A('user/'+id)}catch(e){return toast(e)}A('visit',{id}).catch(()=>{});window.koClose&&koClose();page(esc(u.name),viewHTML(u))};
// ---------- settings ----------
window.koDiscovery=async function(){try{setMe(await A('me'))}catch(e){}const m=ME(),f=m.filters||{},p=m.prefs||{};const mi=p.unit==='mi',dist=f.maxDist||160;
 const tg=(id,t,sub2,on)=>`<label class="kp-tg"><div><b>${t}</b>${sub2?`<small>${sub2}</small>`:''}</div><input type="checkbox" id="${id}" ${on?'checked':''}></label>`;
 page('การตั้งค่า',`
 <div class="kp-sec"><h4>การตั้งค่าบัญชี</h4><div class="kp-row"><span class="kp-ic">📱</span><b>หมายเลขโทรศัพท์</b><i>${esc(m.phone||'ยังไม่ผูกเบอร์')}</i></div></div>
 <div class="kp-sec"><h4>การค้นหา</h4>
  <button class="kp-row" onclick="kpLoc()"><span class="kp-ic">📍</span><b>ตำแหน่ง</b><i>${esc((m.geo&&!m.geo.paused&&(m.geo.district||m.geo.provinceName))||m.provinceName||'ยังไม่ตั้ง')}</i><s>›</s></button>
  <div class="kp-sl"><div class="kp-slh"><b>ระยะทางสูงสุด</b><span id="kpDv"></span></div><input type="range" id="kpDist" min="1" max="160" value="${dist}"></div>
  ${tg('kpOut','แสดงคนที่อยู่ไกลกว่านี้เมื่อคนใกล้ๆ หมด','',f.outside)}
  <div class="kp-sl"><b>สนใจใน</b><div class="ko-seg" id="kpG">${[['f','ผู้หญิง'],['m','ผู้ชาย'],['','ทุกคน']].map(([v,t])=>`<button data-v="${v}" class="${(f.gender||'')===v?'on':''}">${t}</button>`).join('')}</div></div>
  <div class="kp-sl"><div class="kp-slh"><b>ช่วงอายุ</b><span id="kpAv"></span></div><div class="kp-dual"><input type="range" id="kpA1" min="18" max="99" value="${f.ageMin||18}"><input type="range" id="kpA2" min="18" max="99" value="${f.ageMax||99}"></div></div>
  <div class="kp-sl"><div class="kp-slh"><b>จำนวนรูปขั้นต่ำ</b><span id="kpMv"></span></div><input type="range" id="kpMin" min="1" max="9" value="${f.minPhotos||1}"></div>
  ${tg('kpBioF','มีประวัติส่วนตัว','แสดงเฉพาะคนที่เขียนประวัติส่วนตัว',f.hasBio)}</div>
 <div class="kp-sec"><h4>การควบคุมการมองเห็น</h4>
  <label class="kp-tg"><div><b>มาตรฐาน</b><small>ทุกคนในการค้นหาเห็นโปรไฟล์คุณได้</small></div><input type="radio" name="kpVis" value="std" ${p.visibility!=='incog'?'checked':''}></label>
  <label class="kp-tg"><div><b>โหมดไม่ระบุตัวตน 👑</b><small>เฉพาะคนที่คุณกดถูกใจเท่านั้นที่จะเห็นคุณ (Premium)</small></div><input type="radio" name="kpVis" value="incog" ${p.visibility==='incog'?'checked':''}></label>
  ${tg('kpDisc','เปิดการค้นหา (Discovery)','ปิดแล้วโปรไฟล์จะไม่แสดงในการ์ดและหน้าใกล้เคียง แต่ยังแชทกับแมตช์เดิมได้',p.discovery!==false)}
  ${tg('kpVer','รับข้อความเฉพาะคนที่ยืนยันรูปแล้ว ✔','',p.verifiedOnly)}</div>
 <div class="kp-sec"><h4>หน่วยระยะทาง</h4><div class="ko-seg" id="kpU"><button data-v="km" class="${mi?'':'on'}">กม.</button><button data-v="mi" class="${mi?'on':''}">ไมล์</button></div></div>
 <div class="kp-savebar kp-inline"><button class="ko-btn" id="kpDS">💾 บันทึกการค้นหา</button></div>
 <div class="kp-sec"><h4>ความปลอดภัย</h4><button class="kp-row" onclick="kpBlocks()"><span class="kp-ic">🚫</span><b>รายชื่อที่บล็อก</b><s>›</s></button></div>
 <div class="kp-sec"><h4>การแจ้งเตือน</h4>${[['notif','การแจ้งเตือนในแอป'],['notifMsg','ข้อความใหม่'],['notifLike','ไลก์ / Crush / คำชม']].map(([k,t])=>`<label class="kp-tg"><div><b>${t}</b></div><input type="checkbox" ${p[k]!==false?'checked':''} onchange="koPref('${k}',this.checked)"></label>`).join('')}</div>
 <div class="kp-sec"><h4>ช่วยเหลือและกฎหมาย</h4><button class="kp-row" onclick="kpClose();koHelp()"><span class="kp-ic">❓</span><b>ศูนย์ช่วยเหลือ / แจ้งปัญหา</b><s>›</s></button><button class="kp-row" onclick="kpClose();koTeam()"><span class="kp-ic">💬</span><b>ติดต่อทีมงาน</b><s>›</s></button>
  <a class="kp-row" href="/legal/community.html" target="_blank"><span class="kp-ic">📜</span><b>แนวทางชุมชน</b><s>↗</s></a><a class="kp-row" href="/legal/privacy.html" target="_blank"><span class="kp-ic">🔒</span><b>นโยบายความเป็นส่วนตัว (PDPA)</b><s>↗</s></a><a class="kp-row" href="/legal/terms.html" target="_blank"><span class="kp-ic">📄</span><b>ข้อกำหนดการใช้งาน</b><s>↗</s></a>
  <button class="kp-row" onclick="kpClose();koSettingsOld()"><span class="kp-ic">⚙️</span><b>การตั้งค่าอื่นๆ</b><s>›</s></button></div>
 <div class="kp-sec"><button class="kp-row kp-c" onclick="koLogout()"><b>ออกจากระบบ</b></button><button class="kp-row kp-c kp-danger" onclick="koDelete()"><b>ลบบัญชี</b></button><p class="kp-sub" style="text-align:center">การลบบัญชีจะลบโปรไฟล์ รูป แชท และข้อมูลส่วนบุคคลทั้งหมดตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)</p></div><div style="height:40px"></div>`);
 const U=()=>document.querySelector('#kpU .on').dataset.v==='mi',upd=()=>{const dv=+$('kpDist').value;$('kpDv').textContent=U()?Math.round(dv*.621)+' ไมล์':dv+' กม.';let a=+$('kpA1').value,b=+$('kpA2').value;$('kpAv').textContent=Math.min(a,b)+' – '+Math.max(a,b)+(Math.max(a,b)>=99?'+':'');$('kpMv').textContent=$('kpMin').value+' รูป'};
 ['kpDist','kpA1','kpA2','kpMin'].forEach(i=>$(i).oninput=upd);['kpG','kpU'].forEach(g=>document.querySelectorAll('#'+g+' button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#'+g+' button').forEach(x=>x.classList.remove('on'));b.classList.add('on');upd()}));upd();
 $('kpDS').onclick=async()=>{const a=+$('kpA1').value,b=+$('kpA2').value;const vis=document.querySelector('input[name=kpVis]:checked').value;
  try{setMe(await A('discovery',{maxDist:+$('kpDist').value>=160?null:+$('kpDist').value,outside:$('kpOut').checked,gender:document.querySelector('#kpG .on').dataset.v,ageMin:Math.min(a,b),ageMax:Math.max(a,b)>=99?null:Math.max(a,b),minPhotos:+$('kpMin').value>1?+$('kpMin').value:0,hasBio:$('kpBioF').checked,visibility:vis,discovery:$('kpDisc').checked,verifiedOnly:$('kpVer').checked,unit:U()?'mi':'km'}));toast('บันทึกการตั้งค่าแล้ว ✅')}
  catch(e){const s=String(e);if(/Premium/.test(s)){document.querySelector('input[name=kpVis][value=std]').checked=true;toast('👑 '+s)}else toast(s)}}};
window.kpLoc=()=>{kpClose();if(window.ktGeoOpen)ktGeoOpen();else switchPage('nearby',$('nav-nearby'))};
window.kpBlocks=async()=>{let L=[];try{L=await A('blocks')}catch(e){}page('รายชื่อที่บล็อก',L.length?L.map(u=>`<div class="kp-row"><span class="kp-ic">🚫</span><b>${esc(u.name)}</b><button class="ko-btn ko-sm ko-ghost" onclick="kpUnb('${u.id}')">เลิกบล็อก</button></div>`).join(''):'<p class="kp-sub" style="padding:20px;text-align:center">ยังไม่มีรายชื่อที่บล็อก</p>',()=>koDiscovery())};
window.kpUnb=async id=>{try{await A('unblock',{id});toast('เลิกบล็อกแล้ว');kpBlocks()}catch(e){toast(e)}};
// hook into existing settings/edit
window.koSettingsOld=window.koSettings;window.koSettings=()=>{window.koClose&&koClose();koDiscovery()};
window.koEditBasic=ORIG_EDIT;
const _opd=window.openProfileDrawer;window.openProfileDrawer=function(id){if(id&&typeof id==='string'&&!/^locked/.test(id)&&/^[a-f0-9]{8,}$/.test(id))return koProfile(id);return _opd&&_opd.apply(this,arguments)};
})();
// nav: profile tab in main row, swipe ⚙️ → new settings, me-page shortcuts, kill stale SW caches
(function(){const $=id=>document.getElementById(id);
 const np=$('nav-profile'),nm=$('nav-moments');if(np&&nm){nm.after(np);np.innerHTML='<span style="font-size:18px">👤</span><span>โปรไฟล์</span>';np.setAttribute('onclick',"switchPage('me',this)")}
 window.koFilters=()=>{window.koClose&&koClose();koDiscovery()};
 const sp=window.switchPage;window.switchPage=function(n,nav){const r=sp.apply(this,arguments);if(n==='me'){const pg=$('pageMe');const add=()=>{if(!pg.querySelector('.kp-short')){const top=pg.querySelector('.ko-mecard');if(!top)return setTimeout(add,100);top.insertAdjacentHTML('afterend',`<div class="kp-short"><button onclick="koEdit()"><b>📷</b>รูป & ข้อมูล</button><button onclick="koSettings()"><b>⚙️</b>ตั้งค่า</button><button onclick="switchPage('friends',document.getElementById('nav-friends'))"><b>👥</b>เพื่อน</button><button onclick="switchPage('sub',document.getElementById('nav-sub'))"><b>👑</b>Premium</button></div>`);const av=top.querySelector('.ko-ring');if(av){av.style.cursor='pointer';av.onclick=()=>koEdit()}}};add()}return r};
 if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(R=>R.forEach(r=>r.unregister())).catch(()=>{});
 if(window.caches)caches.keys().then(K=>K.forEach(k=>caches.delete(k))).catch(()=>{});
})();
