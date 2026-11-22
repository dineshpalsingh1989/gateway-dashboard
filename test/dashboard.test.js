import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../milesight.js', import.meta.url), 'utf8')
const plain = v => JSON.parse(JSON.stringify(v))
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

test('energy integrates power over time and skips long gaps', () => {
  const context = vm.createContext({})
  vm.runInContext(extract('function energyWh(rows)', '\nvar LOAD_KEYS'), context)
  const h = 3600000
  assert.equal(context.energyWh([[0, 100], [h, 300]]), 200)
  assert.equal(context.energyWh([[0, 100], [h, 100], [3 * h, 100]]), 100)
  assert.equal(context.energyWh([[0, 100]]), 0)

  const day = new Date(2026, 0, 5, 0, 0).getTime() // a Monday
  const days = context.dailyBuckets([[day, 10, 8, 12, 500], [day + h, 20, 18, 22, 700], [day + 24 * h, 5, 5, 5, 100]], 'power')
  assert.deepEqual(plain(days.map(d => [d.avg, d.min, d.max, d.kwh])), [[15, 8, 22, 1.2], [5, 5, 5, 0.1]])
  const grid = context.patternGrid([[day + 9 * h, 4], [day + 7 * 24 * h + 9 * h, 6], [day + 24 * h, 1]])
  assert.deepEqual(plain([grid[0][9], grid[1][0], grid[6][0]].map(c => [c.sum, c.n])), [[10, 2], [1, 1], [0, 0]])
})

test('server rolls readings up per hour and alerts once per condition change', async () => {
  const sent = []
  const context = vm.createContext({ ENVELOPE: new Set(['devEUI']), notifyAlert: async (uid, text) => sent.push(text) })
  vm.runInContext(extract('function rollupHour(', '\n// Alerts go to everyone'), context)
  let r = context.rollupHour(null, 0, { power: 100, devEUI: 1, label: 'x' }, null, 0)
  r = context.rollupHour(r, 0, { power: 300 }, { ts: 0, values: { power: 100 } }, 1800000)
  assert.deepEqual(JSON.parse(JSON.stringify([r.n, r.sum, r.min, r.max, r.wh])), [{ power: 2 }, { power: 400 }, { power: 100 }, { power: 300 }, 100])

  const limits = { temperature: { min: null, max: -18 } }
  const cold = context.alertConditions('Freezer', { temperature: -12, leak: 0, battery: 50 }, limits)
  assert.deepEqual(plain(cold.map(a => a.id)), ['limit:temperature'])
  await context.checkAlerts('u', 'd', cold, null)
  await context.checkAlerts('u', 'd', cold, null)
  assert.equal(sent.length, 1)
  assert.match(sent[0], /Freezer: temperature -12 is above -18/)
  // A silence sweep does not speak for limits, so it must not clear them.
  await context.checkAlerts('u', 'd', [], ['silent'])
  assert.equal(sent.length, 1)
  await context.checkAlerts('u', 'd', context.alertConditions('Freezer', { temperature: -19 }, limits), null)
  assert.match(sent[1], /back within limits/)
  // Flapping straight back inside the cool-down stays quiet.
  await context.checkAlerts('u', 'd', cold, null)
  assert.equal(sent.length, 2)
})

test('overview totals load, flags problems and hides power when absent', () => {
  const elements = {}
  const now = Date.now()
  const context = vm.createContext({
    $: id => elements[id] ||= {}, esc: String, show: (el, on) => { el.hidden = !on },
    meta: k => ({ n: k, dp: 1 }), mvar: k => k, fmt: v => v, ago: () => '3h ago',
    devices: {
      plug: { name: 'Plug', lastSeenAt: { toMillis: () => now } },
      ct: { name: 'Panel', lastSeenAt: { toMillis: () => now } },
      leak: { name: 'Tank', lastSeenAt: { toMillis: () => now - 3 * 3600000 } },
    },
    telemetry: {
      plug: { values: { power: 1200 } },
      ct: { values: { current_1: 10, current_2: 10, current_3: 13 } },
      leak: { values: { leak: 1, battery: 9 } },
    },
  })
  vm.runInContext(extract('var LOAD_KEYS', '\nvar lastVals'), context)
  context.renderOverview()
  assert.deepEqual([now, now - 30 * 60000, now - 3 * 3600000, 0].map(t => context.freshness(t)), ['on', 'idle', 'off', ''])
  // A device reporting hourly is still fine after 70 minutes; one reporting every 5 is silent.
  assert.equal(context.freshness(now - 70 * 60000, 60), 'on')
  assert.equal(context.freshness(now - 20 * 60000, 5), 'off')
  assert.match(elements['pw-tiles'].innerHTML, /1\.20<small>kW/)
  assert.match(elements['pw-tiles'].innerHTML, /33\.0<small>A/)
  assert.match(elements['pw-tiles'].innerHTML, /Phase imbalance.*27\.3/)
  assert.match(elements.att.innerHTML, /Leak detected.*Battery 9%.*Silent 3h/)
  assert.equal(elements.pw.hidden, false)

  context.telemetry = { plug: { values: { temperature: 20 } } }
  context.devices = { plug: { name: 'Plug' } }
  context.renderOverview()
  assert.equal(elements.pw.hidden, true)
  assert.match(elements.att.innerHTML, /All clear/)
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
