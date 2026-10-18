// Same-origin adapter for the dashboard. Session cookies are HttpOnly.
var localAuth={currentUser:null},localToken='',localListeners=[]
async function localCall(action,body){
  var response=await fetch('/local/'+action,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})})
  var result=await response.json();if(!response.ok)throw new Error(result.error||'Request failed');return result
}
function localRevive(v){
  if(v&&typeof v==='object'){
    if(Number.isFinite(v.__timestamp)){v.toMillis=function(){return v.__timestamp};v.toDate=function(){return new Date(v.__timestamp)}}
    else Object.keys(v).forEach(function(k){v[k]=localRevive(v[k])})
  }return v
}
function localUser(result){localToken=result.token||'';var u=result.user||null;if(u){u.getIdToken=async function(){return localToken};u.reload=async function(){}}localAuth.currentUser=u;localListeners.forEach(function(fn){fn(u)});return {user:u}}
function initializeApp(){return {}} function getAuth(){return localAuth} function getFirestore(){return {}}
function doc(db,...parts){return {path:parts.join('/'),kind:'doc'}}
function collection(db,...parts){return {path:parts.join('/'),kind:'collection'}}
function localSnap(path,result){return {id:path.split('/').pop(),exists:()=>!!result.exists,data:()=>localRevive(result.data)}}
async function getDoc(ref){return localSnap(ref.path,await localCall('read',{path:ref.path}))}
async function getDocs(ref){var s=await localCall('list',{path:ref.path,filters:ref.filters||[]});var docs=s.docs.map(d=>localSnap(ref.path+'/'+d.id,{exists:true,data:d.data}));return {docs,size:docs.length,empty:!docs.length,metadata:{fromCache:false},forEach:fn=>docs.forEach(fn)}}
async function setDoc(ref,data,opts){await localCall('write',{path:ref.path,data,merge:!!opts?.merge})}
async function updateDoc(ref,data){return setDoc(ref,data,{merge:true})}
async function deleteDoc(ref){await localCall('write',{path:ref.path,remove:true})}
function serverTimestamp(){return {__op:'timestamp'}} function deleteField(){return {__op:'delete'}}
function where(...args){return {where:args}} function orderBy(...args){return {orderBy:args}} function limit(n){return {limit:n}} function query(ref,...filters){return {...ref,filters}}
function onSnapshot(ref,...args){var fn=args.find(a=>typeof a==='function'),error=args.filter(a=>typeof a==='function')[1]||function(){},stopped=false,busy=false;
  async function poll(){if(stopped||busy)return;busy=true;try{var s=await(ref.kind==='doc'?getDoc(ref):getDocs(ref));if(!stopped)fn(s)}catch(e){if(!stopped)error(e)}finally{busy=false}}
  poll();var timer=setInterval(poll,2000);return function(){stopped=true;clearInterval(timer)}
}
async function runTransaction(db,fn){var writes=[],checks=[];var result=await fn({get:async ref=>{var s=await getDoc(ref);checks.push({path:ref.path,data:s.data()??null});return s},set:(ref,data,opts)=>writes.push({path:ref.path,data,merge:!!opts?.merge}),update:(ref,data)=>writes.push({path:ref.path,data,merge:true}),delete:ref=>writes.push({path:ref.path,remove:true})});await localCall('transaction',{writes,checks});return result}
function onAuthStateChanged(auth,fn){localListeners.push(fn);localCall('session').then(localUser).catch(()=>localUser({}));return ()=>{localListeners=localListeners.filter(f=>f!==fn)}}
async function signInWithEmailAndPassword(auth,email,password){return localUser(await localCall('login',{email,password}))}
async function createUserWithEmailAndPassword(auth,email,password){return localUser(await localCall('register',{email,password,setupToken:document.getElementById('local-admin-token').value}))}
async function signOut(){await localCall('logout');localUser({})}
async function deleteUser(){await localCall('delete-account');localUser({})}
async function sendEmailVerification(){}
async function sendPasswordResetEmail(){throw Error('Local accounts: ask the server administrator to reset your password.')}
function GoogleAuthProvider(){} function OAuthProvider(){} async function signInWithPopup(){throw Error('Local mode uses email and password sign-in.')}
