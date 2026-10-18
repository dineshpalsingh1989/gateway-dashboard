import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { requestJSON, abortRequests, installShutdown } from '../runtime.js'

test('request deadline includes stalled response bodies', async () => {
  await assert.rejects(requestJSON('https://example.invalid', {}, {
    timeoutMs: 10,
    fetchImpl: async (_, { signal }) => ({ json: () => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('deadline')), { once: true })
    }) }),
  }), /deadline/)
})

test('shutdown cancels outstanding network requests', async () => {
  const pending = requestJSON('https://example.invalid', {}, {
    fetchImpl: (_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })
    }),
  })
  abortRequests()
  await assert.rejects(pending, /cancelled/)
})

test('stopping a bot cancels only its own request', async () => {
  const controller = new AbortController()
  const pending = requestJSON('https://example.invalid', {}, {
    signal: controller.signal,
    fetchImpl: (_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('bot stopped')), { once: true })
    }),
  })
  controller.abort()
  await assert.rejects(pending, /bot stopped/)
})

test('shutdown runs cleanup once even when multiple signals arrive', async () => {
  const host = new EventEmitter(), exits = []
  host.exit = code => exits.push(code)
  let calls = 0, finish
  installShutdown(() => { calls++; return new Promise(resolve => { finish = resolve }) }, { host })
  host.emit('SIGTERM'); host.emit('SIGINT')
  assert.equal(calls, 1)
  assert.deepEqual(exits, [])
  finish()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(exits, [0])
})

test('shutdown has a deadline and reports cleanup failures', async () => {
  for (const hangs of [false, true]) {
    const host = new EventEmitter()
    const exit = new Promise(resolve => { host.exit = resolve })
    installShutdown(() => hangs ? new Promise(() => {}) : Promise.reject(new Error('failure')), { host, timeoutMs: 10 })
    host.emit('SIGTERM')
    assert.equal(await exit, 1)
  }
})
