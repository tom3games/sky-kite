// 手で書いた入力の筋書きを回して軌跡を出す: node tools/try.mjs
import { COURSE as C } from '../js/course.js'
import { newState, step, kitePos } from '../js/sim.js'
const s = newState(C, +(process.argv[2] || 0))
const D = Math.PI / 180
// [秒, {aim, reel, walk, toggle}]
const plan = [
  [0, { toggle: 1, aim: 45 * D }], [0.3, { aim: 45 * D, reel: -1 }], [3, { aim: 70 * D, reel: 1 }], [5.5, { aim: 60 * D, reel: 0 }],
]
let pi = 0, cur = {}
for (let f = 0; f < 60 * 8; f++) {
  const t = f / 60
  let tog = false
  while (pi < plan.length && plan[pi][0] <= t) { cur = { ...plan[pi][1] }; tog = !!cur.toggle; pi++ }
  step(C, s, { aim: cur.aim ?? null, reel: cur.reel || 0, walk: cur.walk || 0, toggle: tog })
  if (f % 15 === 0) { const k = kitePos(s); console.log(t.toFixed(2), 'p', s.x.toFixed(1), s.y.toFixed(1), 'v', s.vx.toFixed(1), s.vy.toFixed(1), s.kite, 'L', s.L.toFixed(1), 'phi', (s.phi / D).toFixed(0), 'T', s.T.toFixed(2), 'A', s.A.toFixed(1), s.ground ? 'G' : '', s.why) }
}
