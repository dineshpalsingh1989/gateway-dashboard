import { DuckDBInstance } from '@duckdb/node-api'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const localFields = {
  serverTimestamp: () => ({ __op: 'timestamp' }),
  delete: () => ({ __op: 'delete' }),
}
export function revive(value) {
  if (value && typeof value === 'object') {
    if (Number.isFinite(value.__timestamp)) return { __timestamp: value.__timestamp,
      toMillis: () => value.__timestamp, toDate: () => new Date(value.__timestamp) }
    for (const k of Object.keys(value)) value[k] = revive(value[k])
  }
  return value
}
function mergeData(old, patch) {
  const out = { ...old }
  for (const [k, v] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) throw Error('Invalid field')
    if (v?.__op === 'delete') delete out[k]
    else if (v?.__op === 'timestamp') out[k] = { __timestamp: Date.now() }
    else if (v && typeof v === 'object' && !Array.isArray(v) && !('__timestamp' in v)) out[k] = mergeData(old?.[k] || {}, v)
    else out[k] = v
  }
  return out
}

// A single queued connection owns the database, including transaction reads.
export async function openLocalStore(filename) {
  const path = resolve(filename)
  mkdirSync(dirname(path), { recursive: true })
  const instance = await DuckDBInstance.create(path, { threads: '2', memory_limit: '256MB' })
  const connection = await instance.connect()
  await connection.run('CREATE TABLE IF NOT EXISTS documents (path VARCHAR PRIMARY KEY, body VARCHAR NOT NULL)')
  let tail = Promise.resolve()
  function queue(fn) { const result = tail.then(fn); tail = result.catch(() => {}); return result }
  async function read(path) {
    const rows = (await connection.runAndReadAll('SELECT body FROM documents WHERE path = $1', [path])).getRows()
    return rows.length ? JSON.parse(rows[0][0]) : undefined
  }
  async function write(path, data, merge) {
    const body = mergeData(merge ? await read(path) || {} : {}, data)
    await connection.run('INSERT OR REPLACE INTO documents VALUES ($1, $2)', [path, JSON.stringify(body)])
  }
  const remove = path => connection.run('DELETE FROM documents WHERE path = $1', [path])
  function snap(path, data) { return { id: path.split('/').pop(), exists: data !== undefined, ref: doc(path), data: () => revive(data) } }
  function doc(path) {
    return { path, get: () => queue(async () => snap(path, await read(path))),
      set: (data, opts) => queue(() => write(path, data, opts?.merge)),
      update: data => queue(() => write(path, data, true)), delete: () => queue(() => remove(path)) }
  }
  function collection(path, filters = []) {
    return { path,
      where: (...args) => collection(path, [...filters, { where: args }]),
      orderBy: (...args) => collection(path, [...filters, { orderBy: args }]),
      limit: n => collection(path, [...filters, { limit: n }]),
      add: async data => { const ref = doc(path + '/' + randomUUID()); await ref.set(data); return ref },
      get: () => queue(async () => {
        const prefix = path + '/'
        const rows = (await connection.runAndReadAll('SELECT path, body FROM documents WHERE starts_with(path, $1)', [prefix])).getRows()
        let docs = rows.filter(([p]) => !p.slice(prefix.length).includes('/')).map(([p,b]) => snap(p, JSON.parse(b)))
        for (const f of filters) {
          if (f.where) { const [k,op,v] = f.where; docs = docs.filter(d => op === '>=' ? d.data()[k] >= v : op === '==' ? d.data()[k] === v : false) }
          if (f.orderBy) { const [k,dir] = f.orderBy; docs.sort((a,b) => (a.data()[k] < b.data()[k] ? -1 : a.data()[k] > b.data()[k] ? 1 : 0) * (dir === 'desc' ? -1 : 1)) }
          if (f.limit) docs = docs.slice(0, f.limit)
        }
        return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn) }
      }),
      onSnapshot: (fn, error = () => {}) => {
        let stopped = false, busy = false
        const poll = async () => { if (busy || stopped) return; busy = true; try { const s = await collection(path).get(); if (!stopped) fn(s) } catch(e) { error(e) } finally { busy = false } }
        poll(); const timer = setInterval(poll, 2000); return () => { stopped = true; clearInterval(timer) }
      },
    }
  }
  function transaction(fn) {
    return queue(async () => {
      await connection.run('BEGIN TRANSACTION')
      const writes = []
      const tx = { get: async ref => snap(ref.path, await read(ref.path)),
        set: (ref,data,opts) => writes.push(() => write(ref.path,data,opts?.merge)),
        update: (ref,data) => writes.push(() => write(ref.path,data,true)), delete: ref => writes.push(() => remove(ref.path)) }
      try { const result = await fn(tx); for (const w of writes) await w(); await connection.run('COMMIT'); return result }
      catch(e) { await connection.run('ROLLBACK'); throw e }
    })
  }
  return { path, doc, collection, runTransaction: transaction,
    batch: () => { const refs = []; return { delete: ref => refs.push(ref), commit: () => transaction(async tx => refs.forEach(ref => tx.delete(ref))) } },
    terminate: () => queue(async () => { await connection.run('CHECKPOINT'); connection.closeSync(); instance.closeSync() }),
  }
}
