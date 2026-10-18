import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import net from 'node:net'
import vm from 'node:vm'

async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p}
test('local server boots without Firebase, serves an offline SDK and persists MQTT readings', {timeout:30000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'milesight-server-')),web=await freePort(),mqtt=await freePort()
  const child=spawn(process.execPath,[fileURLToPath(new URL('../milesight.js',import.meta.url))],{cwd:dir,env:{...process.env,STORAGE_MODE:'duckdb',DUCKDB_PATH:join(dir,'live.duckdb'),WEB_PORT:String(web),MQTT_PORT:String(mqtt),FIREBASE_SETUP_TOKEN:'integration-admin'},stdio:['ignore','pipe','pipe'],windowsHide:true})
  let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b)
  const base='http://127.0.0.1:'+web
  let token=''
  async function call(action,data){const r=await fetch(base+'/local/'+action,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(data)});const raw=await r.text();assert.ok(r.headers.get('content-type')?.includes('application/json'),action+': '+raw.slice(0,80)+' logs: '+logs);const body=JSON.parse(raw);assert.equal(r.status,200,JSON.stringify(body));return body}
  try {
    let up=false
    for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){up=true;break}}catch{}await new Promise(r=>setTimeout(r,100));if(child.exitCode!==null)break}
    assert.ok(up,logs)
    const hr=await fetch(base+'/health');assert.ok(hr.headers.get('content-type')?.includes('application/json'),logs);const health=await hr.json();assert.equal(health.storageMode,'duckdb');assert.equal(health.version,'2.1.1')
    const page=await(await fetch(base)).text();assert.doesNotMatch(page,/from 'https:\/\/www.gstatic.com\/firebasejs/);assert.match(page,/var LOCAL_MODE = true/)
    for(const script of page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1])
    assert.equal((await fetch(base+'/system-status')).status,401)
    assert.equal((await fetch(base+'/setup/storage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'firebase'})})).status,401)
    assert.equal((await fetch(base+'/setup/storage',{method:'POST',headers:{'content-type':'application/json','x-setup-token':'integration-admin'},body:JSON.stringify({mode:'invalid'})})).status,400)
    assert.equal((await fetch(base+'/setup/storage',{method:'POST',headers:{'content-type':'application/json','x-setup-token':'integration-admin'},body:JSON.stringify({mode:'duckdb'})})).status,200)
    const account=await call('register',{email:'test@example.com',password:'test-password-123',setupToken:'integration-admin'});token=account.token
    const uid=account.user.uid
    await call('transaction',{writes:[{path:'workspaceNames/test_db',data:{uid}},{path:'users/'+uid,data:{workspaceLabel:'test_db',email:account.user.email}}]})
    const password='test-broker-password-12345'
    await call('write',{path:'brokerUsers/integration',data:{uid,password,topicPrefix:'test_db'}})
    const socket=net.connect(mqtt,'127.0.0.1');await new Promise((r,j)=>{socket.once('connect',r);socket.once('error',j)})
    try {
      const str=s=>{const b=Buffer.from(s);return Buffer.concat([Buffer.from([b.length>>8,b.length&255]),b])}
      function packet(header,body){let n=body.length,length=[];do{let b=n%128;n=Math.floor(n/128);if(n)b|=128;length.push(b)}while(n);return Buffer.concat([Buffer.from([header,...length]),body])}
      const ack=new Promise((r,j)=>{socket.once('data',r);socket.once('error',j)})
      socket.write(packet(0x10,Buffer.concat([str('MQTT'),Buffer.from([4,0xc2,0,60]),str('test-client'),str('integration'),str(password)])))
      assert.deepEqual([...(await ack)], [0x20,2,0,0])
      socket.write(packet(0x30,Buffer.concat([str('test_db/uplink'),Buffer.from(JSON.stringify({devEUI:'24e1241280000001',deviceProfileName:'EM300-TH',object:{temperature:23.5,humidity:51,battery:98}}))])))
      let readings=[]
      for(let i=0;i<40;i++){readings=(await call('list',{path:'workspaces/'+uid+'/telemetry/dev-24e1241280000001/readings'})).docs;if(readings.length)break;await new Promise(r=>setTimeout(r,100))}
      assert.equal(readings.length,1,logs);assert.equal(readings[0].data.values.temperature,23.5)
      const status=await(await fetch(base+'/system-status',{headers:{authorization:'Bearer '+token}})).json();assert.equal(status.storageMode,'duckdb');assert.ok(status.databaseBytes>0)
    }finally{socket.destroy()}
  }finally{
    child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null)return r();child.once('exit',r)})
    await rm(dir,{recursive:true,force:true})
  }
})
