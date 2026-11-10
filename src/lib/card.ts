import { group, overall, pct, points } from './stats'
import { Session } from './types'

/** Draws the shareable session card as a 1080x1350 PNG. */
export async function renderCard(s: Session, courtSvg: SVGSVGElement | null): Promise<Blob> {
  await document.fonts.ready
  const W = 1080, H = 1350, c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const GR = '#0A7F48', TX = '#0F2019', MU = '#566860'
  const disp = "'Alumni Sans Variable'", body = "'Gantari Variable'"
  await Promise.all([document.fonts.load(`800 100px ${disp}`), document.fonts.load(`600 30px ${body}`), document.fonts.load(`italic 900 100px ${disp}`)])
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H)
  g.strokeStyle = GR; g.lineWidth = 10; g.strokeRect(40, 40, W - 80, H - 80)
  g.fillStyle = GR; g.font = `italic 900 104px ${disp}`; g.fillText('NETRICS', 90, 160)
  g.fillStyle = MU; g.font = `600 34px ${body}`; g.textAlign = 'right'
  g.fillText(new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), W - 90, 150)
  g.textAlign = 'left'
  const o = overall(s.stats), t = group(s.stats, '3')
  g.fillStyle = GR; g.font = `800 330px ${disp}`; g.fillText(String(points(s.stats)), 86, 470)
  g.fillStyle = MU; g.font = `700 34px ${body}`; g.fillText('POINTS', 92, 530)
  g.fillStyle = TX; g.font = `800 130px ${disp}`
  g.fillText(`${o.m}/${o.a}`, 590, 300); g.fillText(`${pct(o)}%`, 590, 470)
  g.fillStyle = MU; g.font = `700 30px ${body}`; g.fillText('MAKES / ATTEMPTS', 594, 340); g.fillText('FIELD GOAL', 594, 510)
  if (courtSvg) {
    const svg = courtSvg.cloneNode(true) as SVGSVGElement
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); svg.setAttribute('width', '900'); svg.setAttribute('height', '540')
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
    await img.decode().then(() => g.drawImage(img, 90, 570, 900, 540)).catch(() => undefined)
  }
  g.fillStyle = TX; g.font = `700 42px ${body}`
  g.fillText(`3PT ${t.a ? pct(t) + '%' : '—'}  ·  ${s.stats.reb} REB  ·  ${s.stats.ast} AST`, 90, 1190)
  g.fillStyle = MU; g.font = `500 34px ${body}`; g.fillText(s.court || 'Pickup run', 90, 1250)
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not draw card'))), 'image/png'))
}

export async function shareOrSave(blob: Blob, name: string): Promise<'shared' | 'saved'> {
  const file = new File([blob], name, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return 'shared' }
    catch (e) { if ((e as Error).name === 'AbortError') return 'shared' }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  return 'saved'
}
