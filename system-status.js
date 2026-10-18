import os from 'node:os'
import { statfs, stat, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
export async function systemStatus(databasePath, mode) {
  const path=resolve(databasePath)
  const disk=await statfs(dirname(path)).then(s=>({totalBytes:s.blocks*s.bsize,freeBytes:s.bavail*s.bsize})).catch(()=>null)
  const sizes=await Promise.all([path,path+'.wal'].map(p=>stat(p).then(s=>s.size).catch(()=>0)))
  let memory={totalBytes:os.totalmem(),freeBytes:os.freemem(),scope:'OS visible to container'}
  try {
    const [max,current]=await Promise.all([readFile('/sys/fs/cgroup/memory.max','utf8'),readFile('/sys/fs/cgroup/memory.current','utf8')])
    if(Number.isFinite(Number(max)) && Number(max)>0) memory={totalBytes:Number(max),freeBytes:Math.max(0,Number(max)-Number(current)),scope:'Container limit'}
  } catch {}
  return {storageMode:mode,databaseBytes:mode==='duckdb'?sizes[0]+sizes[1]:null,disk,memory,processMemoryBytes:process.memoryUsage().rss,uptimeSeconds:Math.round(process.uptime())}
}
export function statusText(s){const gb=n=>(n/1073741824).toFixed(2)+' GB';return 'Storage: '+s.storageMode+'\n'+(s.databaseBytes!==null?'DuckDB: '+gb(s.databaseBytes)+'\n':'')+(s.disk?'Disk free: '+gb(s.disk.freeBytes)+' / '+gb(s.disk.totalBytes)+'\n':'Disk status unavailable\n')+'Memory free: '+gb(s.memory.freeBytes)+' / '+gb(s.memory.totalBytes)+' ('+s.memory.scope+')\nProcess RAM: '+gb(s.processMemoryBytes)}
