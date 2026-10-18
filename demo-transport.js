// Runs before the dashboard scripts. Every demo service stays in this browser.
;(function () {
  var originalFetch = window.fetch.bind(window)
  var started = Date.now()
  function json(value, status) {
    return new Response(JSON.stringify(value), {status:status || 200,headers:{'content-type':'application/json'}})
  }
  function command(body, device) {
    // Supply the small hex-to-Base64 operation used by the shared validator.
    var Buffer = {from:function(hex){return {toString:function(){return btoa(hex.match(/../g).map(function(pair){return String.fromCharCode(parseInt(pair,16))}).join(''))}}}}
    return (__BUILD_DOWNLINK__)(body, 'smart_office_db', device)
  }
  window.fetch = async function (input, options) {
    var url = new URL(typeof input === 'string' ? input : input.url, location.href)
    if (url.origin !== location.origin) return originalFetch(input, options)
    if (url.pathname === '/health') return json({
      ok:true,demo:true,version:'2.0.0 Demo',build:'2026-10-18',
      uptime:Math.floor((Date.now()-started)/1000),host:'demo.local',project:'local-demo',
      mqtt:{listening:true,port:1883,clients:1},firestore:'ok',webKey:'ok',checkedAt:Date.now(),
    })
    if (url.pathname === '/selftest') return json({ok:true,detail:'Demo: connection test simulated. No external service was contacted.'})
    if (url.pathname === '/downlink') {
      try {
        var body=JSON.parse(options.body)
        var device=window.__demoDevice && window.__demoDevice(body.deviceId)
        if (!device) return json({ok:false,error:'Choose a demo device'},404)
        var result=command(body,device)
        await window.__demoSaveCommand({deviceId:body.deviceId,eui:device.eui,topic:result.topic,payload:result.payload,status:'simulated',at:Date.now()})
        return json({ok:true,status:'simulated',topic:result.topic,payload:result.payload,historySaved:true,detail:'Demo: command simulated. No MQTT message or radio command was sent.'})
      } catch (error) { return json({ok:false,error:error.message},400) }
    }
    return originalFetch(input, options)
  }
  window.EventSource = function () {
    var stream=this
    var timer=setInterval(function(){
      if(stream.onmessage)stream.onmessage({data:JSON.stringify({t:Date.now(),type:'info',msg:'Demo telemetry: sample sensors active. No gateway is connected.'})})
    },5000)
    var opening=setTimeout(function(){if(stream.onopen)stream.onopen()},0)
    stream.close=function(){clearInterval(timer);clearTimeout(opening)}
  }
})()
