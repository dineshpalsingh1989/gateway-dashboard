const requests = new Set()

// Include response-body parsing in the deadline, not just receipt of headers.
export async function requestJSON(url, options = {}, { timeoutMs = 15000, signal, fetchImpl = fetch } = {}) {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })
  requests.add(controller)
  const timer = setTimeout(cancel, timeoutMs)
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal })
    const data = await response.json()
    return { response, data }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
    requests.delete(controller)
  }
}

export function abortRequests() {
  for (const controller of requests) controller.abort()
}

export function installShutdown(cleanup, { timeoutMs = 10000, host = process } = {}) {
  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    const deadline = setTimeout(() => host.exit(1), timeoutMs)
    try { await cleanup(); clearTimeout(deadline); host.exit(0) }
    catch { clearTimeout(deadline); host.exit(1) }
  }
  host.on('SIGTERM', stop)
  host.on('SIGINT', stop)
  return stop
}
