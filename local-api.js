import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
const scrypt = promisify(scryptCallback)
const denied = () => Object.assign(new Error('Access denied'), { status: 403 })
export async function readBody(req) {
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 65536) throw Object.assign(Error('Request too large'), {status:413}) }
  return JSON.parse(raw || '{}')
}
export function json(res, status, data) { res.writeHead(status, {'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}); res.end(JSON.stringify(data)) }
export function createLocalAuth(db, setupToken) {
  const sessions = new Map(), attempts = new Map()
  function safeUser(rec) { return { uid: rec.uid, email: rec.email, emailVerified: true } }
  async function getUserByEmail(email) {
    const snap = await db.doc('_auth/' + Buffer.from(String(email).toLowerCase()).toString('hex')).get()
    if (!snap.exists) throw Error('Account not found')
    return snap.data()
  }
  async function createUser({email, password}) {
    email = String(email).trim().toLowerCase()
    if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email) || typeof password !== 'string' || password.length < 10 || password.length > 256) throw Error('Use a valid email and a password of 10–256 characters.')
    const salt = randomBytes(16).toString('hex'), hash = (await scrypt(password,salt,64)).toString('hex')
    const ref = db.doc('_auth/' + Buffer.from(email).toString('hex'))
    const rec = { uid: randomUUID(), email, salt, hash }
    await db.runTransaction(async tx => { if ((await tx.get(ref)).exists) throw Error('Account already exists'); tx.set(ref, rec) })
    return safeUser(rec)
  }
  async function login(email,password) {
    if (typeof password !== 'string' || password.length > 256) throw Error('Invalid email or password')
    let rec
    try { rec = await getUserByEmail(email) } catch { await scrypt(password,'invalid-account',64); throw Error('Invalid email or password') }
    const hash = await scrypt(password,rec.salt,64)
    if (!timingSafeEqual(hash,Buffer.from(rec.hash,'hex'))) throw Error('Invalid email or password')
    return safeUser(rec)
  }
  async function verifyIdToken(token) {
    const s = sessions.get(token)
    if (!s || s.expires < Date.now()) { sessions.delete(token); throw Error('Please sign in again') }
    return s.user
  }
  function tokenFrom(req) { return req.headers.authorization?.replace(/^Bearer /,'') || /(?:^|; )milesight_session=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1] || '' }
  async function handle(req,res) {
    if (!req.url.startsWith('/local/')) return false
    try {
      if (req.method !== 'POST') { json(res,405,{error:'Use POST'}); return true }
      const b = await readBody(req), action = req.url.slice(7)
      const token = tokenFrom(req)
      if (action === 'read' && /^workspaceNames\/[a-z0-9_-]{3,}_db$/.test(b.path)) {
        const s = await db.doc(b.path).get(); json(res,200,{exists:s.exists,data:s.data()}); return true
      }
      if (['login','register'].includes(action)) {
        const address = req.socket.remoteAddress || 'unknown'
        const a = attempts.get(address) || { at: Date.now(), count: 0 }
        if (Date.now()-a.at > 900000) { a.at = Date.now(); a.count = 0 }
        a.count++; attempts.set(address,a)
        if (attempts.size > 10000) for (const [k,v] of attempts) if (Date.now()-v.at > 900000) attempts.delete(k)
        if (a.count > 20) throw Object.assign(Error('Too many attempts. Try in 15 minutes.'),{status:429})
        let user
        if (action === 'register') {
          const provided = Buffer.from(String(b.setupToken || '')), expected = Buffer.from(setupToken)
          if (provided.length !== expected.length || !timingSafeEqual(provided,expected)) throw denied()
          user = await createUser(b)
        } else user = await login(b.email,b.password)
        for (const [k,v] of sessions) if (v.expires < Date.now()) sessions.delete(k)
        const newToken = randomBytes(32).toString('hex')
        sessions.set(newToken,{user,expires:Date.now()+86400000})
        res.setHeader('set-cookie','milesight_session='+newToken+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400'+(req.socket.encrypted ? '; Secure' : ''))
        json(res,200,{user,token:newToken}); return true
      }
      const user = await verifyIdToken(token).catch(() => { throw Object.assign(Error('Please sign in'),{status:401}) })
      if (action === 'session') { json(res,200,{user,token}); return true }
      if (action === 'logout') { sessions.delete(token); res.setHeader('set-cookie','milesight_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); json(res,200,{ok:true}); return true }
      if (action === 'delete-account') {
        if ((await db.doc('users/'+user.uid).get()).exists) throw Error('An account with a workspace cannot be deleted here.')
        await db.doc('_auth/'+Buffer.from(user.email).toString('hex')).delete(); sessions.delete(token); json(res,200,{ok:true}); return true
      }
      if (action === 'read' || action === 'list') {
        await authorize(db,user,b.path,'read',null,action === 'list')
        if (action === 'read') { const s = await db.doc(b.path).get(); json(res,200,{exists:s.exists,data:s.data()}); return true }
        let q = db.collection(b.path)
        for (const f of (b.filters || []).slice(0,5)) {
          if(f.where) q=q.where(...f.where)
          if(f.orderBy) q=q.orderBy(...f.orderBy)
          if(f.limit) q=q.limit(Math.min(500,Math.max(1,f.limit)))
        }
        const s = await q.limit(500).get(); json(res,200,{docs:s.docs.map(d=>({id:d.id,data:d.data()}))}); return true
      }
      if (action === 'write' || action === 'transaction') {
        const writes = action === 'write' ? [b] : b.writes
        if (!Array.isArray(writes) || writes.length > 30) throw denied()
        for (const w of writes) await authorize(db,user,w.path,w.remove?'delete':'write',w.data,false,writes)
        if (!Array.isArray(b.checks || []) || (b.checks || []).length > 30) throw denied()
        for (const c of (b.checks || [])) await authorize(db,user,c.path,'read')
        await db.runTransaction(async tx => {
          for (const c of (b.checks || [])) {
            const s = await tx.get(db.doc(c.path))
            if (JSON.stringify(s.data() ?? null) !== JSON.stringify(c.data ?? null)) throw Object.assign(Error('Data changed. Try again.'),{status:409})
          }
          for (const w of writes) {
            const ref = db.doc(w.path), current = await tx.get(ref)
            if (['workspaceNames','users','brokerUsers','telegramLinks','memberInvites'].includes(w.path.split('/')[0]) && current.exists) throw Error('Record already exists')
            if(w.remove) tx.delete(ref); else tx.set(ref,w.data,{merge:!!w.merge})
          }
        })
        json(res,200,{ok:true}); return true
      }
      json(res,404,{error:'Not found'})
    } catch(e) { json(res,e.status || 400,{error:e.message}) }
    return true
  }
  return {handle, verifyIdToken, getUserByEmail, createUser, login, tokenFrom}
}

// Browser operations use an allowlist; the broker and bot use the trusted store.
export async function authorize(db,user,path,op,data,list=false,writes=[]) {
  if (typeof path !== 'string' || path.length > 512 || path.split('/').some(p=>!p || ['__proto__','constructor','prototype'].includes(p))) throw denied()
  const p=path.split('/'), own=p[1]===user.uid, read=op==='read'
  if (list && !(p[0]==='workspaces' && own && p.length===3 && ['devices','telemetry','commands','joinRequests'].includes(p[2])) && !(p[0]==='workspaces' && own && p.length===5 && p[2]==='telemetry' && p[4]==='readings')) throw denied()
  const profile=(await db.doc('users/'+user.uid).get()).data()
  const ws=profile?.workspaceLabel || writes.find(w=>w.path==='users/'+user.uid)?.data?.workspaceLabel
  let ok=false
  if(p[0]==='workspaceNames' && p.length===2) ok=read || (op==='write' && data?.uid===user.uid && p[1]===ws && /^[a-z0-9_-]{3,}_db$/.test(p[1]))
  if(p[0]==='users' && own && p.length===2) ok=read || (op==='write' && data?.workspaceLabel===ws && writes.some(w=>w.path==='workspaceNames/'+ws && w.data?.uid===user.uid))
  if(p[0]==='brokerUsers' && p.length===2) ok=op==='write' && data?.uid===user.uid && data?.topicPrefix===ws && typeof data.password==='string' && data.password.length>=22
  if(p[0]==='accountsByEmail' && p[1]===user.email && p.length===2) ok=op==='write' && data?.uid===user.uid && data?.workspaceLabel===ws
  if(p[0]==='workspaces' && own) {
    if(['devices','telemetry','commands','joinRequests'].includes(p[2])) ok=read && (p.length===3 || p.length===4 || (p[2]==='telemetry' && p[4]==='readings' && p.length<=6))
    if(p[2]==='devices' && p.length===4 && op==='write') ok=Object.keys(data||{}).every(k=>['name','nameSource','type','modelSource','matchedOn'].includes(k))
    if(p[2]==='settings' && p.length===4) ok=read || ['mqttCredentials','telegram','telegramUsers','members'].includes(p[3])
    if(p[2]==='secrets' && p.length===4) ok=!read && p[3]==='telegram'
    if(p[2]==='joinRequests' && p.length===4 && op==='delete') ok=true
  }
  if(p[0]==='workspaces' && p[2]==='joinRequests' && p.length===4 && p[3]===user.email && op==='write') {
    const target=(await db.doc('users/'+p[1]).get()).data()
    ok=data?.uid===user.uid && data?.email===user.email && data?.workspaceLabel===target?.workspaceLabel
  }
  if(p[0]==='memberIndex' && p.length===2) {
    const existing=(await db.doc(path).get()).data()
    ok=read ? p[1]===user.email : (existing ? existing.ownerUid===user.uid : data?.ownerUid===user.uid) && (op==='delete' || data?.ownerUid===user.uid && data?.email===p[1] && data?.workspaceLabel===ws)
  }
  if(p[0]==='memberInvites' && p.length===2) ok=op==='write' && data?.ownerUid===user.uid && data?.workspaceLabel===ws && data.expiresAt>Date.now() && data.expiresAt<=Date.now()+604800000
  if(p[0]==='telegramLinks' && p.length===2 && op==='write') {
    const index=(await db.doc('memberIndex/'+user.email).get()).data()
    ok=data?.uid===user.uid && data?.email===user.email && data.expiresAt>Date.now() && data.expiresAt<=Date.now()+600000 && (data.ownerUid===user.uid || index?.ownerUid===data.ownerUid && index?.status==='active')
  }
  if(p[0]==='telegramBots' && own && p.length===2) ok=!read
  if(!ok) throw denied()
}
