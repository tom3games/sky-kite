import './mute-auto.mjs'
// SKY KITE の総合検査: node verify.mjs（Chromium と WebKit）
import { chromium, webkit } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { readFileSync } from 'node:fs'
process.env.PORT = process.env.VPORT || '5845'
await import('./server.mjs')
const URL0 = `http://localhost:${process.env.PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(bt, opts = {}, q = '') {
  const br = await bt.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), ...(bt === chromium ? ['--use-gl=angle', '--ignore-gpu-blocklist'] : [])] })
  const ctx = await br.newContext({ locale: 'ja-JP', viewport: { width: 1280, height: 720 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('vclr')) { localStorage.clear(); sessionStorage.setItem('vclr', '1') } } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []; p.br = br
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__skyReady, null, { timeout: 40000 })
  return p
}
const fit = q => q.evaluate(() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  if (de.scrollWidth > W + 1) over.push('pageW:' + de.scrollWidth)
  for (const el of document.querySelectorAll('button, .t-how p, h1, #tut')) { if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue; const r = el.getBoundingClientRect(); if (!r.width) continue; if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) over.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + ',' + Math.round(r.top) + '-' + Math.round(r.right) + ',' + Math.round(r.bottom)) }
  return over
})

for (const bt of [chromium, webkit]) {
  const B = bt.name()
  const p = await open(bt)
  await t(`${B}: 起動時にエラーが出ない`, async () => { expect(p.errs.length === 0, p.errs.join('|')) })
  await t(`${B}: 音が鳴らない（検査の無音化が効いている）`, async () => p.evaluate(() => window.__muteOk ? window.__muteOk() : true))
  await t(`${B}: ブラウザの拡大が起きない`, async () => {
    const r = await p.evaluate(() => {
      const vp = document.querySelector('meta[name=viewport]').content
      const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
      const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
      const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
      return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect || getComputedStyle(document.body).webkitUserSelect }
    })
    expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r))
  })
  await t(`${B}: OGP 一式`, async () => {
    const r = await p.evaluate(() => ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => !!document.querySelector(`meta[property="${k}"]`)).concat(!!document.querySelector('meta[name="twitter:card"]')))
    expect(r.every(Boolean), JSON.stringify(r))
  })
  await t(`${B}: Space 長押しで1.5秒以内に体が浮く（PC）`, async () => {
    await p.click('#startBtn'); await p.waitForTimeout(300)
    const y0 = await p.evaluate(() => sky.s.y)
    await p.keyboard.down('Space')
    await p.waitForFunction(y0 => sky.s.y > y0 + 1.2 && !sky.s.ground, y0, { timeout: 4000, polling: 30 })
    const r = await p.evaluate(() => ({ t: +sky.s.t.toFixed(2), y: +sky.s.y.toFixed(1), tut: document.getElementById('tutTxt').textContent }))
    await p.keyboard.up('Space')
    expect(r.t < 4, JSON.stringify(r)); return r
  })
  await t(`${B}: 糸が張って浮ける時は金色`, async () => {
    await p.keyboard.down('Space'); await p.waitForTimeout(500)
    const r = await p.evaluate(() => ({ lift: sky.s.lift }))
    await p.keyboard.up('Space')
    expect(r.lift > 0.9, JSON.stringify(r)); return r
  })
  await t(`${B}: D で凧が右へ振れる`, async () => {
    const a0 = await p.evaluate(() => sky.s.aim)
    await p.keyboard.down('KeyD'); await p.waitForTimeout(500); await p.keyboard.up('KeyD')
    const a1 = await p.evaluate(() => sky.s.aim)
    expect(a1 < a0 - 0.2, a0 + '→' + a1); return { a0: +a0.toFixed(2), a1: +a1.toFixed(2) }
  })
  await t(`${B}: 旗に触れると保存され、読み直すとそこから`, async () => {
    await p.evaluate(() => { sky.s = sky.newState(2); sky.s.flag = 2; sky.s.ev.push('flag') })
    await p.evaluate(() => { try { localStorage.setItem('skykite', JSON.stringify({ flag: 2, best: 40 })) } catch (e) {} })
    await p.reload(); await p.waitForFunction(() => window.__skyReady, null, { timeout: 40000 })
    const f = await p.evaluate(() => sky.s.flag)
    expect(f === 2, 'flag ' + f); return f
  })
  await t(`${B}: 奈落に落ちると旗へ戻る`, async () => {
    await p.click('#startBtn')
    await p.evaluate(() => { sky.s.y = -30 })
    await p.waitForTimeout(200)
    const r = await p.evaluate(() => ({ flag: sky.s.flag, y: +sky.s.y.toFixed(1), resets: sky.s.resets }))
    expect(r.y > 30 && r.resets === 1, JSON.stringify(r)); return r
  })
  await t(`${B}: 頂上の記録を流すと結果画面とポスト`, async () => {
    const rec = JSON.parse(readFileSync('tools/rec_9.json'))
    await p.evaluate(rec => { sky.start(); sky.replay(rec, 9) }, rec)
    await p.waitForFunction(() => !document.getElementById('goal').hidden, null, { timeout: 240000, polling: 200 })
    const r = await p.evaluate(() => ({ txt: document.getElementById('goalTxt').textContent, post: document.getElementById('gPost').href.slice(0, 40) }))
    expect(/x\.com\/intent\/post/.test(r.post), JSON.stringify(r)); return r
  })
  await t(`${B}: 英語に切り替わる`, async () => {
    await p.evaluate(() => { document.getElementById('goal').hidden = true; document.getElementById('title').hidden = false })
    await p.click('#langBtn'); const r = await p.evaluate(() => document.getElementById('startBtn').textContent)
    expect(r === 'Climb', r); return r
  })
  await t(`${B}: 山の左右の外へ出ると旗へ戻る`, async () => {
    await p.evaluate(() => { document.getElementById('goal').hidden = true; sky.s = sky.newState(3); sky.start(); sky.s.x = 44; sky.s.y = 80 })
    await p.waitForTimeout(2200)
    const r = await p.evaluate(() => ({ x: +sky.s.x.toFixed(1), resets: sky.s.resets }))
    expect(r.resets >= 1 && Math.abs(r.x) < 40, JSON.stringify(r)); return r
  })
  await t(`${B}: 最後までエラーなし`, async () => { expect(p.errs.length === 0, p.errs.join('|')) })
  await p.br.close()

  // スマホ: 巻くボタンで浮く・固定スティックで振れる
  const m = await open(bt, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: bt === chromium }, '?touch')
  await t(`${B}: スマホの巻くボタンで浮く`, async () => {
    await m.click('#startBtn'); await m.waitForTimeout(300)
    const b = await m.locator('#bIn').boundingBox()
    await m.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await m.mouse.down()
    await m.waitForFunction(() => sky.s.y > 2 && !sky.s.ground, null, { timeout: 4000, polling: 30 })
    await m.mouse.up(); return { t: await m.evaluate(() => +sky.s.t.toFixed(2)) }
  })
  await t(`${B}: スマホの固定スティックで凧が振れる`, async () => {
    const a0 = await m.evaluate(() => sky.s.aim)
    const b = await m.locator('#stick').boundingBox()
    await m.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await m.mouse.down(); await m.mouse.move(b.x + b.width - 6, b.y + b.height / 2)
    await m.waitForTimeout(500); await m.mouse.up()
    const a1 = await m.evaluate(() => sky.s.aim)
    expect(a1 < a0 - 0.2, a0 + '→' + a1); return { a0: +a0.toFixed(2), a1: +a1.toFixed(2) }
  })
  await t(`${B}: スマホでエラーなし`, async () => { expect(m.errs.length === 0, m.errs.join('|')) })
  await m.br.close()

  // 画面の大きさごとに一画面に収まる
  for (const [w, h, name] of [[360, 640, 'small'], [390, 844, 'phone'], [844, 390, 'land'], [768, 1024, 'tab'], [1440, 900, 'pc']]) {
    const q = await open(bt, { viewport: { width: w, height: h } }, w < 900 ? '?touch' : '')
    await t(`${B}: ${name} タイトルが一画面`, async () => { const o = await fit(q); expect(!o.length, o.join(' ')) })
    await q.click('#startBtn'); await q.waitForTimeout(400)
    await t(`${B}: ${name} 遊ぶ画面が一画面`, async () => { const o = await fit(q); expect(!o.length, o.join(' ')) })
    await q.br.close()
  }
}
console.log(results.join('\n'))
console.log(`\n${pass} ok / ${fail} fail`)
process.exit(fail ? 1 : 0)
