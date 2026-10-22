// Shared firebase-admin init. Credentials: FIREBASE_SERVICE_ACCOUNT = service-account JSON (raw or base64).
// With the emulators (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST) only a project id is needed.
let app=null;
function parseJSON(v){if(!v)return null;v=String(v).trim();try{return JSON.parse(v)}catch(e){}try{return JSON.parse(Buffer.from(v,'base64').toString('utf8'))}catch(e){}return null}
const webConfig=()=>{const c=parseJSON(process.env.FIREBASE_WEB_CONFIG);if(!c||!c.apiKey||!c.projectId)return null;const o={};for(const k of ['apiKey','authDomain','projectId','appId','messagingSenderId'])if(c[k])o[k]=String(c[k]);if(process.env.FIREBASE_APPCHECK_SITE_KEY)o.appCheckSiteKey=process.env.FIREBASE_APPCHECK_SITE_KEY;return o};
const emu=()=>!!(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST);
const serviceAccount=()=>parseJSON(process.env.FIREBASE_SERVICE_ACCOUNT);
const configured=()=>!!(serviceAccount()||emu());
function admin(){if(app)return app;const A=require('firebase-admin');const sa=serviceAccount();
 const projectId=(sa&&sa.project_id)||process.env.FIREBASE_PROJECT_ID||(webConfig()||{}).projectId||'demo-kuytalk';
 app=A.initializeApp(sa&&!emu()?{credential:A.credential.cert(sa),projectId}:sa?{credential:A.credential.cert(sa),projectId}:{projectId});return app}
module.exports={admin,webConfig,configured,serviceAccount,emu,parseJSON};
