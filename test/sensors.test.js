import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { EXTRA_PROFILES } from '../sensor-profiles.js'
import { DEMO_SAMPLES, demoEui } from '../demo-data.js'

const source=readFileSync(new URL('../milesight.js',import.meta.url),'utf8')
const context=vm.createContext({EXTRA_PROFILES,Buffer})
vm.runInContext(source.slice(source.indexOf('const PROFILES ='),source.indexOf('//  FREE TIER'))+
  source.slice(source.indexOf('const U16 ='),source.indexOf('//  TENANT HOSTNAMES')).replace('export function','function'),context)
test('all additional models resolve before broad legacy model names',()=>{
  for(const [key,profile] of Object.entries(EXTRA_PROFILES))assert.equal(context.profileFromName(profile.short),key)
  assert.equal(context.profileFromName('EM300-TH'),'em300-th')
  assert.notEqual(context.detectProfile(['temperature','humidity','battery']).key,'em300-sld')
})
test('gateway-decoded readings win over generic raw channels and support both JSON wrappers',()=>{
  for(const wrapper of ['object','objectJSON']){
    const json={devEUI:demoEui(13),deviceProfileName:'EM500-SMTC',data:'A2cBAA==',temperature:25}
    json[wrapper]=wrapper==='object'?{temperature:26.2,moisture:42.5,ec:860}:JSON.stringify({temperature:26.2,moisture:42.5,ec:860})
    const parsed=context.parsePayload(Buffer.from(JSON.stringify(json)))
    assert.equal(parsed.values.temperature,26.2)
    assert.equal(parsed.values.moisture,42.5)
    assert.equal(parsed.decoded,false)
    assert.equal(parsed.modelName,'EM500-SMTC')
  }
})
test('demo covers every extra model with valid unique DevEUIs',()=>{
  assert.equal(DEMO_SAMPLES.length,24)
  const ids=DEMO_SAMPLES.map((_,i)=>demoEui(i))
  assert.equal(new Set(ids).size,24)
  ids.forEach(id=>assert.match(id,/^[a-f0-9]{16}$/))
  Object.keys(EXTRA_PROFILES).forEach(key=>assert.ok(DEMO_SAMPLES.some(s=>s[0]===key),key))
})
