// Kuy Talk brand: loading screen (male + female mushrooms walk, hold hands, heart pop)
(function(){
const SCENE=`<svg class="scene" viewBox="0 0 400 250" aria-hidden="true">
<defs><radialGradient id="kr" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ff5144"/><stop offset=".7" stop-color="#d81e12"/><stop offset="1" stop-color="#a5130b"/></radialGradient>
<radialGradient id="kp" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#c58bff"/><stop offset=".65" stop-color="#9b3fe6"/><stop offset="1" stop-color="#6f22b5"/></radialGradient>
<linearGradient id="ks" x1="0" x2="1"><stop offset="0" stop-color="#fff3d6"/><stop offset="1" stop-color="#f0d9a6"/></linearGradient></defs>
<ellipse cx="200" cy="232" rx="150" ry="9" fill="#000" opacity=".35"/>
<g class="flower" ><path d="M300 232 q2 -18 0 -30" stroke="#3fae4a" stroke-width="3" fill="none"/><g transform="translate(300 200)"><circle r="5" cx="0" cy="-6" fill="#ff7aa8"/><circle r="5" cx="6" cy="0" fill="#ff7aa8"/><circle r="5" cx="0" cy="6" fill="#ff7aa8"/><circle r="5" cx="-6" cy="0" fill="#ff7aa8"/><circle r="3.5" fill="#ffd400"/></g></g>
<g class="flower f2"><path d="M96 232 q-2 -14 0 -24" stroke="#3fae4a" stroke-width="3" fill="none"/><g transform="translate(96 206)"><circle r="4.5" cx="0" cy="-5" fill="#ffd400"/><circle r="4.5" cx="5" cy="0" fill="#ffd400"/><circle r="4.5" cx="0" cy="5" fill="#ffd400"/><circle r="4.5" cx="-5" cy="0" fill="#ffd400"/><circle r="3" fill="#fff"/></g></g>
<g class="flower"><path d="M330 232 q1 -10 0 -16" stroke="#3fae4a" stroke-width="3" fill="none"/><g transform="translate(330 214)"><circle r="4" cx="0" cy="-4" fill="#6ec3ff"/><circle r="4" cx="4" cy="0" fill="#6ec3ff"/><circle r="4" cx="0" cy="4" fill="#6ec3ff"/><circle r="4" cx="-4" cy="0" fill="#6ec3ff"/><circle r="2.5" fill="#ffd400"/></g></g>
<!-- MALE: red cap, cream spots, tall stem -->
<g class="walkM"><g class="bob">
 <g class="leg"><rect x="138" y="214" width="12" height="18" rx="6" fill="#f0d9a6" stroke="#5a2d12" stroke-width="3"/></g>
 <g class="leg leg2"><rect x="156" y="214" width="12" height="18" rx="6" fill="#f0d9a6" stroke="#5a2d12" stroke-width="3"/></g>
 <g class="armOut"><path d="M110 168 L132 172" stroke="#5a2d12" stroke-width="5" stroke-linecap="round"/><circle cx="106" cy="166" r="8" fill="#fff3d6" stroke="#5a2d12" stroke-width="3"/><path d="M104 158 q2 -8 6 -2" fill="#fff3d6" stroke="#5a2d12" stroke-width="2.5"/></g>
 <path d="M130 120 Q124 205 136 218 Q153 226 170 218 Q182 205 176 120 Z" fill="url(#ks)" stroke="#5a2d12" stroke-width="4" stroke-linejoin="round"/>
 <g class="armIn"><path d="M174 172 L218 172" stroke="#5a2d12" stroke-width="5" stroke-linecap="round"/><circle cx="221" cy="172" r="7.5" fill="#fff3d6" stroke="#5a2d12" stroke-width="3"/></g>
 <g class="eyes"><ellipse cx="144" cy="146" rx="5" ry="6.5" fill="#2a1408"/><ellipse cx="162" cy="146" rx="5" ry="6.5" fill="#2a1408"/><circle cx="145.5" cy="144" r="1.8" fill="#fff"/><circle cx="163.5" cy="144" r="1.8" fill="#fff"/></g>
 <path d="M140 136 q4 -4 8 0 M158 136 q4 -4 8 0" stroke="#2a1408" stroke-width="2.5" fill="none" stroke-linecap="round"/>
 <path d="M144 158 Q153 172 162 158 Z" fill="#e8414f" stroke="#2a1408" stroke-width="2.5" stroke-linejoin="round"/>
 <ellipse cx="136" cy="158" rx="5" ry="3" fill="#ff8a8a" opacity=".7"/><ellipse cx="170" cy="158" rx="5" ry="3" fill="#ff8a8a" opacity=".7"/>
 <path d="M96 118 Q92 72 130 52 Q153 40 176 52 Q214 72 210 118 Q200 128 153 126 Q106 128 96 118 Z" fill="url(#kr)" stroke="#5a2d12" stroke-width="4.5" stroke-linejoin="round"/>
 <path d="M106 120 Q153 134 200 120" stroke="#e9c896" stroke-width="5" fill="none"/>
 <g fill="#fbe7b5"><ellipse cx="126" cy="82" rx="12" ry="10"/><ellipse cx="170" cy="70" rx="14" ry="11"/><ellipse cx="196" cy="98" rx="8" ry="9"/><ellipse cx="150" cy="56" rx="7" ry="4"/></g>
</g></g>
<!-- FEMALE: purple cap, white spots, round body, bow -->
<g class="walkF"><g class="bob bobF">
 <g class="leg"><ellipse cx="238" cy="224" rx="9" ry="8" fill="#f5e3c2" stroke="#5a2d12" stroke-width="3"/></g>
 <g class="leg leg2"><ellipse cx="260" cy="224" rx="9" ry="8" fill="#f5e3c2" stroke="#5a2d12" stroke-width="3"/></g>
 <g class="armOutF"><path d="M286 176 L298 172" stroke="#5a2d12" stroke-width="5" stroke-linecap="round"/><circle cx="302" cy="170" r="7.5" fill="#fff3d6" stroke="#5a2d12" stroke-width="3"/></g>
 <ellipse cx="249" cy="180" rx="38" ry="42" fill="url(#ks)" stroke="#5a2d12" stroke-width="4"/>
 <g class="armInF"><path d="M216 176 L182 173" stroke="#5a2d12" stroke-width="5" stroke-linecap="round"/><circle cx="179" cy="173" r="7" fill="#fff3d6" stroke="#5a2d12" stroke-width="3"/></g>
 <g class="eyes"><ellipse cx="238" cy="172" rx="7" ry="8" fill="#3b1f0e"/><ellipse cx="260" cy="172" rx="7" ry="8" fill="#3b1f0e"/><circle cx="240.5" cy="169" r="2.6" fill="#fff"/><circle cx="262.5" cy="169" r="2.6" fill="#fff"/></g>
 <path d="M230 164 l-4 -3 M268 164 l4 -3" stroke="#3b1f0e" stroke-width="2.2" stroke-linecap="round"/>
 <path d="M242 184 Q249 194 256 184 Z" fill="#ff5a7a" stroke="#3b1f0e" stroke-width="2.2" stroke-linejoin="round"/>
 <ellipse cx="226" cy="186" rx="6" ry="3.5" fill="#ff8fb0" opacity=".85"/><ellipse cx="272" cy="186" rx="6" ry="3.5" fill="#ff8fb0" opacity=".85"/>
 <path d="M190 140 Q184 92 222 70 Q249 58 276 70 Q314 92 308 140 Q296 152 249 150 Q202 152 190 140 Z" fill="url(#kp)" stroke="#4a1f73" stroke-width="4.5" stroke-linejoin="round"/>
 <path d="M200 142 Q249 158 298 142" stroke="#f1d7a8" stroke-width="5" fill="none"/>
 <g fill="#fff"><ellipse cx="222" cy="100" rx="12" ry="10"/><ellipse cx="262" cy="80" rx="15" ry="9"/><ellipse cx="292" cy="112" rx="9" ry="11"/><ellipse cx="248" cy="118" rx="7" ry="6"/></g>
 <g transform="translate(286 82)"><path d="M0 0 l-10 -7 v14z M0 0 l10 -7 v14z" fill="#ff5a9a" stroke="#a3155a" stroke-width="2"/><circle r="3.5" fill="#ff86b8" stroke="#a3155a" stroke-width="2"/></g>
</g></g>
<g class="heart"><path d="M200 128 C186 116 178 102 188 94 C195 89 200 95 200 99 C200 95 205 89 212 94 C222 102 214 116 200 128Z" fill="#ff3b5c" stroke="#fff" stroke-width="3"/></g>
<g fill="#ff7aa8"><path class="mini a" d="M180 92 c-6 -5 -8 -11 -3 -13 c3 -1 4 2 4 3 c0 -1 1 -4 4 -3 c5 2 2 8 -5 13z"/><path class="mini b" d="M222 86 c-6 -5 -8 -11 -3 -13 c3 -1 4 2 4 3 c0 -1 1 -4 4 -3 c5 2 2 8 -5 13z"/><path class="mini c" d="M204 80 c-5 -4 -6 -9 -2 -11 c2 -1 3 2 3 2 c0 -1 1 -3 3 -2 c4 2 2 7 -4 11z"/></g>
<g fill="#ffd400"><path class="spark" d="M60 60 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"/><path class="spark s2" d="M340 50 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"/><path class="spark s3" d="M360 150 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/></g>
</svg>`;
let el=null,shownAt=0,hideT=null;
function show(){if(el){el.classList.remove('hide');return}el=document.createElement('div');el.id='ktLoader';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
 el.innerHTML=SCENE+'<div class="brand">KUY TALK</div><div class="lt">กำลังโหลด<i>.</i><i>.</i><i>.</i></div><div class="bar"><b></b></div>';document.body.appendChild(el);shownAt=Date.now()}
function hide(min=2600){if(!el)return;clearTimeout(hideT);const wait=Math.max(0,min-(Date.now()-shownAt));hideT=setTimeout(()=>{el.classList.add('hide');const e=el;el=null;setTimeout(()=>e.remove(),650)},wait)}
window.KTLoader={show,hide,restart(){if(el){el.remove();el=null}show()}};
// 1) initial app load (assets/fonts)
show();const firstHide=()=>hide(1800);if(document.readyState==='complete')firstHide();else addEventListener('load',firstHide);
// 2) after age-gate confirmation: replay full scene until data loaded (min 2.6s, max 9s)
if(typeof window.checkAge==='function'){const f=window.checkAge;window.checkAge=function(){const dob=(document.getElementById('dobInput')||{}).value;let ok=false;
 if(dob){const age=Math.floor((Date.now()-new Date(dob))/31557600000);ok=age>=18}
 if(ok){KTLoader.restart();let done=false;const fin=()=>{if(done)return;done=true;hide(3200)};addEventListener('kt:loaded',fin,{once:true});setTimeout(fin,9000)}
 return f.apply(this,arguments)}}
})();
