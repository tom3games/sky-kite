import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const dir = import.meta.dirname + '/../art/'
const img = k => 'data:image/png;base64,' + readFileSync(dir + `concept_${k}.png`).toString('base64')
const labs = { a: 'A 夕焼けの凧揚げの里（茜・墨・和紙の角凧）', b: 'B 雪山の断崖の僧院（コバルト・白・深紅の菱凧）', c: 'C 秋の高原の風車塔（琥珀・薄紫・藍の箱凧）' }
const html = `<body style="margin:0;background:#151517;font:600 30px 'Hiragino Sans';color:#eee;display:flex;gap:12px;padding:12px">` +
  Object.keys(labs).map(k => `<div><div style="height:56px">${labs[k]}</div><img src="${img(k)}" style="width:960px;height:540px;display:block"></div>`).join('') + '</body>'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960 * 3 + 48, height: 540 + 92 } })
await p.setContent(html); await p.waitForTimeout(500)
await p.screenshot({ path: dir + 'compare.png' }); await b.close()
