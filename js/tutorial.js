// 最初の旗のチュートリアル。1つずつ実際にやらせる。
// follow は「説明どおりに押すだけの人」の入力（検査の bot がそのまま使う）
export const STEPS = [
  { id: 'back', ja: '左の煙の所へ歩いて戻る', en: 'Walk back left to the smoke', key: 'left',
    follow: () => ({ reel: 0, steer: -1 }),
    done: (s) => s.x < -24 },
  { id: 'reel', ja: '押し続けて、糸を巻く', en: 'Hold to reel in', key: 'reel',
    follow: () => ({ reel: 1, steer: 0 }),
    done: (s, c) => !s.ground && s.y - c.y0 > 1.2 },
  { id: 'up', ja: '浮いた。そのまま巻くと上がる', en: 'You are flying. Keep reeling', key: 'reel',
    follow: () => ({ reel: 1, steer: 0 }),
    done: (s, c) => s.y - c.y0 > 6 || s.L <= 3.2 },
  { id: 'out', ja: '離すと糸が出て、凧が高く上がる', en: 'Release: the line goes out, the kite climbs', key: 'none',
    follow: () => ({ reel: 0, steer: 0 }),
    done: (s, c) => c.relT > 1.6 && s.L > 11 },
  { id: 'reel2', ja: 'もう一度巻いて、もっと上へ', en: 'Reel again to climb higher', key: 'reel',
    follow: () => ({ reel: 1, steer: 0 }),
    done: (s, c) => c.stepT > 1.2 && (s.y - c.y0 > 10 || s.L <= 3.2) },
  { id: 'right', ja: '凧を右へ振って、右の岩棚へ降りる', en: 'Swing the kite right and land on the ledge', key: 'right',
    follow: (s) => ({ reel: 0, steer: s.phi > 0.9 ? 1 : 0 }),
    done: (s) => s.ground && s.y > 6 },
  { id: 'right2', ja: '煙は上昇気流。煙の上で巻いて、右の棚へ', en: 'Smoke means rising air. Reel above it, then drift to the right ledge', key: 'left',
    follow: (s) => ({ reel: s.x < -5 && s.ground ? 0 : (s.y < 12 ? 1 : 0), steer: s.ground && s.x < -4 ? 1 : (s.y < 12 ? (s.phi < 1.45 ? -1 : (s.phi > 1.7 ? 1 : 0)) : (s.phi > 1.0 ? 1 : 0)) }),
    done: (s) => s.ground && s.y > 9 },
  { id: 'wind', ja: '旗と粉雪が風の向き。凧は風下へ流れる', en: 'Flags and snow show the wind. The kite drifts downwind', key: 'none', dur: 4.5,
    follow: () => ({ reel: 0, steer: 0 }), done: (s, c) => c.stepT > 4.5 },
]

export function makeTutorial(s) {
  const c = { i: 1, y0: s.y, relT: 0, stepT: 0, on: true, startT: s.t, liftT: null }
  return {
    c,
    get step() { return c.on ? STEPS[c.i] : null },
    update(s, inp, dt) {
      if (!c.on) return
      c.stepT += dt
      c.relT = inp.reel ? 0 : c.relT + dt
      if (c.liftT == null && !s.ground && s.y - c.y0 > 1.2) c.liftT = s.t - c.startT
      const st = STEPS[c.i]
      if (st.done(s, c)) { c.i++; c.stepT = 0; c.relT = 0; if (c.i >= STEPS.length) c.on = false }
      // 段の上で止まってしまったら「右へ」へ進める（途中で落ちて下へ戻った時はやり直し）
      if (c.on && c.i >= 2 && c.i < 6 && s.ground && s.y > 6 && s.y < 9) { c.i = 6; c.stepT = 0 }
      if (c.on && c.i >= 3 && c.i < 7 && s.ground && s.y - c.y0 < 0.5 && c.stepT > 1) { c.i = s.x > -22 ? 0 : 1; c.stepT = 0 }
    },
  }
}
