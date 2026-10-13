/**
 * Basado en src/lib/cloudinary.ts de imgto.xyz (cloudinary-community, MIT).
 *
 * La web es estática (GitHub Pages), así que la firma de cada subida se calcula
 * en el navegador con la API secret de quien la usa, y las copias temporales se
 * borran con el delete_token que devuelve Cloudinary (válido 10 minutos).
 */

import type { CloudinaryCredentials } from '@/lib/credentials';

export const UPLOADS_FOLDER = 'medgo-imgflow';

export interface CloudinaryUpload {
  public_id: string;
  delete_token?: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
}

/**
 * Firma de Cloudinary: sha1("clave=valor&..." ordenado + api_secret).
 * https://cloudinary.com/documentation/authentication_signatures
 */

async function sign(params: Record<string, string>, secret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(payload + secret));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * uploadFile
 */

export async function uploadFile(file: Blob, filename: string, credentials: CloudinaryCredentials): Promise<CloudinaryUpload> {
  const params = {
    folder: UPLOADS_FOLDER,
    return_delete_token: 'true',
    timestamp: String(Math.round(Date.now() / 1000)),
  };

  const formData = new FormData();
  formData.append('file', file, filename);
  Object.entries(params).forEach(([key, value]) => formData.append(key, value));
  formData.append('api_key', credentials.apiKey);
  formData.append('signature', await sign(params, credentials.apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(credentials.cloudName)}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const { error } = await response.json().catch(() => ({ error: null }));
    throw new Error(error?.message || `Cloudinary respondió ${response.status}`);
  }

  return response.json();
}

/**
 * deleteByToken
 */

export async function deleteByToken(cloudName: string, token: string) {
  const formData = new FormData();
  formData.append('token', token);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/delete_by_token`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('No se pudo borrar la copia temporal en Cloudinary');
}

/**
 * testCredentials: sube una imagen mínima y la borra. Si algo de las
 * credenciales está mal, Cloudinary lo dice aquí y no a mitad del proceso.
 */

export async function testCredentials(credentials: CloudinaryCredentials) {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(0, 0, 100, 100);
  }

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Canvas no disponible'))), 'image/png')
  );

  let upload: CloudinaryUpload;

  try {
    upload = await uploadFile(blob, 'medgo-imgflow-test.png', credentials);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/api_key|api key/i.test(message)) throw new Error('La API key no es válida.');
    if (/signature/i.test(message)) throw new Error('La API secret no es correcta.');
    if (/cloud_name|cloud name|404/i.test(message)) throw new Error('El cloud name no existe.');
    throw new Error(message || 'No se pudo conectar con Cloudinary.');
  }

  if (upload.delete_token) await deleteByToken(credentials.cloudName, upload.delete_token).catch(() => {});
}
