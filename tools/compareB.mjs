import '../mute-auto.mjs'
// B のコンセプト画と、実際のゲーム画面を並べる（art/compare_B_vs_game_v6.png）
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const d = import.meta.dirname + '/../'
const img = (f, t) => `data:image/${t};base64,` + readFileSync(d + f).toString('base64')
const html = `<body style="margin:0;background:#151517;font:600 26px 'Hiragino Sans';color:#eee;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
<div>B コンセプト画（正解）<img src="${img('art/concept_b.png', 'png')}" style="width:100%;display:block;margin-top:8px"></div>
<div>ゲームの実画面（区間4 僧院・B と同じ向き）<img src="${img('shots/final_pc.png', 'png')}" style="width:100%;display:block;margin-top:8px"></div>
<div>実画面（区間0 麓）<img src="${img('shots/final_pc2.png', 'png')}" style="width:100%;display:block;margin-top:8px"></div>
<div style="display:flex;gap:12px;align-items:flex-start"><div>実画面（区間6 雷の峰）<img src="${img('shots/final_pc3.png', 'png')}" style="width:640px;display:block;margin-top:8px"></div>
<div>スマホ<img src="${img('shots/final_phone.png', 'png')}" style="height:420px;display:block;margin-top:8px"></div></div></body>`
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1960, height: 1200 } })
await p.setContent(html); await p.waitForTimeout(500)
await p.screenshot({ path: d + 'art/compare_B_vs_game_v6.png', fullPage: true }); await b.close()
