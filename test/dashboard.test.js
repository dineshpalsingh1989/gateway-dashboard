import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../milesight.js', import.meta.url), 'utf8')
function extract(start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))
}

test('HTML escaping protects text and quoted attributes', () => {
  const context = vm.createContext({})
  vm.runInContext(extract('function esc(s)', '\n'), context)
  assert.equal(context.esc('<img title="x" onerror=\'alert(1)\'>&'),
    '&lt;img title=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;')
  assert.equal(context.esc(null), '')
})

function history() {
  const pending = [], elements = {}, queries = []
  const context = vm.createContext({
    chart: { dev: 'sensor-a', key: 'temperature', days: 1, request: 0 },
    $: id => elements[id] ||= {}, fs: {}, myUid: 'owner',
    collection: (...args) => args, where: (...args) => args,
    orderBy: (...args) => args, limit: n => n,
    query: (...args) => { queries.push(args); return args },
    getDocs: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    drawChart: () => {}, esc: String,
  })
  vm.runInContext(extract('function closeChart()', '\nfunction drawChart()'), context)
  const snapshot = rows => ({ forEach: fn => rows.forEach(row => fn({ data: () => row })) })
  return { context, pending, elements, queries, snapshot }
}

test('history keeps the newest selection when queries finish out of order', async () => {
  const { context: c, pending, snapshot, queries } = history()
  const first = c.loadChart()
  c.chart.dev = 'sensor-b'; c.chart.key = 'humidity'
  const second = c.loadChart()
  pending[1].resolve(snapshot([
    { ts: 20, values: { humidity: 60 } },
    { ts: 10, values: { humidity: 50 } },
    { ts: 5, values: { humidity: Infinity } },
  ]))
  await second
  pending[0].resolve(snapshot([{ ts: 1, values: { temperature: 99 } }]))
  await first
  assert.deepEqual(JSON.parse(JSON.stringify(c.chart.rows)), [[10, 50], [20, 60]])
  assert.equal(c.chart.busy, false)
  assert.equal(queries[0][2][1], 'desc')
})

test('closing history invalidates pending results and errors', async () => {
  for (const fail of [false, true]) {
    const { context: c, pending, snapshot } = history()
    const loading = c.loadChart()
    c.closeChart()
    if (fail) pending[0].reject(new Error('late failure'))
    else pending[0].resolve(snapshot([{ ts: 1, values: { temperature: 99 } }]))
    await loading
    assert.equal(c.chart.rows.length, 0)
    assert.equal(c.chart.busy, false)
  }
})

test('history disables export while loading and provides retry after failure', async () => {
  const { context: c, pending, elements } = history()
  const loading = c.loadChart()
  assert.equal(elements['sh-csv'].disabled, true)
  pending[0].reject(new Error('Connection lost'))
  await loading
  assert.equal(c.chart.busy, false)
  assert.equal(elements['sh-csv'].disabled, true)
  assert.match(elements['sh-plot'].innerHTML, /Connection lost/)
  assert.equal(elements['sh-retry'].onclick, c.loadChart)
})

test('history detects a capped query and enables export for loaded data', async () => {
  const { context: c, pending, elements } = history()
  const loading = c.loadChart()
  pending[0].resolve({ size: 500, forEach: fn => fn({
    data: () => ({ ts: 20, values: { temperature: 21 } }),
  }) })
  await loading
  assert.equal(c.chart.limited, true)
  assert.equal(elements['sh-csv'].disabled, false)
})
