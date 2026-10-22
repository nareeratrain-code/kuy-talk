// Copy a Kuy Talk data.json into Firestore (server-only collections kt_*).
// Usage: FIREBASE_SERVICE_ACCOUNT='<json or base64>' node scripts/migrate-to-firestore.js [path/to/data.json] [--force]
//   (or FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=demo-kuytalk for the emulator)
// Refuses to overwrite a non-empty Firestore unless --force (which REPLACES its contents with the file).
const fs=require('fs'),path=require('path');
const file=process.argv.find((a,i)=>i>1&&!a.startsWith('--'))||path.join(__dirname,'..','data.json');const force=process.argv.includes('--force');
(async()=>{const data=JSON.parse(fs.readFileSync(file,'utf8'));const blank={users:{},likes:[],matches:[],messages:{},rooms:{},moments:[],friends:[],blocks:[],reports:[],visits:[],sessions:{},consents:[],tickets:[],dataRequests:[],trafficLog:[]};
 const S={};await require('../store-firestore').init(S,blank);
 const existing=Object.keys(S.db.users).length;if(existing&&!force){console.error(`Firestore already has ${existing} users — rerun with --force to replace it with ${file}`);process.exit(1)}
 for(const k of Object.keys(S.db))if(!(k in data))S.db[k]=JSON.parse(JSON.stringify(blank[k]??[]));Object.assign(S.db,data);
 await S.flush();const c={};for(const k in S.db)c[k]=Array.isArray(S.db[k])?S.db[k].length:Object.keys(S.db[k]||{}).length;console.log('migrated',file,c);process.exit(0)})().catch(e=>{console.error(e);process.exit(1)});
