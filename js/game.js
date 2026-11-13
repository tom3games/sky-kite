import { COURSE as C } from './course.js?v=3'
import { newState, step, respawn, DT, K, angDiff } from './sim.js?v=3'
import { makeView } from './view.js?v=3'
import { makeTutorial } from './tutorial.js?v=3'
import { Snd } from './sfx.js?v=3'
import { wind } from './sim.js?v=3'

const $ = id => document.getElementById(id)
const qs = new URLSearchParams(location.search)
const touch = matchMedia('(pointer: coarse)').matches || qs.has('touch')
let lang = (qs.get('lang') || (navigator.language || 'ja')).startsWith('ja') ? 'ja' : 'en'
const EN = {
  sub: 'Ride a kite up the rock spire.', start: 'Climb', proto: 'Gray-box prototype for testing the feel.',
  h_in2: 'Hold to reel in (lifts you). Release to let the line out', h_aim2: 'Swing the kite left / right (walk on ledges)',
  h_pad: 'Stick (bottom left)', h_aim2b: 'Swing the kite left / right (walk on ledges)', h_btn: 'Button (bottom right)', h_in2b: 'Hold to reel in. Release to let out',
  b_in: 'Reel', m_resume: 'Resume', m_flag: 'Back to flag', m_title: 'Title', goal: 'Summit', again: 'Again', post: 'Post on X',
}
const JA = {}
document.querySelectorAll('[data-t]').forEach(e => JA[e.dataset.t] = e.textContent)
const tr = k => lang === 'en' ? (EN[k] ?? JA[k]) : JA[k]
function applyLang() {
  document.documentElement.lang = lang
  document.querySelectorAll('[data-t]').forEach(e => { e.textContent = tr(e.dataset.t) })
  $('langBtn').textContent = lang === 'ja' ? 'English' : '日本語'
}
const WHY = { ja: { edge: '山から外れた', nowind: '岩の下では凧が揚がらない。外へ歩く', stall: '風が切れた', low: '凧が落ちた', rock: '糸が岩に掛かった', mill: '糸が風車に巻き込まれた', post: '糸が引っかかった', thunder: '雷が落ちた', tree: '糸が木に掛かった', bell: '糸が鐘楼に掛かった' },
  en: { edge: 'Off the mountain', nowind: 'No room to launch here. Walk out', stall: 'The wind died', low: 'Kite fell', rock: 'Line caught on rock', mill: 'Line caught in the windmill', post: 'Line snagged', thunder: 'Lightning!', tree: 'Line caught in a tree', bell: 'Line caught on the belfry' } }

let view = null
let s = newState(C, 0)
let mode = 'title', acc = 0, last = performance.now()
const saved = (() => { try { return JSON.parse(localStorage.getItem('skykite') || 'null') } catch (e) { return null } })()
if (saved && saved.flag > 0 && saved.flag < C.flags.length) { s = newState(C, saved.flag); s.best = saved.best || s.best }

// ---- 入力: 巻く（押している間）と、凧を左右に振る、の2つだけ ----
const inp = { steer: 0, reel: 0 }
const keys = new Set()
let mDown = false
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) { e.preventDefault(); return }
  if (mode !== 'play') return
  keys.add(e.code)
  if (e.code === 'Space') e.preventDefault()
  if (e.code === 'KeyR' && !e.repeat) backToFlag()
  if (e.code === 'Escape') openMenu()
})
addEventListener('keyup', e => keys.delete(e.code))
addEventListener('blur', () => { keys.clear(); mDown = false; tIn = false })
addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault() }, { passive: false })
document.addEventListener('gesturestart', e => e.preventDefault())
function bindCanvas(cv) {
  cv.addEventListener('contextmenu', e => e.preventDefault())
  if (!touch) {
    cv.addEventListener('mousedown', e => { if (e.button === 0 || e.button === 2) mDown = true })
    addEventListener('mouseup', () => { mDown = false })
  }
}
// スマホ: 左下に固定のスティック（左右だけ）、右下に「巻く」
let stick = null, stickX = 0
const stEl = $('stick'), knob = $('stickKnob')
stEl.addEventListener('pointerdown', e => { e.preventDefault(); stick = e.pointerId; stEl.setPointerCapture(e.pointerId); moveStick(e) })
stEl.addEventListener('pointermove', e => { if (e.pointerId === stick) moveStick(e) })
const stEnd = e => { if (e.pointerId === stick) { stick = null; stickX = 0; knob.style.transform = '' } }
stEl.addEventListener('pointerup', stEnd); stEl.addEventListener('pointercancel', stEnd); stEl.addEventListener('lostpointercapture', stEnd)
function moveStick(e) {
  const r = stEl.getBoundingClientRect(), half = r.width / 2
  const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + half)) / (half * 0.8)))
  stickX = Math.abs(dx) < 0.15 ? 0 : dx
  knob.style.transform = `translateX(${dx * half * 0.6}px)`
}
let tIn = false
const bIn = $('bIn')
bIn.addEventListener('pointerdown', e => { e.preventDefault(); bIn.setPointerCapture(e.pointerId); tIn = true; bIn.classList.add('on') })
const inUp = () => { tIn = false; bIn.classList.remove('on') }
bIn.addEventListener('pointerup', inUp); bIn.addEventListener('pointercancel', inUp); bIn.addEventListener('lostpointercapture', inUp)

let auto = null // 検査用: 記録した入力を流す { acts, hold, i }
function readInput() {
  if (auto) {
    const a = auto.acts[Math.floor(auto.i / auto.hold)] || { reel: 0, steer: 0 }
    inp.steer = a.steer || 0; inp.reel = a.reel || 0; auto.i++; return
  }
  const k = ((keys.has('KeyD') || keys.has('ArrowRight')) ? 1 : 0) - ((keys.has('KeyA') || keys.has('ArrowLeft')) ? 1 : 0)
  inp.steer = k || stickX
  inp.reel = (mDown || tIn || keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp')) ? 1 : 0
}

// ---- 画面 ----
function show(id) { for (const x of ['title', 'menu', 'goal']) $(x).hidden = x !== id; $('hud').hidden = id != null && id !== 'play' ? true : false; $('touch').hidden = !(touch && id === 'play') }
let tut = null
Snd.def({ bell: 'snd/bell.mp3', land: ['snd/land1.mp3', 'snd/land2.mp3', 'snd/land3.mp3'], thud: 'snd/crash1.mp3', creak: ['snd/creak_a.mp3', 'snd/creak_b.mp3', 'snd/creak_c.mp3'], cloth: 'snd/cloth.mp3', swish: 'snd/swish.mp3', finish: 'snd/finish.mp3' })
let muted = (() => { try { return localStorage.getItem('skykite_mute') === '1' } catch (e) { return false } })()
Snd.setMute(muted)
function startSound() {
  Snd.init()
  Snd.loop('wind', 'snd/wind_loop.mp3', 0.0001, 0.5); Snd.loop('base', 'snd/wind.mp3', 0.18, 1); Snd.loop('fire', 'snd/fire.mp3', 0.0001, 0.5)
}
let creakT = 0, clothT = 0
const W2 = [0, 0]
function soundTick(dt) {
  if (!Snd.ctx) return
  wind(C, s.x, s.y + 2, s.t, W2)
  const sp = Math.hypot(W2[0], W2[1])
  const l = Snd.loops.wind; if (l && l.g) l.g.gain.setTargetAtTime(Math.min(0.55, 0.05 + sp * 0.035), Snd.now(), 0.4)
  let fd = 99; for (const p of C.props) if (p.type === 'fire') fd = Math.min(fd, Math.hypot(p.x - s.x, p.y - s.y))
  const f = Snd.loops.fire; if (f && f.g) f.g.gain.setTargetAtTime(Math.max(0.0001, 0.35 * (1 - fd / 12)), Snd.now(), 0.3)
  creakT -= dt; clothT -= dt
  if (s.kite === 'flying' && s.T > 0.9 && creakT <= 0) { Snd.play('creak', { vol: Math.min(0.5, 0.12 + (s.T - 0.9) * 0.3), jitter: 0.08 }); creakT = 0.5 + Math.random() * 0.8 / Math.max(0.6, s.T) }
  if (s.kite === 'flying' && s.A > 8 && clothT <= 0) { Snd.play('cloth', { vol: 0.12, jitter: 0.15 }); clothT = 1.2 + Math.random() * 1.5 }
}
function start() {
  mode = 'play'; show('play'); last = performance.now(); startSound()
  if (s.flag === 0 && s.t < 1 && !tut) tut = makeTutorial(s)
}
const KEYS = { reel: ['Space / クリック', 'Space / click'], right: ['D / →', 'D / →'], left: ['A / ←', 'A / ←'] }
function tutUI() {
  const st = tut && tut.step
  $('tut').classList.toggle('on', !!st)
  $('stick').classList.toggle('hint', !!st && (st.key === 'right' || st.key === 'left'))
  bIn.classList.toggle('hint', !!st && st.key === 'reel')
  if (!st) return
  $('tutTxt').textContent = lang === 'ja' ? st.ja : st.en
  const k = !touch && KEYS[st.key]
  $('tutKey').hidden = !k; if (k) $('tutKey').textContent = k[lang === 'ja' ? 0 : 1]
}
function openMenu() { mode = 'menu'; show('menu') }
function backToFlag() { s.resets++; respawn(C, s) }
$('startBtn').onclick = start
$('langBtn').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; applyLang() }
$('menuBtn').onclick = openMenu
$('muteBtn').onclick = () => { muted = !muted; Snd.setMute(muted); try { localStorage.setItem('skykite_mute', muted ? '1' : '0') } catch (e) {} $('muteBtn').classList.toggle('off', muted) }
$('muteBtn').classList.toggle('off', muted)
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
{ const cols = ['#2e5fb8', '#eeeee6', '#c2312c', '#3c8c4a', '#e3b92f']; $('altTicks').innerHTML = C.flags.map((f, i) => `<i style="top:${100 - f.y / topY * 100}%;background:${cols[i % 5]}"></i>`).join('') }
function hud() {
  const h = Math.max(0, s.y - K.r)
  const pct = v => Math.max(0, Math.min(100, 100 - v / topY * 100))
  $('altNow').style.top = pct(h) + '%'; $('altBest').style.top = pct(s.best) + '%'
  $('altTxt').style.top = pct(h) + '%'; $('altTxt').textContent = Math.round(h) + 'm'
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
      if (tut) { tut.update(s, inp, DT); if (!tut.c.on) tut = null }
      for (const e of s.ev) {
        if (e.startsWith('down:')) { msg(WHY[lang][e.slice(5)] || ''); Snd.play('swish', { vol: 0.5 }) }
        if (e === 'land') Snd.play('land', { vol: 0.45 })
        if (e === 'thud') Snd.play('thud', { vol: 0.6 })
        if (e === 'flag') Snd.play('bell', { vol: 0.6, room: 0.4 })
        if (e === 'goal') { Snd.duck(0.3, 4); Snd.play('finish', { vol: 0.7 }) }
        if (e === 'flag') { const sc = C.sections[C.flags[s.flag].sec]; msg(sc ? (lang === 'ja' ? sc.how : sc.howEn || sc.how) : '', 5); save() }
        if (e === 'goal') { setTimeout(() => { mode = 'goal'; $('goalTxt').textContent = (lang === 'ja' ? `${Math.floor(s.t / 60)}分${Math.floor(s.t % 60)}秒・落ちた回数 ${s.falls}` : `${Math.floor(s.t / 60)}m ${Math.floor(s.t % 60)}s, falls ${s.falls}`); $('gPost').href = 'https://x.com/intent/post?text=' + encodeURIComponent(`SKY KITE 頂上まで ${Math.floor(s.t / 60)}分${Math.floor(s.t % 60)}秒 #SKYKITE`) + '&url=' + encodeURIComponent('https://tom3games.github.io/sky-kite/'); show('goal') }, 1200) }
      }
      acc -= DT; n++
    }
    if (n === 6) acc = 0
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').classList.remove('on') }
    hud(); tutUI(); soundTick(dt)
  }
  view.render(s, dt)
  requestAnimationFrame(frame)
}
async function boot() {
  try {
    view = await makeView(C, $('view'), { low: touch, keep: qs.has('keep'), progress: f => { $('ldFill').style.width = Math.round(f * 100) + '%' } })
  } catch (e) { $('ldTxt').textContent = 'このブラウザでは3Dを表示できませんでした'; throw e }
  bindCanvas(view.renderer.domElement)
  $('loading').hidden = true; $('title').hidden = false
  window.sky.view = view
  window.__skyReady = true
  last = performance.now(); requestAnimationFrame(frame)
}
boot()
window.sky = { C, newState: f => { tut = null; return newState(C, f) }, replay(rec, f) { s = newState(C, f); tut = null; auto = { ...rec, i: 0 } }, get s() { return s }, set s(v) { s = v }, inp, start, view: null, K }
