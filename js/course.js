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
bands.push({ y0: -40, y1: 32, x0: -60, x1: 15, wx: 4.5, grad: 0.55 })
bands.push({ y0: -40, y1: 24, x0: 15, x1: 60, wx: 4.5, grad: 0.7 })
sec('麓の段々', 0, 14, '段が高くて歩いては上がれない。凧に引かれて飛び乗る', '揚げて、巻く。たたんで歩く')
box(-36, 36, 0, 10, 'ground')
// 両側の岩の尾根（遊ぶ面は岩山の大きな溝。外へは出られない）
box(-46, -36, 236, 246, 'ridge')
box(36, 46, 236, 246, 'ridge')
flag(-27, 0, 0)
// 出発点は香炉の強い上昇気流の上（誰でも、巻くだけで浮く）
zone('up', -34, -20, -2, 30, { v: 3.6, e: 3 })
prop('smoke', -27.5, 0.4, { h: 16, big: true })
prop('flagpole', -30, 0); prop('grass', -18, 0, { w: 14 }); prop('grass', 10, 0, { w: 16 })
box(-17, -1, 6.5, 1.8, 'rock')
zone('up', -9, 3, 6, 26, { v: 6.2, e: 2.5 })
prop('fire', -3, 6.5); prop('smoke', -3, 6.9, { h: 12 })
box(5, 14, 10, 1.6, 'rock')
prop('grass', 9, 10, { w: 6 })
box(20, 31, 13.2, 2.2, 'rock')
prop('flagpole', 29.5, 13.2)
flag(25, 13.2, 1)

// ---- 1 上昇気流の柱: 風は弱く左へ。焚き火の煙の柱の中だけ、巻くと上がる。柱から柱へ乗り継ぐ ----
bands.push({ y0: 24, y1: 46, x0: 15, x1: 60, wx: -2.5 })
bands.push({ y0: 32, y1: 43, x0: -4, x1: 15, wx: -2.5 })
bands.push({ y0: 32, y1: 37, x0: -60, x1: -4, wx: -2.5 })
sec('煙の柱', 13, 40, '柱の外は風が弱く、凧は体を支えられない。煙の上昇気流に凧を入れた時だけ上がれる', '煙の中で巻いて上がる。柱の上で左へ振り、次の煙へ')
zone('up', 19, 31, 12, 46, { v: 6.8, e: 2.5 })
prop('fire', 27, 13.2); prop('smoke', 27, 13.6, { h: 18 })
box(4, 14, 27, 1.6, 'wood')
zone('up', 3, 13, 26, 44, { v: 6.8, e: 2 })
prop('fire', 9, 27); prop('smoke', 9, 27.4, { h: 18 })
box(-22, -12, 35, 1.8, 'rock')
prop('flagpole', -21, 35)
flag(-17, 35, 2, { goal: true })  // 試作 v2 はここまで

// ---- 2 横風の竪穴: 左へ強い風。凧を真上の端に置き、巻いた時だけ真上へ上がる ----
bands.push({ y0: 37, y1: 74, x0: -60, x1: -4, wx: -11 })
bands.push({ y0: 43, y1: 74, x0: -4, x1: 15, wx: -11 })
bands.push({ y0: 46, y1: 74, x0: 15, x1: 60, wx: -11 })
sec('横風の竪穴', 35, 72, '強い横風で凧は左へ倒れる。真上の端に置いて巻くと、風を切って真上へ上がる', '凧は真上寄りに。巻いて上がり、段で糸を出して溜める')
box(-34, -24, 71.5, 37.5, 'rock')   // 左の壁。上面が出口
box(-6, 36, 74, 27.5, 'rock')       // 右の壁（竪穴の幅は 18m）
box(-12, -6, 50, 1.2, 'wood')
box(-24, -18, 57.5, 1.2, 'wood')
box(-12, -6, 65, 1.2, 'wood')
prop('flagpole', -32.5, 71.5)
flag(-29, 71.5, 3)

// ---- 3 鐘楼と風車: 右へ風。鐘楼の針と回る風車の羽根の間に糸を通す ----
bands.push({ y0: 75, y1: 104, wx: 8 })
sec('鐘楼と風車', 71.5, 100, '糸が鐘楼や羽根に掛かると凧が落ちる。どこで揚げ、どの高さに凧を置くかで糸の通り道を選ぶ', '鐘楼の先で揚げる。羽根が通り過ぎた隙に巻く')
box(4, 7.5, 86.5, 12.5, 'tower')
snags.push({ type: 'post', x: 5.75, y: 89, r: 0.45, what: 'bell', h: 5 })
snags.push({ type: 'mill', x: 21, y: 86.5, R: 5.5, n: 3, w: 0.5, phase: 0.3 })
box(19.5, 22.5, 86.5, 12.5, 'tower')
snags.push({ type: 'post', x: -3, y: 77.5, r: 0.7, what: 'tree', h: 6 })
box(25, 36, 98, 2, 'rock')
prop('flagpole', 34.5, 98)
flag(30, 98, 4)

// ---- 4 僧院の屋根: 左へ風。建物の風下は無風で、凧を入れると落ちる ----
bands.push({ y0: 104, y1: 134, wx: -9 })
sec('僧院の屋根', 98, 128, '建物の陰（風下）に凧が入ると風が切れて落ちる。糸を出して屋根より上の風に当て続ける', '旗と粉雪が止まっている所を避ける。糸を長く')
function house(x0, x1, base, h, shade) {
  const b = box(x0, x1, base + h, h, 'house')
  zone('calm', x0 - shade, x0 + 0.5, base - 1, base + h + 1.2, { e: 1.2 })
  return b
}
box(6, 22, 108, 1.6, 'rock')
house(11, 19, 108, 6, 9)
box(-16, -1, 117, 1.6, 'rock')
house(-12, -4, 117, 6.5, 10)
box(-34, -20, 127, 2, 'rock')
prop('flagpole', -32.5, 127)
flag(-26, 127, 5)

// ---- 5 吊り橋の谷: 風向きが 12 秒ごとに左右で入れ替わる ----
bands.push({ y0: 134, y1: 166, wx: 9 })
sec('吊り橋の谷', 127, 165, '風が入れ替わる前に揚げると反対へ引かれる。旗が向きを変える瞬間を待って、行きたい側の風で揚げる', '旗が回ったら揚げる。次に回る前に降りる')
zone('flip', -40, 40, 131, 168, { period: 12, phase: 0, e: 2 })
box(2, 12, 137, 1.4, 'wood')
box(-22, -12, 146, 1.6, 'rock')
box(10, 22, 155, 1.6, 'rock')
box(-34, -22, 164, 2, 'rock')
prop('bridge', -12, 146, { x1: 2, y1: 137 })
prop('flagpole', -33, 164)
flag(-28, 164, 6)

// ---- 6 雷の峰: 右へ風。雷雲が光る前に凧を雲から出す ----
bands.push({ y0: 166, y1: 196, wx: 8 })
sec('雷の峰', 164, 194, '雷雲の中の凧に雷が落ちる。光り始めたら糸を巻いて凧を雲の下へ、過ぎたら出して強い風へ', '雲が明滅したら巻く。光が去ったら出す')
storms.push({ x0: -16, x1: 6, y0: 178, y1: 190, period: 6, phase: 2, dur: 0.8 })
storms.push({ x0: 10, x1: 30, y0: 190, y1: 202, period: 6, phase: 5, dur: 0.8 })
box(-6, 4, 174, 1.4, 'rock')
box(10, 18, 183, 1.4, 'rock')
box(24, 36, 193, 2, 'rock')
prop('flagpole', 34.5, 193)
flag(30, 193, 7)

// ---- 7 張り出した頂: 左へ強い風。凧を岩の外へ高く揚げ、下から自分を引き上げる ----
bands.push({ y0: 196, y1: 260, wx: -10 })
sec('張り出した頂', 193, 222, '頂は下へ張り出していて歩いても跳んでも届かない。凧を岩の縁より高く揚げてから巻くと、縁を越えて引き上げられる', '縁より高く出す。糸が岩に触れない角度で巻く')
box(-30, 0, 222, 14, 'rock')
zone('up', 0, 9, 200, 232, { v: 9, vx: 2, e: 2.5 })  // 岩にぶつかった風が壁ぞいに吹き上がる
prop('shrine', -16, 222)
flag(-10, 222, 8, { goal: true })

export const COURSE = { solids, zones, snags, storms, flags, props, bands, sections }
// 雷雲・糸の掛かる物の一覧は zones から分けておく（sim が速く見る）
