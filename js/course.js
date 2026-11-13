// コース（1本の縦の登り）。見た目と当たりはこの箱の一覧から作る。
// box: x0..x1 横、y1 が上面、厚み th。kind は見た目の種類（rock / wood / roof / hut ...）

const solids = [], zones = [], snags = [], storms = [], flags = [], props = [], bands = [], sections = []

function box(x0, x1, top, th = 1.4, kind = 'rock', extra = {}) {
  const b = { x0, x1, y0: top - th, y1: top, kind, ...extra }
  solids.push(b); return b
}
function flag(x, y, sec, extra = {}) { flags.push({ x, y, sec, ...extra }) }
function zone(type, x0, x1, y0, y1, extra = {}) { const z = { type, x0, x1, y0, y1, ...extra }; zones.push(z); return z }
function prop(type, x, y, extra = {}) { props.push({ type, x, y, ...extra }) }
function sec(name, y0, y1, why, how) { sections.push({ name, y0, y1, why, how }) }

// ---- 0 麓の段々（練習）: 風は右へ 8m/s。凧を揚げて巻くと、右上の段へ引き上げられる ----
bands.push({ y0: -40, y1: 24, wx: 8, grad: 0.3 })
sec('麓の段々', 0, 14, '段が高くて歩いては上がれない。凧に引かれて飛び乗る', '揚げて、巻く。たたんで歩く')
box(-36, 36, 0, 10, 'ground')
flag(-27, 0, 0)
prop('flagpole', -30, 0); prop('grass', -18, 0, { w: 14 }); prop('grass', 10, 0, { w: 16 })
box(-12, -3, 4.2, 1.6, 'rock')
box(5, 14, 8.6, 1.6, 'rock')
prop('grass', 9, 8.6, { w: 6 })
box(20, 31, 13.2, 2.2, 'rock')
prop('flagpole', 29.5, 13.2)
flag(25, 13.2, 1)

// ---- 1 上昇気流の柱: 左へ弱い風。煙の柱の中に凧を入れると真上へ。柱から柱へ乗り継ぐ ----
bands.push({ y0: 24, y1: 46, wx: -4 })
sec('煙の柱', 13, 40, '柱の間は歩ける足場がない。上昇気流に凧を入れた時だけ上がれる', '凧を煙の中へ。柱の端で次の柱へ流れる')
prop('hut', 17.5, 13.2, { w: 4, h: 3.2, chimney: true })
box(15.4, 19.6, 16.4, 3.2, 'hut')
zone('up', 14.5, 21, 16, 36, { v: 11, e: 2 })
prop('smoke', 18.5, 17.6, { h: 22 })
box(-1, 7, 26.5, 1.6, 'wood')
prop('hut', 2, 26.5, { w: 3, h: 2.6, chimney: true })
box(0.5, 3.5, 29.1, 2.6, 'hut')
zone('up', -0.5, 5.5, 29, 46, { v: 12, e: 2 })
prop('smoke', 3, 30.2, { h: 18 })
box(-22, -12, 38.5, 1.8, 'rock')
prop('flagpole', -21, 38.5)
flag(-17, 38.5, 2)

// ---- 2 横風の竪穴: 右へ強い風。凧を真上の端に置き、巻いた時だけ真上へ上がる ----
bands.push({ y0: 46, y1: 74, wx: 12 })
sec('横風の竪穴', 38, 70, '強い横風で凧は右へ倒れる。真上の端に置いて巻くと、風を切って真上へ上がる', '凧は真上。巻いて上がり、段で糸を出して溜める')
box(-34, -24, 74, 36, 'rock')     // 左の壁
box(-10, 36, 71.5, 23.5, 'rock')      // 右の壁（竪穴の幅は 14m）。上面が出口
box(-24, -18, 46.5, 1.2, 'wood')
box(-16, -10, 54.5, 1.2, 'wood')
box(-24, -19, 62, 1.2, 'wood')
prop('flagpole', 2, 71.5)
flag(-3, 71.5, 3)
zone('calm', -40, -24, 38, 80, { k: 1, e: 0.5 })

export const COURSE = { solids, zones, snags, storms, flags, props, bands, sections }
// 雷雲・糸の掛かる物の一覧は zones から分けておく（sim が速く見る）
