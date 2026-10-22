// Kuy Talk – mobile pane switching (list ⇄ detail) + back buttons
(function(){
const mq=matchMedia('(max-width:768px)');const B=document.body;
function sync(){const page=(typeof currentPage!=='undefined'&&currentPage)||'chat';let list=false,detail=false;
 if(page==='chat'){if(currentChat)detail=true;else list=true}
 else if(page==='rooms'){if(currentRoom)detail=true;else list=true}
 B.classList.toggle('kt-list',mq.matches&&list);B.classList.toggle('kt-detail',mq.matches&&detail)}
window.ktMobileSync=sync;
const wrap=(n,after)=>{const f=window[n];if(typeof f!=='function')return;window[n]=function(){const r=f.apply(this,arguments);Promise.resolve(r).finally(()=>{after&&after();sync()});return r}};
['switchPage','openChat','openRoom','closeRoomChat','buildChatList','checkAge'].forEach(n=>wrap(n));
window.ktBackToList=function(){if(currentPage==='rooms'&&currentRoom){closeRoomChat();return}
 currentChat=null;document.getElementById('activeChatView').style.display='none';document.getElementById('emptyChatMsg').style.display='';document.querySelectorAll('.chat-item.active').forEach(e=>e.classList.remove('active'));sync()};
function addBack(){const h=document.querySelector('#activeChatView .cw-header');if(h&&!h.querySelector('.mob-back')){const b=document.createElement('button');b.className='mob-back';b.setAttribute('aria-label','กลับ');b.textContent='‹';b.onclick=ktBackToList;h.prepend(b)}}
addBack();mq.addEventListener('change',sync);sync();
// Android back button: go back to list instead of leaving the app
history.replaceState({kt:1},'');window.addEventListener('popstate',()=>{if(B.classList.contains('kt-detail')){ktBackToList();history.pushState({kt:1},'')}});
document.addEventListener('click',e=>{if(e.target.closest('.chat-item,.province-item'))setTimeout(()=>{if(B.classList.contains('kt-detail'))history.pushState({kt:2},'')},0)},true);
})();
