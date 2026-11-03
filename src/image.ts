// Reduce la foto antes de guardarla: las fotos del celular pesan varios MB.
// Lado más largo: alcanza para una foto que ocupe 2x2 casilleros.
const MAX_SIDE = 1400

export async function prepareCardImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85),
  )
}

/**
 * Parte una foto en `cols` x `rows` cartas: primero la recorta al tamaño del bloque
 * (sin deformarla) y después devuelve un pedazo por casillero, de izquierda a derecha
 * y de arriba a abajo.
 */
export async function splitCardImage(file: File, cols: number, rows: number): Promise<Blob[]> {
  if (cols === 1 && rows === 1) return [await prepareCardImage(file)]
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const blockRatio = (cols * 63) / (rows * 88)
  // Recorte centrado con la proporción del bloque
  let sw = bitmap.width
  let sh = sw / blockRatio
  if (sh > bitmap.height) {
    sh = bitmap.height
    sw = sh * blockRatio
  }
  const sx = (bitmap.width - sw) / 2
  const sy = (bitmap.height - sh) / 2
  const pieceH = Math.min(1000, Math.round(sh / rows))
  const pieceW = Math.round((pieceH * 63) / 88)
  const blobs: Blob[] = []
  try {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const canvas = document.createElement('canvas')
        canvas.width = pieceW
        canvas.height = pieceH
        canvas
          .getContext('2d')!
          .drawImage(bitmap, sx + (c * sw) / cols, sy + (r * sh) / rows, sw / cols, sh / rows, 0, 0, pieceW, pieceH)
        blobs.push(
          await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85),
          ),
        )
      }
    }
  } finally {
    bitmap.close()
  }
  return blobs
}
