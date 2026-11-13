import '../mute-auto.mjs'
// 公開ページを開いてエラーが無いか・遊べるかを見る: node tools/live.mjs [url]
import { chromium, webkit } from 'playwright'
const url = process.argv[2] || 'https://tom3games.github.io/sky-kite/?v=' + Date.now()
for (const bt of [chromium, webkit]) {
  const br = await bt.launch()
  const p = await br.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
  await p.goto(url); await p.waitForFunction(() => window.__skyReady, null, { timeout: 30000 })
  await p.evaluate(() => { sky.start(); sky.inp.toggle = true })
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => ({ kite: sky.s.kite, t: +sky.s.t.toFixed(1) }))
  console.log(bt.name(), JSON.stringify(r), errs)
  await br.close()
}
process.exit(0)
