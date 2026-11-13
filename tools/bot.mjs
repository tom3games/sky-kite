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

const AIMS = [15, 40, 60, 75, 90, 105, 120, 140, 165].map(a => a * D)
const ACTS = []
for (const a of AIMS) for (const r of [-1, 0, 1]) ACTS.push({ aim: a, reel: r, walk: 0 })
ACTS.push({ toggle: 1, aim: 90 * D, reel: 0, walk: 0 }, { walk: 1, reel: 0 }, { walk: -1, reel: 0 })
for (const a of [40, 90, 140]) ACTS.push({ toggle: 1, aim: a * D, reel: 0, walk: 0, wait: 1 })

const clone = s => ({ ...s, ev: [] })
const goal = C.flags[to]
function score(s) {
  if (s.flag >= to) return 1e6 - s.t
  const dx = s.x - goal.x, dy = s.y - goal.y
  return -Math.hypot(dx * 0.6, dy) + Math.min(s.y, goal.y + 2) * 0.8 - s.resets * 50 + (s.kite === 'flying' ? s.L * 0.35 : 0)
}
function run(s, a) {
  const n = HOLD
  for (let i = 0; i < n; i++) {
    step(C, s, { aim: a.aim ?? null, reel: a.reel || 0, walk: a.walk || 0, toggle: i === 0 && !!a.toggle })
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
      if (a.toggle && !b.s.ground && (b.s.kite !== 'flying' || a.wait)) continue
      if (a.walk && b.s.kite === 'flying' && !b.s.ground) continue
      const s = run(clone(b.s), a)
      if (s.resets > b.s.resets) continue
      const key = [Math.round(s.x * 2), Math.round(s.y * 2), s.kite, Math.round(s.L / 3), Math.round(s.vx), Math.round(s.vy)].join(',')
      const sc = score(s)
      if (seen.has(key) && seen.get(key) >= sc) continue
      seen.set(key, sc)
      next.push({ s, path: b.path.concat(ai), sc })
    }
  }
  next.sort((a, b) => b.sc - a.sc)
  beam = next.slice(0, BEAM)
  if (!beam.length) break
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
