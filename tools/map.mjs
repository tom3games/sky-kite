import '../mute-auto.mjs'
// 2D の地図: 岩・風の矢印・旗・（あれば）記録の軌跡。 node tools/map.mjs <y0> <y1> [rec の旗] [t秒]
import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import { COURSE as C } from '../js/course.js'
import { wind, newState, step } from '../js/sim.js'
const [y0 = 0, y1 = 80, recF, T = 0] = process.argv.slice(2).map(Number)
const S = 9, X0 = -46, W = 92 * S, H = (y1 - y0) * S
const tx = x => (x - X0) * S, ty = y => (y1 - y) * S
const arrows = []
for (let x = -44; x <= 44; x += 2.5) for (let y = y0; y <= y1; y += 2.5) { const w = wind(C, x, y, T); arrows.push([tx(x), ty(y), w[0], w[1]]) }
let path = []
if (recF != null && existsSync(import.meta.dirname + `/rec_${recF}.json`)) {
  const rec = JSON.parse(readFileSync(import.meta.dirname + `/rec_${recF}.json`)), s = newState(C, recF)
  for (let i = 0; i < rec.acts.length * rec.hold; i++) { const a = rec.acts[Math.floor(i / rec.hold)]; step(C, s, { steer: a.steer, reel: a.reel }); if (i % 6 === 0) path.push([tx(s.x), ty(s.y), s.kite === 'flying' ? 1 : 0]) }
}
const boxes = C.solids.map(b => [tx(b.x0), ty(b.y1), (b.x1 - b.x0) * S, (b.y1 - b.y0) * S])
const zones = C.zones.map(z => [z.type, tx(z.x0), ty(z.y1), (z.x1 - z.x0) * S, (z.y1 - z.y0) * S])
const flags = C.flags.map(f => [tx(f.x), ty(f.y)])
const html = `<canvas id=c width=${W} height=${H}></canvas><script>
const g=c.getContext('2d');g.fillStyle='#223';g.fillRect(0,0,${W},${H})
for(const [t,x,y,w,h] of ${JSON.stringify(zones)}){g.fillStyle=t==='up'?'rgba(255,160,60,.18)':t==='calm'?'rgba(0,0,0,.35)':'rgba(120,200,255,.12)';g.fillRect(x,y,w,h)}
g.fillStyle='#888';for(const [x,y,w,h] of ${JSON.stringify(boxes)})g.fillRect(x,y,w,h)
g.strokeStyle='rgba(180,220,255,.7)';for(const [x,y,wx,wy] of ${JSON.stringify(arrows)}){const k=0.9;g.beginPath();g.moveTo(x,y);g.lineTo(x+wx*k*${S/9},y-wy*k*${S/9});g.stroke();g.fillStyle='#bde';g.fillRect(x-1,y-1,2,2)}
g.fillStyle='#fd4';for(const [x,y] of ${JSON.stringify(flags)}){g.fillRect(x-3,y-14,6,14)}
for(const [x,y,f] of ${JSON.stringify(path)}){g.fillStyle=f?'#f55':'#5f5';g.fillRect(x-1.5,y-1.5,3,3)}
g.fillStyle='#fff';g.font='12px sans-serif';for(let y=${Math.ceil(y0 / 10) * 10};y<=${y1};y+=10)g.fillText(y+'m',2,${y1 * S}-y*${S}+4)
</script>`
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } })
await p.setContent(html); await p.screenshot({ path: `shots/map_${y0}_${y1}.png` }); await b.close()
console.log(`shots/map_${y0}_${y1}.png`)
