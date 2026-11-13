// 記録を node で流して位置を出す: node tools/simrec.mjs <旗>
import { COURSE as C } from '../js/course.js'
import { newState, step } from '../js/sim.js'
import { readFileSync } from 'node:fs'
const f = +process.argv[2]
const rec = JSON.parse(readFileSync(import.meta.dirname + `/rec_${f}.json`))
const s = newState(C, f)
for (let i = 0; i < rec.acts.length * rec.hold; i++) {
  const a = rec.acts[Math.floor(i / rec.hold)]
  step(C, s, { steer: a.steer, reel: a.reel })
  if (i % (+process.env.EVERY || 300) === 0) console.log(s.t.toFixed(1), s.x.toFixed(1), s.y.toFixed(1), s.kite, s.flag)
}
console.log('end', s.t.toFixed(1), s.x.toFixed(1), s.y.toFixed(1), s.flag)
