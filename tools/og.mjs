import '../mute-auto.mjs'
// og.png（1200x630）と、B の絵との比較用の実画面（shots/final_pc.png）を撮る
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
process.env.PORT = '5848'
await import('../server.mjs')
const br = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] })
for (const [w, h, out, f, at] of [[1200, 630, 'og.png', 4, 13], [1280, 720, 'shots/final_pc.png', 4, 13], [1280, 720, 'shots/final_pc2.png', 0, 4], [1280, 720, 'shots/final_pc3.png', 6, 12], [390, 844, 'shots/final_phone.png', 4, 13]]) {
  const rec = JSON.parse(readFileSync(import.meta.dirname + `/rec_${f}.json`))
  const p = await br.newPage({ viewport: { width: w, height: h }, locale: 'ja-JP' })
  await p.goto(`http://localhost:5848/${w < h ? '?touch' : ''}`)
  await p.waitForFunction(() => window.__skyReady, null, { timeout: 40000 })
  await p.evaluate(([rec, f]) => { sky.start(); sky.replay(rec, f) }, [rec, f])
  await p.waitForFunction(at => sky.s.t >= at, at, { polling: 30, timeout: 60000 })
  if (out === 'og.png') await p.evaluate(() => { for (const id of ['hud', 'tut', 'touch']) document.getElementById(id).style.visibility = 'hidden'; const d = document.createElement('div'); d.innerHTML = '<div style="position:fixed;left:48px;top:40px;font:700 112px/0.9 Cormorant Garamond,Georgia,serif;color:#fff;letter-spacing:.06em;text-shadow:0 4px 20px rgba(0,10,40,.5)">SKY KITE</div>'; document.body.appendChild(d) })
  await p.waitForTimeout(400)
  await p.screenshot({ path: out }); await p.close()
}
await br.close(); process.exit(0)
