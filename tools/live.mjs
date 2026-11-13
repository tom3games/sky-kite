import '../mute-auto.mjs'
// 公開ページを開いてエラーが無いか・遊べるかを見る: node tools/live.mjs [url]
import { chromium, webkit } from 'playwright'
const url = process.argv[2] || 'https://tom3games.github.io/sky-kite/?touch&v=' + Date.now()
for (const bt of [chromium, webkit]) {
  const br = await bt.launch()
  const p = await br.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
  await p.goto(url); await p.waitForFunction(() => window.__skyReady, null, { timeout: 30000 })
  await p.evaluate(() => sky.start())
  await p.waitForTimeout(600)
  const box = await p.locator('#bIn').boundingBox()
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down()
  await p.waitForTimeout(2500)
  const r = await p.evaluate(() => ({ kite: sky.s.kite, y: +sky.s.y.toFixed(1), t: +sky.s.t.toFixed(1), tut: document.getElementById('tutTxt').textContent }))
  await p.mouse.up()
  console.log(bt.name(), JSON.stringify(r), errs)
  await br.close()
}
process.exit(0)
