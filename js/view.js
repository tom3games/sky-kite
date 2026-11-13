// 見た目（灰色の箱の試作）。当たりと同じ course の箱から形を作る。
import * as THREE from 'three'
import { wind, millBlades, stormOn, K, kitePos } from './sim.js'

export function makeView(C, el) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(2, devicePixelRatio))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  el.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x9fb3c4)
  scene.fog = new THREE.Fog(0x9fb3c4, 40, 160)
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 500)
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x5a5650, 1.3))
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2)
  sun.position.set(20, 40, 30); sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 })
  scene.add(sun, sun.target)

  const DEPTH = { ground: 7, rock: 5, wood: 3.2, hut: 3 }
  const mats = {
    ground: new THREE.MeshStandardMaterial({ color: 0x8a8a84, roughness: 0.95 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xa08a6a, roughness: 0.8 }),
    hut: new THREE.MeshStandardMaterial({ color: 0xb0a898, roughness: 0.85 }),
  }
  const top = C.solids.reduce((m, b) => Math.max(m, b.y1), 0)
  // 奥の岩壁
  const wall = new THREE.Mesh(new THREE.BoxGeometry(80, top + 60, 4), new THREE.MeshStandardMaterial({ color: 0x77756f, roughness: 1 }))
  wall.position.set(0, (top + 60) / 2 - 30, -5.5); wall.receiveShadow = true; scene.add(wall)
  for (const b of C.solids) {
    const d = DEPTH[b.kind] ?? 4
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, b.y1 - b.y0, d), mats[b.kind] ?? mats.rock)
    m.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, -3.5 + d / 2)
    m.castShadow = m.receiveShadow = true
    scene.add(m)
  }
  // 雲の海（奈落）
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: 0xdfe6ec, fog: true }))
  sea.rotation.x = -Math.PI / 2; sea.position.y = -12; scene.add(sea)

  // 旗（セーブ）
  const flagMeshes = []
  for (const f of C.flags) {
    const g = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2), new THREE.MeshStandardMaterial({ color: 0x4a3c2c }))
    pole.position.y = 1.6; g.add(pole)
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9, 6, 1), new THREE.MeshStandardMaterial({ color: 0xc9b46a, side: THREE.DoubleSide, roughness: 1 }))
    cloth.position.set(0.7, 2.7, 0); g.add(cloth)
    g.position.set(f.x, f.y, 0.8); scene.add(g)
    flagMeshes.push({ g, cloth, f, base: cloth.geometry.attributes.position.array.slice() })
  }
  // 吹き流し（風の向きを見せる旗。props の flagpole）
  const socks = []
  for (const p of C.props.filter(p => p.type === 'flagpole')) {
    const g = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2), new THREE.MeshStandardMaterial({ color: 0x3a3631 }))
    pole.position.y = 2.1; g.add(pole)
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5, 8, 1), new THREE.MeshStandardMaterial({ color: 0xb04a3a, side: THREE.DoubleSide }))
    cloth.geometry.translate(1, 0, 0)
    const hold = new THREE.Group(); hold.position.y = 3.9; hold.add(cloth); g.add(hold)
    g.position.set(p.x, p.y, -1.5); scene.add(g)
    socks.push({ hold, cloth, x: p.x, y: p.y + 3.9, base: cloth.geometry.attributes.position.array.slice() })
  }
  // 煙の柱（上昇気流）: 粒
  const smokes = C.props.filter(p => p.type === 'smoke').map(p => {
    const n = 70, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xeeeeee, size: 1.6, transparent: true, opacity: 0.35, depthWrite: false }))
    scene.add(pts)
    const seeds = Array.from({ length: n }, (_, i) => ({ a: i / n, o: ((i * 7919) % 100) / 100 - 0.5 }))
    return { p, pts, pos, seeds }
  })

  // 風の筋（画面の周りに流す粒）
  const NS = 420
  const sgeo = new THREE.BufferGeometry(), spos = new Float32Array(NS * 6)
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3))
  const streaks = new THREE.LineSegments(sgeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }))
  streaks.frustumCulled = false
  scene.add(streaks)
  const sp = Array.from({ length: NS }, (_, i) => ({ x: 0, y: 0, z: 0, life: -1, seed: i }))
  let rnd = 12345
  const rand = () => (rnd = (rnd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff

  // 雷雲・風車
  const stormMeshes = C.storms.map(z => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(z.x1 - z.x0, z.y1 - z.y0, 6), new THREE.MeshBasicMaterial({ color: 0x40444c, transparent: true, opacity: 0.45, depthWrite: false }))
    m.position.set((z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2, 0); scene.add(m); return { z, m }
  })
  const mills = C.snags.filter(s => s.type === 'mill').map(s => {
    const g = new THREE.Group(); g.position.set(s.x, s.y, 0.3)
    for (let i = 0; i < s.n; i++) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(s.R, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x6b5a44 }))
      bl.geometry.translate(s.R / 2, 0, 0); bl.rotation.z = i * 2 * Math.PI / s.n; bl.castShadow = true; g.add(bl)
    }
    scene.add(g); return { s, g }
  })
  for (const s of C.snags.filter(s => s.type === 'post')) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, 3, 10), mats.wood)
    m.rotation.x = Math.PI / 2; m.position.set(s.x, s.y, -1); scene.add(m)
  }

  // 人
  const body = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color: 0x3d4f66, roughness: 0.8 })
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 10), skin)
  torso.position.y = -0.55; torso.castShadow = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd8b48c }))
  head.position.y = -0.02
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 4, 8), skin)
  legs.position.y = -1.2; legs.castShadow = true
  const arms = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), skin)
  arms.position.y = 0.05
  body.add(torso, head, legs, arms)
  scene.add(body)
  // 凧
  const kite = new THREE.Group()
  const kshape = new THREE.Shape(); kshape.moveTo(0, 1.6); kshape.lineTo(1.25, 0.1); kshape.lineTo(0, -1.9); kshape.lineTo(-1.25, 0.1); kshape.closePath()
  const kmesh = new THREE.Mesh(new THREE.ShapeGeometry(kshape), new THREE.MeshStandardMaterial({ color: 0xd9502f, side: THREE.DoubleSide, roughness: 0.7 }))
  kmesh.castShadow = true; kite.add(kmesh)
  const tailGeo = new THREE.BufferGeometry(); const tailPos = new Float32Array(10 * 3)
  tailGeo.setAttribute('position', new THREE.BufferAttribute(tailPos, 3))
  const tail = new THREE.Line(tailGeo, new THREE.LineBasicMaterial({ color: 0xf2e0b0 }))
  tail.frustumCulled = false
  scene.add(kite, tail)
  const folded = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 0.12), kmesh.material)
  scene.add(folded)
  // 糸（たるみつき）
  const NL = 24, lgeo = new THREE.BufferGeometry(), lpos = new Float32Array(NL * 3)
  lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3))
  const line = new THREE.Line(lgeo, new THREE.LineBasicMaterial({ color: 0xf6f2e6 }))
  line.frustumCulled = false; scene.add(line)

  let camX = 0, camY = 0, aspect = 1, W0 = 1, H0 = 1
  function resize() {
    W0 = el.clientWidth; H0 = el.clientHeight
    renderer.setSize(W0, H0, false); aspect = W0 / H0
    cam.aspect = aspect; cam.updateProjectionMatrix()
  }
  addEventListener('resize', resize); resize()

  const tmpW = [0, 0]
  let kfx = 0, kfy = 0, kfInit = false
  function render(s, dt, alpha = 1) {
    const t = s.t
    // カメラ: 体と凧の間を見る。縦画面は引く
    const [kx, ky] = kitePos(s)
    const flying = s.kite === 'flying'
    const fx = flying ? s.x * 0.65 + kx * 0.35 : s.x, fy = flying ? s.y * 0.6 + ky * 0.4 + 1 : s.y + 2.5
    const k = 1 - Math.exp(-dt * 3)
    camX += (fx - camX) * k; camY += (fy - camY) * k
    if (!render.init) { camX = fx; camY = fy; render.init = true }
    const dist = aspect < 1 ? 30 + 6 * (1 - aspect) : 24
    const up = aspect < 1 ? 4 : 1.5
    cam.position.set(camX - 2.5, camY + up - 0.3, dist)
    cam.lookAt(camX, camY + up, 0)
    sun.position.set(camX + 18, camY + 30, 30); sun.target.position.set(camX, camY, 0)

    // 人
    body.position.set(s.x, s.y + K.hand * 0.6, 0)
    body.rotation.z = s.ground ? 0 : s.beta
    arms.rotation.z = flying ? s.phi - Math.PI / 2 : 0
    arms.position.set(flying ? Math.cos(s.phi) * 0.25 : 0, flying ? 0.1 : -0.5, 0)
    legs.rotation.z = s.ground && Math.abs(s.vx) > 0.3 ? Math.sin(t * 12) * 0.3 : 0
    // 凧
    kite.visible = flying || s.kite === 'down'
    folded.visible = s.kite === 'folded'
    folded.position.set(s.x - 0.25, s.y + 0.1, -0.3); folded.rotation.z = 0.2
    let kx2 = kx, ky2 = ky
    if (s.kite === 'down') { // 落ちた凧は体の近くへ
      kx2 = s.x + 1.2; ky2 = s.y - 0.2
    }
    if (!kfInit) { kfx = kx2; kfy = ky2; kfInit = true }
    const kk = 1 - Math.exp(-dt * 14)
    kfx += (kx2 - kfx) * kk; kfy += (ky2 - kfy) * kk
    kite.position.set(kfx, kfy, 0.3)
    kite.rotation.z = flying ? s.phi - Math.PI / 2 + Math.sin(t * 7) * 0.05 * Math.min(1, s.A / 8) : 1.4
    kite.rotation.y = 0.35
    // 尾
    wind(C, kfx, kfy, t, tmpW)
    const wl = Math.hypot(tmpW[0], tmpW[1]) || 1
    for (let i = 0; i < 10; i++) {
      const a = i * 0.35
      tailPos[i * 3] = kfx - Math.sin(kite.rotation.z) * 1.9 + (tmpW[0] / wl) * a + Math.sin(t * 9 + i) * 0.08 * i
      tailPos[i * 3 + 1] = kfy - Math.cos(kite.rotation.z) * 1.9 + (tmpW[1] / wl) * a - (wl < 3 ? a : 0)
      tailPos[i * 3 + 2] = 0.3
    }
    tailGeo.attributes.position.needsUpdate = true
    // 糸
    line.visible = flying || s.kite === 'down'
    const hx = s.x + (flying ? Math.cos(s.phi) * 0.45 : 0), hy = s.y + K.hand + 0.2
    const sag = flying ? Math.max(0, 1.2 - s.T) * s.L * 0.06 : 0.6
    for (let i = 0; i < NL; i++) {
      const u = i / (NL - 1)
      lpos[i * 3] = hx + (kfx - hx) * u
      lpos[i * 3 + 1] = hy + (kfy - hy) * u - sag * 4 * u * (1 - u)
      lpos[i * 3 + 2] = 0.3 * u
    }
    lgeo.attributes.position.needsUpdate = true

    // 旗
    for (const fm of flagMeshes) {
      const on = C.flags.indexOf(fm.f) <= s.flag
      fm.cloth.material.color.setHex(on ? 0xe2c45a : 0x8f8a7a)
      wave(fm.cloth, fm.base, fm.f.x, fm.f.y + 2.7, t)
    }
    for (const so of socks) {
      wind(C, so.x, so.y, t, tmpW)
      const sp = Math.hypot(tmpW[0], tmpW[1])
      const target = sp < 0.8 ? -Math.PI / 2 + 0.15 : Math.atan2(tmpW[1], tmpW[0])
      const droop = Math.min(1, sp / 7)
      const ang = target * droop + (-Math.PI / 2) * (1 - droop)
      so.hold.rotation.z += (ang - so.hold.rotation.z) * (1 - Math.exp(-dt * 4))
      const a = so.cloth.geometry.attributes.position.array
      for (let i = 0; i < a.length; i += 3) { const u = so.base[i] / 2; a[i + 1] = so.base[i + 1] + Math.sin(t * (6 + sp) - u * 6) * 0.12 * u * droop; a[i + 2] = Math.sin(t * 7 - u * 5) * 0.1 * u }
      so.cloth.geometry.attributes.position.needsUpdate = true
    }
    // 煙
    for (const sm of smokes) {
      const { p, pos, seeds } = sm
      for (let i = 0; i < seeds.length; i++) {
        const sd = seeds[i]; const a = (sd.a + t * 0.12) % 1
        let y = p.y + a * p.h, x = p.x + sd.o * (0.6 + a * 2.2)
        wind(C, x, y, t, tmpW)
        x += tmpW[0] * a * 0.5
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = -1 + sd.o
      }
      sm.pts.geometry.attributes.position.needsUpdate = true
    }
    // 風の筋
    const vw = 30 * (aspect < 1 ? 1.2 : aspect), vh = 30
    for (let i = 0; i < NS; i++) {
      const q = sp[i]
      if (q.life <= 0 || Math.abs(q.x - camX) > vw || Math.abs(q.y - camY) > vh) {
        q.x = camX + (rand() * 2 - 1) * vw; q.y = camY + (rand() * 2 - 1) * vh; q.z = -2 + rand() * 4; q.life = 0.8 + rand() * 1.6; q.max = q.life
      }
      wind(C, q.x, q.y, t, tmpW)
      q.x += tmpW[0] * dt; q.y += tmpW[1] * dt; q.life -= dt
      const len = 0.06, f = Math.min(1, q.life / q.max * 3, (q.max - q.life) * 3)
      const spd = Math.hypot(tmpW[0], tmpW[1])
      spos[i * 6] = q.x; spos[i * 6 + 1] = q.y; spos[i * 6 + 2] = q.z
      spos[i * 6 + 3] = q.x - tmpW[0] * len * f * (spd > 1.5 ? 1 : 0); spos[i * 6 + 4] = q.y - tmpW[1] * len * f * (spd > 1.5 ? 1 : 0); spos[i * 6 + 5] = q.z
    }
    sgeo.attributes.position.needsUpdate = true
    for (const st of stormMeshes) st.m.material.color.setHex(stormOn(st.z, t) ? 0xf4f0ff : (pulseWarn(st.z, t) ? 0x6a6f7c : 0x40444c))
    for (const m of mills) { m.g.rotation.z = m.s.phase + m.s.w * t }

    renderer.render(scene, cam)
  }
  function pulseWarn(z, t) { const u = ((t - z.phase) % z.period + z.period) % z.period; return u > z.period - 1.5 && Math.floor(t * 8) % 2 === 0 }
  function wave(mesh, base, x, y, t) {
    wind(C, x, y, t, tmpW)
    const sp = Math.hypot(tmpW[0], tmpW[1]), dir = Math.sign(tmpW[0]) || 1
    const a = mesh.geometry.attributes.position.array
    for (let i = 0; i < a.length; i += 3) { const u = (base[i] + 0.7) / 1.4; a[i] = (base[i] + 0.7) * dir - 0.7; a[i + 1] = base[i + 1] + Math.sin(t * 8 - u * 6) * 0.1 * u * Math.min(1, sp / 6) - (sp < 1 ? u * 0.5 : 0); a[i + 2] = Math.sin(t * 9 - u * 5) * 0.12 * u }
    mesh.geometry.attributes.position.needsUpdate = true
  }
  // 体の画面上の位置（マウスで凧の向きを決める基準）
  const v3 = new THREE.Vector3()
  function screenOf(x, y) { v3.set(x, y, 0).project(cam); return [(v3.x + 1) / 2 * W0, (1 - v3.y) / 2 * H0] }
  return { render, screenOf, renderer, cam }
}
