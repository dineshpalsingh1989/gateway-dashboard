// Local, isolated preview of the real dashboard. No Firebase or MQTT services.
import http from 'node:http'
import { buildDemoPage } from './demo-page.js'
import { DEMO_SAMPLES, demoEui } from './demo-data.js'
import { createDownlinkHandler } from './downlink.js'

const page = buildDemoPage()
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
