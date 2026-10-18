// Local, isolated preview of the real dashboard. No Firebase or MQTT services.
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { EXTRA_PROFILES, EXTRA_META } from './sensor-profiles.js'
import { DEMO_SAMPLES, demoEui } from './demo-data.js'
import { createDownlinkHandler } from './downlink.js'

const source = readFileSync(new URL('./milesight.js', import.meta.url), 'utf8')
const marker = 'const PAGE = String.raw`'
let page = source.slice(source.indexOf(marker) + marker.length, source.lastIndexOf('</html>`') + 7)
page = page.replace(/import \{ initializeApp \} from[^]*?from 'https:\/\/www.gstatic.com\/firebasejs\/10.12.2\/firebase-firestore.js'/, readFileSync(new URL('./demo-sdk.js', import.meta.url), 'utf8'))
page = page.replace('__EXTRA_PROFILES__',()=>JSON.stringify(EXTRA_PROFILES)).replace('__EXTRA_META__',()=>JSON.stringify(EXTRA_META)).replace('__DEMO_SAMPLES__',()=>JSON.stringify(DEMO_SAMPLES))
for (const [key, value] of Object.entries({FIREBASE_CONFIG:'{"projectId":"local-demo"}',CHANGES:'[["Demo","Explore sample data. Changes stay in this browser session."]]',VERSION:'2.0.0 Demo',BUILD:'2026-10-18',BROKER_DOMAIN:'',SERVER_HOST:'demo.local',MQTT_PORT:'1883'})) page = page.replaceAll('__'+key+'__', () => value)
page = page.replace('<body>', '<body><div style="padding:10px;text-align:center;background:#134e4a;color:white">Interactive demo · Sample data · Changes are temporary · No live services connected</div>')
const port = Number(process.env.DEMO_PORT) || 8081
const downlink = createDownlinkHandler({
  verifyToken: async token => {if(token!=='demo')throw Error();return {uid:'demo-owner'}},
  getWorkspace: async () => 'smart_office_db',
  getDevice: async (uid,id) => DEMO_SAMPLES.some((s,i)=>demoEui(i)===id)?{eui:id}:null,
  publish: async () => {}, record: async () => ({update:async()=>{}}), emit:()=>{},
})
http.createServer((req,res) => {
  if(req.url==='/downlink')return downlink(req,res)
  if(req.url.startsWith('/events')) {
    res.writeHead(200, {'content-type':'text/event-stream','cache-control':'no-cache'})
    const send = () => res.write('data: '+JSON.stringify({t:Date.now(),type:'stored',eui:'24e1241280001001',fields:'temperature, humidity, co2',path:'demo/telemetry'})+'\n\n')
    send(); const timer=setInterval(send,5000);req.on('close',()=>clearInterval(timer));return
  }
  if(req.url==='/health'||req.url==='/selftest') {
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,demo:true,version:'2.0.0 Demo',build:'2026-10-18',mqtt:{listening:true,port:1883,clients:6},firestore:'ok',webKey:'ok',checkedAt:Date.now()}));return
  }
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(page)
}).listen(port,'127.0.0.1',()=>console.log('Demo dashboard: http://localhost:'+port))
