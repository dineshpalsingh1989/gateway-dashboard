import { mkdir, writeFile } from 'node:fs/promises'
import { buildDemoPage } from './demo-page.js'

const directory=new URL('./dist/',import.meta.url)
await mkdir(directory,{recursive:true})
await writeFile(new URL('index.html',directory),buildDemoPage())
await writeFile(new URL('.nojekyll',directory),'')
console.log('Static demo built: dist/index.html')
