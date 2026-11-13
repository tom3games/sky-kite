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
function sec(name, y0, y1, why, how, howEn) { sections.push({ name, y0, y1, why, how, howEn }) }

// ---- 0 麓の段々（練習）: 風は右へ 8m/s。凧を揚げて巻くと、右上の段へ引き上げられる ----
bands.push({ y0: -40, y1: 32, x0: -60, x1: -12, wx: 4.5, grad: 0.55 })
bands.push({ y0: -40, y1: 18, x0: -12, x1: 15, wx: 4.5, grad: 0.55 })
bands.push({ y0: -40, y1: 18, x0: 15, x1: 60, wx: 4.5, grad: 0.7 })
sec('麓の段々', 0, 14, '段が高くて歩いては上がれない。凧に引かれて飛び乗る', '押して巻く。離すと糸が出る', 'Hold to reel. Release to let out')
box(-36, 36, 0, 10, 'ground')
// 山の左右の外（|x|>40.5）は奈落。凧は吹き下ろしで落ち、体は旗へ戻る（sim.js）
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
bands.push({ y0: 18, y1: 46, x0: 15, x1: 60, wx: -2.5 })
bands.push({ y0: 18, y1: 43, x0: -4, x1: 15, wx: -2.5 })
bands.push({ y0: 18, y1: 37, x0: -12, x1: -4, wx: -2.5 })
bands.push({ y0: 32, y1: 37, x0: -60, x1: -12, wx: -2.5 })
sec('煙の柱', 13, 40, '柱の外は風が弱く、凧は体を支えられない。煙の上昇気流に凧を入れた時だけ上がれる', '煙の中で巻いて上がる。柱の上で左へ振り、次の煙へ', 'Reel inside the smoke. At the top, swing left to the next column')
zone('up', 19, 31, 12, 46, { v: 6.8, e: 2.5 })
prop('fire', 27, 13.2); prop('smoke', 27, 13.6, { h: 18 })
box(-3, 14, 28, 1.6, 'wood')
zone('up', -12, 18, 30, 42, { v: 2.8, e: 3 })   // 柱の間にも弱い上昇気流（屋根で温まった空気）
zone('up', 3, 13, 26, 44, { v: 6.8, e: 2 })
prop('fire', 9, 27); prop('smoke', 9, 27.4, { h: 18 })
box(-24, -6, 32, 1.8, 'rock')
prop('flagpole', -21, 32)
flag(-11, 32, 2)

// ---- 2 横風の竪穴: 左へ強い風。凧を真上の端に置き、巻いた時だけ真上へ上がる ----
bands.push({ y0: 37, y1: 70, x0: -60, x1: -4, wx: -11 })
bands.push({ y0: 43, y1: 70, x0: -4, x1: 15, wx: -11 })
bands.push({ y0: 46, y1: 70, x0: 15, x1: 60, wx: -11 })
sec('横風の竪穴', 35, 72, '強い横風で凧は左へ倒れる。真上の端に置いて巻くと、風を切って真上へ上がる', '凧は真上寄りに振る。巻いて上がり、右の段で休む', 'Keep the kite high. Reel up, rest on the right-hand steps')
box(-34, -24, 71.5, 40, 'rock')     // 左の壁。上面が出口
zone('add', -24, -17, 37, 66, { wx: 7, e: 2.5 })   // 左の壁で跳ね返る風（壁ぎわでは凧が押し戻される）
box(-8, 36, 72, 25.5, 'rock')       // 右の壁（竪穴の幅は 18m）
box(-11, -8, 46, 1, 'wood')
box(-11, -8, 55, 1, 'wood')
box(-11, -8, 64, 1, 'wood')
zone('up', -28, -16, 60, 82, { v: 6, e: 2.5 })   // 左の壁にぶつかった風が吹き上がる
prop('flagpole', -32.5, 71.5)
flag(-29, 71.5, 3)

// ---- 3 鐘楼と風車: 右へ風。鐘楼の針と回る風車の羽根の間に糸を通す ----
bands.push({ y0: 70, y1: 104, wx: 8 })
sec('鐘楼と風車', 71.5, 100, '糸が鐘楼や羽根に掛かると凧が落ちる。どこで揚げ、どの高さに凧を置くかで糸の通り道を選ぶ', '凧を羽根より高く。羽根が過ぎた隙に巻く', 'Keep the kite above the sails. Reel when a sail has passed')
box(8, 11.5, 81, 9, 'tower')                     // 鐘楼
snags.push({ type: 'post', x: 9.75, y: 83, r: 0.4, what: 'bell', h: 4 })   // 鐘楼の針
zone('up', -4, 5, 72, 100, { v: 5.8, e: 2 })        // 香炉の煙
prop('fire', 1, 72); prop('smoke', 1, 72.4, { h: 20 })
snags.push({ type: 'mill', x: 21, y: 84, R: 5.5, n: 3, w: 0.5, phase: 0.3 })
snags.push({ type: 'post', x: 21, y: 78, r: 0.25, what: 'mill', h: 12, pole: true })   // 風車の柱（細い。体は抜けるが糸は掛かる）
snags.push({ type: 'post', x: 15.5, y: 77, r: 0.6, what: 'tree', h: 6 })
box(25, 36, 86, 2, 'rock')
zone('up', 17, 25, 72, 96, { v: 5, e: 2 })
zone('up', 24, 32, 88, 112, { v: 6.5, e: 2 })   // 旗の棚の香炉の煙（区間4の上り口）
prop('fire', 28, 86); prop('smoke', 28, 86.4, { h: 22 })   // 右の尾根にぶつかった風が吹き上がる
zone('add', 25, 36, 86, 102, { wx: -6, e: 2 })   // 尾根の前では横風が弱まる
prop('flagpole', 34.5, 86)
flag(31, 86, 4)

// ---- 4 僧院の屋根: 左へ風。建物の風下は無風で、凧を入れると落ちる ----
bands.push({ y0: 104, y1: 134, wx: -9 })
sec('僧院の屋根', 98, 128, '建物の陰（風下）に凧が入ると風が切れて落ちる。糸を出して屋根より上の風に当て続ける', '旗と粉雪が止まった所に凧を入れない。屋根より高く', 'Keep the kite out of the still air behind roofs. Fly it higher')
// 僧院の建物は遊ぶ面の奥に建つ（体は手前を通れる。閉じ込められる所を作らない）。風下に無風の陰ができる
function house(x0, x1, base, h, shade) {
  prop('house', x0, base, { x1, h })
  zone('calm', x0 - shade, x0 + 0.5, base - 1, base + h + 1.2, { e: 1.2 })
}
box(4, 24, 110, 1.6, 'rock')
zone('up', 13, 21, 110, 128, { v: 6, e: 2 }); prop('fire', 17, 110); prop('smoke', 17, 110.4, { h: 16 })
house(-5, 2, 110, 6, 6)
box(-16, -1, 119, 1.6, 'rock')
house(-23, -16, 119, 6.5, 4)
box(-34, -20, 127, 2, 'rock')
prop('flagpole', -32.5, 127)
flag(-26, 127, 5)

// ---- 5 吊り橋の谷: 風向きが 12 秒ごとに左右で入れ替わる ----
bands.push({ y0: 132, y1: 166, wx: 11 })
sec('吊り橋の谷', 127, 165, '風は8秒ごとに左右が入れ替わる。旗が向きを変える瞬間を待ち、行きたい側の風の間に巻いて渡る', '旗が回ったら巻く。次に回る前に棚へ', 'When the flags turn, reel. Land before they turn back')
zone('flip', -40, 40, 131, 168, { period: 16, phase: 0, e: 2 })
zone('up', -36, 36, 131, 166, { v: 4.8, e: 2 })   // 谷の底から吹き上がる弱い風（入れ替わる間も凧は落ちない）
box(-12, 2, 135, 1.4, 'wood')
box(7, 21, 144, 1.6, 'rock')
box(-16, -2, 153, 1.6, 'rock')
box(-34, -22, 164, 2, 'rock')
prop('bridge', 0, 135, { x1: 10, y1: 144 })
prop('flagpole', -33, 164)
flag(-28, 164, 6)

// ---- 6 雷の峰: 右へ風。雷雲が光る前に凧を雲から出す ----
bands.push({ y0: 166, y1: 203, wx: 8 })
sec('雷の峰', 164, 194, '雷雲の中の凧に雷が落ちる。光り始めたら糸を巻いて凧を雲の下へ、過ぎたら出して強い風へ', '雲が明滅したら巻いて凧を下げる。光が去ったら離す', 'When the cloud flickers, reel the kite down. Let out after the flash')
storms.push({ x0: -16, x1: 6, y0: 180, y1: 190, period: 8, phase: 2, dur: 0.8 })
storms.push({ x0: 10, x1: 30, y0: 192, y1: 202, period: 8, phase: 6, dur: 0.8 })
box(-9, 6, 174, 1.4, 'rock')
zone('up', -8, 3, 166, 196, { v: 6.5, e: 2 }); prop('fire', -1, 174); prop('smoke', -1, 174.4, { h: 16 })
box(9, 21, 183, 1.4, 'rock')
zone('up', 10, 20, 176, 206, { v: 6.5, e: 2 }); prop('fire', 14, 183); prop('smoke', 14, 183.4, { h: 16 })
box(17, 36, 193, 2, 'rock')
prop('flagpole', 34.5, 193)
flag(30, 193, 7)

// ---- 7 張り出した頂: 左へ強い風。凧を岩の外へ高く揚げ、下から自分を引き上げる ----
bands.push({ y0: 203, y1: 224, wx: -10 })
sec('張り出した頂', 193, 222, '頂は下へ張り出していて歩いても跳んでも届かない。凧を岩の縁より高く揚げてから巻くと、縁を越えて引き上げられる', '縁より高く凧を上げてから巻く', 'Fly the kite above the rim, then reel')
box(-30, 0, 222, 14, 'rock')
zone('up', 0, 9, 200, 232, { v: 5.5, vx: 1, e: 2.5 })  // 岩にぶつかった風が壁ぞいに吹き上がる
prop('flagpole', -28, 222)
flag(-10, 222, 8)

// ---- 8 突風の階段: 風は弱い。下から吹き上げる突風（6秒ごと）の間だけ、巻くと上へ ----
bands.push({ y0: 224, y1: 252, wx: -3.5 })
sec('突風の階段', 222, 250, 'ふだんの風では体を支えられない。下から吹き上げる突風の間だけ凧が強く引く。突風が来る瞬間に巻いて、次の棚へ', '粉雪が舞い上がったら巻く', 'When the snow rises, reel in')
zone('gust', -26, -8, 220, 238, { wx: 0, wy: 13, period: 6, phase: 0, dur: 1.7, e: 2 })
box(-28, -18, 232, 1.6, 'rock')
zone('gust', -6, 14, 228, 248, { wx: 0, wy: 13, period: 6, phase: 3, dur: 1.7, e: 2 })
box(2, 13, 241, 1.6, 'rock')
zone('gust', -28, -8, 238, 256, { wx: 0, wy: 13, period: 6, phase: 1.5, dur: 1.7, e: 2 })
box(-32, -20, 250, 2, 'rock')
prop('flagpole', -31, 250)
flag(-25, 250, 9)

// ---- 9 最後の張り出し: 右へ強い風。凧を張り出しの縁より高く上げてから巻く ----
bands.push({ y0: 252, y1: 300, wx: 10 })
sec('最後の張り出し', 250, 276, '頂の祠は張り出しの上。左の壁ぞいの吹き上げに凧を入れて縁より高く揚げ、縁に糸が触れない角度で巻く', '壁ぞいで凧を高く。縁を越えたら巻く', 'Fly the kite high along the wall, then reel over the rim')
box(-12, 22, 276, 12, 'rock')
zone('up', -20, -11, 254, 286, { v: 5.5, vx: -1, e: 2.5 })
prop('shrine', 8, 276)
flag(4, 276, 10, { goal: true })

export const COURSE = { solids, zones, snags, storms, flags, props, bands, sections }
// 雷雲・糸の掛かる物の一覧は zones から分けておく（sim が速く見る）
