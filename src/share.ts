// Arma una imagen de una página del binder (3x3) para compartirla por WhatsApp,
// Instagram, etc. con el menú de compartir del teléfono.

import { type BinderColor, binderColor } from '@/lib/binderColors'

export interface ShareSlot {
  /** URL de la imagen de la carta, si tiene. */
  src?: string
  /** Nombre para mostrar si no hay imagen. */
  name?: string
  /** Casilleros que ocupa (fotos grandes). */
  cols?: number
  rows?: number
  /** Tapado por una foto grande de otro casillero: no se dibuja. */
  covered?: boolean
}

const W = 1080
const H = 1350
const PAD = 64
const GAP = 22
const CARD_RATIO = 88 / 63

/** Las imágenes de otros sitios pasan por nuestro servidor para poder dibujarlas. */
const proxied = (src: string) => (src.startsWith('/') ? src : `/api/share-image?url=${encodeURIComponent(src)}`)

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = proxied(src)
  })
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

/** Dibuja la página y devuelve un PNG. */
export async function renderPage(
  binderName: string,
  page: number,
  pageCount: number,
  slots: ShareSlot[],
  color: BinderColor = binderColor(),
): Promise<Blob> {
  const images = await Promise.all(slots.map((s) => (s.src ? loadImage(s.src) : Promise.resolve(null))))

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const font = (size: number, weight = 700) =>
    `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

  // Colores del skin elegido
  const css = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null
  const themed = (name: string, fallback: string) => css?.getPropertyValue(name).trim() || fallback

  // Fondo
  ctx.fillStyle = themed('--bg', '#1b1530')
  ctx.fillRect(0, 0, W, H)

  // Título
  ctx.fillStyle = themed('--text', '#f2eefc')
  ctx.font = font(56)
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(ellipsize(ctx, binderName, W - PAD * 2), PAD, PAD + 52)
  ctx.fillStyle = themed('--muted', '#a99fcc')
  ctx.font = font(32, 500)
  ctx.fillText(`Página ${page + 1} de ${pageCount}`, PAD, PAD + 100)

  // Hoja del binder: 3x3 con proporción de carta
  const top = PAD + 140
  const bottomSpace = 90
  const innerPad = 26
  const maxW = (W - PAD * 2 - innerPad * 2 - GAP * 2) / 3
  const maxH = (H - top - bottomSpace - innerPad * 2 - GAP * 2) / 3
  const cw = Math.min(maxW, maxH / CARD_RATIO)
  const ch = cw * CARD_RATIO
  const sheetW = cw * 3 + GAP * 2 + innerPad * 2
  const sheetH = ch * 3 + GAP * 2 + innerPad * 2
  const sx = (W - sheetW) / 2
  const sy = top

  const grad = ctx.createLinearGradient(sx, sy, sx + sheetW, sy + sheetH)
  grad.addColorStop(0, color.edge)
  grad.addColorStop(1, color.base)
  ctx.fillStyle = grad
  roundedRect(ctx, sx, sy, sheetW, sheetH, 28)
  ctx.fill()

  slots.forEach((slot, i) => {
    if (slot.covered) return
    const x = sx + innerPad + (i % 3) * (cw + GAP)
    const y = sy + innerPad + Math.floor(i / 3) * (ch + GAP)
    const cols = slot.cols ?? 1
    const rows = slot.rows ?? 1
    const img = images[i]
    drawSlot(slot, img, x, y, cw * cols + GAP * (cols - 1), ch * rows + GAP * (rows - 1))
  })

  function drawSlot(slot: ShareSlot, img: HTMLImageElement | null, x: number, y: number, cw: number, ch: number) {
    ctx.save()
    roundedRect(ctx, x, y, cw, ch, 14)
    if (img) {
      ctx.clip()
      // Recorta para llenar el casillero sin deformar
      const scale = Math.max(cw / img.width, ch / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, x + (cw - dw) / 2, y + (ch - dh) / 2, dw, dh)
    } else {
      ctx.fillStyle = color.pocket
      ctx.fill()
      ctx.strokeStyle = color.pocketBorder
      ctx.lineWidth = 2
      ctx.stroke()
      if (slot.name) {
        ctx.fillStyle = color.plus
        ctx.font = font(26, 600)
        ctx.textAlign = 'center'
        ctx.fillText(ellipsize(ctx, slot.name, cw - 20), x + cw / 2, y + ch / 2)
        ctx.textAlign = 'left'
      }
    }
    ctx.restore()
  }

  // Firma
  ctx.fillStyle = themed('--gold', '#f5c542')
  ctx.font = font(34, 800)
  ctx.textAlign = 'center'
  ctx.fillText('OhMyCard!!', W / 2, H - 44)

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'),
  )
}

/** Abre el menú de compartir del teléfono; si no hay, descarga la imagen. */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared'
      // Si falla el menú, se descarga igual
    }
  }
  downloadImage(blob, filename)
  return 'downloaded'
}

export function downloadImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
