// 初めての人の bot: チュートリアルの文どおりに押すだけ。浮くまでの時間と、最初の岩棚に着くまでを測る
// 人の反応の遅れ（文が出てから押すまで）を 0.6 秒入れる
import { COURSE as C } from '../js/course.js'
import { newState, step, DT } from '../js/sim.js'
import { makeTutorial, STEPS } from '../js/tutorial.js'
const s = newState(C, 0), tut = makeTutorial(s)
let cur = { reel: 0, steer: 0 }, lastStep = -1, wait = 0.6, log = []
for (let f = 0; f < 60 * 60 && tut.c.on; f++) {
  const st = tut.step
  if (tut.c.i !== lastStep) { lastStep = tut.c.i; wait = 0.6; log.push(`${s.t.toFixed(1)}s ${st.id}`) }
  if (wait > 0) wait -= DT; else cur = st.follow(s)
  step(C, s, cur)
  tut.update(s, cur, DT)
  if (process.env.TRACE && f % 20 === 0) console.log(s.t.toFixed(1), tut.step?.id, s.x.toFixed(1), s.y.toFixed(1), s.kite, s.L.toFixed(1), (s.phi*57.3).toFixed(0), s.lift.toFixed(2), JSON.stringify(cur))
}
console.log(JSON.stringify({ liftAt: tut.c.liftT && +tut.c.liftT.toFixed(2), tutorialDone: !tut.c.on, t: +s.t.toFixed(1), y: +s.y.toFixed(1), x: +s.x.toFixed(1), steps: log }))
