import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import vm from 'node:vm'
import { validateConfig, saveConfig, readSavedConfig, createSetupHandler, testFirebase } from '../firebase-setup.js'

const config = { web: { apiKey: 'test-key', authDomain: 'demo-test.firebaseapp.com',
  projectId: 'demo-test', appId: '1:123:web:test' }, keyPath: './serviceAccountKey.json' }

function temporaryFile(t, name = 'settings.json') {
  const directory = mkdtempSync(join(tmpdir(), 'milesight-setup-test-'))
  const path = join(directory, name)
  t.after(() => { for (const file of [path, path + '.tmp']) { try { unlinkSync(file) } catch {} }; rmdirSync(directory) })
  return path
}

test('Firebase settings validate required fields and persist only recognized values', t => {
  for (const bad of [null, {}, { ...config, web: {} }, { ...config, keyPath: '' },
    { ...config, web: { ...config.web, authDomain: 'https://example.com/path' } },
    { ...config, web: { ...config.web, apiKey: {} } }]) assert.throws(() => validateConfig(bad))
  const path = temporaryFile(t)
  saveConfig({ ...config, private_key: 'must-not-save', web: { ...config.web, private_key: 'also-not-save' } }, path)
  assert.equal(readSavedConfig(path).web.projectId, 'demo-test')
  assert.equal(readFileSync(path, 'utf8').includes('must-not-save'), false)
  assert.equal(readFileSync(path, 'utf8').includes('also-not-save'), false)
})

async function call(handler, url, { method = 'GET', token, body } = {}) {
  const req = { url, method, headers: token ? { 'x-setup-token': token } : {},
    async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(body) } }
  const res = { headersSent: false, writeHead(code, headers) { this.status = code; this.headers = headers; this.headersSent = true },
    end(body) { this.body = body } }
  res.handled = await handler(req, res)
  return res
}

test('Setup protects configuration, testing and saving with its own administrator token', async t => {
  const path = temporaryFile(t), token = 'test-administrator-token'
  let tested = false
  const handler = createSetupHandler(config, { token, path, test: async () => { tested = true; return { ok: true, results: [] } } })
  for (const url of ['/setup/config', '/setup/test', '/setup/save']) {
    assert.equal((await call(handler, url, { method: url.endsWith('config') ? 'GET' : 'POST', body: JSON.stringify(config) })).status, 401)
  }
  assert.equal(tested, false)
  assert.equal((await call(handler, '/setup/config', { token })).status, 200)
  assert.equal((await call(handler, '/setup/save', { token, method: 'POST', body: 'null' })).status, 400)
  assert.equal((await call(handler, '/setup/save', { token, method: 'POST', body: 'x'.repeat(16385) })).status, 413)
  assert.equal((await call(handler, '/setup/save', { token, method: 'POST', body: JSON.stringify(config) })).status, 200)
  assert.equal(readSavedConfig(path).web.apiKey, 'test-key')
  const edited = { ...config, web: { ...config.web, appId: '1:123:web:changed' } }
  await call(handler, '/setup/save', { token, method: 'POST', body: JSON.stringify(edited) })
  const reloaded = JSON.parse((await call(handler, '/setup/config', { token })).body)
  assert.equal(reloaded.web.appId, edited.web.appId)
  assert.equal(reloaded.restartRequired, true)
  assert.equal((await call(handler, '/setup/test', { token, method: 'POST', body: JSON.stringify(config) })).status, 200)
  assert.equal(tested, true)
  assert.equal((await call(handler, '/health')).handled, false)
})

function setupUI(fetch) {
  const html = readFileSync(new URL('../firebase-setup.html', import.meta.url), 'utf8')
  const nodes = {}, listeners = {}
  for (const match of html.matchAll(/id="([^"]+)"/g)) {
    nodes[match[1]] = { value: '', disabled: false, textContent: '', dataset: {},
      setAttribute() {}, addEventListener(type, fn) { this[type] = fn },
      replaceChildren() {}, reportValidity: () => true, focus() {} }
  }
  const buttons = ['load', 'import', 'test', 'save'].map(id => nodes[id])
  nodes.keyPath.value = './serviceAccountKey.json'
  const context = vm.createContext({ document: { getElementById: id => nodes[id], querySelectorAll: () => buttons },
    window: { addEventListener: (type, fn) => { listeners[type] = fn } }, fetch, AbortSignal })
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context)
  return { nodes, listeners }
}

test('Setup protects unsaved edits, locks fields during save and clears dirty state on success', async () => {
  let resolve
  const { nodes, listeners } = setupUI(() => new Promise(done => { resolve = done }))
  nodes.token.value = 'test-token'
  nodes.apiKey.value = 'changed'
  nodes.settings.input({ target: nodes.apiKey })
  assert.equal(nodes['save-state'].textContent, 'Unsaved changes')
  assert.equal(nodes.load.disabled, true)
  let prevented = false
  listeners.beforeunload({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  nodes.settings.onsubmit({ preventDefault() {} })
  assert.equal(nodes['config-fields'].disabled, true)
  resolve({ ok: true, json: async () => ({ message: 'Saved. Restart required.' }) })
  // Drain the asynchronous fetch, JSON parsing, save callback, and busy cleanup.
  await new Promise(done => setImmediate(done))
  assert.equal(nodes['config-fields'].disabled, false)
  assert.equal(nodes['save-state'].textContent, 'Saved · restart required')
  prevented = false
  listeners.beforeunload({ preventDefault() { prevented = true } })
  assert.equal(prevented, false)
})

test('Setup recovers from a network failure without losing edits', async () => {
  const { nodes } = setupUI(async () => { throw new TypeError('fetch failed') })
  nodes.token.value = 'test-token'; nodes.apiKey.value = 'unsaved-key'
  nodes.settings.input({ target: nodes.apiKey })
  await nodes.load.onclick()
  assert.match(nodes.message.textContent, /Could not reach the server/)
  assert.equal(nodes.apiKey.value, 'unsaved-key')
  assert.equal(nodes['config-fields'].disabled, false)
  assert.equal(nodes.save.disabled, false)
})

test('First-run setup redirects to a self-contained page without Firebase', async () => {
  const handler = createSetupHandler(config, { token: 'test-token', bootstrap: true })
  assert.equal((await call(handler, '/')).headers.location, '/setup')
  const response = await call(handler, '/setup')
  assert.equal(response.status, 200)
  assert.match(response.body, /Test Firebase connection/)
  assert.doesNotMatch(response.body, /<script[^>]+src=/)
  const script = response.body.match(/<script>([\s\S]*?)<\/script>/)[1]
  new vm.Script(script)
})

test('Connection test verifies read-back, cleans up and releases the test app', async t => {
  const path = temporaryFile(t, 'service.json')
  writeFileSync(path, JSON.stringify({ type: 'service_account', project_id: 'demo-test', private_key: 'fake-test-key', client_email: 'test@example.com' }))
  const run = async (failRead = false, failDelete = false) => {
    const methods = []; let closed = false
    const result = await testFirebase({ ...config, keyPath: path }, {
      openApp: async () => ({ options: { credential: { getAccessToken: async () => ({ access_token: 'test-access-token' }) } } }),
      closeApp: async () => { closed = true },
      request: async (url, options) => {
        if (url.includes('identitytoolkit')) return { status: 400, json: async () => ({ error: { message: 'INVALID_ID_TOKEN' } }) }
        methods.push(options.method)
        return { ok: !(failRead && options.method === 'GET') && !(failDelete && options.method === 'DELETE'),
          json: async () => ({ fields: { purpose: { stringValue: 'Firebase setup connection test' } } }) }
      },
    })
    assert.deepEqual(methods, ['PATCH', 'GET', 'DELETE'])
    assert.equal(closed, true)
    assert.equal(result.ok, !failRead && !failDelete)
    assert.equal(JSON.stringify(result).includes('fake-test-key'), false)
  }
  await run(); await run(true); await run(false, true)
})

test('Connection test rejects unknown API failures and mismatched service projects', async t => {
  const path = temporaryFile(t, 'service.json')
  writeFileSync(path, JSON.stringify({ project_id: 'different-project' }))
  const result = await testFirebase({ ...config, keyPath: path }, {
    request: async () => ({ status: 500, json: async () => ({ error: { message: 'server error' } }) }),
  })
  assert.equal(result.ok, false)
  assert.equal(result.results[0].ok, false)
  assert.match(result.results[1].detail, /does not match/)
})
