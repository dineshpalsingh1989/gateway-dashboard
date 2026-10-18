// Milesight Embedded NS format:
// https://support.milesight-iot.com/support/solutions/articles/73000514114
export function buildDownlink(body, workspace, device) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid command')
  if (!/^[a-z0-9_-]+_db$/.test(workspace || '')) throw new Error('Workspace is not configured')
  const eui = String(device?.eui || '').toLowerCase()
  if (!/^[a-f0-9]{16}$/.test(eui)) throw new Error('Device must have a 16-character DevEUI')
  const template = body.topicTemplate || workspace + '/downlink/$deveui'
  if (typeof template !== 'string' || template.length > 256 ||
      !template.startsWith(workspace + '/') || !template.includes('$deveui') ||
      /[#+\u0000-\u0020]/.test(template) || template === workspace + '/uplink') {
    throw new Error('Topic must stay in your workspace and contain $deveui, without wildcards or spaces')
  }
  const topic = template.replaceAll('$deveui', eui)
  if (topic.includes('$')) throw new Error('Unsupported topic placeholder')
  if (!Number.isInteger(body.fport) || body.fport < 1 || body.fport > 223) throw new Error('FPort must be 1–223')
  if (typeof body.confirmed !== 'boolean') throw new Error('Choose confirmed or unconfirmed')
  const hex = typeof body.hex === 'string' ? body.hex.replace(/\s/g, '') : ''
  if (!/^(?:[a-fA-F0-9]{2}){1,51}$/.test(hex)) throw new Error('Enter 1–51 bytes of hexadecimal command data')
  return { topic, payload: { confirmed: body.confirmed, fport: body.fport, data: Buffer.from(hex, 'hex').toString('base64') } }
}

export function createDownlinkHandler({ verifyToken, getWorkspace, getDevice, publish, record, emit }) {
  return async (req, res) => {
    const reply = (code, data) => { res.writeHead(code, {'content-type':'application/json','cache-control':'no-store'}); res.end(JSON.stringify(data)) }
    if (req.method !== 'POST') return reply(405, {ok:false,error:'Use POST'})
    let raw = '', body
    try {
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) return reply(413, {ok:false,error:'Request too large'}) }
      body = JSON.parse(raw)
    } catch { return reply(400, {ok:false,error:'Invalid JSON'}) }
    let uid
    try { uid = (await verifyToken(req.headers.authorization?.replace(/^Bearer /, '') || '')).uid; if (!uid) throw Error() }
    catch { return reply(401, {ok:false,error:'Sign in to send commands'}) }
    if (!body || typeof body.deviceId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.deviceId)) return reply(400,{ok:false,error:'Invalid device'})
    let command, device
    try {
      const workspace = await getWorkspace(uid)
      device = await getDevice(uid, body.deviceId)
      if (!device) return reply(404,{ok:false,error:'Device not found in your workspace'})
      command = buildDownlink(body, workspace, device)
    } catch (e) { return reply(400,{ok:false,error:e.message}) }
    let entry
    try { entry = await record(uid, {deviceId:body.deviceId,eui:device.eui,...command,status:'publishing',at:Date.now()}) }
    catch { return reply(503,{ok:false,error:'Could not create command record; nothing sent'}) }
    try { await publish(command) }
    catch {
      await entry.update({status:'publish_failed'}).catch(()=>{})
      return reply(503,{ok:false,error:'Broker publication failed; check command history before retrying'})
    }
    // A broker publication is not proof of radio delivery or device execution.
    let historySaved = true
    try { await entry.update({status:'published'}) } catch { historySaved = false }
    emit(uid,'info',{msg:'Downlink published to '+command.topic+'; device delivery unverified'})
    return reply(200,{ok:true,status:'published',historySaved,topic:command.topic,payload:command.payload,detail:'Published to MQTT. Device delivery and execution are unverified.'})
  }
}
