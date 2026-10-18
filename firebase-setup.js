import http from 'node:http'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { installShutdown } from './runtime.js'

export const webFields = ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId', 'databaseURL']
export const envFields = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'DATABASE_URL']
const configPath = resolve('firebase.local.json')
export function readStorageMode() {
  if (process.env.STORAGE_MODE) {
    if (!['firebase', 'duckdb'].includes(process.env.STORAGE_MODE)) throw Error('STORAGE_MODE must be firebase or duckdb')
    return process.env.STORAGE_MODE
  }
  if (!existsSync('storage.local.json')) return 'firebase'
  const mode = JSON.parse(readFileSync('storage.local.json', 'utf8')).mode
  if (!['firebase', 'duckdb'].includes(mode)) throw Error('Invalid storage.local.json')
  return mode
}

export function readSavedConfig(path = configPath) {
  if (!existsSync(path)) return { web: {}, keyPath: './serviceAccountKey.json' }
  try { return validateConfig(JSON.parse(readFileSync(path, 'utf8'))) }
  catch {
    console.error('[setup] Cannot read saved Firebase settings. Open /setup to replace them.')
    return { web: {}, keyPath: './serviceAccountKey.json' }
  }
}

export function validateConfig(value) {
  if (!value || typeof value !== 'object' || !value.web || typeof value.web !== 'object') throw new Error('Enter a Firebase web configuration.')
  const web = {}
  for (const key of webFields) {
    const field = value.web[key] ?? ''
    if (typeof field !== 'string' || field.length > 2048) throw new Error('Invalid ' + key)
    web[key] = field.trim()
  }
  for (const key of ['apiKey', 'authDomain', 'projectId', 'appId']) {
    if (!web[key]) throw new Error(key + ' is required.')
  }
  if (!/^[a-z0-9][a-z0-9-]{3,62}$/.test(web.projectId)) throw new Error('Enter a valid Firebase project ID.')
  if (!/^[a-zA-Z0-9.-]+$/.test(web.authDomain)) throw new Error('Auth domain must be a hostname, without https:// or a path.')
  if (typeof value.keyPath !== 'string' || !value.keyPath.trim() || value.keyPath.length > 2048) throw new Error('Enter the service-account file path on the server.')
  return { web, keyPath: value.keyPath.trim() }
}

export function saveConfig(value, path = configPath) {
  const config = validateConfig(value)
  const temporary = path + '.tmp'
  writeFileSync(temporary, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 })
  renameSync(temporary, path)
}

export async function testFirebase(value, { request = fetch, openApp, closeApp } = {}) {
  const config = validateConfig(value), results = []
  try {
    const response = await request('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(config.web.apiKey), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'setup-probe' }), signal: AbortSignal.timeout(10000),
    })
    const data = await response.json()
    const message = data.error?.message || ''
    const ok = response.status === 400 && /^(INVALID_ID_TOKEN|MISSING_ID_TOKEN)(\s|$)/.test(message)
    results.push({ name: 'Web API key / Authentication endpoint', ok,
      detail: ok ? 'Google accepted the key. Sign-in providers and authorized domains still need to be enabled in Firebase.' : 'Not confirmed: ' + (message || 'HTTP ' + response.status) })
  } catch { results.push({ name: 'Web API key / Authentication endpoint', ok: false, detail: 'Could not reach Google within the test timeout.' }) }

  let app, step = 'Service account / project match'
  try {
    const service = JSON.parse(readFileSync(config.keyPath, 'utf8'))
    if (service.project_id !== config.web.projectId) throw new Error('Service-account project does not match the web project ID.')
    if (service.type !== 'service_account' || !service.private_key || !service.client_email) throw new Error('This file is not a Firebase service-account JSON key.')
    results.push({ name: 'Service account / project match', ok: true, detail: 'The service-account file belongs to the selected project.' })
    step = 'Service-account authentication'
    if (openApp) app = await openApp(service, config.web.projectId)
    else {
      const { initializeApp, cert } = await import('firebase-admin/app')
      app = initializeApp({ credential: cert(service), projectId: config.web.projectId }, 'setup-' + randomBytes(8).toString('hex'))
    }
    let timer
    const access = await Promise.race([
      app.options.credential.getAccessToken(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Credential timeout')), 10000) }),
    ]).finally(() => clearTimeout(timer))
    const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(config.web.projectId) +
      '/databases/(default)/documents/_setupProbes/' + randomBytes(16).toString('hex')
    async function probe(method, body) {
      const response = await request(url, { method,
        headers: { authorization: 'Bearer ' + access.access_token, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('Firestore request failed')
      return response
    }
    try {
      step = 'Firestore write'
      await probe('PATCH', { fields: { purpose: { stringValue: 'Firebase setup connection test' } } })
      step = 'Firestore read'
      const snapshot = await (await probe('GET')).json()
      if (snapshot.fields?.purpose?.stringValue !== 'Firebase setup connection test') throw new Error('Read-back failed')
      results.push({ name: 'Firestore write and read', ok: true, detail: 'Successfully wrote and read a temporary document using the service account.' })
    } finally {
      try {
        await probe('DELETE')
        results.push({ name: 'Firestore cleanup', ok: true, detail: 'Temporary test document removed.' })
      } catch {
        results.push({ name: 'Firestore cleanup', ok: false, detail: 'Could not remove the temporary document. Check _setupProbes in Firebase Console.' })
      }
    }
  } catch (error) {
    // Never return provider errors that might include credential material or file contents.
    results.push({ name: step, ok: false,
      detail: /does not match|not a Firebase/.test(error.message) ? error.message :
        'Could not complete the test. Check the file path, service-account permissions, Firestore database, and network access.' })
  } finally {
    if (app) {
      if (closeApp) await closeApp(app)
      else { const { deleteApp } = await import('firebase-admin/app'); await deleteApp(app).catch(() => {}) }
    }
  }
  return { ok: results.every(result => result.ok), results }
}

export function createSetupHandler(current, { token = process.env.FIREBASE_SETUP_TOKEN || randomBytes(24).toString('hex'), bootstrap = false, path = configPath, test = testFirebase } = {}) {
  console.log('[setup] Firebase settings: /setup — administrator token: ' + token)
  let testing = false
  return async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (pathname !== '/setup' && !pathname.startsWith('/setup/')) {
      if (!bootstrap) return false
      res.writeHead(302, { location: '/setup' }); res.end(); return true
    }
    const reply = (status, value) => {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
      res.end(JSON.stringify(value))
    }
    if (pathname === '/setup' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY',
        'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" })
      res.end(readFileSync(new URL('./firebase-setup.html', import.meta.url), 'utf8')); return true
    }
    const provided = Buffer.from(req.headers['x-setup-token'] || '')
    const expected = Buffer.from(token)
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) { reply(401, { error: 'Enter the administrator setup token from the server console.' }); return true }
    if (pathname === '/setup/config' && req.method === 'GET') {
      const saved = existsSync(path) ? readSavedConfig(path) : null
      const restartRequired = Boolean(saved && ((process.env.FIREBASE_SERVICE_ACCOUNT_PATH || saved.keyPath) !== current.keyPath ||
        webFields.some((key, i) => (process.env['VITE_FIREBASE_' + envFields[i]] || saved.web[key] || '') !== (current.web[key] || ''))))
      reply(200, { ...(saved || current), storageMode: readStorageMode(), restartRequired, overrides: webFields.filter((_, i) => process.env['VITE_FIREBASE_' + envFields[i]]),
        keyPathOverride: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH) }); return true
    }
    if (!['/setup/save', '/setup/test', '/setup/storage'].includes(pathname) || req.method !== 'POST') { reply(404, { error: 'Not found' }); return true }
    try {
      let raw = '', size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 16384) { reply(413, { error: 'Configuration is too large.' }); return true }
        raw += chunk.toString('utf8')
      }
      if (pathname === '/setup/storage') {
        const value = JSON.parse(raw)
        if (!['firebase','duckdb'].includes(value.mode)) { reply(400,{error:'Choose Firebase or DuckDB'}); return true }
        writeFileSync('storage.local.json.tmp',JSON.stringify({mode:value.mode})+'\n',{mode:0o600})
        renameSync('storage.local.json.tmp','storage.local.json')
        reply(200,{ok:true,message:'Storage choice saved. Restart the server to apply. Existing data stays in its original database; no migration is performed.'+(process.env.STORAGE_MODE?' STORAGE_MODE environment override is active and takes precedence.':'')}); return true
      }
      let config
      try { config = validateConfig(JSON.parse(raw)) } catch (error) { reply(400, { error: error instanceof SyntaxError ? 'Invalid JSON.' : error.message }); return true }
      if (pathname === '/setup/save') {
        saveConfig(config, path)
        reply(200, { ok: true, message: 'Saved. Restart the server to apply these settings. Environment variables take precedence.' })
      } else {
        if (testing) { reply(409, { error: 'A connection test is already running.' }); return true }
        testing = true
        try { reply(200, await test(config)) } finally { testing = false }
      }
    } catch { if (!res.headersSent) reply(500, { error: 'Could not complete the request. Check server file permissions and retry.' }) }
    return true
  }
}

export function startSetupServer(port, current) {
  const handler = createSetupHandler(current, { bootstrap: true })
  const server = http.createServer((req, res) => { handler(req, res).catch(() => { res.writeHead(500); res.end('Setup failed') }) })
    .listen(port, () => console.log('[setup] Open http://localhost:' + port + '/setup to configure Firebase, then restart.'))
  installShutdown(() => new Promise(resolve => server.close(resolve)))
  return server
}
