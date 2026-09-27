const maximumFileBytes = 15 * 1024 * 1024
const maximumImageBytes = 320 * 1024
const maximumImagePixels = 40_000_000

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No fue posible procesar esta imagen.'))
    }, type, quality)
  })
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No fue posible preparar esta imagen.'))
    reader.readAsDataURL(blob)
  })
}

export async function compressChatImage(file) {
  if (!file?.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen.')
  if (file.size > maximumFileBytes) throw new Error('La imagen original no puede superar los 15 MB.')

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
    if (bitmap.width * bitmap.height > maximumImagePixels) {
      throw new Error('La resolución de la imagen es demasiado alta.')
    }

    const canvas = document.createElement('canvas')
    let scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height))
    let blob

    for (let attempt = 0; attempt < 7; attempt += 1) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d', { alpha: false })
      if (!context) throw new Error('No fue posible procesar esta imagen.')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      blob = await canvasToBlob(canvas, 'image/webp', Math.max(0.5, 0.78 - attempt * 0.04))
      if (blob.type === 'image/webp' && blob.size <= maximumImageBytes) break
      if (blob.size <= maximumImageBytes) break
      scale *= 0.82
    }

    if (!blob || blob.size > maximumImageBytes) {
      throw new Error('La imagen sigue siendo demasiado pesada después de comprimirla.')
    }
    return await readAsDataUrl(blob)
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error('No fue posible abrir esta imagen.')
  } finally {
    bitmap?.close()
  }
}