import '../mute-auto.mjs'
// 実画面を撮る: node tools/shot.mjs [名前] [w] [h] [旗] [秒] [JSで入力]
import { chromium } from 'playwright'
process.env.PORT = process.env.VPORT || '5841'
await import('../server.mjs')
const [name = 'a', w = 1280, h = 720, flag = 0, sec = 3, code = ''] = process.argv.slice(2)
const br = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] })
const p = await br.newPage({ viewport: { width: +w, height: +h }, locale: 'ja-JP' })
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
await p.goto(`http://localhost:${process.env.PORT}/${+w < +h ? '?touch' : ''}`)
await p.waitForFunction(() => window.__skyReady, null, { timeout: 20000 })
await p.screenshot({ path: `shots/${name}_title.png` })
await p.evaluate(([f, code]) => { const { sky } = window; sky.start(); if (+f) { sky.s = sky.newState ? sky.newState(+f) : sky.s } ; if (code) eval(code) }, [flag, code])
await p.waitForTimeout(+sec * 1000)
await p.screenshot({ path: `shots/${name}.png` })
console.log(JSON.stringify(await p.evaluate(() => { const s = window.sky.s; return { x: s.x, y: s.y, kite: s.kite, L: s.L, t: s.t } })), errs)
await br.close(); process.exit(0)
