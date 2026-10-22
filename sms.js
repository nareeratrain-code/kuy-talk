// Pluggable SMS sender. SMS_PROVIDER = thaibulksms | twilio | console (default).
// thaibulksms: THAIBULKSMS_API_KEY, THAIBULKSMS_API_SECRET, THAIBULKSMS_SENDER (approved sender name), optional THAIBULKSMS_FORCE=standard|corporate
// twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM (number / alphanumeric ID) or TWILIO_MESSAGING_SERVICE_SID
const E=process.env;
const basic=(a,b)=>'Basic '+Buffer.from(a+':'+b).toString('base64');
const adapters={
 thaibulksms:{ok:()=>!!(E.THAIBULKSMS_API_KEY&&E.THAIBULKSMS_API_SECRET&&E.THAIBULKSMS_SENDER),
  async send(to,text){const body=new URLSearchParams({msisdn:to,message:text,sender:E.THAIBULKSMS_SENDER});if(E.THAIBULKSMS_FORCE)body.set('force',E.THAIBULKSMS_FORCE);
   const r=await fetch('https://api-v2.thaibulksms.com/sms',{method:'POST',headers:{authorization:basic(E.THAIBULKSMS_API_KEY,E.THAIBULKSMS_API_SECRET),'content-type':'application/x-www-form-urlencoded',accept:'application/json'},body});
   if(!r.ok)throw new Error('thaibulksms '+r.status+' '+(await r.text()).slice(0,200));return true}},
 twilio:{ok:()=>!!(E.TWILIO_ACCOUNT_SID&&E.TWILIO_AUTH_TOKEN&&(E.TWILIO_FROM||E.TWILIO_MESSAGING_SERVICE_SID)),
  async send(to,text){const body=new URLSearchParams({To:to,Body:text});E.TWILIO_MESSAGING_SERVICE_SID?body.set('MessagingServiceSid',E.TWILIO_MESSAGING_SERVICE_SID):body.set('From',E.TWILIO_FROM);
   const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${E.TWILIO_ACCOUNT_SID}/Messages.json`,{method:'POST',headers:{authorization:basic(E.TWILIO_ACCOUNT_SID,E.TWILIO_AUTH_TOKEN),'content-type':'application/x-www-form-urlencoded'},body});
   if(!r.ok)throw new Error('twilio '+r.status+' '+(await r.text()).slice(0,200));return true}},
 console:{ok:()=>true,async send(to,text){console.log('[SMS console]',to.slice(0,6)+'****',text.replace(/\d{6}/,'******'));return true}}};
const name=(E.SMS_PROVIDER||'console').toLowerCase();
const A=adapters[name]||adapters.console;
// dev mode = no real provider configured → OTP shown on screen ("โหมดทดสอบ")
const devMode=!(adapters[name]&&name!=='console'&&A.ok());
if(!devMode)console.log('SMS provider:',name);else if(name!=='console')console.warn('SMS_PROVIDER='+name+' missing credentials → falling back to console dev mode');
module.exports={send:(to,text)=>(devMode?adapters.console:A).send(to,text),devMode,provider:devMode?'console':name};
