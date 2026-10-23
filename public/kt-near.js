// Full-screen Nearby feed (mobile): one person per screen, vertical scroll-snap
(function(){const $=id=>document.getElementById(id),K=()=>window.KT,E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const mob=()=>matchMedia('(max-width:768px)').matches;let L=[];
 const isImg=x=>typeof x==='string'&&/^(\/api\/pic\/|https?:|data:image\/)/.test(x);
 const KMS=[[0,'ทั้งประเทศ'],[1,'1 km'],[5,'5 km'],[10,'10 km'],[25,'25 km'],[50,'50 km'],[100,'100 km']];
 const GR=['#7c3aed,#ec4899','#f59e0b,#ef4444','#06b6d4,#3b82f6','#10b981,#14b8a6','#e11d48,#f97316','#8b5cf6,#06b6d4'];
 const navH=()=>{const n=document.querySelector('#sidebar');const h=n&&n.getBoundingClientRect().height;document.documentElement.style.setProperty('--kn-nav',(h&&h<140?h:64)+'px')};
 function ensure(){const pg=$('pageNearby');if(!pg)return null;let f=$('knFeed');if(!f){pg.classList.add('kn-page');pg.insertAdjacentHTML('beforeend',`<div id="knWrap"><div class="kn-top"><div class="ko-tabs"><button class="on">ใกล้เคียง</button><button onclick="switchPage('deck',document.getElementById('nav-deck'))">ปัดการ์ด</button></div><div class="kn-row"><select id="knKm" aria-label="ระยะ">${KMS.map(([v,t])=>`<option value="${v}">📍 ${t}</option>`).join('')}</select><span class="kn-cnt" id="knCnt"></span><span class="kn-lk" id="knLk"></span></div></div><div id="knFeed"></div></div>`);f=$('knFeed');$('knKm').onchange=e=>window.koKm&&koKm(+e.target.value)}return f}
 function card(u,i){const ph=(Array.isArray(u.photos)&&u.photos.filter(isImg).length?u.photos.filter(isImg):isImg(u.avatar)?[u.avatar]:[]);const job=u.details&&u.details.job;const dist=u.distLabel||(u.dist!=null?u.dist+' km':u.provinceName||'');
  const bg=ph.length?ph.map((p,k)=>`<img class="kn-img${k?'':' on'}" ${i>2?'loading="lazy" ':''}src="${E(p)}" alt="">`).join(''):`<div class="kn-ph" style="background:linear-gradient(160deg,${GR[i%GR.length]})"><span>🍄</span><b>${E((u.name||'?').slice(0,1))}</b></div>`;
  return `<section class="kn-card" data-id="${E(u.id)}" data-n="${ph.length}" data-k="0">${bg}${ph.length>1?`<div class="kn-bars">${ph.map((_,k)=>`<i class="${k?'':'on'}"></i>`).join('')}</div>`:''}<div class="kn-grad"></div>
  <div class="kn-info"><div class="kn-name">${E(u.name)} <span>${E(u.age||'')}</span>${u.verified?' <em class="kn-v">✔</em>':''}</div>${job?`<div class="kn-job">💼 ${E(job)}</div>`:''}<div class="kn-badges">${dist?`<span>📍 ${E(dist)}</span>`:''}${u.bot?'<span>🤖 บอท</span>':''}${u.turbo?'<span>⚡ Turbo</span>':''}</div>${u.bio?`<div class="kn-bio">${E(u.bio)}</div>`:''}
  <div class="kn-acts"><button class="kn-like${u.liked?' liked':''}" data-act="like">❤️ ${u.liked?'กดแล้ว':'กดหัวใจ'}</button><button class="kn-msg" data-act="msg">💬 ข้อความ</button></div></div></section>`}
 function render(){if(!mob())return;const f=ensure();if(!f)return;navH();const k=window.KT_KM||0;$('knKm').value=String(k);$('knCnt').textContent=`พบ ${L.length} คน`;const ll=$('likeLabel');$('knLk').textContent=ll?'❤️ '+ll.textContent:'';
  f.innerHTML=L.length?L.map(card).join(''):`<section class="kn-card"><div class="kn-ph" style="background:linear-gradient(160deg,#7c3aed,#ec4899)"><span>🍄</span></div><div class="kn-info"><div class="kn-name">ยังไม่พบใครในระยะนี้</div><div class="kn-job">ลองขยายระยะทางด้านบน</div></div></section>`;f.scrollTop=0}
 addEventListener('kt:people',e=>{L=(e.detail||[]).filter(u=>u&&u.id);render()});
 addEventListener('resize',()=>{navH()});
 document.addEventListener('click',async e=>{const c=e.target.closest('#knFeed .kn-card[data-id]');if(!c)return;const id=c.dataset.id,u=L.find(x=>x.id===id)||{};const a=e.target.closest('[data-act]');
  if(a){e.stopPropagation();if(a.dataset.act==='msg')return K().openChatUid(id);if(a.classList.contains('liked'))return;const fake=document.createElement('button');await window.handleLike(fake,id,u.name||'');if(fake.classList.contains('liked')){u.liked=true;a.classList.add('liked');a.textContent='❤️ กดแล้ว';const ll=$('likeLabel');if(ll)$('knLk').textContent='❤️ '+ll.textContent}return}
  if(e.target.closest('.kn-info'))return window.koProfile&&koProfile(id);
  const n=+c.dataset.n,r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;
  if(n>1&&(x<.3||x>.7)){let k=(+c.dataset.k+(x<.3?-1:1)+n)%n;c.dataset.k=k;c.querySelectorAll('.kn-img').forEach((m,j)=>m.classList.toggle('on',j===k));c.querySelectorAll('.kn-bars i').forEach((m,j)=>m.classList.toggle('on',j===k));return}
  window.koProfile&&koProfile(id)});
})();
