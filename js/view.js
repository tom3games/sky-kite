// 見た目。コンセプト画 B（雪山の断崖の僧院・真昼のコバルトの空・白い雪・花崗岩・深紅の菱凧・祈りの旗）が正解。
// 形は全部 course の同じ箱から作る（当たりと見た目は同じデータ）。旗・粉雪・煙は sim の wind() と同じ風で動く。
import * as THREE from 'three'
import { HDRLoader } from '../vendor/jsm/loaders/HDRLoader.js'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'
import { wind, stormOn, K, kitePos } from './sim.js?v=3'

// B の絵から抜いた色（固定）
export const PAL = {
  skyTop: 0x1a4aa6, skyLow: 0x77a9e6, haze: 0xa9c6ea,
  snow: 0xf2f5f9, snowShade: 0x9db5da, granite: 0x80838a, graniteDark: 0x3c4048,
  crimson: 0xb3202a, wood: 0x6b4630, gold: 0xe3b92f,
  flags: [0x2e5fb8, 0xeeeee6, 0xc2312c, 0x3c8c4a, 0xe3b92f],
}

let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
const noise = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s) }
const vnoise = (x, y, z) => {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz)
  const l = (a, b, t) => a + (b - a) * t
  const n = (a, b, c) => noise(ix + a, iy + b, iz + c)
  return l(l(l(n(0, 0, 0), n(1, 0, 0), u), l(n(0, 1, 0), n(1, 1, 0), u), v), l(l(n(0, 0, 1), n(1, 0, 1), u), l(n(0, 1, 1), n(1, 1, 1), u), v), w)
}

export async function makeView(C, el, opt = {}) {
  const low = !!opt.low
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opt.keep, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(low ? 1.5 : 2, devicePixelRatio))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  el.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(PAL.haze, 60, 420)
  const cam = new THREE.PerspectiveCamera(46, 1, 0.1, 1200)
  const progress = opt.progress || (() => {})
  let done = 0, total = 0
  const track = p => { total++; return p.then(v => { done++; progress(done / total); return v }) }

  // ---- 読み込み ----
  const tl = new THREE.TextureLoader()
  const loads = []
  const tex = (name, srgb) => {
    let t
    const file = name.includes('.') ? name : name + '.webp'
    loads.push(track(new Promise(r => { t = tl.load(`assets/tex/${file}`, r, undefined, r) })))
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envP = track(new Promise(r => new HDRLoader().load('assets/sky_1k.hdr', h => { h.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pmrem.fromEquirectangular(h).texture; scene.environmentIntensity = 0.7; h.dispose(); r() }, undefined, () => r())))
  const gltfP = track(new Promise(r => new GLTFLoader().load('assets/models/Adventurer.gltf', r, undefined, () => r(null))))

  // ---- 空と遠景 ----
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(PAL.skyTop) }, low: { value: new THREE.Color(PAL.skyLow) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 low; varying vec3 vp; void main(){ float h = clamp(vp.y*1.8+0.12,0.0,1.0); gl_FragColor = vec4(mix(low, top, pow(h,0.7)),1.0); }',
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat); sky.renderOrder = -10; scene.add(sky)
  let panoTex
  loads.push(track(new Promise(r => { panoTex = tl.load('assets/pano.jpg', r, undefined, r) })))
  panoTex.colorSpace = THREE.SRGBColorSpace
  // 遠くの山並みのマットペイント（円筒の内側。カメラの高さに少し遅れて付いてくる）
  const pano = new THREE.Mesh(new THREE.CylinderGeometry(700, 700, 440, 48, 1, true, Math.PI * 0.6, Math.PI * 0.8),
    new THREE.MeshBasicMaterial({ map: panoTex, side: THREE.BackSide, fog: false, transparent: true, depthWrite: false }))
  pano.material.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.a *= 1.0 - smoothstep(0.45, 0.62, vMapUv.y);') }
  pano.renderOrder = -9; scene.add(pano)

  // ---- 光 ----
  scene.add(new THREE.HemisphereLight(0xcfe2ff, 0xdfe6ef, 0.6))
  const sun = new THREE.DirectionalLight(0xfff3df, 3.0)
  sun.castShadow = true
  sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048)
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 170 })
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.08
  scene.add(sun, sun.target)

  // ---- 材質 ----
  const T = {
    rockD: tex('rock_face_03_diff.jpg', true), rockN: tex('rock_face_03_nor_gl.jpg'), rockR: tex('rock_face_03_rough.jpg'),
    darkD: tex('dark_rock_02_diff.jpg', true), darkN: tex('dark_rock_02_nor_gl.jpg'), darkR: tex('dark_rock_02_rough.jpg'),
    stoneD: tex('rock_wall_08_diff.jpg', true), stoneN: tex('rock_wall_08_nor_gl.jpg'), stoneR: tex('rock_wall_08_rough.jpg'),
    snowD: tex('snow_02_diff', true), snowN: tex('snow_02_nor_gl'), snowR: tex('snow_02_rough'),
    plasD: tex('plastered_wall_04_diff', true), plasN: tex('plastered_wall_04_nor_gl'),
    woodD: tex('weathered_planks_diff', true), woodN: tex('weathered_planks_nor_gl'), woodR: tex('weathered_planks_rough'),
  }
  // 雪の積もる岩: 上を向いた面に雪をのせる（世界の向きとノイズで混ぜる）
  function snowy(map, nmap, rmap, opts = {}) {
    const m = new THREE.MeshStandardMaterial({ map, normalMap: nmap, roughnessMap: rmap, roughness: 0.95, color: opts.color ?? 0xffffff, normalScale: new THREE.Vector2(1.3, 1.3) })
    const amt = opts.snow ?? 0.62, sat = (opts.sat ?? 1).toFixed(2), tint = new THREE.Color(opts.tint ?? 0xffffff)
    m.onBeforeCompile = sh => {
      sh.uniforms.snowMap = { value: T.snowD }
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 wN; varying vec3 wP;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nwN = normalize(mat3(modelMatrix) * objectNormal); wP = (modelMatrix * vec4(transformed,1.0)).xyz;')
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D snowMap; varying vec3 wN; varying vec3 wP;\nfloat hs(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }\nfloat vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x), mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x), f.y); }')
        .replace('#include <map_fragment>', `#include <map_fragment>
          { float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, ${sat}) * vec3(${tint.r.toFixed(3)}, ${tint.g.toFixed(3)}, ${tint.b.toFixed(3)}); }
          float n = vn(wP.xy * 0.35) * 0.6 + vn(wP.xz * 1.3 + wP.y) * 0.4;
          float sAmt = smoothstep(${(1 - amt).toFixed(2)}, ${(1 - amt + 0.25).toFixed(2)}, wN.y + (n - 0.5) * 0.55);
          float crev = smoothstep(0.86, 0.95, vn(wP.xy * 1.7 + wP.z)) * 0.35 * (1.0 - step(0.75, abs(wN.y)));
          sAmt = max(sAmt, crev);
          vec3 sc = texture2D(snowMap, wP.xz * 0.25 + wP.y * 0.05).rgb * 1.06;
          diffuseColor.rgb = mix(diffuseColor.rgb, sc, sAmt);
          float snowMask = sAmt;`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, snowMask);')
    }
    return m
  }
  const M = {
    cliff: snowy(T.rockD, T.rockN, T.rockR, { snow: 0.5, sat: 0.12, tint: 0xb5bcc8 }),
    rock: snowy(T.rockD, T.rockN, T.rockR, { snow: 0.55, sat: 0.15, tint: 0xc0c5ce }),
    far: snowy(T.rockD, T.rockN, T.rockR, { snow: 0.45, sat: 0.1, tint: 0x6f7889 }),
    ridge: snowy(T.rockD, T.rockN, T.rockR, { snow: 0.6, sat: 0.12, tint: 0xa9b0bd }),
    snow: new THREE.MeshStandardMaterial({ map: T.snowD, normalMap: T.snowN, roughnessMap: T.snowR, color: 0xffffff, roughness: 0.7 }),
    plaster: new THREE.MeshStandardMaterial({ map: T.plasD, normalMap: T.plasN, color: 0xf1ede4, roughness: 0.9 }),
    crimson: new THREE.MeshStandardMaterial({ color: 0x8e1d22, roughness: 0.75 }),
    wood: new THREE.MeshStandardMaterial({ map: T.woodD, normalMap: T.woodN, roughnessMap: T.woodR, color: 0xa47a58 }),
    darkWood: new THREE.MeshStandardMaterial({ map: T.woodD, normalMap: T.woodN, color: 0x4a2f22, roughness: 0.85 }),
    block: snowy(T.stoneD, T.stoneN, T.stoneR, { snow: 0.5, sat: 0.5, tint: 0xe8e2d8 }),
    window: new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 1 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc89b3a, metalness: 0.9, roughness: 0.32 }),
    rope: new THREE.MeshStandardMaterial({ color: 0x8d7a5c, roughness: 1 }),
    pine: new THREE.MeshStandardMaterial({ color: 0x24402e, roughness: 0.9 }),
  }
  // 箱の面ごとに UV を実寸にする（テクスチャが伸びない）
  function worldUV(geo, sx, sy, sz, s = 4) {
    const uv = geo.attributes.uv, n = geo.attributes.normal
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i))
      const [a, b] = nx > 0.5 ? [sz, sy] : ny > 0.5 ? [sx, sz] : [sx, sy]
      uv.setXY(i, uv.getX(i) * a / s, uv.getY(i) * b / s)
    }
  }
  // 岩の棚: 上面は平らのまま（当たりと同じ高さ）。横は内側へだけ、下と奥行きはでこぼこに
  function rockBox(b, depth, z0, mat, rough = 0.35) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0
    const g = new THREE.BoxGeometry(w, h, depth, Math.max(2, Math.min(60, Math.round(w))), Math.max(2, Math.min(120, Math.round(h * 1.2))), Math.max(2, Math.round(depth)))
    worldUV(g, w, h, depth)
    const p = g.attributes.position
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      if (y > h / 2 - 0.01) continue
      const wx = x + cx, wy = y + cy
      const r1 = 1 - Math.abs(vnoise(wx * 0.35, wy * 0.22, z * 0.3) * 2 - 1)   // 尾根状（花崗岩の割れ目の稜）
      const d = (r1 - 0.5) * 2 * rough + (vnoise(wx * 0.9, wy * 0.9, z * 0.9) - 0.5) * rough * 0.8 + (vnoise(wx * 2.5, wy * 2.5, z * 2.5) - 0.5) * rough * 0.25
      let nx = x, ny = y, nz = z
      if (Math.abs(x) > w / 2 - 0.01) nx = x - Math.sign(x) * Math.abs(d) * 0.5   // 横の面は内へ（当たりより外に出さない）
      if (y < -h / 2 + 0.01) ny = y + d * 0.8
      if (z > depth / 2 - 0.01) nz = z + d                                         // 手前の面はでこぼこ
      p.setXYZ(i, nx, ny, nz)
    }
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, mat)
    m.position.set(cx, cy, z0 + depth / 2)
    m.castShadow = m.receiveShadow = true
    scene.add(m); return m
  }
  // 雪の帽子（棚の上面。真ん中は少し盛り、縁は丸く落ちる）
  function snowCap(x0, x1, y, z0, depth) {
    const w = x1 - x0
    const g = new THREE.BoxGeometry(w + 0.1, 0.2, depth + 0.1, Math.max(2, Math.min(80, Math.round(w * 2))), 1, Math.max(2, Math.round(depth * 2)))
    worldUV(g, w, 0.2, depth, 3)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      if (y > 0) { const e = Math.max(0, Math.min(1, (w / 2 - Math.abs(x)) / 0.5, (depth / 2 - Math.abs(z)) / 0.5)); p.setY(i, y + e * (0.03 + vnoise(x + x0, z, 3.3) * 0.1) - (1 - e) * 0.12) }
    }
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, M.snow); m.position.set((x0 + x1) / 2, y - 0.09, z0 + depth / 2); m.receiveShadow = true; m.castShadow = true
    scene.add(m)
  }

  const DEPTH = { ground: 6, rock: 5, wood: 3.2, ridge: 14, tower: 3.4, house: 5.5 }
  const WALLZ = -3.5
  const top = C.solids.reduce((m, b) => Math.max(m, b.y1), 0)
  // 棚の奥の岩の柱（とぎれとぎれ。間から空と遠くの山並みが見える）
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, x = side * (40 + rnd() * 70), w = 14 + rnd() * 18, h = 90 + rnd() * 120, y = -40 + (i / 16) * (top + 20)
    const g = new THREE.CylinderGeometry(w * 0.25, w * 0.7, h, 9, Math.round(h / 3))
    const p = g.attributes.position
    for (let j = 0; j < p.count; j++) { const px = p.getX(j), py = p.getY(j), pz = p.getZ(j); const d = (vnoise(px * 0.25 + i, py * 0.12, pz * 0.25) - 0.5) * w * 0.5; p.setXYZ(j, px + d, py, pz + d * 0.7) }
    g.computeVertexNormals(); worldUV(g, w * 2, h, w, 6)
    const m = new THREE.Mesh(g, M.far); m.position.set(x, y, -90 - rnd() * 60); m.rotation.y = rnd() * 6; scene.add(m)
  }
  // 両側の尾根の向こうの岩山（奥行き）
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1, h = 30 + rnd() * 60
    const g = new THREE.ConeGeometry(10 + rnd() * 14, h, 8, 8)
    const p = g.attributes.position
    for (let j = 0; j < p.count; j++) { const x = p.getX(j), y = p.getY(j), z = p.getZ(j); const d = (vnoise(x * 0.2 + i, y * 0.2, z * 0.2) - 0.5) * 7; p.setXYZ(j, x + d, y, z + d) }
    g.computeVertexNormals(); worldUV(g, 20, h, 20, 8)
    const m = new THREE.Mesh(g, M.cliff)
    m.position.set(side * (54 + rnd() * 50), -20 + (i / 30) * (top + 50) + rnd() * 20, -8 - rnd() * 40)
    m.rotation.y = rnd() * 6; m.receiveShadow = true; scene.add(m)
  }
  // 雲海
  const cloudTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const id = g.createImageData(256, 256); for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const v = vnoise(x / 32, y / 32, 0) * 0.6 + vnoise(x / 12, y / 12, 3) * 0.4; const i = (y * 256 + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 238 + v * 17; id.data[i + 3] = 255 * Math.min(1, Math.max(0, (v - 0.22) * 1.9)) } g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); t.colorSpace = THREE.SRGBColorSpace; return t })()
  const seas = []
  for (let k = 0; k < 3; k++) {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshLambertMaterial({ map: cloudTex, transparent: true, opacity: 0.92 - k * 0.22, depthWrite: false }))
    sea.rotation.x = -Math.PI / 2; sea.position.y = -14 - k * 5; scene.add(sea); seas.push(sea)
  }

  // ---- 足場・建物 ----
  for (const b of C.solids) {
    const d = DEPTH[b.kind] ?? 4
    if (b.kind === 'house') { house(b); continue }
    if (b.kind === 'tower') { tower(b); continue }
    if (b.kind === 'wood') {
      const w = b.x1 - b.x0, h = b.y1 - b.y0
      const g = new THREE.BoxGeometry(w, h, d); worldUV(g, w, h, d, 2.5)
      const m = new THREE.Mesh(g, M.wood); m.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, WALLZ + d / 2); m.castShadow = m.receiveShadow = true; scene.add(m)
      for (let x = b.x0 + 0.4; x < b.x1; x += 2.2) { const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.6, 6), M.darkWood); s2.position.set(x, b.y0 - 0.9, WALLZ + 0.9); s2.rotation.x = 0.7; s2.castShadow = true; scene.add(s2) }
      snowCap(b.x0, b.x1, b.y1, WALLZ, d)
      continue
    }
    const ridge = b.kind === 'ridge'
    const z0 = ridge ? WALLZ - 4 : WALLZ - 0.5
    if (ridge) { rockBox(b, 12, -16, M.ridge, 2.2); continue }
    const deep = b.kind === 'ground' ? 16 : 9
    rockBox(b, d + deep, z0 - deep + 0.5, M.rock, 0.35)
    snowCap(b.x0, b.x1, b.y1, z0 - deep + 0.5, d + deep)
    if (b.kind !== 'ground') { // 棚の下の岩の根（下へ細くなる）
      const w = b.x1 - b.x0, hh = 2.5 + w * 0.22
      const g = new THREE.ConeGeometry(w * 0.45, hh, 7, 4); g.rotateX(Math.PI)
      const p = g.attributes.position
      for (let j = 0; j < p.count; j++) { const x = p.getX(j), y = p.getY(j), z = p.getZ(j); const dd = (vnoise(x * 0.4 + b.x0, y * 0.4, z * 0.4) - 0.5) * 2; p.setXYZ(j, x + dd, y, z * 1.3 + dd) }
      g.computeVertexNormals(); worldUV(g, w, hh, w, 5)
      const r = new THREE.Mesh(g, M.rock); r.position.set((b.x0 + b.x1) / 2, b.y0 - hh / 2 + 0.3, z0 - deep * 0.45); r.castShadow = r.receiveShadow = true; scene.add(r)
    }
  }
  function house(b) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, d = DEPTH.house, cx = (b.x0 + b.x1) / 2
    const g = new THREE.BoxGeometry(w, h, d); worldUV(g, w, h, d, 3)
    const m = new THREE.Mesh(g, M.plaster); m.position.set(cx, (b.y0 + b.y1) / 2, WALLZ + d / 2); m.castShadow = m.receiveShadow = true; scene.add(m)
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.7, d + 0.1), M.crimson); band.position.set(cx, b.y1 - 0.55, WALLZ + d / 2); band.castShadow = true; scene.add(band)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.3, d + 0.8), M.darkWood); roof.position.set(cx, b.y1 + 0.1, WALLZ + d / 2); roof.castShadow = true; scene.add(roof)
    for (let x = b.x0 + 0.3; x < b.x1; x += 0.8) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), M.darkWood); e.position.set(x, b.y1 - 0.15, WALLZ + d + 0.2); scene.add(e) }
    snowCap(b.x0 - 0.4, b.x1 + 0.4, b.y1 + 0.25, WALLZ - 0.4, d + 0.8)
    for (let x = b.x0 + 1.2; x < b.x1 - 0.8; x += 2.2) for (let y = b.y0 + 1.4; y < b.y1 - 1.4; y += 2.2) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.15, 0.08), M.darkWood); fr.position.set(x, y, WALLZ + d + 0.02); scene.add(fr)
      const wi = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.88, 0.1), M.window); wi.position.set(x, y, WALLZ + d + 0.04); scene.add(wi)
    }
  }
  function tower(b) {
    const w = b.x1 - b.x0, h = b.y1 - b.y0, d = DEPTH.tower, cx = (b.x0 + b.x1) / 2
    const g = new THREE.BoxGeometry(w, h, d); worldUV(g, w, h, d, 2.5)
    const m = new THREE.Mesh(g, M.block); m.position.set(cx, (b.y0 + b.y1) / 2, WALLZ + 1 + d / 2); m.castShadow = m.receiveShadow = true; scene.add(m)
    const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, 1.6, 4), M.crimson); cap.position.set(cx, b.y1 + 0.8, WALLZ + 1 + d / 2); cap.rotation.y = Math.PI / 4; cap.castShadow = true; scene.add(cap)
  }
  for (const s of C.snags) {
    if (s.type !== 'post') continue
    if (s.what === 'tree') {
      const g = new THREE.Group(); g.position.set(s.x, s.y - s.h / 2, 0)
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, s.h, 6), M.darkWood); trunk.position.y = s.h / 2; trunk.castShadow = true; g.add(trunk)
      for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.5 - k * 0.22, 1.7, 7), M.pine); c.position.y = 1.6 + k * 0.95; c.castShadow = true; g.add(c); const sn = new THREE.Mesh(new THREE.ConeGeometry(1.2 - k * 0.2, 0.5, 7), M.snow); sn.position.y = 2.1 + k * 0.95; g.add(sn) }
      scene.add(g)
    } else {
      const sp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, s.h, 6), M.gold); sp2.position.set(s.x, s.y, 0.3); sp2.castShadow = true; scene.add(sp2)
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 0.6, 10, 1, true), M.gold); bell.position.set(s.x, s.y - s.h / 2 + 0.4, 0.6); scene.add(bell)
    }
  }
  const mills = C.snags.filter(s => s.type === 'mill').map(s => {
    const g = new THREE.Group(); g.position.set(s.x, s.y, 0.6)
    for (let i = 0; i < s.n; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * 2 * Math.PI / s.n
      const a = new THREE.Mesh(new THREE.BoxGeometry(s.R, 0.18, 0.18), M.darkWood); a.position.x = s.R / 2; a.castShadow = true; arm.add(a)
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(s.R * 0.82, 1.1), new THREE.MeshStandardMaterial({ color: 0xe9e2d2, side: THREE.DoubleSide, roughness: 1 }))
      sail.position.set(s.R * 0.55, 0.62, 0.05); sail.castShadow = true; arm.add(sail)
      g.add(arm)
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.6, 10), M.darkWood); hub.rotation.x = Math.PI / 2; g.add(hub)
    scene.add(g); return { s, g }
  })

  // ---- 祈りの旗（綱にずらり。向きと揺れは wind() そのもの。色の並びと形だけで、文字は入れない） ----
  const flagLines = []
  for (const b of C.solids.filter(b => (b.kind === 'rock' || b.kind === 'wood') && b.x1 - b.x0 >= 6 && b.x1 - b.x0 < 30)) flagLines.push({ x0: b.x0 + 0.4, y0: b.y1 + 3.4, x1: b.x1 - 0.4, y1: b.y1 + 2.3 + (b.x1 - b.x0) * 0.04, z: WALLZ + 1.1 })
  for (const p of C.props.filter(p => p.type === 'flagpole')) flagLines.push({ x0: p.x, y0: p.y + 4.6, x1: p.x + (p.x < 0 ? 5 : -5), y1: p.y + 0.3, z: WALLZ + 2.6, pole: true })
  const flagList = []
  for (const L of flagLines) {
    const len = Math.hypot(L.x1 - L.x0, L.y1 - L.y0), n = Math.floor(len / 0.62), sagY = len * 0.05
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(L.x0, L.y0, L.z), new THREE.Vector3((L.x0 + L.x1) / 2, (L.y0 + L.y1) / 2 - sagY * 2, L.z), new THREE.Vector3(L.x1, L.y1, L.z))
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.025, 4), M.rope))
    for (let i = 1; i < n; i++) { const pt = curve.getPoint(i / n); flagList.push({ x: pt.x, y: pt.y, z: L.z, c: PAL.flags[i % 5], ph: rnd() * 6, a: 0 }) }
    if (L.pole) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.8, 6), M.darkWood); pole.position.set(L.x0, L.y0 - 2.4, L.z); pole.castShadow = true; scene.add(pole) }
  }
  const flagGeo = new THREE.PlaneGeometry(0.46, 0.58, 3, 2); flagGeo.translate(0, -0.29, 0)
  const flagMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1 })
  flagMat.onBeforeCompile = sh => {
    sh.uniforms.time = { value: 0 }; flagMat.userData.sh = sh
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFl; attribute float aPh; uniform float time;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat u = -position.y / 0.58; transformed.z += sin(time * (6.0 + aFl * 1.1) + aPh - u * 5.0) * 0.17 * u * min(1.0, aFl / 6.0);')
  }
  const flags = new THREE.InstancedMesh(flagGeo, flagMat, Math.max(1, flagList.length))
  flags.castShadow = true; flags.frustumCulled = false
  const aFl = new Float32Array(flagList.length), aPh = new Float32Array(flagList.length)
  flagList.forEach((f, i) => { flags.setColorAt(i, new THREE.Color(f.c)); aPh[i] = f.ph })
  flagGeo.setAttribute('aFl', new THREE.InstancedBufferAttribute(aFl, 1)); flagGeo.setAttribute('aPh', new THREE.InstancedBufferAttribute(aPh, 1))
  scene.add(flags)

  // セーブの旗（黄ばんだ大きい旗）
  const saveFlags = C.flags.map((f, i) => {
    const g = new THREE.Group(); g.position.set(f.x, f.y, WALLZ + 3.4)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 6), M.darkWood); pole.position.y = 1.8; pole.castShadow = true; g.add(pole)
    const cg = new THREE.PlaneGeometry(1.5, 0.95, 8, 2); cg.translate(0.75, 0, 0)
    const cloth = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xcdb46e, side: THREE.DoubleSide, roughness: 1 }))
    cloth.position.y = 3.05; cloth.castShadow = true; g.add(cloth)
    scene.add(g); return { g, cloth, f, i, base: cg.attributes.position.array.slice() }
  })

  // 香炉（焚き火）と煙
  const fires = C.props.filter(p => p.type === 'fire').map(p => {
    const g = new THREE.Group(); g.position.set(p.x, p.y, WALLZ + 2.2)
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.5, 10), M.block); bowl.position.y = 0.25; bowl.castShadow = true; g.add(bowl)
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.88 })); fl.position.y = 0.85; g.add(fl)
    scene.add(g); return { g, fl, p }
  })
  const softTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c) })()
  const smokes = C.props.filter(p => p.type === 'smoke').map(p => {
    const n = 46, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3)
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTex, color: 0xd8d4ce, size: 3.0, transparent: true, opacity: 0.34, depthWrite: false }))
    pts.frustumCulled = false; scene.add(pts)
    return { p, pts, pos, n }
  })

  // ---- 粉雪（風そのものを見せる。画面のまわりを風に乗って流れる） ----
  const NS = low ? 700 : 1300
  const sgeo = new THREE.BufferGeometry(), spos = new Float32Array(NS * 3)
  sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3))
  const snowPts = new THREE.Points(sgeo, new THREE.PointsMaterial({ map: softTex, color: 0xffffff, size: 0.24, transparent: true, opacity: 0.95, depthWrite: false }))
  snowPts.frustumCulled = false; scene.add(snowPts)
  const sp = Array.from({ length: NS }, () => ({ x: 0, y: 0, z: 0, life: -1 }))
  const NST = 170, stgeo = new THREE.BufferGeometry(), stpos = new Float32Array(NST * 6)
  stgeo.setAttribute('position', new THREE.BufferAttribute(stpos, 3))
  const streaks = new THREE.LineSegments(stgeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }))
  streaks.frustumCulled = false; scene.add(streaks)
  const st = Array.from({ length: NST }, () => ({ x: 0, y: 0, z: 0, life: -1, m: 1 }))

  // 雷雲
  const storms = C.storms.map(z => {
    const g = new THREE.Group()
    const n = 30, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { pos[i * 3] = z.x0 + rnd() * (z.x1 - z.x0); pos[i * 3 + 1] = z.y0 + 1 + rnd() * (z.y1 - z.y0 - 1); pos[i * 3 + 2] = -1 + rnd() * 3 }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({ map: softTex, color: 0x50586a, size: 10, transparent: true, opacity: 0.8, depthWrite: false })
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; g.add(pts)
    const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 9 }, (_, i) => new THREE.Vector3((z.x0 + z.x1) / 2 + (rnd() - 0.5) * 3, z.y1 - i * (z.y1 - z.y0 + 6) / 8, 0.5))), new THREE.LineBasicMaterial({ color: 0xf2f0ff }))
    bolt.visible = false; g.add(bolt)
    const light = new THREE.PointLight(0xdfe4ff, 0, 70); light.position.set((z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2, 4); g.add(light)
    scene.add(g); return { z, mat, bolt, light }
  })

  // ---- 人 ----
  const body = new THREE.Group(); scene.add(body)
  let rig = null, mixer = null, curAct = null
  const acts = {}
  const gltf = await gltfP
  if (gltf) {
    rig = gltf.scene
    const box = new THREE.Box3().setFromObject(rig), hgt = box.max.y - box.min.y
    rig.scale.setScalar(1.72 / hgt)
    rig.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false
        for (const m of [].concat(o.material)) { // 毛皮の外套の旅人へ色を寄せる
          const n = m.name
          if (n === 'Green') m.color.setHex(0x5a3a2a); else if (n === 'LightGreen') m.color.setHex(0x9a7b5a)
          else if (n === 'Brown') m.color.setHex(0x3a2a20); else if (n === 'Gold') m.color.setHex(0xb3202a)
          m.roughness = 0.92; m.metalness = 0
        }
      }
    })
    rig.position.y = -K.r - 0.02
    body.add(rig)
    mixer = new THREE.AnimationMixer(rig)
    for (const c of gltf.animations) acts[c.name] = mixer.clipAction(c)
    const bones = {}; rig.traverse(o => { if (o.isBone) bones[o.name] = o })
    rig.userData.bones = bones
  } else {
    const fb = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a2a })); fb.position.y = 0.3; body.add(fb)
  }
  function play(name, fade = 0.25) { const a = acts[name]; if (!a || curAct === a) return; a.reset().fadeIn(fade).play(); if (curAct) curAct.fadeOut(fade); curAct = a }

  // ---- 凧（深紅の菱凧・木の骨・2本の長い尾） ----
  const kite = new THREE.Group(); scene.add(kite)
  const ksh = new THREE.Shape(); ksh.moveTo(0, 1.7); ksh.lineTo(1.35, 0.2); ksh.lineTo(0, -2.1); ksh.lineTo(-1.35, 0.2); ksh.closePath()
  const kgeo = new THREE.ShapeGeometry(ksh, 4)
  { const p = kgeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -(1 - Math.min(1, Math.abs(x) / 1.35)) * 0.25 - 0.03 * y) } kgeo.computeVertexNormals() }
  const kmat = new THREE.MeshStandardMaterial({ color: 0xb3202a, side: THREE.DoubleSide, roughness: 0.62, emissive: 0xff9a40, emissiveIntensity: 0 })
  const kmesh = new THREE.Mesh(kgeo, kmat); kmesh.castShadow = true; kite.add(kmesh)
  const spar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.8, 5), M.darkWood); spar1.position.set(0, -0.2, 0.06); kite.add(spar1)
  const spar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.7, 5), M.darkWood); spar2.rotation.z = Math.PI / 2; spar2.position.set(0, 0.2, 0.06); kite.add(spar2)
  const tails = [0, 1].map(k => {
    const n = 14, pts = Array.from({ length: n }, () => new THREE.Vector3()), prev = pts.map(v => v.clone())
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3), idx = []
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx)
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: k ? 0xc9302f : 0x8e1d22, side: THREE.DoubleSide, roughness: 0.8 }))
    m.frustumCulled = false; scene.add(m)
    return { pts, prev, pos, geo, init: false, off: k ? 0.25 : -0.25 }
  })

  // 糸（帯。張りで色と太さ: たるみ=灰、張り=白、浮ける=金）
  const NL = 28, lgeo = new THREE.BufferGeometry(), lpos = new Float32Array(NL * 2 * 3), lidx = []
  for (let i = 0; i < NL - 1; i++) { const a = i * 2; lidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  lgeo.setAttribute('position', new THREE.BufferAttribute(lpos, 3)); lgeo.setIndex(lidx)
  const lmat = new THREE.MeshBasicMaterial({ color: 0xf6f2e6, side: THREE.DoubleSide, transparent: true, fog: false })
  const line = new THREE.Mesh(lgeo, lmat); line.frustumCulled = false; scene.add(line)
  const lpts = Array.from({ length: NL }, () => [0, 0])
  const cGold = new THREE.Color(0xffc23a), cWhite = new THREE.Color(0xfbf8ef), cSlack = new THREE.Color(0x7d8088)
  const chev = []
  const chevGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.35, 0.3, 0), new THREE.Vector3(0.1, 0, 0), new THREE.Vector3(-0.35, -0.3, 0)])
  for (let i = 0; i < 10; i++) { const m = new THREE.Line(chevGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false })); m.userData = { u: i / 10, o: ((i * 37) % 10) / 10 - 0.5 }; scene.add(m); chev.push(m) }

  // ---- 後処理（PC だけ: 弱いブルーム） ----
  let composer = null
  if (!low) {
    try {
      const { EffectComposer } = await import('../vendor/jsm/postprocessing/EffectComposer.js')
      const { RenderPass } = await import('../vendor/jsm/postprocessing/RenderPass.js')
      const { UnrealBloomPass } = await import('../vendor/jsm/postprocessing/UnrealBloomPass.js')
      const { OutputPass } = await import('../vendor/jsm/postprocessing/OutputPass.js')
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, cam))
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.2, 0.5, 0.93))
      composer.addPass(new OutputPass())
    } catch (e) { composer = null }
  }

  let camX = 0, camY = 0, aspect = 1, W0 = 1, H0 = 1
  function resize() {
    W0 = el.clientWidth; H0 = el.clientHeight
    renderer.setSize(W0, H0, false); aspect = W0 / H0
    cam.aspect = aspect; cam.fov = aspect < 1 ? 58 : 46; cam.updateProjectionMatrix()
    if (composer) composer.setSize(W0, H0)
  }
  addEventListener('resize', resize); resize()
  await Promise.all([envP, ...loads])

  const tmpW = [0, 0], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1)
  let kfx = 0, kfy = 0, kfInit = false, init = false, flash = 0, face = 1
  function render(s, dt) {
    const t = s.t
    const [kx, ky] = kitePos(s)
    const flying = s.kite === 'flying'
    // カメラ: 体と凧の間を、少し下から見上げる（B の絵の構図）
    const fx = flying ? s.x * 0.75 + kx * 0.25 : s.x, fy = flying ? s.y * 0.72 + ky * 0.28 + 1 : s.y + 3
    const k = 1 - Math.exp(-dt * 2.6)
    if (!init) { camX = fx; camY = fy; init = true }
    camX += (fx - camX) * k; camY += (fy - camY) * k
    // 斜め（右手前）から見る: 岩壁が奥へ流れ、右に空と遠くの山並みが見える
    const up = aspect < 1 ? 3 : 1.2, dist = aspect < 1 ? 27 + 4 * (1 - aspect) : 24
    cam.position.set(camX + dist * 0.42, camY + up - 3.5, dist * 0.92)
    cam.lookAt(camX + 1.5, camY + up, 0)
    sun.position.set(camX + 26, camY + 44, 40); sun.target.position.set(camX, camY, 0)
    sky.position.copy(cam.position)
    pano.position.set(cam.position.x * 0.9, camY * 0.6 + 40, cam.position.z)
    for (const sea of seas) sea.position.x = camX * 0.2

    // 人
    body.position.set(s.x, s.y, 0.2)
    if (rig) {
      const moving = s.ground && Math.abs(s.vx) > 0.3
      play(s.ground && moving ? 'Walk' : 'Idle', 0.25)
      if (moving) face = Math.sign(s.vx)
      const yaw = s.ground ? (moving ? face * Math.PI / 2 : Math.PI + face * 0.6) : Math.PI
      rig.rotation.y += (yaw - rig.rotation.y) * (1 - Math.exp(-dt * 8))
      mixer.update(dt)
      const B = rig.userData.bones
      if (flying && B['UpperArm.L']) {
        const hang = s.ground ? 0.5 : 1
        for (const side of ['L', 'R']) {
          const ua = B['UpperArm.' + side]; if (ua) ua.rotation.x = ua.rotation.x * (1 - hang) - (Math.PI - 0.3) * hang
          const la = B['LowerArm.' + side]; if (la) la.rotation.x = la.rotation.x * (1 - hang) - 0.2 * hang
        }
        if (!s.ground) for (const side of ['L', 'R']) { const ul = B['UpperLeg.' + side]; if (ul) ul.rotation.x = Math.sin(t * 2 + (side === 'L' ? 0 : 1.6)) * 0.2 + 0.12 }
      }
      body.rotation.z = s.ground ? 0 : s.beta * 0.9
    }
    // 凧
    let kx2 = kx, ky2 = ky
    if (s.kite === 'down') { kx2 = s.x + 1.0 * face; ky2 = s.y - 0.1 }
    if (!kfInit) { kfx = kx2; kfy = ky2; kfInit = true }
    const kk = 1 - Math.exp(-dt * 14)
    kfx += (kx2 - kfx) * kk; kfy += (ky2 - kfy) * kk
    kite.position.set(kfx, kfy, 0.4)
    wind(C, kfx, kfy, t, tmpW)
    const ws = Math.hypot(tmpW[0], tmpW[1]), wa = Math.atan2(tmpW[1], tmpW[0])
    kite.rotation.set(flying ? 0.3 : 1.2, 0.25, flying ? s.phi - Math.PI / 2 + Math.sin(t * 6.5) * 0.06 * Math.min(1, s.A / 8) : 1.45)
    kite.updateMatrixWorld()
    for (const tl2 of tails) {
      v3.set(tl2.off, -2.05, 0).applyMatrix4(kite.matrixWorld)
      const P = tl2.pts, Pv = tl2.prev
      if (!tl2.init) { for (let i = 0; i < P.length; i++) { P[i].copy(v3); P[i].y -= i * 0.36; Pv[i].copy(P[i]) } tl2.init = true }
      P[0].copy(v3)
      const d2t = Math.min(dt, 0.05) ** 2
      for (let i = 1; i < P.length; i++) {
        const p = P[i], pv = Pv[i], vx = (p.x - pv.x) * 0.9, vy = (p.y - pv.y) * 0.9
        pv.copy(p)
        p.x += vx + tmpW[0] * d2t * 6; p.y += vy - 4 * d2t + tmpW[1] * d2t * 6
        p.z = 0.4 + Math.sin(t * 7 + i) * 0.03 * i
      }
      for (let it = 0; it < 3; it++) for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, d = (l - 0.36) / l; b.x -= dx * d; b.y -= dy * d }
      for (let i = 0; i < P.length; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]
        let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1, w = 0.09 * (1 - i / P.length * 0.5)
        nx = nx / l * w; ny = ny / l * w
        tl2.pos.set([P[i].x + nx, P[i].y + ny, P[i].z, P[i].x - nx, P[i].y - ny, P[i].z], i * 6)
      }
      tl2.geo.attributes.position.needsUpdate = true; tl2.geo.computeBoundingSphere()
    }
    // 糸
    line.visible = flying || s.kite === 'down'
    const hx = s.x, hy = s.y + K.hand + (s.ground ? 0.3 : 0.75)
    const sag = flying ? Math.max(0, 0.9 - s.T) * s.L * 0.08 : 0.5
    for (let i = 0; i < NL; i++) { const u = i / (NL - 1); lpts[i][0] = hx + (kfx - hx) * u; lpts[i][1] = hy + (kfy - hy) * u - sag * 4 * u * (1 - u) }
    const lift = flying ? s.lift : 0
    const gold = Math.max(0, Math.min(1, (lift - 0.9) / 0.2)), taut = Math.max(0, Math.min(1, (s.T - 0.3) / 0.5))
    lmat.color.copy(cSlack).lerp(cWhite, taut).lerp(cGold, gold)
    const wdt = 0.03 + 0.04 * taut + 0.05 * gold
    for (let i = 0; i < NL; i++) {
      const a = lpts[Math.max(0, i - 1)], b = lpts[Math.min(NL - 1, i + 1)]
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l
      const z = 0.2 + 0.2 * i / (NL - 1)
      lpos.set([lpts[i][0] + nx * wdt, lpts[i][1] + ny * wdt, z, lpts[i][0] - nx * wdt, lpts[i][1] - ny * wdt, z], i * 6)
    }
    lgeo.attributes.position.needsUpdate = true
    kmat.emissiveIntensity = gold * (0.07 + 0.05 * Math.sin(t * 10))
    for (const m of chev) {
      const d = m.userData; d.u = (d.u + dt * (0.25 + ws * 0.05)) % 1
      const along = (d.u - 0.5) * 9, side = d.o * 7
      m.position.set(kfx + Math.cos(wa) * along - Math.sin(wa) * side, kfy + Math.sin(wa) * along + Math.cos(wa) * side, 0.8)
      m.rotation.z = wa
      m.material.opacity = Math.min(0.7, ws / 10) * Math.sin(d.u * Math.PI) * (flying ? 1 : 0.35)
    }

    // 祈りの旗: 風下へなびく。弱い風では垂れる（平面の -y が布の先）
    for (let i = 0; i < flagList.length; i++) {
      const f = flagList[i]
      if (Math.abs(f.y - camY) > 40) continue
      wind(C, f.x, f.y - 0.3, t, tmpW)
      const s2 = Math.hypot(tmpW[0], tmpW[1]), droop = Math.min(1, s2 / 7)
      // 風のない時は真下（a=0）。風が強いほど風下（布の先が風の向き）へ
      const target = s2 > 0.3 ? Math.atan2(tmpW[0], -tmpW[1]) : 0
      let da = target - 0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI
      const want = da * droop
      let d2 = want - f.a; while (d2 > Math.PI) d2 -= 2 * Math.PI; while (d2 < -Math.PI) d2 += 2 * Math.PI
      f.a += d2 * Math.min(1, dt * (2 + s2 * 0.6))
      e3.set(0, 0, f.a + Math.sin(t * (5 + s2) + f.ph) * 0.1 * droop); q.setFromEuler(e3)
      m4.compose(v3.set(f.x, f.y, f.z), q, one); flags.setMatrixAt(i, m4)
      aFl[i] = s2
    }
    flags.instanceMatrix.needsUpdate = true; flagGeo.attributes.aFl.needsUpdate = true
    if (flagMat.userData.sh) flagMat.userData.sh.uniforms.time.value = t
    for (const sf of saveFlags) {
      sf.cloth.material.color.setHex(sf.i <= s.flag ? 0xe3c35f : 0x9a937e)
      if (Math.abs(sf.f.y - camY) > 40) continue
      wind(C, sf.f.x, sf.f.y + 3, t, tmpW)
      const s2 = Math.hypot(tmpW[0], tmpW[1]), dir = tmpW[0] >= 0 ? 1 : -1, droop = Math.min(1, s2 / 6)
      const a = sf.cloth.geometry.attributes.position.array
      for (let j = 0; j < a.length; j += 3) { const u = sf.base[j] / 1.5; a[j] = sf.base[j] * dir * (0.35 + 0.65 * droop); a[j + 1] = sf.base[j + 1] - u * 1.1 * (1 - droop) + Math.sin(t * 8 - u * 6) * 0.1 * u * droop; a[j + 2] = Math.sin(t * 9 - u * 5) * 0.14 * u * droop }
      sf.cloth.geometry.attributes.position.needsUpdate = true; sf.cloth.geometry.computeVertexNormals()
    }
    for (const f of fires) { const s2 = 0.85 + Math.sin(t * 17 + f.p.x) * 0.1 + Math.sin(t * 29) * 0.06; f.fl.scale.set(s2, s2 * 1.2, s2) }
    for (const sm of smokes) {
      const { p, pos, n } = sm
      if (Math.abs(p.y - camY) > 50) continue
      for (let i = 0; i < n; i++) {
        const a = ((i / n) + t * 0.09) % 1
        let x = p.x + Math.sin(i * 2.3) * 0.4 * (0.4 + a); const y = p.y + 0.6 + a * p.h
        wind(C, x, y, t, tmpW)
        x += tmpW[0] * a * 0.55 + Math.sin(t * 0.7 + i) * a * 0.6
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = WALLZ + 2.2 + Math.cos(i * 1.7) * 0.6
      }
      sm.pts.geometry.attributes.position.needsUpdate = true
    }
    // 粉雪と風の筋
    const vw = 30 * Math.max(1, aspect), vh = 26
    for (let i = 0; i < NS; i++) {
      const q2 = sp[i]
      if (q2.life <= 0 || Math.abs(q2.x - camX) > vw || Math.abs(q2.y - camY) > vh) { q2.x = camX + (rnd() * 2 - 1) * vw; q2.y = camY + (rnd() * 2 - 1) * vh; q2.z = -2.5 + rnd() * 8; q2.life = 1 + rnd() * 3 }
      wind(C, q2.x, q2.y, t, tmpW)
      q2.x += (tmpW[0] + Math.sin(t * 2 + i) * 0.4) * dt; q2.y += (tmpW[1] - 0.6) * dt; q2.life -= dt
      spos[i * 3] = q2.x; spos[i * 3 + 1] = q2.y; spos[i * 3 + 2] = q2.z
    }
    sgeo.attributes.position.needsUpdate = true
    for (let i = 0; i < NST; i++) {
      const q2 = st[i]
      if (q2.life <= 0 || Math.abs(q2.x - camX) > vw || Math.abs(q2.y - camY) > vh) { q2.x = camX + (rnd() * 2 - 1) * vw; q2.y = camY + (rnd() * 2 - 1) * vh; q2.z = -2 + rnd() * 6; q2.life = 0.5 + rnd(); q2.m = q2.life }
      wind(C, q2.x, q2.y, t, tmpW)
      const s3 = Math.hypot(tmpW[0], tmpW[1]), on = s3 > 6.5 ? Math.min(1, (s3 - 6.5) / 4) : 0
      q2.x += tmpW[0] * dt; q2.y += tmpW[1] * dt; q2.life -= dt
      const f2 = Math.min(1, q2.life / q2.m * 3, (q2.m - q2.life) * 4) * on * 0.13
      stpos.set([q2.x, q2.y, q2.z, q2.x - tmpW[0] * f2, q2.y - tmpW[1] * f2, q2.z], i * 6)
    }
    stgeo.attributes.position.needsUpdate = true
    flash = Math.max(0, flash - dt * 4)
    for (const sm of storms) {
      const on = stormOn(sm.z, t), u = ((t - sm.z.phase) % sm.z.period + sm.z.period) % sm.z.period, warn = u > sm.z.period - 1.6
      sm.mat.color.setHex(on ? 0xd8dcff : warn && Math.floor(t * 9) % 2 ? 0x7a8299 : 0x4a5163)
      sm.bolt.visible = on; sm.light.intensity = on ? 600 : warn ? 40 * (Math.floor(t * 9) % 2) : 0
      if (on && Math.abs((sm.z.y0 + sm.z.y1) / 2 - camY) < 40) flash = 1
    }
    for (const m of mills) m.g.rotation.z = m.s.phase + m.s.w * t
    renderer.toneMappingExposure = 1.05 + flash * 0.45
    if (composer) composer.render(); else renderer.render(scene, cam)
  }
  const vv = new THREE.Vector3()
  function screenOf(x, y) { vv.set(x, y, 0).project(cam); return [(vv.x + 1) / 2 * W0, (1 - vv.y) / 2 * H0] }
  return { render, screenOf, renderer, cam, scene }
}
