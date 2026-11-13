// 上手い bot（先を読む探索）: 旗 i から旗 i+1 まで行けるかを探す。
// node tools/bot.mjs [開始の旗] [終わりの旗] [ビーム幅] [反応(刻み)]
// 入力は 0.3 秒ごとに選び直す（人が考えて押す速さに近い粒度）。見つかった入力は tools/rec_<i>.json に残す。
import { COURSE as C } from '../js/course.js'
import { newState, step, K } from '../js/sim.js'
import { writeFileSync } from 'node:fs'

const D = Math.PI / 180
const from = +(process.argv[2] ?? 0), to = +(process.argv[3] ?? from + 1)
const BEAM = +(process.argv[4] ?? 60)
const HOLD = +(process.argv[5] ?? 18) // 何刻みごとに選び直すか（18=0.3秒）
const MAXT = +(process.env.MAXT ?? 120)

const ACTS = []
for (const st of [-1, 0, 1]) for (const r of [0, 1]) ACTS.push({ steer: st, reel: r })
const clone = s => ({ ...s, ev: [] })
const goal = C.flags[to]
function score(s) {
  if (s.flag >= to) return 1e6 - s.t
  const dx = s.x - goal.x, dy = s.y - goal.y
  const near = s.y > goal.y - 2.5
  return Math.min(s.y, goal.y + 1.5) - (near ? Math.abs(dx) * 0.7 : Math.abs(dx) * 0.08) - s.resets * 50 + (s.kite === 'flying' ? s.L * 0.25 : -3)
}
function run(s, a) {
  const n = HOLD
  for (let i = 0; i < n; i++) {
    step(C, s, { steer: a.steer, reel: a.reel })
    if (s.flag >= to) break
  }
  return s
}
let beam = [{ s: newState(C, from), path: [] }]
const seen = new Map()
let best = null
const t0 = Date.now()
for (let depth = 0; depth * HOLD / 60 < MAXT; depth++) {
  const next = []
  for (const b of beam) {
    for (let ai = 0; ai < ACTS.length; ai++) {
      const a = ACTS[ai]
      const s = run(clone(b.s), a)
      if (s.resets > b.s.resets) continue
      if (s.y < C.flags[from].y - (+process.env.DROP || 15)) continue
      const key = [Math.floor(depth / 10), Math.round(s.x * 2), Math.round(s.y * 2), s.kite, Math.round(s.L / 3), Math.round(s.vx), Math.round(s.vy), Math.round(s.aim * 4)].join(',')
      const sc = score(s)
      if (seen.has(key) && seen.get(key) >= sc) continue
      seen.set(key, sc)
      next.push({ s, path: b.path.concat(ai), sc })
    }
  }
  next.sort((a, b) => b.sc - a.sc)
  // 横の位置ごとに上位を残す（一つの場所に固まらないように）
  const per = new Map(); beam = []
  for (const n of next) { const k = Math.round(n.s.x / 4); const c = per.get(k) || 0; if (c < Math.max(3, BEAM / 12)) { per.set(k, c + 1); beam.push(n) } if (beam.length >= BEAM) break }
  if (!beam.length) { console.error("empty at", depth); break }
  if (beam[0].s.flag >= to) { best = beam[0]; break }
  if (depth % 20 === 0) { const b = beam[0].s; console.error(`t=${(depth * HOLD / 60).toFixed(1)} best x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} kite=${b.kite} L=${b.L.toFixed(0)} sc=${beam[0].sc.toFixed(1)}`) }
}
if (best) {
  console.log(JSON.stringify({ ok: true, from, to, time: +best.s.t.toFixed(1), drops: best.s.falls, ms: Date.now() - t0 }))
  writeFileSync(import.meta.dirname + `/rec_${from}.json`, JSON.stringify({ hold: HOLD, acts: best.path.map(i => ACTS[i]) }))
} else {
  const b = beam[0]?.s
  console.log(JSON.stringify({ ok: false, from, to, reached: b && { x: +b.x.toFixed(1), y: +b.y.toFixed(1), best: +b.best.toFixed(1) }, ms: Date.now() - t0 }))
}
