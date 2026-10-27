const webpush=require('web-push');

const subject=()=>String(process.env.VAPID_SUBJECT||'').trim();
const publicKey=()=>String(process.env.VAPID_PUBLIC_KEY||'').trim();
const privateKey=()=>String(process.env.VAPID_PRIVATE_KEY||'').trim();
const enabled=()=>!!(subject()&&publicKey()&&privateKey());

function configure(){
  if(!enabled())return false;
  webpush.setVapidDetails(subject(),publicKey(),privateKey());
  return true;
}

module.exports={webpush,subject,publicKey,privateKey,enabled,configure};
