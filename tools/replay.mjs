import '../mute-auto.mjs'
// 記録した入力を実画面で流して何枚か撮る: node tools/replay.mjs <旗> <名前> <撮る秒,...> [w h]
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
process.env.PORT = process.env.VPORT || '5846'
await import('../server.mjs')
const [flag, name, times, w = 1280, h = 720] = process.argv.slice(2)
const rec = JSON.parse(readFileSync(import.meta.dirname + `/rec_${flag}.json`))
const br = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] })
const p = await br.newPage({ viewport: { width: +w, height: +h }, locale: 'ja-JP' })
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
await p.goto(`http://localhost:${process.env.PORT}/${+w < +h ? '?touch' : ''}`)
await p.waitForFunction(() => window.__skyReady, null, { timeout: 20000 })
await p.evaluate(([rec, f]) => { sky.start(); sky.replay(rec, +f) }, [rec, flag])
let prev = 0
for (const t of times.split(',').map(Number)) {
  await p.waitForFunction(t => sky.s.t >= t, t, { timeout: 120000, polling: 50 })
  await p.screenshot({ path: `shots/${name}_${t}.png` })
}
console.log(JSON.stringify(await p.evaluate(() => { const s = sky.s; return { x: s.x, y: s.y, flag: s.flag, t: s.t } })), errs)
await br.close(); process.exit(0)
