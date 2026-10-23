// Rich profile: 9 photos (stored as separate docs in db.pics), bio/prompts/favourites/lifestyle, discovery settings
const crypto=require('crypto');const {F,PROMPTS,MOVIES}=require('./profile-fields');
const PQ=new Set(Object.values(PROMPTS).flat());
const IMG=x=>typeof x==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x)&&x.length<700000;
const MAXP=9;
module.exports=function(X){const {app,db,save,auth,me,clean,limited,isPrem}=X;db.pics=db.pics||{};
 const s=(v,n)=>typeof v==='string'?clean(v).slice(0,n):'';
 // client field defs
 app.get('/kt-fields.js',(req,res)=>{res.type('js').set('Cache-Control','no-cache').send('window.KTPF='+JSON.stringify({F,PROMPTS,MOVIES,MAXP}))});
 // photo storage
 const putPic=(uid,d)=>{const k=crypto.randomBytes(10).toString('hex');db.pics[k]={uid,d,ts:Date.now()};return '/api/pic/'+k};
 const delPic=url=>{const m=/^\/api\/pic\/([a-f0-9]+)$/.exec(url||'');if(m)delete db.pics[m[1]]};
 app.get('/api/pic/:k',(req,res)=>{const p=db.pics[req.params.k];if(!p)return res.status(404).end();const m=/^data:(image\/\w+);base64,(.*)$/.exec(p.d);res.set('Cache-Control','public, max-age=31536000, immutable').type(m[1]).send(Buffer.from(m[2],'base64'))});
 // migrate legacy inline data-URL photos/avatars out of user docs (keeps user docs well under Firestore 1MB)
 setTimeout(()=>{let n=0;for(const u of Object.values(db.users)){if(Array.isArray(u.photos)&&u.photos.some(p=>/^data:/.test(p))){u.photos=u.photos.map(p=>/^data:/.test(p)?putPic(u.id,p):p);n++}if(/^data:/.test(u.avatar||'')){u.avatar=u.photos&&u.photos[0]||putPic(u.id,u.avatar);n++}}if(n){console.log('migrated photos for',n,'users');save()}},0);
 const syncAv=u=>{if(u.photos.length)u.avatar=u.photos[0];else if(/^(data:|\/api\/pic)/.test(u.avatar||''))u.avatar='🙂'};
 // replaces old 4-photo endpoints
 app.post('/api/photos',auth,(req,res)=>{const u=req.u;u.photos=u.photos||[];if(limited('ph:'+u.id,20,60000))return res.status(429).json({error:'อัปโหลดถี่เกินไป'});
  if(!IMG(req.body.photo))return res.status(400).json({error:'รูปไม่ถูกต้องหรือใหญ่เกินไป'});if(u.photos.length>=MAXP)return res.status(400).json({error:'ใส่รูปได้สูงสุด 9 รูป'});
  const url=putPic(u.id,req.body.photo),at=Number.isInteger(req.body.at)?req.body.at:-1;
  if(at>=0&&at<u.photos.length){delPic(u.photos[at]);u.photos[at]=url}else u.photos.push(url);syncAv(u);save();res.json(me(u))});
 app.delete('/api/photos/:i',auth,(req,res)=>{const u=req.u;u.photos=u.photos||[];const i=+req.params.i;if(i>=0&&i<u.photos.length){delPic(u.photos[i]);u.photos.splice(i,1)}syncAv(u);save();res.json(me(u))});
 app.post('/api/photos/order',auth,(req,res)=>{const u=req.u,o=req.body.order,P=u.photos||[];if(!Array.isArray(o)||o.length!==P.length||new Set(o).size!==P.length||!o.every(i=>Number.isInteger(i)&&i>=0&&i<P.length))return res.status(400).json({error:'ลำดับไม่ถูกต้อง'});
  u.photos=o.map(i=>P[i]);syncAv(u);save();res.json(me(u))});
 // details
 app.post('/api/profile/details',auth,(req,res)=>{const u=req.u,b=req.body||{},d=u.details=u.details||{};
  if(b.bio!=null)u.bio=s(b.bio,500);
  for(const k of ['job','company','school'])if(b[k]!=null)d[k]=s(b[k],50);
  for(const k of ['series','team','music','games'])if(b[k]!=null)d[k]=s(b[k],100);
  if(b.social!=null){const h=String(b.social).trim().replace(/^@/,'');if(h&&!/^[A-Za-z0-9._]{1,30}$/.test(h))return res.status(400).json({error:'ชื่อ Instagram ไม่ถูกต้อง'});d.social=h}
  if(b.height!=null){const h=parseInt(b.height);d.height=h>=120&&h<=230?h:null}
  if(b.movies!=null){if(!Array.isArray(b.movies))return res.status(400).json({error:'หนังไม่ถูกต้อง'});d.movies=[...new Set(b.movies.map(x=>s(x,40)).filter(Boolean))].slice(0,6)}
  if(b.prompts!=null){if(!Array.isArray(b.prompts))return res.status(400).json({error:'ประโยคไม่ถูกต้อง'});d.prompts=b.prompts.filter(p=>p&&PQ.has(p.q)&&s(p.a,150)).slice(0,3).map(p=>({q:p.q,a:s(p.a,150)}))}
  for(const [k,f] of Object.entries(F)){if(b[k]===undefined)continue;const v=b[k];
   if(f.multi){if(!Array.isArray(v)||v.some(x=>!f.o.includes(x)))return res.status(400).json({error:f.t+' ไม่ถูกต้อง'});d[k]=[...new Set(v)].slice(0,f.multi)}
   else{if(v!==''&&v!==null&&!f.o.includes(v))return res.status(400).json({error:f.t+' ไม่ถูกต้อง'});d[k]=v||null}}
  save();res.json(me(u))});
 // discovery settings
 app.post('/api/discovery',auth,(req,res)=>{const u=req.u,b=req.body||{},f=u.filters=u.filters||{},p=u.prefs=u.prefs||{};const n=(v,lo,hi)=>{v=parseInt(v);return v>=lo&&v<=hi?v:null};
  if('maxDist' in b)f.maxDist=n(b.maxDist,1,160);if('outside' in b)f.outside=!!b.outside;if('gender' in b)f.gender=['m','f'].includes(b.gender)?b.gender:'';
  if('ageMin' in b)f.ageMin=n(b.ageMin,18,99);if('ageMax' in b)f.ageMax=n(b.ageMax,18,99);if(f.ageMin&&f.ageMax&&f.ageMin>f.ageMax)[f.ageMin,f.ageMax]=[f.ageMax,f.ageMin];
  if('minPhotos' in b)f.minPhotos=n(b.minPhotos,1,9)||0;if('hasBio' in b)f.hasBio=!!b.hasBio;
  if('visibility' in b){if(!['std','incog'].includes(b.visibility))return res.status(400).json({error:'ค่าไม่ถูกต้อง'});if(b.visibility==='incog'&&!isPrem(u))return res.status(403).json({error:'โหมดไม่ระบุตัวตนสำหรับ Premium เท่านั้น'});p.visibility=b.visibility}
  if('discovery' in b)p.discovery=!!b.discovery;if('verifiedOnly' in b)p.verifiedOnly=!!b.verifiedOnly;if('unit' in b&&['km','mi'].includes(b.unit))p.unit=b.unit;
  save();res.json(me(u))});
 return {delPic,IMG}};
// helpers used by app.js
module.exports.pubExt=u=>{const d=u.details||{};return{details:{job:d.job||'',company:d.company||'',school:d.school||'',series:d.series||'',team:d.team||'',music:d.music||'',games:d.games||'',social:d.social||'',height:d.height||null,movies:d.movies||[],prompts:d.prompts||[],...Object.fromEntries(Object.keys(F).map(k=>[k,d[k]||(F[k].multi?[]:null)]))}}};
// discovery visibility: hidden if discovery off, or incognito (unless they liked the viewer)
module.exports.visibleTo=(db,viewer,x)=>{const p=x.prefs||{};if(p.discovery===false)return false;if(p.visibility==='incog'){return db.likes.some(l=>l.from===x.id&&l.to===viewer.id&&l.like)}return true};
module.exports.extraPass=(u,x)=>{const f=u.filters||{};if(f.minPhotos&&(x.photos||[]).length<f.minPhotos)return false;if(f.hasBio&&!String(x.bio||'').trim())return false;return true};
