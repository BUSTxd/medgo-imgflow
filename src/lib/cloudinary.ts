/**
 * Basado en src/lib/cloudinary.ts de imgto.xyz (cloudinary-community, MIT).
 * Subida firmada directa del navegador a Cloudinary: las imágenes nunca pasan
 * por nuestro servidor, solo la firma.
 */

export const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
export const API_KEY = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
export const UPLOADS_FOLDER = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOADS_FOLDER || 'medgo-imgflow';

export const isCloudinaryConfigured = Boolean(CLOUD_NAME && API_KEY);

export interface CloudinaryUpload {
  public_id: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
}

/**
 * uploadFile
 */

export async function uploadFile(file: Blob, filename: string): Promise<CloudinaryUpload> {
  const timestamp = Math.round(Date.now() / 1000);

  const { signature, error: signError } = await fetch('/api/sign', {
    method: 'POST',
    body: JSON.stringify({ folder: UPLOADS_FOLDER, timestamp }),
  }).then((r) => r.json());

  if (!signature) throw new Error(signError || 'No se pudo firmar la subida');

  const formData = new FormData();
  formData.append('file', file, filename);
  formData.append('folder', UPLOADS_FOLDER);
  formData.append('api_key', String(API_KEY));
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: null }));
    throw new Error(error?.message || 'Error desconocido al subir');
  }

  return response.json();
}

/**
 * deleteUploads
 */

export async function deleteUploads(publicIds: string[]) {
  if (publicIds.length === 0) return;
  const response = await fetch('/api/cleanup', {
    method: 'POST',
    body: JSON.stringify({ publicIds }),
  });
  if (!response.ok) throw new Error('No se pudieron borrar las imágenes temporales de Cloudinary');
}
