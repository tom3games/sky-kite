// 技なしの bot（風を読まない）: 3種で区間ごとに越えられるか。腕の差が出るかを見る
//   全力: ずっと巻く＋旗の方へ振る ／ 交互: 2秒巻く・2秒離す＋旗の方へ ／ 真上: 凧を真上に保って巻く
import { COURSE as C } from '../js/course.js'
import { newState, step } from '../js/sim.js'
const pol = {
  full: (s, g) => ({ reel: 1, steer: Math.sign(g.x - s.x) * (s.phi > 0.5 && s.phi < 2.6 ? 1 : 0) }),
  pump: (s, g) => ({ reel: Math.floor(s.t / 2) % 2 ? 0 : 1, steer: Math.sign(g.x - s.x) * (s.phi > 0.5 && s.phi < 2.6 ? 1 : 0) }),
  up: (s) => ({ reel: 1, steer: s.phi > 1.7 ? 1 : s.phi < 1.45 ? -1 : 0 }),
}
const out = []
for (let i = 0; i < C.flags.length - 1; i++) {
  const row = { sec: i }
  for (const k in pol) {
    const s = newState(C, i), g = C.flags[i + 1]
    let ok = false
    for (let f = 0; f < 60 * 180; f++) { step(C, s, pol[k](s, g)); if (s.flag > i) { ok = true; break } }
    row[k] = ok ? +s.t.toFixed(0) : 'x'
  }
  out.push(row)
}
console.table(out)
