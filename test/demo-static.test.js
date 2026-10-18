import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { buildDemoPage } from '../demo-page.js'

const page=buildDemoPage()
test('static demo is self-contained and replaces all runtime configuration',()=>{
  assert.match(page,/24 sample devices/)
  assert.doesNotMatch(page,/__[A-Z_]+__/)
  assert.doesNotMatch(page,/import .*from ['"]https:/)
  assert.doesNotMatch(page,/href="\/setup"/)
  for(const script of page.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1])
})
test('static demo health, tests, commands and events need no backend requests',async()=>{
  const forwarded=[],records=[],timers=[]
  const window={fetch:async(...args)=>{forwarded.push(args);throw Error('Unexpected backend request')},
    __demoDevice:id=>id==='controller'?{eui:'24e1241280000006'}:undefined,
    __demoSaveCommand:async row=>records.push(row)}
  const context=vm.createContext({window,location:{href:'https://example.github.io/milesight-dashboard/',origin:'https://example.github.io'},URL,Response,btoa,
    setInterval:fn=>{timers.push(fn);return 1},clearInterval:()=>{},setTimeout:fn=>{timers.push(fn);return 2},clearTimeout:()=>{}})
  vm.runInContext(page.match(/<script>([\s\S]*?)<\/script>/)[1],context)
  assert.equal((await(await window.fetch('/health')).json()).demo,true)
  assert.match((await(await window.fetch('/selftest')).json()).detail,/simulated/)
  const options={method:'POST',body:JSON.stringify({deviceId:'controller',hex:'0701ff',fport:85,confirmed:true})}
  const command=await(await window.fetch('/downlink',options)).json()
  assert.equal(command.status,'simulated')
  assert.equal(command.payload.data,'BwH/')
  assert.equal(records[0].status,'simulated')
  assert.equal((await window.fetch('/downlink',{...options,body:JSON.stringify({...JSON.parse(options.body),topicTemplate:'other_db/downlink/$deveui'})})).status,400)
  assert.equal((await window.fetch('/downlink',{...options,body:JSON.stringify({...JSON.parse(options.body),deviceId:'missing'})})).status,404)
  const stream=new window.EventSource('/events')
  let event
  stream.onmessage=value=>{event=JSON.parse(value.data)}
  timers[0]()
  assert.match(event.msg,/No gateway/)
  stream.close()
  assert.equal(forwarded.length,0)
})
