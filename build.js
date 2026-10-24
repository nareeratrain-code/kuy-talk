// Startup asset build: bundles + minifies index.html's CSS/JS into hashed, immutable files (in memory).
// Falls back to the original public/index.html if anything fails.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const PUB=path.join(__dirname,'public');
function build(){const es=require('esbuild');let html=fs.readFileSync(path.join(PUB,'index.html'),'utf8');const out={};
 const hash=s=>crypto.createHash('sha1').update(s).digest('hex').slice(0,10);
 const css=s=>es.transformSync(s,{loader:'css',minify:true}).code;const js=s=>es.transformSync(s,{loader:'js',minify:true,target:'es2019'}).code;
 // CSS: the two head <style> blocks + linked local stylesheets, in their original order
 const headEnd=html.indexOf('</head>');let head=html.slice(0,headEnd);const parts=[];
 head=head.replace(/<style[^>]*>([\s\S]*?)<\/style>|<link rel="stylesheet" href="\/([\w.-]+\.css)(?:\?v=\d+)?">/g,(m,inl,f)=>{parts.push(inl!=null?inl:fs.readFileSync(path.join(PUB,f),'utf8'));return parts.length===1?'%%CSS%%':''});
 const C=css(parts.join('\n'));const cn='app.'+hash(C)+'.css';out[cn]={type:'text/css',body:C};
 head=head.replace('%%CSS%%',`<link rel="stylesheet" href="/b/${cn}">`);
 // fonts: non-blocking
 head=head.replace(/<link href="(https:\/\/fonts\.googleapis\.com[^"]+)" rel="stylesheet">/,(m,u)=>`<link rel="preload" as="style" href="${u}" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${u}"></noscript>`);
 let body=html.slice(headEnd);
 // JS: inline scripts + local scripts (in order) -> one bundle placed after socket.io
 const J=[];body=body.replace(/<script>([\s\S]*?)<\/script>|<script src="\/([\w.-]+\.js)(?:\?v=\d+)?"><\/script>/g,(m,inl,f)=>{
  if(inl!=null)J.push(inl);else if(f==='kt-fields.js'){const {F,PROMPTS,MOVIES}=require('./profile-fields');J.push('window.KTPF='+JSON.stringify({F,PROMPTS,MOVIES,MAXP:9})+';')}else J.push(fs.readFileSync(path.join(PUB,f),'utf8'));return ''});
 const B=J.map(s=>js(s)).join(';\n');const jn='app.'+hash(B)+'.js';out[jn]={type:'application/javascript',body:B};
 body=body.replace('<script src="/socket.io/socket.io.js"></script>',`<script src="/socket.io/socket.io.min.js"></script><script src="/b/${jn}"></script>`);
 if(!body.includes('/b/'+jn))throw new Error('socket.io tag not found');
 out.html=(head+body).replace(/\n\s*\n/g,'\n');return out}
module.exports=function(app){let A=null;try{if(process.env.NO_BUNDLE!=='1'){A=build();console.log('assets bundled:',Object.keys(A).filter(k=>k!=='html').join(', '))}}catch(e){console.error('bundle failed, serving originals:',e.message);A=null}
 if(!A)return;
 const page=(req,res)=>{res.set('Cache-Control','no-cache').type('html').send(A.html)};
 app.get(['/','/index.html'],page);
 app.get('/b/:f',(req,res)=>{const a=A[req.params.f];if(!a||req.params.f==='html')return res.status(404).end();res.set('Cache-Control','public, max-age=31536000, immutable').type(a.type).send(a.body)})};
