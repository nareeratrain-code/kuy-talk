// Kuy Talk UI: DOB selects, nav tap animations, avatar fallback on nearby cards
(function(){
const TH=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
window.ktInitDob=function(d,m,y,hidden,onChange){if(!d||!m||!y)return;const now=new Date(),maxY=now.getFullYear()-18;
 TH.forEach((n,i)=>m.add(new Option(n,i+1)));for(let Y=maxY;Y>=1940;Y--)y.add(new Option(`${Y} (พ.ศ. ${Y+543})`,Y));
 const days=()=>{const Y=+y.value||2000,M=+m.value||1,n=new Date(Y,M,0).getDate(),cur=+d.value;d.length=1;for(let i=1;i<=n;i++)d.add(new Option(i,i));if(cur)d.value=Math.min(cur,n)};
 const upd=()=>{days();const ok=d.value&&m.value&&y.value;hidden&&(hidden.value=ok?`${y.value}-${String(m.value).padStart(2,'0')}-${String(d.value).padStart(2,'0')}`:'');[d,m,y].forEach(s=>s.classList.remove('bad'));onChange&&onChange()};
 [d,m,y].forEach(s=>s.addEventListener('change',upd));days()};
window.ktAgeOf=v=>{if(!v)return null;const [Y,M,D]=v.split('-').map(Number),t=new Date();let a=t.getFullYear()-Y;if(t.getMonth()+1<M||(t.getMonth()+1===M&&t.getDate()<D))a--;return a};
const $=id=>document.getElementById(id);
if($('ktDob')){ktInitDob($('dobD'),$('dobM'),$('dobY'),$('dobInput'),()=>{const e=$('ageError');if(e)e.textContent=''});
 // clearer Thai errors before original check runs
 const f=window.checkAge;window.checkAge=function(){const h=$('dobInput'),e=$('ageError');
  if(!h.value){const miss=[['dobD','วัน'],['dobM','เดือน'],['dobY','ปี']].filter(([i])=>!$(i).value);miss.forEach(([i])=>$(i).classList.add('bad'));
   if(miss.length){e.textContent='กรุณาเลือก '+miss.map(x=>x[1]).join(' / ')+' เกิดให้ครบ';return}}
  const a=ktAgeOf(h.value);if(a!==null&&a<18){e.textContent=`⚠️ คุณอายุ ${a} ปี — ต้องมีอายุ 18 ปีขึ้นไปจึงจะใช้งานได้`;return}
  return f.apply(this,arguments)}}
// nav tap animation (instant on pointerdown)
const sel='.nav-icon, nav button';
const tap=t=>{if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;const all=[...document.querySelectorAll(sel)];t.classList.remove('kt-tap','v1','v2','v3');void t.offsetWidth;const v=all.indexOf(t)%4;t.classList.add('kt-tap');if(v)t.classList.add('v'+v);clearTimeout(t._kt);t._kt=setTimeout(()=>t.classList.remove('kt-tap','v1','v2','v3'),650)};
document.addEventListener('pointerdown',e=>{const t=e.target.closest(sel);if(t)tap(t)},{passive:true});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest)(t=>t&&tap(t))(e.target.closest(sel))});
// avatar fallback for nearby cards
if(typeof window.buildNearbyGrid==='function'){const g=window.buildNearbyGrid;window.buildNearbyGrid=function(){const r=g.apply(this,arguments);
 document.querySelectorAll('#nearbyGrid .user-card').forEach((c,i)=>{const u=nearbyUsers[i];if(!u||u.locked)return;const ph=c.querySelector('.uc-photo');if(!ph||ph.querySelector('.kt-emoji'))return;
  const av=u.avatar||'';if(av.startsWith('data:image/')){ph.style.backgroundImage=`url(${av})`;ph.classList.add('kt-has-img');const l=ph.querySelector('.uc-photo-letter');if(l)l.style.display='none'}
  else{const l=ph.querySelector('.uc-photo-letter');if(l)l.style.display='none';const e=document.createElement('div');e.className='kt-emoji';e.textContent=av||(u.rawName||u.name||'?').slice(0,1).toUpperCase();ph.appendChild(e)}});return r}}
})();
(function(){if(typeof window.openProfileDrawer!=='function'||typeof nearbyUsers==='undefined')return;const f=window.openProfileDrawer;window.openProfileDrawer=function(id){const r=f.apply(this,arguments);setTimeout(()=>{const u=nearbyUsers.find(x=>x.id===id);const p=document.getElementById('pdPhoto'),l=document.getElementById('pdPhotoLetter');if(!u||!p)return;
 if((u.avatar||'').startsWith('data:image/')){p.style.background=`url(${u.avatar}) center/cover`;if(l)l.textContent=''}else if(l){l.textContent=u.avatar||u.letter;l.style.opacity='1';l.style.fontSize='110px'}},30);return r}})();
// classic.html re-renders its nav on every tab change: re-apply the tap animation to the new button
(function(){if(document.getElementById('sidebar'))return;let last=null;
 document.addEventListener('pointerdown',e=>{const b=e.target.closest('nav button');if(b)last={i:[...b.parentNode.children].indexOf(b),t:Date.now()}},{passive:true,capture:true});
 new MutationObserver(()=>{if(!last||Date.now()-last.t>500)return;const b=document.querySelectorAll('nav button')[last.i];if(b&&!b.classList.contains('kt-tap')){const v=last.i%4;b.classList.add('kt-tap');if(v)b.classList.add('v'+v);setTimeout(()=>b.classList.remove('kt-tap','v1','v2','v3'),650)}}).observe(document.body,{childList:true,subtree:true})})();
