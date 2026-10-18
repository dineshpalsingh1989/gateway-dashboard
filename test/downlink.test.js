import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { buildDownlink, createDownlinkHandler } from '../downlink.js'

const device={eui:'24E1241280000006'}
const body={deviceId:'controller',hex:'07 01 ff',fport:85,confirmed:true}
test('downlinks use exact Milesight bytes, topic and JSON envelope',()=>{
  assert.deepEqual(buildDownlink(body,'office_db',device),{
    topic:'office_db/downlink/24e1241280000006',payload:{confirmed:true,fport:85,data:'BwH/'},
  })
})
test('downlinks reject cross-workspace topics, MQTT wildcards and malformed commands',()=>{
  for(const change of [
    {topicTemplate:'other_db/downlink/$deveui'}, {topicTemplate:'office_db/#/$deveui'},
    {topicTemplate:'office_db/+/$deveui'}, {topicTemplate:'office_db/downlink/no-device'},
    {topicTemplate:'office_db/downlink/$deveui/$other'}, {fport:0},{fport:224},{fport:1.5},
    {confirmed:'true'},{hex:'0'},{hex:'xx'},{hex:''},{hex:'ff'.repeat(52)},
  ])assert.throws(()=>buildDownlink({...body,...change},'office_db',device))
  assert.throws(()=>buildDownlink(body,'office_db',{eui:'bad'}))
})
test('endpoint authenticates, isolates device lookup, audits before publication, and never claims delivery',async t=>{
  let found=true, failPublish=false, failRecord=false, failUpdate=false
  const publications=[],lookups=[],records=[]
  const handler=createDownlinkHandler({
    verifyToken:async token=>{if(token!=='alice')throw Error();return {uid:'alice'}},
    getWorkspace:async uid=>uid+'_db',
    getDevice:async(uid,id)=>{lookups.push([uid,id]);return found?device:null},
    publish:async command=>{if(failPublish)throw Error();publications.push(command)},
    record:async(uid,entry)=>{if(failRecord)throw Error();records.push({uid,...entry});return {update:async patch=>{if(failUpdate)throw Error();Object.assign(records.at(-1),patch)}}},
    emit:()=>{},
  })
  const server=http.createServer(handler)
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(()=>new Promise(resolve=>server.close(resolve)))
  const send=(token='alice',data=body,method='POST')=>fetch('http://127.0.0.1:'+server.address().port,{method,headers:{authorization:'Bearer '+token},body:method==='POST'?JSON.stringify(data):undefined})
  assert.equal((await send('bad')).status,401)
  assert.equal(lookups.length,0)
  assert.equal((await send('alice',body,'GET')).status,405)
  assert.equal((await send('alice',{...body,deviceId:'../bob'})).status,400)
  found=false;assert.equal((await send()).status,404);assert.equal(publications.length,0)
  found=true;assert.equal((await send('alice',{...body,topicTemplate:'bob_db/downlink/$deveui'})).status,400)
  failRecord=true;assert.equal((await send()).status,503);assert.equal(publications.length,0)
  failRecord=false;failPublish=true;assert.equal((await send()).status,503);assert.equal(records.at(-1).status,'publish_failed')
  failPublish=false
  const result=await (await send()).json()
  assert.equal(result.status,'published');assert.match(result.detail,/unverified/)
  assert.deepEqual(lookups.at(-1),['alice','controller'])
  assert.equal(publications[0].topic,'alice_db/downlink/24e1241280000006')
  assert.equal(records.at(-1).status,'published')
  failUpdate=true
  const partial=await (await send()).json()
  assert.equal(partial.ok,true);assert.equal(partial.historySaved,false)
  assert.equal((await send('alice',{...body,hex:'ff'.repeat(3000)})).status,413)
})
