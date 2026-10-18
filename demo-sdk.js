// Browser-only Firebase-shaped adapter; all records stay in memory.
var demoUser={uid:'demo-owner',email:'owner@example.com',emailVerified:true,getIdToken:async()=> 'demo'}
var demoRecords={},demoWatchers=[]
var stamp=function(ms){return {toMillis:function(){return ms}}}
var samples=__DEMO_SAMPLES__
samples.forEach(function(s,i){
 var id='24e1241280'+String(i).padStart(6,'0'),now=Date.now(),history=[]
 for(var n=0;n<480;n++){var values={};Object.keys(s[2]).forEach(function(k){var v=s[2][k];values[k]=/status|battery|region|people/.test(k)?v:Number((v+Math.sin(n/12+i)*Math.max(Math.abs(v)*0.06,0.3)).toFixed(2))});history.push({ts:now-(479-n)*3600000,values:values})}
 demoRecords['workspaces/demo-owner/devices/'+id]={name:s[1],type:s[0],eui:id,vendor:'Milesight',modelSource:'gateway',lastSeenAt:stamp(now),rssi:-67-i*3,snr:9.5,firmwareVersion:'1.2.8'}
 demoRecords['workspaces/demo-owner/telemetry/'+id]={values:s[2],updatedAt:stamp(now),history:history.slice(-20)}
 history.forEach(function(row,n){demoRecords['workspaces/demo-owner/telemetry/'+id+'/readings/'+n]=row})
})
demoRecords['users/demo-owner']={workspaceLabel:'smart_office_db'}
demoRecords['workspaces/demo-owner/settings/mqttCredentials']={username:'demo-workspace',password:'demo-password'}
demoRecords['workspaces/demo-owner/settings/storage']={usedBytes:48300000,storedReadings:115200,prunedReadings:0}
demoRecords['workspaces/demo-owner/settings/telegram']={hasToken:true,hasKey:true,status:'connected',geminiModel:'gemini-2.0-flash',sessionMinutes:60}
demoRecords['workspaces/demo-owner/settings/members']={emails:{'alex@example.com':true,'sam@example.com':true}}
demoRecords['workspaces/demo-owner/settings/telegramUsers']={users:{}}
function initializeApp(){return {}} function getAuth(){return {currentUser:demoUser}} function getFirestore(){return {}}
function doc(db,...parts){return parts.join('/')} function collection(db,...parts){return parts.join('/')}
function demoSnap(path){return {id:path.split('/').pop(),exists:()=>path in demoRecords,data:()=>demoRecords[path]}}
function demoCollection(path){var rows=Object.keys(demoRecords).filter(p=>p.startsWith(path+'/')&&p.slice(path.length+1).indexOf('/')<0).map(demoSnap);return {size:rows.length,metadata:{fromCache:false},forEach:fn=>rows.forEach(fn)}}
function onSnapshot(path,...args){var fn=args.find(a=>typeof a==='function');var notify=()=>{if(path.path)getDocs(path).then(fn);else fn(path in demoRecords?demoSnap(path):demoCollection(path))};demoWatchers.push(notify);setTimeout(notify,0);return ()=>{demoWatchers=demoWatchers.filter(x=>x!==notify)}}
async function getDoc(path){return demoSnap(path)}
async function setDoc(path,data,opts){demoRecords[path]=opts&&opts.merge?{...demoRecords[path],...data}:data;demoWatchers.forEach(fn=>fn())}
async function updateDoc(path,data){return setDoc(path,data,{merge:true})}
async function deleteDoc(path){delete demoRecords[path];demoWatchers.forEach(fn=>fn())}
function deleteField(){return null} function serverTimestamp(){return stamp(Date.now())}
function onAuthStateChanged(auth,fn){setTimeout(()=>fn(demoUser),0)}
async function signOut(){location.reload()}
async function signInWithEmailAndPassword(){} async function createUserWithEmailAndPassword(){} async function deleteUser(){} async function sendPasswordResetEmail(){} async function sendEmailVerification(){} async function signInWithPopup(){}
function GoogleAuthProvider(){} function OAuthProvider(){}
async function runTransaction(db,fn){return fn({get:getDoc,set:setDoc,update:updateDoc,delete:deleteDoc})}
function where(...args){return {where:args}} function orderBy(){return {}} function limit(n){return {limit:n}} function query(path,...filters){return {path,filters}}
async function getDocs(q){var rows=[];demoCollection(q.path||q).forEach(d=>rows.push(d));if(q.filters){q.filters.forEach(f=>{if(f.where)rows=rows.filter(d=>d.data()[f.where[0]]>=f.where[2])});rows.sort((a,b)=>(b.data().ts||b.data().at)-(a.data().ts||a.data().at));q.filters.forEach(f=>{if(f.limit)rows=rows.slice(0,f.limit)})}return {size:rows.length,forEach:fn=>rows.forEach(fn)}}
var demoFetch=window.fetch.bind(window)
window.fetch=async function(url,options){
 var response=await demoFetch(url,options)
 if(url==='/downlink'&&response.ok){var result=await response.clone().json();if(result.ok){var body=JSON.parse(options.body);await setDoc('workspaces/demo-owner/commands/'+Date.now(),{...result,deviceId:body.deviceId,eui:body.deviceId,at:Date.now(),status:'simulated'});return new Response(JSON.stringify({...result,status:'simulated',detail:'Demo: command simulated. No MQTT message or radio command was sent.'}),{headers:{'content-type':'application/json'}})}}
 return response
}
