import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'
import { openLocalStore, localFields } from '../local-store.js'
import { authorize, createLocalAuth } from '../local-api.js'
import { sensorCommand } from '../telegram-menu.js'
import { systemStatus } from '../system-status.js'

test('DuckDB persists documents and history, serializes transactions and rolls back failures',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'milesight-')),path=join(dir,'state.duckdb')
  let db=await openLocalStore(path)
  try {
    const ref=db.doc('counter/value')
    await ref.set({count:0,nested:{a:1,b:2},at:localFields.serverTimestamp()})
    await Promise.all(Array.from({length:10},()=>db.runTransaction(async tx=>{const s=await tx.get(ref);tx.set(ref,{count:s.data().count+1},{merge:true})})))
    await ref.set({nested:{a:localFields.delete()}},{merge:true})
    assert.equal((await ref.get()).data().count,10)
    assert.deepEqual((await ref.get()).data().nested,{b:2})
    assert.ok((await ref.get()).data().at.toMillis()>0)
    await assert.rejects(db.runTransaction(async tx=>{tx.set(ref,{count:99});throw Error('stop')}))
    for(const ts of [1,3,2])await db.collection('workspaces/a/telemetry/d/readings').add({ts,values:{temperature:ts}})
    const q=await db.collection('workspaces/a/telemetry/d/readings').where('ts','>=',2).orderBy('ts','desc').limit(1).get()
    assert.equal(q.docs[0].data().ts,3)
    await db.terminate();db=await openLocalStore(path)
    assert.equal((await db.doc('counter/value').get()).data().count,10)
    const status=await systemStatus(path,'duckdb');assert.ok(status.databaseBytes>0);assert.ok(status.memory.totalBytes>0)
  }finally{await db.terminate();await rm(dir,{recursive:true,force:true})}
})

test('local browser API requires admin registration and isolates workspaces and secrets',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'milesight-api-')),db=await openLocalStore(join(dir,'state.duckdb'))
  const auth=createLocalAuth(db,'administrator-token')
  const server=http.createServer(async(req,res)=>{if(!await auth.handle(req,res)){res.writeHead(404);res.end()}})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const url='http://127.0.0.1:'+server.address().port+'/local/'
  async function call(action,body={},token){const r=await fetch(url+action,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
  try {
    assert.equal((await call('register',{email:'owner@example.com',password:'long-password'})).status,403)
    const account=await call('register',{email:'owner@example.com',password:'long-password',setupToken:'administrator-token'})
    assert.equal(account.status,200)
    const {user,token}=account.data
    assert.equal((await call('login',{email:user.email,password:'wrong-password'})).status,400)
    assert.equal((await call('session',{},token)).data.user.uid,user.uid)
    const writes=[{path:'workspaceNames/office_db',data:{uid:user.uid}},{path:'users/'+user.uid,data:{email:user.email,workspaceLabel:'office_db'}}]
    assert.equal((await call('transaction',{writes,checks:[{path:'workspaceNames/office_db',data:null}]},token)).status,200)
    assert.equal((await call('transaction',{writes},token)).status,400)
    assert.equal((await call('read',{path:'workspaceNames/office_db'})).status,200)
    assert.equal((await call('read',{path:'users/'+user.uid})).status,401)
    await db.doc('workspaces/'+user.uid+'/telemetry/device').set({values:{temperature:22}})
    assert.equal((await call('read',{path:'workspaces/'+user.uid+'/telemetry/device'},token)).data.data.values.temperature,22)
    for(const path of ['_auth/anything','brokerUsers/anything','telegramBots/'+user.uid,'workspaces/other/telemetry/device','workspaces/'+user.uid+'/secrets/telegram'])assert.equal((await call('read',{path},token)).status,403,path)
    for(const path of ['workspaces/'+user.uid+'/telemetry/device','workspaces/'+user.uid+'/settings/storage','users/other'])assert.equal((await call('write',{path,data:{value:1}},token)).status,403,path)
    await assert.rejects(authorize(db,user,'workspaces/'+user.uid+'/__proto__/x','write',{}))
    const settings='workspaces/'+user.uid+'/settings/telegram'
    assert.equal((await call('write',{path:settings,data:{mode:'commands'}},token)).status,200)
    assert.equal((await call('read',{path:settings},token)).data.data.mode,'commands')
    assert.equal((await call('logout',{},token)).status,200)
    assert.equal((await call('session',{},token)).status,401)
  }finally{await new Promise(resolve=>server.close(resolve));await db.terminate();await rm(dir,{recursive:true,force:true})}
})

test('Telegram commands format sensor data without an AI provider',()=>{
  const ctx={devices:[{name:'Office',model:'AM300',eui:'24e124',lastSeen:'2026-10-18',readings:{temperature:{now:22},battery:{now:90}}}]}
  assert.match(sensorCommand('/devices',ctx),/Office \(AM300\)/)
  assert.match(sensorCommand('/latest@mybot',ctx),/temperature: 22/)
  assert.match(sensorCommand('/status',ctx),/Battery: 90/)
  assert.match(sensorCommand('/menu',ctx),/\/system/)
  assert.equal(sensorCommand('ask an AI',ctx),null)
  assert.match(sensorCommand('/devices',{devices:[]}),/No devices/)
})
