// Kuy Talk bridge v2: wires the original single-file UI to the real backend (REST + Socket.IO).
(function(){
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
let T=localStorage.kt_token,ME=null,sock=null,anonOn=false,anonPeer=null,CFG=null;
const USERS={};// uid -> pub user (for name/report lookup)
const api=async(p,b,method)=>{const r=await fetch('/api/'+p,{method:method||(b?'POST':'GET'),headers:{'content-type':'application/json','x-token':T||''},body:b&&JSON.stringify(b)});const j=await r.json().catch(()=>({}));if(!r.ok)throw j.error||'ผิดพลาด';return j};
const tm=ts=>new Date(ts||Date.now()).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
const ago=ts=>{const m=Math.floor((Date.now()-ts)/6e4);return m<1?'เมื่อสักครู่':m<60?m+' นาทีที่แล้ว':m<1440?Math.floor(m/60)+' ชม.ที่แล้ว':Math.floor(m/1440)+' วันที่แล้ว'};
const GR=['linear-gradient(135deg,#ff3b5c,#ff8a4c)','linear-gradient(135deg,#7c3aed,#ec4899)','linear-gradient(135deg,#06b6d4,#3b82f6)','linear-gradient(135deg,#22c55e,#14b8a6)','linear-gradient(135deg,#f59e0b,#ef4444)'];
const gr=id=>GR[parseInt(String(id||'0').slice(0,4),16)%GR.length||0];
const isImg=a=>typeof a==='string'&&a.startsWith('data:image/');
const letter=u=>u&&u.avatar&&!isImg(u.avatar)?esc(u.avatar):esc((u&&u.name||'?')[0]);
const avStyle=u=>isImg(u&&u.avatar)?`background:url(${u.avatar}) center/cover`:`background:${gr(u&&u.id)}`;
const avHTML=u=>isImg(u&&u.avatar)?'':letter(u);
const remember=u=>{if(u&&u.id)USERS[u.id]=u;return u};
const midOf=uid=>Object.keys(chats).find(k=>chats[k].uid===uid);
function updateLikeBar(){if(!ME)return;const used=ME.swipesUsed||0,f=ME.free;const l=$('likeLabel'),b=$('likeBarFill');if(l)l.textContent=ME.premium?'∞ Premium':`${used}/${f}`;if(b)b.style.width=ME.premium?'100%':Math.min(100,used/f*100)+'%';try{likeCount=used}catch{}
 const ex=$('premiumExpiryText');if(ex&&ME.premiumUntil)ex.textContent='หมดอายุ '+new Date(ME.premiumUntil).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}
async function refresh(){ME=await api('me');remember(ME);updateLikeBar()}
async function ensureAccount(age){if(T||!window.KT_PTICKET){try{await refresh();return}catch(e){if(String(e).includes('ระงับ')){showToast('บัญชีนี้ถูกระงับ');throw e}}}
 const nm=($('epName')||{}).value;const name=(nm&&nm!=='Demo User'?nm:'ผู้ใช้'+Math.floor(1000+Math.random()*9000));
 const dob=($('dobInput')||{}).value||undefined;const r=await api('signup',{name,dob,ref:localStorage.kt_ref||undefined,consent:window.KT_CONSENT||{},phoneTicket:window.KT_PTICKET||undefined,age:age||20,gender:'x',bio:'สวัสดี! มาจาก Kuy Talk',avatar:'😎'});T=localStorage.kt_token=r.token;window.KT_PTICKET=null;if(r.refOk)setTimeout(()=>showToast('🎁 ใช้รหัสแนะนำสำเร็จ รับ 50 เหรียญ!'),1500);localStorage.removeItem('kt_ref');await refresh()}
const STK={hi:['🍄👋','หวัดดี'],love:['🍄💕','รักเลย'],haha:['🍄😂','ฮ่าๆ'],wow:['🍄😮','ว้าว'],sad:['🍄🥺','งอแง'],ok:['🍄👌','โอเค'],night:['🍄🌙','ฝันดี'],eat:['🍄🍜','กินยัง']};
const fmt=t=>{const m=/^\[\[sticker:(\w+)\]\]$/.exec(t||'');if(m&&STK[m[1]])return `<span class="kt-stk" data-stk="${m[1]}"><span class="kt-stk-e">${STK[m[1]][0]}</span><span class="kt-stk-t">${STK[m[1]][1]}</span></span>`;return esc(t)};
const fmtM=x=>x.deleted?'<i class="ko-del">🚫 ข้อความนี้ถูกยกเลิก</i>':x.type==='photo'&&/^(data:image\/|\/api\/pic\/[a-f0-9]+$)/.test(x.photo||'')?`<img class="ko-mimg" src="${x.photo}" alt="รูป" onclick="koViewImg(this.src)">`:x.type==='loc'?(window.koLocCard?koLocCard(x.lat,x.lng):'📍'):fmt(x.text);
const pv=t=>/^\[\[sticker:/.test(t||'')?'[สติกเกอร์]':esc(t);
// ---------- chats / nearby ----------
async function loadChats(){const L=(await api('matches')).sort((a,b)=>(b.other.official?1:0)-(a.other.official?1:0));const NEW={};
 for(const m of L){const o=remember(m.other);const msgs=(await api('messages/'+m.id)).map(x=>({from:x.from===ME.id?'me':'them',text:fmtM(x),raw:x.text,id:x.id,ts:x.ts,time:tm(x.ts)}));
  NEW[m.id]={uid:o.id,official:!!o.official,verified:!!o.verified,name:esc(o.name)+(o.official?' <span class="kt-vb kt-off" title="บัญชีทางการ">✔</span>':o.verified?' <span class="kt-vb" title="ยืนยันตัวตนแล้ว">✔</span>':'')+(o.bot&&!o.official?' 🤖':''),rawName:o.name,avatar:letter(o),grad:gr(o.id),online:true,time:msgs.length?msgs[msgs.length-1].time:'',preview:msgs.length?pv(msgs[msgs.length-1].raw):'แมตช์แล้ว! ทักเลย 💕',unread:0,msgs}}
 Object.keys(chats).forEach(k=>{if(!NEW[k])delete chats[k]});for(const k in NEW){const o=chats[k];if(o&&o.peerRead)NEW[k].peerRead=o.peerRead;chats[k]=NEW[k]}buildChatList();if(currentChat&&!chats[currentChat]){currentChat=null;$('activeChatView').style.display='none';$('emptyChatMsg').style.display=''}}
async function loadPeople(){const L=await api('people'+(window.KT_KM?'?km='+window.KT_KM:''));nearbyUsers.length=0;
 L.forEach(u=>{remember(u);nearbyUsers.push({id:u.id,name:esc(u.name),rawName:u.name,age:u.age,dist:esc(u.distLabel||(u.dist!=null?u.dist+' km':'—')),bio:esc(u.bio),grad:gr(u.id),letter:letter(u),badge:u.turbo?'⚡ Turbo':u.verified?'✔ ยืนยันแล้ว':u.premium?'👑 Premium':u.bot?'🤖 Bot':null,badgeColor:'rgba(124,58,237,.8)',avatar:u.avatar,tags:[u.zodiac&&u.zodiac.sym+' '+u.zodiac.name,u.provinceName&&'📍 '+u.provinceName,...(u.badges||[])].filter(Boolean).map(esc),about:esc(u.bio)||'—',interests:[],liked:u.liked,mid:u.mid})});
 if(!ME.premium&&nearbyUsers.length>3)nearbyUsers.splice(3,0,{id:'locked1',name:'???',age:'?',dist:'< 2 km',bio:'ใกล้มาก!',grad:'linear-gradient(135deg,#374151,#1f2937)',letter:'?',locked:true});
 // lucky/shake pools are filled per-spin from the server
 buildNearbyGrid();dispatchEvent(new CustomEvent('kt:people',{detail:L}))}
const _buildNearby=window.buildNearbyGrid;
window.buildNearbyGrid=function(){_buildNearby();document.querySelectorAll('#nearbyGrid .user-card').forEach((card,i)=>{const u=nearbyUsers[i];if(!u||u.locked)return;
 const lb=card.querySelector('.btn-like');if(lb&&u.liked){lb.classList.add('liked');lb.innerHTML='<em class="ei" style="margin-right:4px">❤️</em>กดแล้ว!'}
 const mb=card.querySelector('.btn-msg');if(mb){mb.removeAttribute('onclick');mb.onclick=e=>{e.stopPropagation();openChatUid(u.id)}}})};
function openChatUid(uid){const mid=midOf(uid);if(mid){openChat(mid);switchPage('chat',$('nav-chat'))}else showToast('ต้องแมตช์กันก่อน — กด ❤️ ให้กันทั้งสองฝ่ายจึงจะแชทได้')}
window.ktOpenChatUid=openChatUid;
async function loadAll(){await Promise.all([loadChats(),loadPeople(),loadMoments(),loadFriends(),loadBlocks()])}
// ---------- socket ----------
function connect(){sock=io({auth:{token:T}});KTCall.init(sock);dispatchEvent(new CustomEvent('kt:sock',{detail:sock}));
 sock.on('connect',()=>{if(currentRoom)sock.emit('room:join',currentRoom)});
 sock.on('msg',m=>{const c=chats[m.mid];if(!c){loadChats();return}if(m.from===ME.id){if(m.type){c.msgs.push({from:'me',text:fmtM(m),raw:m.text,id:m.id,ts:m.ts,time:tm(m.ts)});c.preview=pv(m.text)}else{const pend=c.msgs.filter(x=>x.from==='me'&&!x.id).pop();if(pend)pend.id=m.id}if(currentChat===m.mid)renderMessages();buildChatList();return}$('typingRow')?.remove();
  c.msgs.push({from:'them',text:fmtM(m),raw:m.text,id:m.id,ts:m.ts,time:tm(m.ts)});c.preview=pv(m.text);if(currentChat===m.mid&&!document.hidden)sock.emit('read',{mid:m.mid});c.time=tm(m.ts);
  if(currentChat===m.mid)renderMessages();else{c.unread++;showToast('💬 ข้อความใหม่จาก '+c.name)}buildChatList();$('ci-'+currentChat)?.classList.add('active')});
 sock.on('typing',({mid})=>{if(currentChat!==mid||$('typingRow'))return;const c=chats[mid],box=$('cwMessages');const t=document.createElement('div');t.className='msg-row fade-in';t.id='typingRow';t.innerHTML=`<div class="msg-avatar-sm" style="background:${c.grad}">${c.avatar}</div><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;box.appendChild(t);box.scrollTop=1e9;setTimeout(()=>t.remove(),4000)});
 sock.on('match',async m=>{await loadChats();loadPeople();showToast('🎉 แมตช์ใหม่กับ '+esc(m.other.name)+'!')});
 sock.on('friend',d=>{loadFriends();showToast(d.status==='pending'?`👋 ${esc(d.from.name)} ขอเป็นเพื่อน`:d.status==='accepted'?`🤝 ${esc(d.from.name)} เป็นเพื่อนกับคุณแล้ว`:'คำขอถูกปฏิเสธ')});
 sock.on('rand:paired',p=>{if(!anonOn)return;anonPeer=remember(p);$('anonMatching').style.display='none';$('anonChatCard').style.display='block';
  $('anonId').textContent=p.bot?`คนแปลกหน้า #${Math.floor(1000+Math.random()*9000)} 🤖`:`${p.name}, ${p.age}`;
  $('anonMsgs').innerHTML='<div style="text-align:center;font-size:12px;color:var(--text3);padding:8px 16px;background:rgba(255,255,255,.03);border-radius:8px">🔗 เชื่อมต่อแล้ว · ทักทายกันเลย!</div>'});
 sock.on('rand:msg',m=>{if(anonOn)addAnonBubble(esc(m.text),'them')});
 sock.on('rand:ended',()=>{if(anonOn)addAnonBubble('<i>อีกฝ่ายออกจากแชทแล้ว — กดจบแล้วเริ่มใหม่</i>','them')});
 sock.on('room:counts',c=>{ROOMCOUNTS=c;uniqueProvinces.forEach(p=>p.online=c[p.id]||0);if(currentPage==='rooms')buildProvinceList($('provinceSearch').value,currentRegionFilter);if(currentRoom)$('roomOnlineCount').textContent=`${c[currentRoom]||0} คนออนไลน์`});
 sock.on('room:history',({room,msgs})=>{roomMessages[room]=msgs;if(room===currentRoom)renderRoomMessages()});
 sock.on('room:msg',m=>{(roomMessages[m.room]=roomMessages[m.room]||[]).push(m);if(roomMessages[m.room].length>100)roomMessages[m.room].shift();if(m.room===currentRoom){$('roomTyping')&&($('roomTyping').textContent='');renderRoomMessages()}});
 sock.on('room:typing',d=>{if(d.room!==currentRoom)return;const t=$('roomTyping');if(!t)return;t.textContent=`${d.name} กำลังพิมพ์...`;clearTimeout(t._t);t._t=setTimeout(()=>t.textContent='',3000)});
 sock.on('err',e=>{showToast(e);if(anonOn&&String(e).match(/เหรียญ|ไม่พบ|สุ่มถี่/))cancelAnon()});
 sock.on('disconnect',r=>{if(r==='io server disconnect')showToast('การเชื่อมต่อถูกตัด (บัญชีอาจถูกระงับ)')})}
let ROOMCOUNTS={};
// ---------- overrides: age gate ----------
const _checkAge=window.checkAge;
window.checkAge=async function(){const dob=$('dobInput').value;_checkAge();if(!dob)return;
 const age=Math.floor((Date.now()-new Date(dob))/31557600000);if(age<18)return;try{CFG=await api('config');setupProvinces();await ensureAccount(age);connect();setTimeout(()=>loadAll().catch(()=>{}).finally(()=>dispatchEvent(new Event("kt:loaded"))),700)}catch(e){showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: '+e)}};
// returning user with a valid session: skip the age gate / DOB entirely
window.ktEnterApp=async function(){const g=$('ageGate');if(!g||g.style.display==='none')return;g.style.transition='opacity .4s';g.style.opacity='0';
 setTimeout(()=>{g.style.display='none';$('shell').style.display='flex';try{initApp()}catch(e){}},400);
 try{CFG=await api('config');setupProvinces();await refresh();connect();setTimeout(()=>loadAll().catch(()=>{}).finally(()=>dispatchEvent(new Event("kt:loaded"))),700)}catch(e){showToast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: '+e)}};
// ---------- 1:1 chat ----------
let lastTyping=0;
window.sendMessage=function(){const input=$('msgInput');const text=input.value.trim();if(!text||!currentChat||!sock)return;
 const fr=scanMessageForViolations(text);if(fr.flagged){logFilterHit(currentChat,text,fr);showFilterWarning(fr);if(fr.severity==='severe')return}
 const shown=fr.flagged?censorText(text,fr.hits):text;const c=chats[currentChat];c.msgs.push({from:'me',text:fmt(shown),raw:shown,ts:Date.now(),time:tm(),flagged:fr.flagged});c.preview=pv(shown);c.time=tm();
 input.value='';renderMessages();buildChatList();$('ci-'+currentChat)?.classList.add('active');sock.emit('msg',{mid:currentChat,text:shown})};
document.addEventListener('input',e=>{if(!sock)return;if(e.target.id==='msgInput'&&currentChat&&Date.now()-lastTyping>2000){lastTyping=Date.now();sock.emit('typing',{mid:currentChat})}
 if(e.target.id==='roomMsgInput'&&currentRoom&&Date.now()-lastTyping>2000){lastTyping=Date.now();sock.emit('room:typing')}});
window.handleLike=async function(btn,id,name){if(btn&&btn.classList.contains('liked'))return;
 try{const r=await api('swipe',{to:id,dir:'right'});ME=r.me;updateLikeBar();if(btn){btn.classList.add('liked');btn.innerHTML='<em class="ei" style="margin-right:4px">❤️</em>กดแล้ว!'}const nu=nearbyUsers.find(x=>x.id===id);if(nu)nu.liked=true;
  if(r.match){await loadChats();showToast(`🎉 แมตช์กับ ${name}! ไปที่แชทได้เลย`);spawnHeartRain(document.body)}else showToast(`💖 กดหัวใจ ${name} แล้ว!`)}
 catch(e){if(confirm(e+'\nอัพเกรด Premium เพื่อกดไม่จำกัด?'))switchPage('sub',$('nav-sub'))}};
window.likeFromDrawer=function(){const u=nearbyUsers.find(x=>x.name===currentDrawerUser);if(!u)return;handleLike($('like-'+u.id),u.id,u.name);$('pdLikeBtn').innerHTML='<em class="ei" style="margin-right:8px">❤️</em>กดแล้ว!';$('pdLikeBtn').style.opacity='.6'};
window.msgFromDrawer=function(){const u=nearbyUsers.find(x=>x.name===currentDrawerUser);closeDrawer();if(u)openChatUid(u.id)};
window.startCall=function(){if(!currentChat)return;KTCall.start(currentChat,false,chats[currentChat].rawName)};
window.startVideoCall=function(){if(!currentChat)return;KTCall.start(currentChat,true,chats[currentChat].rawName)};
window.endCall=function(){KTCall.end();$('callScreen')?.classList.remove('show')};
// ---------- random chat ----------
window.startAnon=function(){if(!sock)return showToast('กรุณาเข้าสู่ระบบก่อน');anonOn=true;anonPeer=null;$('anonIdle').style.display='none';$('anonMatching').style.display='block';sock.emit('rand:join',{})};
window.sendAnonMsg=function(){const i=$('anonInput');const t=i.value.trim();if(!t||!anonPeer)return;const fr=scanMessageForViolations(t);if(fr.severity==='severe'){showFilterWarning(fr);return}const shown=fr.flagged?censorText(t,fr.hits):t;addAnonBubble(esc(shown),'me');i.value='';sock.emit('rand:msg',shown)};
window.endAnon=function(){anonOn=false;anonPeer=null;sock&&sock.emit('rand:leave');$('anonChatCard').style.display='none';$('anonIdle').style.display='block';showToast('จบการสนทนาแล้ว')};
window.cancelAnon=function(){anonOn=false;sock&&sock.emit('rand:leave');$('anonMatching').style.display='none';$('anonIdle').style.display='block'};
// ---------- payment (SIMULATED) ----------
window.doPay=function(){const btn=$('payConfirmBtn');btn.disabled=true;btn.textContent='กำลังดำเนินการ (จำลอง)...';
 setTimeout(async()=>{try{ME=await api('subscribe',{});updateLikeBar();loadPeople()}catch(e){showToast(e)}btn.disabled=false;btn.innerHTML='🔒 ชำระเงิน ฿50 (จำลอง)';closePayModal();$('successModal').classList.add('show')},1200)};
const _save=window.saveProfile;window.saveProfile=function(){_save&&_save();if(T)api('profile',{name:$('epName').value.trim(),bio:($('epBio')||{}).value}).then(m=>{ME=m}).catch(e=>showToast(e))};
// ---------- province rooms ----------
function setupProvinces(){const old={};uniqueProvinces.forEach(p=>old[p.th]=p.emoji);uniqueProvinces.length=0;
 CFG.provinces.forEach(p=>uniqueProvinces.push({...p,emoji:old[p.th]||'📍',online:0}));
 const lbl=document.querySelector('#panelRooms .panel-sub, #panelRooms [data-count]');}
window.buildProvinceList=function(search='',region='all'){const list=$('provinceList');if(!list)return;let f=uniqueProvinces;if(region!=='all')f=f.filter(p=>p.region===region);
 if(search){const q=search.toLowerCase();f=f.filter(p=>p.th.includes(search)||p.en.toLowerCase().includes(q))}
 if(!f.length){list.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">ไม่พบจังหวัดที่ค้นหา</div>';return}
 const RN={central:'ภาคกลาง',north:'ภาคเหนือ',northeast:'ภาคอีสาน',east:'ภาคตะวันออก',west:'ภาคตะวันตก',south:'ภาคใต้'};let h=`<div class="province-section-label">ทั้งหมด ${f.length} จังหวัด</div>`;
 ['central','north','northeast','east','west','south'].forEach(r=>{const g=f.filter(p=>p.region===r).sort((a,b)=>b.online-a.online);if(!g.length)return;h+=`<div class="province-section-label">${(typeof regions!=='undefined'&&regions[r])||RN[r]}</div>`;
  g.forEach(p=>h+=`<div class="province-item ${currentRoom===p.id?'active':''}" onclick="openRoom('${p.id}')"><div class="prov-emoji">${p.emoji}</div><div class="prov-info"><div class="prov-name">${esc(p.th)}</div><div class="prov-name-en">${esc(p.en)}</div></div><div style="text-align:right;flex-shrink:0"><div class="prov-online">● ${p.online} คน</div><div class="prov-msg-count">${(roomMessages[p.id]||[]).length} ข้อความ</div></div></div>`)});
 list.innerHTML=h};
window.openRoom=function(id){const p=uniqueProvinces.find(x=>x.id===id);if(!p||!sock)return;currentRoom=id;sock.emit('room:join',id);
 $('roomAvatar').textContent=p.emoji;$('roomName').textContent='ห้อง'+p.th;$('roomOnlineCount').textContent=`${ROOMCOUNTS[id]||0} คนออนไลน์`;
 $('roomEmptyState').style.display='none';$('roomChatView').style.display='flex';
 if(!$('roomTyping')){const t=document.createElement('div');t.id='roomTyping';t.style.cssText='font-size:12px;color:var(--text3);padding:0 16px;min-height:16px';$('roomMessages').after(t)}
 renderRoomMessages();buildProvinceList($('provinceSearch').value,currentRegionFilter)};
window.closeRoomChat=function(){currentRoom=null;sock&&sock.emit('room:leave');$('roomChatView').style.display='none';$('roomEmptyState').style.display='flex';buildProvinceList($('provinceSearch').value,currentRegionFilter)};
window.renderRoomMessages=function(){if(!currentRoom)return;const p=uniqueProvinces.find(x=>x.id===currentRoom);const box=$('roomMessages');
 let h=`<div class="room-system-msg">${p.emoji} ยินดีต้อนรับสู่ห้อง<b>${esc(p.th)}</b> — กติกา: สุภาพ ห้ามสแปม ห้ามขายของ · เก็บประวัติ 100 ข้อความล่าสุด</div>`;
 (roomMessages[currentRoom]||[]).forEach(m=>{remember({id:m.uid,name:m.name,avatar:m.avatar,bot:m.bot});const mine=m.uid===ME.id;
  h+=`<div class="room-msg-row ${mine?'me':''}">${mine?'':`<div class="msg-avatar-sm" title="รายงาน/บล็อก" style="cursor:pointer;${avStyle({id:m.uid,avatar:m.avatar})}" onclick="openReportModal('${m.uid}')">${avHTML({id:m.uid,name:m.name,avatar:m.avatar})}</div>`}<div>${mine?'':`<div class="room-sender-name">${esc(m.name)}${m.bot?' 🤖':''}</div>`}<div style="display:flex;align-items:flex-end;gap:6px;${mine?'flex-direction:row-reverse':''}"><div class="bubble ${mine?'me':'them'}">${m.type==='photo'&&/^\/api\/pic\/[a-f0-9]+$/.test(m.photo||'')?`<img class="ko-mimg" src="${m.photo}" alt="รูป" onclick="koViewImg&&koViewImg(this.src)">`:m.type==='loc'&&window.koLocCard?koLocCard(m.lat,m.lng):esc(m.text)}</div><div class="bubble-time">${tm(m.ts)}</div></div></div></div>`});
 box.innerHTML=h;box.scrollTop=1e9};
window.sendRoomMessage=function(){const i=$('roomMsgInput');const t=i.value.trim();if(!t||!currentRoom||!sock)return;const fr=scanMessageForViolations(t);if(fr.severity==='severe'){showToast('🚫 ข้อความถูกบล็อก — กรุณาใช้ถ้อยคำที่เหมาะสม');logFilterHit(currentRoom,t,fr);return}
 sock.emit('room:msg',{room:currentRoom,text:fr.flagged?censorText(t,fr.hits):t});i.value=''};
window.showRoomInfo=function(){const p=uniqueProvinces.find(x=>x.id===currentRoom);if(p)showToast(`${p.emoji} ${p.th} — ${ROOMCOUNTS[p.id]||0} คนออนไลน์ตอนนี้`)};
// ---------- moments ----------
let MOMENTS=[];
async function loadMoments(){MOMENTS=await api('moments');MOMENTS.forEach(m=>{remember(m.user);m.comments.forEach(c=>remember(c.user))});buildMoments()}
window.buildMoments=function(){const list=$('momentsList');if(!list)return;if(!MOMENTS.length){list.innerHTML='<p style="color:var(--text3);text-align:center;padding:30px">ยังไม่มีโมเมนต์ — โพสต์แรกเลย!</p>';return}
 list.innerHTML=MOMENTS.map(m=>`<div class="moment-card fade-in"><div class="mc-header"><div class="mc-avatar" style="${avStyle(m.user)}">${avHTML(m.user)}</div><div style="flex:1"><div class="mc-name">${esc(m.user.name)}${m.user.bot?' 🤖':''}</div><div class="mc-meta">${ago(m.ts)}</div></div>
 ${m.user.id===ME.id?`<div onclick="ktDelMoment('${m.id}')" style="color:var(--text3);cursor:pointer;padding:4px" title="ลบ">🗑️</div>`:`<div onclick="openReportModal('${m.user.id}')" style="color:var(--text3);cursor:pointer;padding:4px" title="รายงาน">···</div>`}</div>
 ${m.text?`<div class="mc-text">${esc(m.text)}</div>`:''}${m.photo?`<img src="${m.photo}" style="width:100%;border-radius:14px;margin:6px 0;max-height:420px;object-fit:cover">`:''}
 <div class="mc-footer"><div class="mc-action ${m.liked?'liked':''}" onclick="ktLikeMoment('${m.id}')"><em class="ei">❤️</em> <span>${m.likes}</span></div><div class="mc-action" onclick="ktToggleCmt('${m.id}')"><em class="ei">💬</em> <span>${m.comments.length}</span></div></div>
 <div id="cmt-${m.id}" style="display:${OPENCMT.has(m.id)?'block':'none'};margin-top:8px">${m.comments.map(c=>`<div style="font-size:13px;padding:4px 0"><b>${esc(c.user.name)}</b> ${esc(c.text)}</div>`).join('')}
 <div style="display:flex;gap:6px;margin-top:6px"><input id="cin-${m.id}" placeholder="เขียนคอมเมนต์..." maxlength=300 style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--dark3);color:var(--text);font-family:inherit" onkeydown="if(event.key==='Enter')ktComment('${m.id}')"><button onclick="ktComment('${m.id}')" style="padding:8px 12px;border:0;border-radius:10px;background:var(--grad);color:#fff;font-family:inherit;cursor:pointer">ส่ง</button></div></div></div>`).join('')};
const OPENCMT=new Set();
const upd=m=>{const i=MOMENTS.findIndex(x=>x.id===m.id);if(i>=0)MOMENTS[i]=m;buildMoments()};
window.ktLikeMoment=async id=>{try{upd(await api(`moments/${id}/like`,{}))}catch(e){showToast(e)}};
window.ktToggleCmt=id=>{OPENCMT.has(id)?OPENCMT.delete(id):OPENCMT.add(id);buildMoments()};
window.ktComment=async id=>{const v=$('cin-'+id).value.trim();if(!v)return;try{OPENCMT.add(id);upd(await api(`moments/${id}/comment`,{text:v}));setTimeout(loadMoments,1800)}catch(e){showToast(e)}};
window.ktDelMoment=async id=>{if(!confirm('ลบโมเมนต์นี้?'))return;await api('moments/'+id,null,'DELETE');loadMoments()};
window.ktOpenComposer=function(){if(!ME)return;let photo=null;const d=document.createElement('div');d.style.cssText='position:fixed;inset:0;background:#000b;z-index:999;display:flex;align-items:center;justify-content:center';
 d.innerHTML=`<div style="background:var(--card);border:1px solid var(--border);border-radius:20px;padding:20px;width:92%;max-width:440px;color:var(--text);font-family:inherit"><h3 style="margin-bottom:10px">โพสต์โมเมนต์</h3><textarea id=ktPost maxlength=500 rows=4 placeholder="แชร์อะไรให้เพื่อนๆ ฟัง..." style="width:100%;padding:12px;border-radius:12px;border:1px solid var(--border);background:var(--dark3);color:var(--text);font-family:inherit"></textarea>
 <img id=ktPrev style="display:none;width:100%;border-radius:12px;margin-top:8px"><div style="display:flex;gap:8px;margin-top:12px"><label style="padding:10px 14px;border-radius:12px;background:var(--dark3);cursor:pointer">🖼 รูป<input id=ktPhoto type=file accept="image/*" hidden></label><div style="flex:1"></div><button id=ktCancel style="padding:10px 14px;border-radius:12px;border:0;background:var(--dark3);color:var(--text);font-family:inherit;cursor:pointer">ยกเลิก</button><button id=ktSend style="padding:10px 18px;border-radius:12px;border:0;background:var(--grad);color:#fff;font-weight:700;font-family:inherit;cursor:pointer">โพสต์</button></div></div>`;
 document.body.append(d);d.querySelector('#ktCancel').onclick=()=>d.remove();
 d.querySelector('#ktPhoto').onchange=e=>{const f=e.target.files[0];if(!f)return;const im=new Image();im.onload=()=>{const c=document.createElement('canvas');const k=Math.min(1,900/Math.max(im.width,im.height));c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);photo=c.toDataURL('image/jpeg',.8);const p=d.querySelector('#ktPrev');p.src=photo;p.style.display='block'};im.src=URL.createObjectURL(f)};
 d.querySelector('#ktSend').onclick=async()=>{try{const m=await api('moments',{text:d.querySelector('#ktPost').value,photo});MOMENTS.unshift(m);buildMoments();d.remove();showToast('โพสต์แล้ว ✨')}catch(e){showToast(e)}}};
// ---------- friends ----------
let FR={friends:[],incoming:[],outgoing:[]};
async function loadFriends(){FR=await api('friends');[...FR.friends,...FR.incoming,...FR.outgoing].forEach(remember);buildFriends()}
window.buildFriends=function(){const list=$('friendsList'),box=$('friendReqBox');if(!list)return;
 const row=(u,right)=>`<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--card);border-radius:14px;margin-bottom:6px"><div style="width:44px;height:44px;border-radius:13px;${avStyle(u)};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:white;flex-shrink:0">${avHTML(u)}</div><div style="flex:1"><div style="font-weight:700;font-size:14px">${esc(u.name)}${u.bot?' 🤖':''}</div><div style="font-size:12px;color:${u.online||u.bot?'var(--green)':'var(--text3)'}">${u.online||u.bot?'ออนไลน์':esc(u.bio||'')}</div></div><div style="display:flex;gap:6px">${right}</div></div>`;
 const B=(t,f,bg='rgba(255,255,255,.06)')=>`<button onclick="${f}" style="padding:7px 11px;background:${bg};border:0;border-radius:9px;color:#fff;font-family:inherit;font-size:12px;cursor:pointer">${t}</button>`;
 box.innerHTML=FR.incoming.length?`<div style="background:var(--card);border:1px solid rgba(255,59,92,.3);border-radius:20px;padding:16px;margin-bottom:20px"><p style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:12px">คำขอเป็นเพื่อน · ${FR.incoming.length}</p>${FR.incoming.map(u=>row(u,B('ยอมรับ',`ktFriendRespond('${u.id}',true)`,'var(--grad)')+B('ปฏิเสธ',`ktFriendRespond('${u.id}',false)`))).join('')}</div>`:'';
 const can=Object.values(chats).filter(c=>!FR.friends.some(f=>f.id===c.uid)&&!FR.outgoing.some(f=>f.id===c.uid)&&!FR.incoming.some(f=>f.id===c.uid));
 $('friendsLabel').textContent=`เพื่อนทั้งหมด · ${FR.friends.length}`;
 list.innerHTML=(FR.friends.map(u=>row(u,B('💬',`ktOpenChatUid('${u.id}')`)+B('🚩',`openReportModal('${u.id}')`)+B('✖',`ktFriendRemove('${u.id}')`))).join('')||'<p style="color:var(--text3);font-size:13px;padding:8px 0">ยังไม่มีเพื่อน — เพิ่มจากคนที่แมตช์ด้านล่าง</p>')
 +(FR.outgoing.length?`<p style="font-size:12px;color:var(--text3);margin:16px 0 8px">รอการตอบรับ · ${FR.outgoing.length}</p>`+FR.outgoing.map(u=>row(u,'<span style="font-size:12px;color:var(--text3)">⏳ ส่งคำขอแล้ว</span>')).join(''):'')
 +(can.length?`<p style="font-size:12px;color:var(--text3);margin:16px 0 8px">แมตช์ที่ยังไม่ได้เป็นเพื่อน</p>`+can.map(c=>{const u=USERS[c.uid]||{id:c.uid,name:c.rawName};return row(u,B('➕ เพิ่มเพื่อน',`ktFriendAdd('${u.id}')`,'var(--grad)'))}).join(''):'')};
window.ktFriendAdd=async id=>{try{const r=await api('friends/request',{id});showToast(r.status==='accepted'?'🤝 เป็นเพื่อนกันแล้ว!':'ส่งคำขอเป็นเพื่อนแล้ว');loadFriends()}catch(e){showToast(e)}};
window.ktFriendRespond=async(id,accept)=>{await api('friends/respond',{id,accept});showToast(accept?'🤝 ยอมรับแล้ว':'ปฏิเสธแล้ว');loadFriends()};
window.ktFriendRemove=async id=>{if(!confirm('ลบเพื่อนคนนี้?'))return;await api('friends/remove',{id});loadFriends()};
// ---------- block / report ----------
let RT=null;// resolved report target uid
const _openReport=window.openReportModal;
window.openReportModal=function(x){let uid=null,name=x;
 if(chats[x]){uid=chats[x].uid;name=chats[x].rawName}else if(USERS[x]){uid=x;name=USERS[x].name}else if(x==='คนแปลกหน้า'&&anonPeer){uid=anonPeer.id;name=anonPeer.bot?'คนแปลกหน้า':anonPeer.name}
 else{const u=Object.values(USERS).find(u=>u.name===x)||nearbyUsers.find(u=>u.name===x);if(u){uid=u.id;name=u.rawName||u.name}}
 RT=uid;_openReport(name||'ผู้ใช้นี้')};
async function loadBlocks(){const L=await api('blocks');blockedUsers.length=0;L.forEach(u=>blockedUsers.push({id:u.id,name:esc(u.name),letter:letter(u),grad:gr(u.id),when:ago(u.ts),reason:esc(u.reason||'ไม่ระบุ')}));updateBlockCount()}
async function doBlock(reason){if(!RT)return showToast('ไม่พบผู้ใช้ที่จะบล็อก');await api('block',{id:RT,reason});if(anonPeer&&anonPeer.id===RT)endAnon();await Promise.all([loadBlocks(),loadChats(),loadPeople(),loadMoments(),loadFriends()])}
window.blockUser=async function(){closeReportModal();try{await doBlock('');showToast(`🚫 บล็อก "${reportTarget}" แล้ว`)}catch(e){showToast(e)}};
const _final=window.finalSubmitReport;
window.finalSubmitReport=async function(){const shouldBlock=$('togBlockWith').classList.contains('on');const detail=$('rDetailText').value.trim();const cat=reportSelectedCat,sev=reportSelectedSev||'low';
 const sevMap={low:'low',medium:'medium',high:'high',critical:'critical',mild:'low',moderate:'medium',severe:'high'};
 try{if(!RT)throw 'ไม่พบผู้ใช้ที่จะรายงาน';await api('report',{id:RT,category:cat,severity:sevMap[sev]||'low',detail,context:currentPage});if(shouldBlock)await doBlock(cat)}catch(e){showToast(e);return}
 const keep=blockedUsers.slice();_final();blockedUsers.length=0;keep.forEach(b=>blockedUsers.push(b));updateBlockCount()};
window.unblockUser=async function(idx){const u=blockedUsers[idx];if(!u)return;await api('unblock',{id:u.id});await loadBlocks();buildBlockList();showToast(`✅ ยกเลิกบล็อก "${u.name}" แล้ว`);loadChats();loadPeople();loadMoments()};
// ---------- lucky / shake (real pairing) ----------
const _spin=window.doLuckySpin;
window.doLuckySpin=async function(){try{const r=await api('lucky',{});ME=r.me;const u=remember(r.user);
 const card={id:u.id,name:esc(u.name),letter:letter(u),age:u.age+' ปี',loc:'Kuy Talk',dist:'ใกล้คุณ',grad:gr(u.id),tags:[esc(u.bio||'')].filter(Boolean),likedAgo:u.bot?'🤖 บอท':'✨ ผู้ใช้จริง',chatId:r.mid};
 luckyPool.forEach((_,i)=>luckyPool[i]=card);await loadChats();loadPeople();_spin()}catch(e){showToast(e)}};
window.chatWithLucky=function(){closeLuckyResult();closeLucky();if(luckyCurrentUser&&chats[luckyCurrentUser.chatId])openChat(luckyCurrentUser.chatId)};
window.viewLuckyProfile=function(){closeLuckyResult();closeLucky();if(luckyCurrentUser)openProfileDrawer(luckyCurrentUser.id)};
const _shakeMatch=window.showShakeMatch;
window.showShakeMatch=async function(){try{const r=await api('shake',{});const u=remember(r.user);matchedUsers.length=0;matchedUsers.push({name:u.name,avatar:avHTML(u)||letter(u),grad:gr(u.id),age:u.age+' ปี',dist:'ใกล้คุณ',chatId:r.mid});await loadChats();_shakeMatch()}
 catch(e){showToast(e);cancelShakeSearch&&cancelShakeSearch()}};
window.chatWithMatched=function(){closeShake();if(currentMatchedUser&&chats[currentMatchedUser.chatId])openChat(currentMatchedUser.chatId)};
// ---------- misc ----------
document.addEventListener('DOMContentLoaded',()=>{const pm=$('payModal');if(pm){const n=document.createElement('div');n.style.cssText='margin:8px 0;padding:8px 12px;border-radius:10px;background:rgba(251,191,36,.15);color:#fbbf24;font-size:12px;text-align:center';n.textContent='⚠️ ระบบชำระเงินจำลอง — ไม่มีการตัดเงินจริงและไม่เก็บข้อมูลบัตร';(pm.querySelector('.pay-methods')||pm.firstElementChild).before(n)}});
setInterval(()=>{if(sock&&ME&&document.visibilityState==='visible'){if(currentPage==='moments')loadMoments();if(currentPage==='friends')loadFriends()}},20000);
try{const q=new URLSearchParams(location.search).get('ref');if(q)localStorage.kt_ref=q.slice(0,12)}catch(e){}
window.KT={setToken:t=>{T=localStorage.kt_token=t},fmtM,pv,api,me:()=>ME,setMe:m=>{ME=m;remember(m);updateLikeBar()},refresh,loadChats,loadPeople,sock:()=>sock,get chats(){return chats},openChatUid,fmt,esc,remember,STK,cfg:()=>CFG};
})();
// fix: the shell's click-outside handler closed the drawer in the same click that opened it
(function(){const f=window.openProfileDrawer;window.openProfileDrawer=function(id){setTimeout(()=>f(id),0)}})();

