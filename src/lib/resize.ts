/**
 * Reducción por peso: replica el paso manual de bajar cada imagen a ~700 KB
 * antes de convertirla. Se busca la escala más grande (manteniendo proporción)
 * cuyo archivo re-codificado en el mismo formato quede por debajo del objetivo.
 */

const MAX_ITERATIONS = 7;

function encode(bitmap: ImageBitmap, scale: number, type: string): Promise<Blob> {
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo codificar la imagen'))), type, 0.92)
  );
}

export interface ResizeResult {
  blob: Blob;
  width: number;
  height: number;
  scale: number;
}

export async function shrinkToTarget(source: Blob, targetBytes: number, type: string): Promise<ResizeResult | null> {
  if (source.size <= targetBytes) return null;

  const bitmap = await createImageBitmap(source);

  try {
    let lo = 0;
    let hi = 1;
    // El tamaño crece ~ con el área: sqrt da un primer intento muy cercano.
    let scale = Math.min(0.99, Math.sqrt(targetBytes / source.size));
    let best: { blob: Blob; scale: number } | null = null;
    let smallest: { blob: Blob; scale: number } | null = null;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const blob = await encode(bitmap, scale, type);

      if (!smallest || blob.size < smallest.blob.size) smallest = { blob, scale };

      if (blob.size <= targetBytes) {
        if (!best || scale > best.scale) best = { blob, scale };
        lo = scale;
        // Ya está a menos de 5% del objetivo: suficiente.
        if (blob.size >= targetBytes * 0.95) break;
      } else {
        hi = scale;
      }

      scale = (lo + hi) / 2;
    }

    const chosen = best || smallest!;

    return {
      blob: chosen.blob,
      scale: chosen.scale,
      width: Math.round(bitmap.width * chosen.scale),
      height: Math.round(bitmap.height * chosen.scale),
    };
  } finally {
    bitmap.close();
  }
}
