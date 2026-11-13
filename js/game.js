import { COURSE as C } from './course.js'
import { newState, step, respawn, DT, K, angDiff } from './sim.js'
import { makeView } from './view.js'

const $ = id => document.getElementById(id)
const qs = new URLSearchParams(location.search)
const touch = matchMedia('(pointer: coarse)').matches || qs.has('touch')
let lang = (qs.get('lang') || (navigator.language || 'ja')).startsWith('ja') ? 'ja' : 'en'
const EN = {
  sub: 'Ride a kite up the rock spire.', start: 'Climb', proto: 'Gray-box prototype for testing the feel.',
  h_aim: 'Mouse', h_aim2: 'Steer the kite', h_in: 'Left click', h_in2: 'Reel in (lifts you)', h_out: 'Right click', h_out2: 'Let out (kite goes higher)',
  h_tog: 'Launch / fold', h_walk: 'Walk', h_r: 'Back to flag', h_pad: 'Left thumb', h_pad2: 'Steer kite / walk when folded', h_btn: 'Right thumb', h_btn2: 'Reel, let out, launch',
  b_out: 'Out', b_in: 'Reel', b_up: 'Launch', b_fold: 'Fold', m_resume: 'Resume', m_flag: 'Back to flag', m_title: 'Title', goal: 'Summit', again: 'Again', post: 'Post on X',
}
const JA = {}
document.querySelectorAll('[data-t]').forEach(e => JA[e.dataset.t] = e.textContent)
JA.b_fold = 'たたむ'
const tr = k => lang === 'en' ? (EN[k] ?? JA[k]) : JA[k]
function applyLang() {
  document.documentElement.lang = lang
  document.querySelectorAll('[data-t]').forEach(e => { e.textContent = tr(e.dataset.t) })
  $('langBtn').textContent = lang === 'ja' ? 'English' : '日本語'
}
const WHY = { ja: { stall: '風が切れた', low: '凧が落ちた', rock: '糸が岩に掛かった', mill: '糸が風車に巻き込まれた', post: '糸が引っかかった', thunder: '雷が落ちた', tree: '糸が木に掛かった', bell: '糸が鐘楼に掛かった' },
  en: { stall: 'The wind died', low: 'Kite fell', rock: 'Line caught on rock', mill: 'Line caught in the windmill', post: 'Line snagged', thunder: 'Lightning!', tree: 'Line caught in a tree', bell: 'Line caught on the belfry' } }

const view = makeView(C, $('view'))
let s = newState(C, 0)
let mode = 'title', acc = 0, last = performance.now()
const saved = (() => { try { return JSON.parse(localStorage.getItem('skykite') || 'null') } catch (e) { return null } })()
if (saved && saved.flag > 0 && saved.flag < C.flags.length) { s = newState(C, saved.flag); s.best = saved.best || s.best }

// ---- 入力 ----
const inp = { aim: null, reel: 0, walk: 0, toggle: false }
const keys = new Set()
let mouse = null, mIn = false, mOut = false
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) { e.preventDefault(); return }
  if (mode !== 'play') return
  keys.add(e.code)
  if (e.code === 'Space' && !e.repeat) { inp.toggle = true; e.preventDefault() }
  if (e.code === 'KeyR' && !e.repeat) backToFlag()
  if (e.code === 'Escape') openMenu()
})
addEventListener('keyup', e => keys.delete(e.code))
addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); else if (mode === 'play') wheelReel = Math.sign(e.deltaY) * 0.25 }, { passive: false })
let wheelReel = 0
document.addEventListener('gesturestart', e => e.preventDefault())
const cv = view.renderer.domElement
cv.addEventListener('contextmenu', e => e.preventDefault())
if (!touch) {
  cv.addEventListener('mousemove', e => { mouse = [e.clientX, e.clientY] })
  cv.addEventListener('mousedown', e => { if (e.button === 0) mIn = true; if (e.button === 2) mOut = true })
  addEventListener('mouseup', e => { if (e.button === 0) mIn = false; if (e.button === 2) mOut = false })
}
// スマホ: 左の指でパッド、右の指でボタン
let pad = null
const padEl = $('pad'), ring = $('padRing'), knob = $('padKnob')
padEl.addEventListener('pointerdown', e => { pad = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; padEl.setPointerCapture(e.pointerId); showPad() })
padEl.addEventListener('pointermove', e => { if (pad && e.pointerId === pad.id) { pad.dx = e.clientX - pad.x0; pad.dy = e.clientY - pad.y0; const l = Math.hypot(pad.dx, pad.dy); if (l > 60) { pad.x0 += pad.dx * (1 - 60 / l); pad.y0 += pad.dy * (1 - 60 / l); pad.dx *= 60 / l; pad.dy *= 60 / l } showPad() } })
const padEnd = e => { if (pad && e.pointerId === pad.id) { pad = null; showPad() } }
padEl.addEventListener('pointerup', padEnd); padEl.addEventListener('pointercancel', padEnd)
function showPad() {
  ring.style.display = knob.style.display = pad ? 'block' : 'none'
  if (pad) { ring.style.left = pad.x0 + 'px'; ring.style.top = pad.y0 + 'px'; knob.style.left = pad.x0 + pad.dx + 'px'; knob.style.top = pad.y0 + pad.dy + 'px' }
}
let tIn = false, tOut = false
function holdBtn(el, set) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); set(true); el.classList.add('on') })
  const up = () => { set(false); el.classList.remove('on') }
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up)
}
holdBtn($('bIn'), v => tIn = v)
holdBtn($('bOut'), v => tOut = v)
$('bTog').addEventListener('pointerdown', e => { e.preventDefault(); inp.toggle = true })

let aimKeys = Math.PI / 3
let auto = null // 検査用: 記録した入力を流す { acts, hold, i }
function readInput() {
  if (auto) {
    const a = auto.acts[Math.floor(auto.i / auto.hold)] || { reel: 0 }
    inp.aim = a.aim ?? null; inp.reel = a.reel || 0; inp.walk = a.walk || 0
    if (auto.i % auto.hold === 0 && a.toggle) inp.toggle = true
    auto.i++; return
  }
  // 歩く
  let walk = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
  // 凧の向き
  let aim = s.kite === 'flying' ? s.phi : null
  if (!touch && mouse) {
    const [sx, sy] = view.screenOf(s.x, s.y + K.hand)
    const dx = mouse[0] - sx, dy = sy - mouse[1]
    if (Math.hypot(dx, dy) > 12) aim = Math.atan2(dy, dx)
  }
  const ak = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)
  if (ak) { aimKeys = (aim ?? aimKeys) + ak * 2.2 * DT; aim = aimKeys; mouse = null } else if (aim != null) aimKeys = aim
  if (pad) {
    const l = Math.hypot(pad.dx, pad.dy)
    if (s.kite === 'flying' && !(s.ground && Math.abs(pad.dx) > 1.6 * Math.abs(pad.dy) && pad.dy > -10)) { if (l > 14) aim = Math.atan2(-pad.dy, pad.dx) }
    if (s.kite !== 'flying' || s.ground) { if (Math.abs(pad.dx) > 18 && Math.abs(pad.dx) > Math.abs(pad.dy) * 0.8) walk = Math.sign(pad.dx) }
  }
  if (aim != null) aim = Math.max(-0.1, Math.min(Math.PI + 0.1, aim < -Math.PI / 2 ? aim + 2 * Math.PI : aim))
  let reel = 0
  if (mIn || tIn || keys.has('KeyW') || keys.has('ArrowUp')) reel = 1
  else if (mOut || tOut || keys.has('KeyS') || keys.has('ArrowDown')) reel = -1
  if (wheelReel) { reel = wheelReel > 0 ? -1 : 1; wheelReel -= Math.sign(wheelReel) * DT; if (Math.abs(wheelReel) < DT) wheelReel = 0 }
  inp.aim = aim; inp.walk = walk; inp.reel = reel
}

// ---- 画面 ----
function show(id) { for (const x of ['title', 'menu', 'goal']) $(x).hidden = x !== id; $('hud').hidden = id != null && id !== 'play' ? true : false; $('touch').hidden = !(touch && id === 'play') }
function start() {
  mode = 'play'; show('play'); last = performance.now()
  if (s.flag === 0 && s.t < 1) msg(touch ? (lang === 'ja' ? '揚げる、出す、巻く' : 'Launch, let out, reel in') : (lang === 'ja' ? 'Space で揚げる。右クリックで出す。左クリックで巻く' : 'Space to launch, right click to let out, left click to reel'), 6)
}
function openMenu() { mode = 'menu'; show('menu') }
function backToFlag() { s.resets++; respawn(C, s) }
$('startBtn').onclick = start
$('langBtn').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; applyLang() }
$('menuBtn').onclick = openMenu
$('mResume').onclick = start
$('mFlag').onclick = () => { backToFlag(); start() }
$('mTitle').onclick = () => { mode = 'title'; show('title') }
$('gAgain').onclick = () => { s = newState(C, 0); save(); start() }
document.body.classList.toggle('touch', touch); $('howPc').hidden = touch; $('howTouch').hidden = !touch
applyLang()

let msgT = 0
function msg(t, dur = 1.8) { $('msg').textContent = t; $('msg').classList.add('on'); msgT = dur }
function save() { try { localStorage.setItem('skykite', JSON.stringify({ flag: s.flag, best: s.best })) } catch (e) {} }
const topY = C.flags[C.flags.length - 1].y
function hud() {
  const h = Math.max(0, s.y - K.r)
  const pct = v => Math.max(0, Math.min(100, 100 - v / topY * 100))
  $('altNow').style.top = pct(h) + '%'; $('altBest').style.top = pct(s.best) + '%'
  $('altTxt').style.top = pct(h) + '%'; $('altTxt').textContent = Math.round(h) + 'm'
  const fl = s.kite === 'flying'
  $('line').style.opacity = fl ? 1 : 0.3
  $('lineFill').style.width = ((s.L - K.Lmin) / (K.Lmax - K.Lmin) * 100) + '%'
  $('lineTxt').textContent = fl ? Math.round(s.L) + 'm' : ''
  $('bTogTxt').textContent = tr(fl ? 'b_fold' : 'b_up')
  $('drop').textContent = s.dropT > 0 ? '-' + Math.round(s.lastDrop) + 'm' : ''
  $('drop').classList.toggle('on', s.dropT > 0)
}

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now
  if (mode === 'play') {
    acc += dt
    let n = 0
    while (acc >= DT && n < 6) {
      readInput()
      step(C, s, inp)
      inp.toggle = false
      for (const e of s.ev) {
        if (e.startsWith('down:')) msg(WHY[lang][e.slice(5)] || '')
        if (e === 'flag') { msg(lang === 'ja' ? '旗に触れた' : 'Flag reached'); save() }
        if (e === 'goal') { setTimeout(() => { mode = 'goal'; $('goalTxt').textContent = (lang === 'ja' ? `${Math.floor(s.t / 60)}分${Math.floor(s.t % 60)}秒・落ちた回数 ${s.falls}` : `${Math.floor(s.t / 60)}m ${Math.floor(s.t % 60)}s, falls ${s.falls}`); $('gPost').href = 'https://x.com/intent/post?text=' + encodeURIComponent(`SKY KITE 頂上まで ${Math.floor(s.t / 60)}分${Math.floor(s.t % 60)}秒 #SKYKITE`) + '&url=' + encodeURIComponent('https://tom3games.github.io/sky-kite/'); show('goal') }, 1200) }
      }
      acc -= DT; n++
    }
    if (n === 6) acc = 0
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').classList.remove('on') }
    hud()
  }
  view.render(s, dt)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
window.sky = { C, newState: f => newState(C, f), replay(rec, f) { s = newState(C, f); auto = { ...rec, i: 0 } }, get s() { return s }, set s(v) { s = v }, inp, start, view, K }
window.__skyReady = true
