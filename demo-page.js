import { readFileSync } from 'node:fs'
import { EXTRA_PROFILES, EXTRA_META } from './sensor-profiles.js'
import { DEMO_SAMPLES } from './demo-data.js'
import { buildDownlink } from './downlink.js'

// Extract the real dashboard without executing its Firebase/server entry point.
export function buildDemoPage() {
  const source=readFileSync(new URL('./milesight.js',import.meta.url),'utf8')
  const marker='const PAGE = String.raw`'
  const start=source.indexOf(marker),end=source.lastIndexOf('</html>`')
  if(start<0||end<start)throw new Error('Dashboard template not found')
  let page=source.slice(start+marker.length,end+7)
  const sdk=readFileSync(new URL('./demo-sdk.js',import.meta.url),'utf8')
  const imports=/import \{ initializeApp \} from[^]*?from 'https:\/\/www.gstatic.com\/firebasejs\/10.12.2\/firebase-firestore.js'/
  if(!imports.test(page))throw new Error('Firebase module block not found')
  page=page.replace(imports,()=>sdk)
  const values={EXTRA_PROFILES:JSON.stringify(EXTRA_PROFILES),EXTRA_META:JSON.stringify(EXTRA_META),DEMO_SAMPLES:JSON.stringify(DEMO_SAMPLES),FIREBASE_CONFIG:'{"projectId":"local-demo"}',CHANGES:'[["Demo","Explore 24 sample devices. Changes stay in this browser session."]]',VERSION:'2.0.0 Demo',BUILD:'2026-10-18',BROKER_DOMAIN:'',SERVER_HOST:'demo.local',MQTT_PORT:'1883'}
  for(const [key,value] of Object.entries(values))page=page.replaceAll('__'+key+'__',()=>value)
  const transport=readFileSync(new URL('./demo-transport.js',import.meta.url),'utf8').replace('__BUILD_DOWNLINK__',()=>buildDownlink.toString())
  page=page.replace('<body>',()=>'<body><script>'+transport+'</script><div style="padding:10px;text-align:center;background:#134e4a;color:white">Interactive demo · 24 sample devices · Changes are temporary · Commands are simulated</div>')
  page=page.replace(/<a href="\/setup">[^<]*<\/a>/g,'<span>Firebase setup is available in the self-hosted application.</span>')
  return page
}
