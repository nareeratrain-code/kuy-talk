// Offline Thailand geo helpers: reverse geocode (nearest amphoe centroid), haversine,
// privacy fuzzing and a grid spatial index. Data: geo/th-districts.json
// [nameTh, provinceId, lat, lng] built from GeoNames ADM2 (CC BY 4.0) joined with
// thailand-geography-data district names (MIT).
const D=require('./geo/th-districts.json');
const R=6371,rad=x=>x*Math.PI/180;
const hav=(a,b,c,d)=>{const x=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;return 2*R*Math.asin(Math.sqrt(x))};
const TH={latMin:5.4,latMax:20.6,lngMin:97.2,lngMax:105.8};
const inTH=(lat,lng)=>lat>=TH.latMin&&lat<=TH.latMax&&lng>=TH.lngMin&&lng<=TH.lngMax;
// district lookup grid (0.5°)
const DG=new Map(),dk=(a,b)=>Math.floor(a*2)+':'+Math.floor(b*2);
for(const d of D){const k=dk(d[2],d[3]);(DG.get(k)||DG.set(k,[]).get(k)).push(d)}
function reverse(lat,lng){if(!inTH(lat,lng))return null;let best=null,bd=1e9;const a=Math.floor(lat*2),b=Math.floor(lng*2);
 for(let r=1;r<=3&&!best;r++)for(let i=a-r;i<=a+r;i++)for(let j=b-r;j<=b+r;j++)for(const d of DG.get(i+':'+j)||[]){const x=hav(lat,lng,d[2],d[3]);if(x<bd){bd=x;best=d}}
 return best&&bd<80?{district:best[0],province:best[1]}:null}
// province centroid = mean of its district centroids (fallback when GPS denied)
const PC={};for(const d of D){const p=PC[d[1]]=PC[d[1]]||{lat:0,lng:0,n:0};p.lat+=d[2];p.lng+=d[3];p.n++}for(const k in PC){PC[k].lat/=PC[k].n;PC[k].lng/=PC[k].n}
const provCentroid=p=>PC[p]?{lat:PC[p].lat,lng:PC[p].lng}:null;
// privacy: snap to ~250 m grid + per-user stable offset (≤ ~100 m). Exact coords are never stored.
const STEP=0.0025;
function fuzz(lat,lng,seed){let h=0;for(const c of String(seed||''))h=(h*31+c.charCodeAt(0))>>>0;const ox=((h%1000)/1000-0.5)*0.0018,oy=(((h>>10)%1000)/1000-0.5)*0.0018;
 return{lat:+(Math.round(lat/STEP)*STEP+oy).toFixed(4),lng:+(Math.round(lng/STEP)*STEP+ox).toFixed(4)}}
const label=(km,sameDistrict,district,prov)=>km==null?null:sameDistrict&&district?(prov==='bangkok'?'ในเขต ':'ในอำเภอ ')+district:km<1?'< 1 km':km<10?km.toFixed(1)+' km':Math.round(km)+' km';
// grid spatial index (0.25° ≈ 28 km cells) for nationwide nearby queries
class Grid{constructor(c=0.25){this.c=c;this.m=new Map();this.at=new Map()}
 key(lat,lng){return Math.floor(lat/this.c)+':'+Math.floor(lng/this.c)}
 put(id,lat,lng){this.del(id);if(lat==null)return;const k=this.key(lat,lng);(this.m.get(k)||this.m.set(k,new Set()).get(k)).add(id);this.at.set(id,k)}
 del(id){const k=this.at.get(id);if(k){this.m.get(k)?.delete(id);this.at.delete(id)}}
 near(lat,lng,km){const n=Math.ceil(km/(this.c*111))+1,a=Math.floor(lat/this.c),b=Math.floor(lng/this.c),out=[];for(let i=a-n;i<=a+n;i++)for(let j=b-n;j<=b+n;j++)for(const id of this.m.get(i+':'+j)||[])out.push(id);return out}}
const randomPoint=i=>{const d=D[(i*7919)%D.length];return{lat:d[2]+((i*37)%20-10)/1000,lng:d[3]+((i*53)%20-10)/1000}};
module.exports={D,hav,reverse,provCentroid,fuzz,label,Grid,inTH,randomPoint,DISTRICTS:D.length};
