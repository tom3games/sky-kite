import { COURSE as C } from './course.js?v=2'
import { newState, step, respawn, DT, K, angDiff } from './sim.js?v=2'
import { makeView } from './view.js?v=2'
import { makeTutorial } from './tutorial.js?v=2'

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
const WHY = { ja: { nowind: '岩の下では凧が揚がらない。外へ歩く', stall: '風が切れた', low: '凧が落ちた', rock: '糸が岩に掛かった', mill: '糸が風車に巻き込まれた', post: '糸が引っかかった', thunder: '雷が落ちた', tree: '糸が木に掛かった', bell: '糸が鐘楼に掛かった' },
  en: { nowind: 'No room to launch here. Walk out', stall: 'The wind died', low: 'Kite fell', rock: 'Line caught on rock', mill: 'Line caught in the windmill', post: 'Line snagged', thunder: 'Lightning!', tree: 'Line caught in a tree', bell: 'Line caught on the belfry' } }

const view = makeView(C, $('view'))
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
const cv = view.renderer.domElement
cv.addEventListener('contextmenu', e => e.preventDefault())
if (!touch) {
  cv.addEventListener('mousedown', e => { if (e.button === 0 || e.button === 2) mDown = true })
  addEventListener('mouseup', () => { mDown = false })
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
function start() {
  mode = 'play'; show('play'); last = performance.now()
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
        if (e.startsWith('down:')) msg(WHY[lang][e.slice(5)] || '')
        if (e === 'flag') { const sc = C.sections[C.flags[s.flag].sec]; msg(sc ? (lang === 'ja' ? sc.how : sc.howEn || sc.how) : '', 5); save() }
        if (e === 'goal') { setTimeout(() => { mode = 'goal'; $('goalTxt').textContent = (lang === 'ja' ? `試作はここまで。${Math.floor(s.t / 60)}分${Math.floor(s.t % 60)}秒・落ちた回数 ${s.falls}` : `${Math.floor(s.t / 60)}m ${Math.floor(s.t % 60)}s, falls ${s.falls}`); $('gPost').href = 'https://x.com/intent/post?text=' + encodeURIComponent(`SKY KITE 頂上まで ${Math.floor(s.t / 60)}分${Math.floor(s.t % 60)}秒 #SKYKITE`) + '&url=' + encodeURIComponent('https://tom3games.github.io/sky-kite/'); show('goal') }, 1200) }
      }
      acc -= DT; n++
    }
    if (n === 6) acc = 0
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').classList.remove('on') }
    hud(); tutUI()
  }
  view.render(s, dt)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
window.sky = { C, newState: f => newState(C, f), replay(rec, f) { s = newState(C, f); tut = null; auto = { ...rec, i: 0 } }, get s() { return s }, set s(v) { s = v }, inp, start, view, K }
window.__skyReady = true
