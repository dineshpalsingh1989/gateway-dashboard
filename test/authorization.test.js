import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../milesight.js', import.meta.url), 'utf8')
const context = vm.createContext({})
vm.runInContext(source.slice(source.indexOf('const ownNamespace ='), source.indexOf('aedes.authorizePublish =')) +
  '\nglobalThis.publish = ownNamespace; globalThis.subscribe = ownSubscription', context)

test('MQTT publish and subscription authorization isolates tenants', () => {
  const client = { topicPrefix: 'acme_db' }
  for (const topic of ['acme_db/uplink', 'acme_db/device/status']) {
    assert.equal(context.publish(client, topic), true)
    assert.equal(context.subscribe(client, topic), true)
  }
  for (const topic of ['#', '+/#', 'other_db/#', 'acme_db_evil/uplink', 'acme_db-other/#']) {
    assert.equal(context.publish(client, topic), false)
    assert.equal(context.subscribe(client, topic), false)
  }
  for (const topic of ['acme_db/#', 'acme_db/+', 'acme_db/+/status']) {
    assert.equal(context.subscribe(client, topic), true)
  }
  assert.equal(context.publish(null, 'acme_db/uplink'), false)
  assert.equal(context.subscribe({}, 'acme_db/#'), false)
})

test('Firestore denies cross-tenant access and secret reads', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
  const project = 'demo-milesight'
  const base = 'http://' + process.env.FIRESTORE_EMULATOR_HOST
  const rules = await fetch(base + '/emulator/v1/projects/' + project + ':securityRules', {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules',
      content: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') }] } }),
  })
  assert.equal(rules.ok, true, await rules.text())
  function token(uid, verified = true) {
    const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
    return encode({ alg: 'none', typ: 'JWT' }) + '.' + encode({
      sub: uid, user_id: uid, aud: project, iss: 'https://securetoken.google.com/' + project,
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
      email: uid + '@example.com', email_verified: verified,
      firebase: { sign_in_provider: 'password', identities: {} },
    }) + '.'
  }
  async function request(path, auth, method = 'GET', fields) {
    return fetch(base + '/v1/projects/' + project + '/databases/(default)/documents/' + path, {
      method, headers: { authorization: 'Bearer ' + auth, 'content-type': 'application/json' },
      body: fields ? JSON.stringify({ fields }) : undefined,
    })
  }
  for (const path of ['workspaces/alice/telemetry/sensor', 'workspaces/alice/commands/command', 'workspaces/alice/secrets/telegram',
    'brokerUsers/alice-broker', 'memberIndex/alice@example.com']) {
    const seeded = await request(path, 'owner', 'PATCH', { value: { stringValue: 'private' } })
    assert.equal(seeded.ok, true, await seeded.text())
  }
  assert.equal((await request('workspaces/alice/telemetry/sensor', token('alice'))).status, 200)
  assert.equal((await request('workspaces/alice/telemetry/sensor', token('bob'))).status, 403)
  assert.equal((await request('workspaces/alice/commands/command', token('alice'))).status, 200)
  assert.equal((await request('workspaces/alice/commands/command', token('bob'))).status, 403)
  assert.equal((await request('workspaces/alice/commands/command', token('alice'), 'PATCH',
    {status:{stringValue:'delivered'}})).status, 403)
  assert.equal((await request('workspaces/alice/secrets/telegram', token('alice'))).status, 403)
  assert.equal((await request('brokerUsers/alice-broker', token('alice'))).status, 403)
  assert.equal((await request('memberIndex/alice@example.com', token('alice'))).status, 200)
  assert.equal((await request('memberIndex/alice@example.com', token('alice', false))).status, 403)
  assert.equal((await request('memberIndex/alice@example.com', token('bob'))).status, 403)
  assert.equal((await request('workspaces/alice/telemetry/sensor', token('alice'), 'PATCH',
    { value: { stringValue: 'forged' } })).status, 403)
})
