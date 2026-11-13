// 人の速さの bot: 上手い bot の道筋（rec_<i>.json）を覚えた人が、反応の遅れと手のぶれ込みで追いかける。
// 0.4秒ごとに少し先（2.8秒）を読んで入力を決めるが、決めた入力が効くのは 0.2〜0.35 秒後。左右の強さは 7〜10割、
// 1割の確率で判断を1回見送る（前の入力のまま）。8回（乱数の種を変えて）回し、時間内に次の旗へ着いた回数を数える。
// node tools/human.mjs <区間> [回数=8]
import { COURSE as C } from '../js/course.js'
import { newState, step } from '../js/sim.js'
import { readFileSync } from 'node:fs'

const sec = +process.argv[2], N = +(process.argv[3] || 8), EASY = !!process.env.EASY
const rec = JSON.parse(readFileSync(import.meta.dirname + `/rec_${sec}.json`))
// 手本の道筋
const ref = []
{
  const s = newState(C, sec)
  for (let i = 0; i < rec.acts.length * rec.hold; i++) { const a = rec.acts[Math.floor(i / rec.hold)]; step(C, s, { steer: a.steer, reel: a.reel }); if (i % 6 === 0) ref.push([s.x, s.y]) ; if (s.flag > sec) break }
}
const refT = ref.length * 6 / 60
const ACTS = []; for (const st of [-1, 0, 1]) for (const r of [0, 1]) ACTS.push({ steer: st, reel: r })
const clone = s => ({ ...s, ev: [] })
function progress(s, k0) {
  if (s.flag > sec) return 1e6
  // 道筋のどこにいるか（前後どこでも。覚えた道に戻れば続きから）
  let best = -1, nd = 1e9, nk = 0
  for (let k = 0; k < Math.min(ref.length, k0 + 120); k++) { const d = Math.hypot(s.x - ref[k][0], s.y - ref[k][1]); if (d < 2.2 && k > best) best = k; if (d < nd) { nd = d; nk = k } }
  return best >= 0 ? best * 1 - s.resets * 1e4 : nk - nd * 6 - s.resets * 1e4
}
function plan(s0, k0) {
  let beam = [{ s: clone(s0), first: -1, sc: 0 }]
  for (let d = 0; d < 7; d++) {
    const nx = []
    for (const b of beam) for (let ai = 0; ai < ACTS.length; ai++) {
      const s = clone(b.s); const a = ACTS[ai]
      for (let f = 0; f < 24; f++) { step(C, s, a); if (s.flag > sec) break }
      nx.push({ s, first: b.first < 0 ? ai : b.first, sc: progress(s, k0) })
    }
    nx.sort((a, b) => b.sc - a.sc); beam = nx.slice(0, 12)
    if (beam[0].sc >= 1e6) break
  }
  return { ai: beam[0].first, sc: beam[0].sc }
}
let rs = 1
const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647
const out = []
for (let trial = 0; trial < N; trial++) {
  rs = 1000 + trial * 7919
  const s = newState(C, sec)
  let cur = { steer: 0, reel: 0 }, pend = null, k = 0
  const limit = Math.max(90, refT * 3 + 30) * 60
  let ok = false
  for (let f = 0; f < limit; f++) {
    if (f % 24 === 0) {
      const sc = progress(s, k); if (sc >= 0 && sc < 1e6) k = Math.floor(sc)
      if (EASY || rnd() > 0.1) {
        // 人は反応が遅れるぶん、少し先の自分を見越して決める（今の入力のまま遅れの間だけ進めた所から読む）
        const delay = EASY ? 0 : Math.round((0.2 + rnd() * 0.15) * 60)
        const ps = clone(s); for (let j = 0; j < delay; j++) step(C, ps, cur)
        const p = plan(ps, k); const a = ACTS[p.ai]
        pend = { at: f + delay, a: { steer: a.steer * (EASY ? 1 : 0.7 + rnd() * 0.3), reel: a.reel } }
      }
    }
    if (pend && f >= pend.at) { cur = pend.a; pend = null }
    step(C, s, cur)
    if (process.env.TRACE && f % 60 === 0) console.error(trial, (f/60).toFixed(0), s.x.toFixed(1), s.y.toFixed(1), 'k', k, '/', ref.length, s.kite)
    if (s.flag > sec) { ok = true; break }
  }
  out.push(ok ? +s.t.toFixed(0) : 'x')
}
const n = out.filter(v => v !== 'x').length
console.log(JSON.stringify({ sec, ok: `${n}/${N}`, times: out, expert: +refT.toFixed(1) }))
