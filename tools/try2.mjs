// node tools/try2.mjs <旗> '<json: [[秒,{aim(度),reel,walk,toggle}],...]>' [秒]
import { COURSE as C } from '../js/course.js'
import { newState, step, kitePos } from '../js/sim.js'
const D = Math.PI / 180
const s = newState(C, +process.argv[2])
const plan = JSON.parse(process.argv[3])
let pi = 0, cur = {}
for (let f = 0; f < 60 * (+process.argv[4] || 10); f++) {
  const t = f / 60; let tog = false
  while (pi < plan.length && plan[pi][0] <= t) { cur = { ...plan[pi][1] }; tog = !!cur.toggle; pi++ }
  step(C, s, { steer: cur.steer || 0, reel: cur.reel || 0 })
  if (f % 20 === 0) { const k = kitePos(s); console.log(t.toFixed(2), 'p', s.x.toFixed(1), s.y.toFixed(1), 'v', s.vx.toFixed(1), s.vy.toFixed(1), s.kite, 'L', s.L.toFixed(1), 'phi', (s.phi / D).toFixed(0), 'T', s.T.toFixed(2), 'A', s.A.toFixed(1), 'k', k[0].toFixed(0), k[1].toFixed(0), 'lift', s.lift.toFixed(2), s.ground ? 'G' : '', s.why) }
}
