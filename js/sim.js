// SKY KITE の物理。DOM を触らない（node の bot でも同じ物を回す）。
// 遊ぶ面は岩山の壁に沿った2次元（x=横, y=高さ, m）。見た目の3Dも当たりも course の同じ箱から作る。
// 固定 60Hz × 4 分割。風は course のデータと時刻だけで決まる（乱数なし）。

export const DT = 1 / 60
export const SUB = 4
export const K = {
  g: 15,            // 重力（少し強めで手ざわりを締める）
  r: 0.42,          // 体の当たりの半径
  hand: 0.55,       // 糸を持つ手の高さ（体の中心から）
  walk: 2.6, mu: 2.2,
  drag: 0.07,       // 空気の抵抗（体）
  Lmin: 3, Lmax: 26, reelIn: 4.5, reelOut: 3.2, launchL: 8, startL: 18,
  win: 80 * Math.PI / 180,  // 凧が飛べる範囲（風下から左右に）
  A1: 6.0,          // この見かけの風で、真ん中の引きが体重と同じ
  Tcap: 3.4, stallA: 2.6,
  stepUp: 0.62, abyss: -24,
  vf: 0.8,          // 体の速さがどれだけ凧の見かけの風を減らすか（糸の伸びで半分）
}

const PI = Math.PI
export const angDiff = (a, b) => { let d = a - b; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v
const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t) }

// 長方形の中で 1、縁 e で 0 へなめらかに落ちる重み
export function rectW(z, x, y) {
  const e = z.e ?? 1.5
  if (x < z.x0 - e || x > z.x1 + e || y < z.y0 - e || y > z.y1 + e) return 0
  return sstep(z.x0 - e, z.x0 + e * 0.2, x) * (1 - sstep(z.x1 - e * 0.2, z.x1 + e, x)) *
         sstep(z.y0 - e, z.y0 + e * 0.2, y) * (1 - sstep(z.y1 - e * 0.2, z.y1 + e, y))
}

// 周期の合図: 0..1。period 秒ごとに phase から dur 秒だけ 1（立ち上がり rise 秒）
export function pulse(t, period, phase, dur, rise = 0.35) {
  let u = ((t - phase) % period + period) % period
  if (u > dur + rise) return 0
  if (u < rise) return sstep(0, rise, u)
  if (u > dur) return 1 - sstep(dur, dur + rise, u)
  return 1
}
// 向きが周期で入れ替わる（+1 ↔ -1）。入れ替わりは swap 秒かけてなめらか
export function flipS(t, period, phase, swap = 1.2) {
  const u = ((t - phase) % period + period) % period, h = period / 2
  if (u < h) return u < swap ? -1 + 2 * sstep(0, swap, u) : 1
  return u - h < swap ? 1 - 2 * sstep(0, swap, u - h) : -1
}

// 風。返り値は [wx, wy]
export function wind(C, x, y, t, out = [0, 0]) {
  let wx = 0, wy = 0
  // 高さの帯（帯の境は 4m でなめらかに）
  const B = C.bands
  for (let i = 0; i < B.length; i++) {
    const b = B[i]
    let w = sstep(b.y0 - 2, b.y0 + 2, y) * (1 - sstep(b.y1 - 2, b.y1 + 2, y))
    if (w > 0 && b.x0 != null) w *= sstep(b.x0 - 3, b.x0 + 3, x) * (1 - sstep(b.x1 - 3, b.x1 + 3, x))
    if (w > 0) {
      const gx = b.grad ? 1 + b.grad * clamp((y - b.y0) / (b.y1 - b.y0), 0, 1) : 1
      wx += b.wx * w * gx; wy += (b.wy || 0) * w
    }
  }
  let calm = 1, ay2 = 0   // ay2: 建物の陰でも残る弱い上昇気流（陰の後に足す）
  for (const z of C.zones) {
    const w = rectW(z, x, y); if (!w) continue
    switch (z.type) {
      case 'up': if (z.after) { ay2 += z.v * w } else { wy += z.v * w; if (z.vx) wx += z.vx * w } break
      case 'add': wx += z.wx * w; wy += (z.wy || 0) * w; break
      case 'calm': calm *= 1 - w * (z.k ?? 1); break
      case 'gust': { const p = pulse(t, z.period, z.phase, z.dur); wx += z.wx * w * p; wy += (z.wy || 0) * w * p; break }
      case 'flip': { const s = flipS(t, z.period, z.phase); wx = wx * (1 - w) + w * Math.abs(wx) * s * (z.dir || 1); break }
      default: break
    }
  }
  // 山の縁では外向きの風が回り込んで弱まる（縁から吹き飛ばされにくい）
  if (wx * x > 0) wx *= 1 - 0.85 * sstep(29, 36, Math.abs(x))
  // 岩山の外は吹き下ろし（外へ出た凧は落ちる）
  const ex = Math.abs(x) - (C.edge ?? 37)
  if (ex > -2) { const w = sstep(-2, 3, ex); wx *= 1 - w; wy = wy * (1 - w) - 11 * w }
  out[0] = wx * calm; out[1] = wy * calm + ay2
  return out
}

export function stormOn(z, t) { return pulse(t, z.period, z.phase, z.dur, 0.05) > 0.5 }

// ---- 当たり ----
function segHitsBox(ax, ay, bx, by, b, s = 0.05) {
  // 線分が箱（少し縮めた）を通るか（スラブ法）
  const x0 = b.x0 + s, x1 = b.x1 - s, y0 = b.y0 + s, y1 = b.y1 - s
  let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay
  const clip = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r } else { if (r < t0) return false; if (r < t1) t1 = r } return true }
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dy, ay - y0) && clip(dy, y1 - ay) && t0 <= t1
}
function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (Math.abs(d) < 1e-9) return false
  const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d
  const v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d
  return u >= 0 && u <= 1 && v >= 0 && v <= 1
}
function segCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy
  const t = clamp(((cx - ax) * dx + (cy - ay) * dy) / (l2 || 1), 0, 1)
  const px = ax + dx * t - cx, py = ay + dy * t - cy
  return px * px + py * py < r * r
}
// 風車の羽根（線分）を返す
export function millBlades(m, t) {
  const out = []
  for (let i = 0; i < m.n; i++) {
    const a = m.phase + m.w * t + i * 2 * PI / m.n
    out.push([m.x, m.y, m.x + Math.cos(a) * m.R, m.y + Math.sin(a) * m.R])
  }
  return out
}
// 糸が何かに掛かったか。掛かった物の種類を返す
export function lineSnag(C, ax, ay, bx, by, t) {
  for (const b of C.solids) if (segHitsBox(ax, ay, bx, by, b)) return 'rock'
  for (const s of C.snags) {
    if (s.type === 'post' && segCircle(ax, ay, bx, by, s.x, s.y, s.r)) return s.what || 'post'
    if (s.type === 'seg' && segSeg(ax, ay, bx, by, s.x0, s.y0, s.x1, s.y1)) return s.what || 'post'
    if (s.type === 'mill') for (const l of millBlades(s, t)) if (segSeg(ax, ay, bx, by, l[0], l[1], l[2], l[3])) return 'mill'
  }
  return null
}
function pointInSolid(C, x, y, pad = 0.25) {
  for (const b of C.solids) if (x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1 + pad) return true
  return false
}

// ---- 状態 ----
export function newState(C, flagIdx = 0) {
  const f = C.flags[flagIdx]
  return {
    t: 0, frame: 0, x: f.x, y: f.y + K.r + 0.01, vx: 0, vy: 0,
    ground: true, groundT: 0, kite: 'down', L: K.launchL, phi: PI / 2, aim: PI / 2, reel: 0,
    T: 0, A: 0, psi: 0, why: '', downT: 9, lift: 0,
    flag: flagIdx, best: f.y, maxY: f.y, falls: 0, resets: 0, lastDrop: 0, dropT: 0,
    stun: 0, beta: 0, bv: 0, flagT: 0, sec: C.flags[flagIdx].sec ?? 0, done: false, landV: 0,
    ev: [],  // その刻みで起きた事（音・演出用）
  }
}

export function respawn(C, s) {
  const f = C.flags[s.flag]
  Object.assign(s, { x: f.x, y: f.y + K.r + 0.01, vx: 0, vy: 0, kite: 'down', downT: 9, why: '', L: K.launchL, reel: 0, T: 0, stun: 0, beta: 0, bv: 0, maxY: f.y, aim: PI / 2 })
  s.ev.push('respawn')
}

const W = [0, 0]
// input: { steer: -1..1（+ で凧を右へ振る）, reel: 0|1（押している間は巻く。離すと糸が出る） }
// 凧はいつも揚がっている。落ちた時は、足場に立ったら 0.8 秒で揚げ直す
export function step(C, s, inp) {
  s.ev.length = 0
  if (s.kite !== 'flying' && s.ground && s.downT > 0.8 && s.stun <= 0) launch(C, s)
  if (s.stun <= 0) s.aim -= (inp.steer || 0) * 1.0 * DT
  const h = DT / SUB
  for (let i = 0; i < SUB; i++) sub(C, s, inp, h)
  s.t += DT; s.frame++
  if (s.stun > 0) s.stun -= DT
  if (s.dropT > 0) s.dropT -= DT
  if (s.flagT > 0) s.flagT -= DT
  // 旗
  if (s.ground) {
    for (let i = s.flag + 1; i < C.flags.length; i++) {
      const f = C.flags[i]
      if (Math.abs(s.x - f.x) < 4.5 && Math.abs(s.y - K.r - f.y) < 0.6) {
        s.flag = i; s.flagT = 2.5; s.sec = f.sec ?? s.sec; s.ev.push('flag')
        if (f.goal && !s.done) { s.done = true; s.ev.push('goal') }
      }
    }
  }
  if (s.y > s.best) s.best = s.y
  // 山から外れた（左右の外）: 凧は落ち、少しして旗へ
  if (Math.abs(s.x) > (C.edge ?? 37) + 3.5) { if (s.kite === 'flying') down(s, 'edge'); s.outT = (s.outT || 0) + DT } else s.outT = 0
  if (s.y < K.abyss || s.outT > 1.4) { s.resets++; s.falls++; s.outT = 0; respawn(C, s) }
  // 体の振れ（見た目。手を支点に、糸と反対へぶら下がる）
  const tgt = (s.kite === 'flying' && !s.ground) ? clamp(angDiff(s.phi, PI / 2), -1.2, 1.2) * 0.85 : 0
  s.bv += (-(s.beta - tgt) * 26 - s.bv * 4.2 - s.vx * 0.0) * DT
  s.beta += s.bv * DT
}

function launch(C, s) {
  const hx = s.x, hy = s.y + K.hand
  wind(C, hx, hy + 4, s.t, W)
  const psi = Math.atan2(W[1], W[0])
  // 真上に近い順に、糸が岩に掛からず凧が岩に入らない向きを探す（長さも短い方へ試す）
  let pick = null, L = 0
  for (const L0 of [s.downT >= 9 && s.flag === 0 ? K.startL : K.launchL, 6, 4]) {
  L = L0
  for (let i = 0; i < 13 && pick == null; i++) {
    const off = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.17
    let a = PI / 2 + off
    const d = angDiff(a, psi); if (Math.abs(d) > K.win * 0.85) continue
    if (Math.sin(a) < 0.3) continue
    const kx = hx + Math.cos(a) * L, ky = hy + Math.sin(a) * L
    if (pointInSolid(C, kx, ky, 0.4) || lineSnag(C, hx, hy, kx, ky, s.t)) continue
    pick = a
  }
  if (pick != null) break
  }
  if (pick == null) { s.downT = 0.3; s.why = 'nowind'; return }
  s.kite = 'flying'; s.L = L; s.phi = pick; s.aim = pick; s.why = ''
  s.ev.push('launch')
}

function down(s, why) {
  if (s.kite !== 'flying') return
  s.kite = 'down'; s.why = why; s.downT = 0; s.T = 0; s.ev.push('down:' + why)
}

function sub(C, s, inp, h) {
  const g = K.g
  let ax = 0, ay = -g
  const hx = s.x, hy = s.y + K.hand
  s.reel = 0; s.T = 0
  if (s.kite === 'flying') {
    const ux = Math.cos(s.phi), uy = Math.sin(s.phi)
    let r = 0
    if (s.stun <= 0) {
      if (inp.reel > 0) { if (s.L > K.Lmin) { r = K.reelIn; s.L = Math.max(K.Lmin, s.L - r * h) } }
      // 離すと糸が出る。ただし足場で何も押していない時は出さない（休める）
      // 離すと糸が出る（足場で止まっている時は 12m まで）
      else if (s.L < (s.ground && Math.abs(inp.steer || 0) < 0.3 ? Math.max(12, Math.min(s.L, K.Lmax)) : K.Lmax)) { r = -K.reelOut; s.L = Math.min(K.Lmax, s.L + K.reelOut * h) }
    }
    s.reel = r
    const kx = hx + ux * s.L, ky = hy + uy * s.L
    wind(C, kx, ky, s.t, W)
    const rr = r > 0 ? r : 0 // 出す時は凧はその場で糸を伸ばすだけ
    const Ax = W[0] - s.vx * K.vf + rr * ux, Ay = W[1] - s.vy * K.vf + rr * uy
    const A = Math.hypot(Ax, Ay), psi = Math.atan2(Ay, Ax)
    s.A = A; s.psi = psi
    let T = 0
    if (A < K.stallA) {
      // 風が切れた: 凧は真下へ落ちていく
      const d = angDiff(-PI / 2, s.phi)
      s.phi += clamp(d, -1.5 * h, 1.5 * h)
      T = 0.04
    } else {
      const om = Math.min(3.4, 0.32 * A)
      // 振った向き（aim）は風の窓の中に収める（窓の外へ回し続けても戻りが遅れない）
      let d = clamp(angDiff(s.aim, psi), -K.win, K.win)
      // 角度は [-90°, 270°) で表し、地面より下（-6° 未満・186° 超）へは振らない
      let a = psi + d
      a = ((a + PI / 2) % (2 * PI) + 2 * PI) % (2 * PI) - PI / 2
      s.aim = clamp(a, -0.1, PI + 0.1)
      d = clamp(angDiff(s.aim, psi), -K.win, K.win)
      const want = psi + d
      const cur = angDiff(s.phi, psi)
      const rate = Math.abs(cur) > K.win ? Math.max(om, 2.4) : om
      s.phi += clamp(angDiff(want, s.phi), -rate * h, rate * h)
      const dd = Math.abs(angDiff(s.phi, psi))
      // 風下の真ん中で一番強く、端（真上など）でも 4 分の 1 は残る
      const c = 0.25 + 0.75 * Math.max(0, Math.cos(Math.min(dd, PI / 2)))
      const lenF = 0.8 + 0.5 * (s.L - K.Lmin) / (K.Lmax - K.Lmin) // 糸を出すほど強く引く
      // 体が凧の方へ速く動くと糸がゆるむ（引っぱられて飛ぶ勢いが止まらなくなるのを防ぐ）
      const toward = s.vx * ux + s.vy * uy - Math.max(0, r)
      const slack = clamp(1 - (toward - 2) / 6, 0.15, 1)
      T = Math.min(K.Tcap, (A / K.A1) ** 2 * c * lenF * slack)
    }
    s.T = T; s.lift = T * Math.sin(s.phi)
    // 足場で何も押していない時は踏んばる（横に引かれる力を4割に。上へ引かれる力はそのまま）
    const brace = s.ground && Math.abs(inp.steer || 0) < 0.3 ? 0.25 : 1
    ax += g * T * Math.cos(s.phi) * brace; ay += g * T * Math.sin(s.phi)
    // 凧が落ちきった・岩に入った・糸が掛かった・雷
    const nkx = hx + Math.cos(s.phi) * s.L, nky = hy + Math.sin(s.phi) * s.L
    if (s.phi < -0.28 && s.phi > -PI + 0.28) down(s, A < K.stallA ? 'stall' : 'low')
    else if (pointInSolid(C, nkx, nky)) {
      // 凧が岩に当たったら、糸を岩の手前まで縮めて止まる（落ちはしない。糸が岩に掛かった時だけ落ちる）
      let lo = 1, hi = s.L
      for (let it = 0; it < 8; it++) { const m = (lo + hi) / 2; if (pointInSolid(C, hx + Math.cos(s.phi) * m, hy + Math.sin(s.phi) * m)) hi = m; else lo = m }
      if (lo < 2) down(s, 'rock'); else { s.L = lo; s.ev.push('bump') }
    }
    else { const sn = lineSnag(C, hx, hy, nkx, nky, s.t); if (sn) down(s, sn) }
    if (s.kite === 'flying') for (const z of C.storms) if (stormOn(z, s.t) && nkx > z.x0 && nkx < z.x1 && nky > z.y0 && nky < z.y1) { down(s, 'thunder'); s.stun = 0.9; break }
  } else if (s.kite === 'down') { s.downT += h }

  // 地面と歩き
  const st = inp.steer || 0
  const walkIn = s.stun > 0 ? 0 : (Math.abs(st) > 0.3 ? Math.sign(st) : 0)
  if (s.ground && ay <= 0) {
    const N = -ay
    const vt = walkIn * K.walk
    const need = (vt - s.vx) / h - ax
    const lim = K.mu * Math.max(N, walkIn ? 0 : 0.3 * g)
    ax += clamp(need, -lim, lim)
  } else if (!s.ground) {
    const v = Math.hypot(s.vx, s.vy)
    ax -= K.drag * v * s.vx; ay -= K.drag * v * s.vy
    ax += walkIn * 1.2 // 空中で少しだけ体をひねれる
  }
  s.vx += ax * h; s.vy += ay * h
  s.x += s.vx * h; s.y += s.vy * h
  collide(C, s, walkIn)
}

function collide(C, s, walkIn) {
  const r = K.r
  const wasGround = s.ground
  s.ground = false
  for (let it = 0; it < 3; it++) {
    for (const b of C.solids) {
      const cx = clamp(s.x, b.x0, b.x1), cy = clamp(s.y, b.y0, b.y1)
      let dx = s.x - cx, dy = s.y - cy
      const d2 = dx * dx + dy * dy
      if (d2 >= r * r) continue
      let d = Math.sqrt(d2), nx, ny
      if (d < 1e-6) { // 中に入った: 一番近い面へ
        const L = s.x - b.x0, R = b.x1 - s.x, D = s.y - b.y0, U = b.y1 - s.y
        const m = Math.min(L, R, D, U)
        if (m === U) { nx = 0; ny = 1; d = -U } else if (m === D) { nx = 0; ny = -1; d = -D } else if (m === L) { nx = -1; ny = 0; d = -L } else { nx = 1; ny = 0; d = -R }
      } else { nx = dx / d; ny = dy / d }
      // 段差を上がる（歩いていて、横からぶつかった低い段）
      if (wasGround && Math.abs(nx) > 0.7 && b.y1 - (s.y - r) < K.stepUp && b.y1 - (s.y - r) > 0 && walkIn * nx < 0) {
        s.y = b.y1 + r + 0.005; s.vy = Math.max(s.vy, 0); s.ground = true; continue
      }
      const pen = r - d
      s.x += nx * pen; s.y += ny * pen
      const vn = s.vx * nx + s.vy * ny
      if (vn < 0) {
        if (ny > 0.6) { s.landV = -vn }
        s.vx -= vn * nx; s.vy -= vn * ny
      }
      if (ny > 0.6) s.ground = true
    }
  }
  if (s.ground && !wasGround) {
    const drop = s.maxY - s.y
    if (s.landV > 19) { s.stun = 0.7; s.ev.push('thud') } else if (s.landV > 6) s.ev.push('land')
    if (drop > 5) { s.lastDrop = drop; s.dropT = 2.4; s.falls++; s.ev.push('drop') }
    s.maxY = s.y
  }
  if (s.ground) s.groundT += DT / SUB; else { s.groundT = 0; if (s.y > s.maxY) s.maxY = s.y }
  if (s.ground && s.y > s.maxY) s.maxY = s.y
}

export function kitePos(s) {
  return [s.x + Math.cos(s.phi) * s.L, s.y + K.hand + Math.sin(s.phi) * s.L]
}
