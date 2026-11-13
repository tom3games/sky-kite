import '../mute-auto.mjs'
// og.png（1200x630）を実画面から撮る
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
process.env.PORT = '5843'
await import('../server.mjs')
const rec = JSON.parse(readFileSync(import.meta.dirname + '/rec_0.json'))
const br = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] })
const p = await br.newPage({ viewport: { width: 1200, height: 630 }, locale: 'ja-JP' })
await p.goto(`http://localhost:5843/`)
await p.waitForFunction(() => window.__skyReady)
await p.evaluate(rec => { sky.start(); sky.replay(rec, 0) }, rec)
await p.waitForFunction(() => sky.s.t >= +(process?.env?.T || 12), null, { polling: 50 }).catch(() => {})
await p.waitForFunction(() => sky.s.t >= 12.5, null, { polling: 50 })
await p.evaluate(() => { document.getElementById('hud').hidden = true; document.getElementById('msg').textContent = '' })
await p.waitForTimeout(100)
await p.screenshot({ path: 'og.png' })
await br.close(); process.exit(0)
