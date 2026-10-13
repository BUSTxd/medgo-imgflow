import pLimit from 'p-limit';
import { getCldImageUrl } from 'next-cloudinary';

import { deleteByToken, uploadFile, UPLOADS_FOLDER } from '@/lib/cloudinary';
import type { CloudinaryCredentials } from '@/lib/credentials';
import {
  basename,
  isConvertibleImage,
  isHtml,
  mimeFromPath,
  planRenames,
  rewriteHtml,
  type InputBundle,
  type VFile,
} from '@/lib/notion';
import { shrinkToTarget } from '@/lib/resize';
import { getFileBlob, withRetry } from '@/lib/util';

export type StageId = 'read' | 'analyze' | 'resize' | 'upload' | 'convert' | 'rewrite' | 'pack';

export const STAGES: Array<{ id: StageId; label: string; hint: string }> = [
  { id: 'read', label: 'Leer', hint: 'Descomprimiendo el export' },
  { id: 'analyze', label: 'Analizar', hint: 'Buscando HTML e imágenes' },
  { id: 'resize', label: 'Redimensionar', hint: 'Bajando peso al objetivo' },
  { id: 'upload', label: 'Subir', hint: 'Enviando a Cloudinary' },
  { id: 'convert', label: 'Convertir', hint: 'q_auto:low en Cloudinary' },
  { id: 'rewrite', label: 'Reescribir HTML', hint: 'Actualizando rutas' },
  { id: 'pack', label: 'Empaquetar', hint: 'Preparando la descarga' },
];

export const OUTPUT_FORMATS = ['avif', 'webp', 'jpg', 'jxl', 'png'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export interface Settings {
  format: OutputFormat;
  resize: boolean;
  targetKB: number;
}

export const DEFAULT_SETTINGS: Settings = { format: 'avif', resize: true, targetKB: 700 };

export type StageStatus = 'idle' | 'active' | 'done' | 'skipped' | 'error';

export interface StageState {
  status: StageStatus;
  done: number;
  total: number;
}

export type ImageStatus = 'queued' | 'resizing' | 'uploading' | 'converting' | 'done' | 'error';

export interface ImageItem {
  id: string;
  path: string;
  name: string;
  previewUrl: string;
  originalSize: number;
  resizedSize?: number;
  finalSize?: number;
  outputPath?: string;
  status: ImageStatus;
  error?: string;
}

export interface HtmlReport {
  path: string;
  count: number;
}

export interface PipelineResult {
  /** Archivos finales con su ruta; el ZIP se arma solo si se pide. */
  files: VFile[];
  /** Nombre del ZIP (el mismo del export original). */
  name: string;
  originalBytes: number;
  finalBytes: number;
  converted: number;
  failed: number;
  htmlReports: HtmlReport[];
  cleanupError?: string;
}

export type PipelineEvent =
  | { type: 'stage'; stage: StageId; state: StageState }
  | { type: 'images'; images: ImageItem[] }
  | { type: 'image'; id: string; patch: Partial<ImageItem> }
  | { type: 'result'; result: PipelineResult };

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') return 'Cloudinary rechazó la descarga (¿bloqueador de anuncios?)';
    return error.message;
  }
  return 'Error desconocido';
}

export async function runPipeline(
  getBundle: () => Promise<InputBundle>,
  settings: Settings,
  credentials: CloudinaryCredentials,
  emit: (event: PipelineEvent) => void
) {
  const stages = new Map<StageId, StageState>(
    STAGES.map(({ id }) => [id, { status: 'idle', done: 0, total: 0 }])
  );

  const setStage = (stage: StageId, patch: Partial<StageState>) => {
    const next = { ...stages.get(stage)!, ...patch };
    stages.set(stage, next);
    emit({ type: 'stage', stage, state: next });
  };

  const tick = (stage: StageId) => {
    const current = stages.get(stage)!;
    const done = current.done + 1;
    setStage(stage, { done, status: done >= current.total ? 'done' : 'active' });
  };

  const start = (stage: StageId) => {
    if (stages.get(stage)!.status === 'idle') setStage(stage, { status: 'active' });
  };

  // 1. Leer

  setStage('read', { status: 'active', total: 1 });
  const bundle = await getBundle();
  setStage('read', { status: 'done', done: 1 });

  // 2. Analizar

  setStage('analyze', { status: 'active', total: 1 });

  const htmlFiles = bundle.files.filter((file) => isHtml(file.path));
  const imageFiles = bundle.files.filter((file) => isConvertibleImage(file.path));

  if (imageFiles.length === 0 && htmlFiles.length === 0) {
    setStage('analyze', { status: 'error' });
    throw new Error('No encontré HTML ni imágenes en lo que soltaste.');
  }

  const images: ImageItem[] = imageFiles.map((file, index) => ({
    id: `${index}-${file.path}`,
    path: file.path,
    name: basename(file.path),
    previewUrl: URL.createObjectURL(file.data),
    originalSize: file.data.size,
    status: 'queued',
  }));

  emit({ type: 'images', images });
  setStage('analyze', { status: 'done', done: 1 });

  const total = images.length;

  if (total === 0) {
    (['resize', 'upload', 'convert'] as const).forEach((stage) => setStage(stage, { status: 'skipped' }));
  } else {
    if (settings.resize) setStage('resize', { total });
    else setStage('resize', { status: 'skipped' });
    setStage('upload', { total });
    setStage('convert', { total });
  }

  // 3-5. Redimensionar → Subir → Convertir (sin el límite de 20 de imgto)

  const resizeLimit = pLimit(3);
  const networkLimit = pLimit(10);
  const targetBytes = settings.targetKB * 1000;

  const converted = new Map<string, Blob>();
  let cleanupFailures = 0;

  await Promise.all(
    imageFiles.map(async (file, index) => {
      const image = images[index];
      const update = (patch: Partial<ImageItem>) => emit({ type: 'image', id: image.id, patch });
      const pending = new Set<StageId>(settings.resize ? ['resize', 'upload', 'convert'] : ['upload', 'convert']);
      const finish = (stage: StageId) => {
        pending.delete(stage);
        tick(stage);
      };

      try {
        let source = file.data;

        if (settings.resize) {
          source = await resizeLimit(async () => {
            start('resize');
            update({ status: 'resizing' });
            const resized = await shrinkToTarget(file.data, targetBytes, mimeFromPath(file.path));
            if (resized) update({ resizedSize: resized.blob.size });
            return resized?.blob ?? file.data;
          });
          finish('resize');
        }

        const output = await networkLimit(async () => {
          start('upload');
          update({ status: 'uploading' });
          const upload = await withRetry(() => uploadFile(source, image.name, credentials));
          finish('upload');

          start('convert');
          update({ status: 'converting' });

          try {
            // Misma transformación que imgto.xyz: f_<formato> + q_auto:low
            const url = getCldImageUrl(
              { src: upload.public_id, format: settings.format, quality: 'auto:low' },
              { cloud: { cloudName: credentials.cloudName } }
            );
            return await withRetry(() => getFileBlob(url));
          } finally {
            // Borra la copia temporal en Cloudinary para no gastar cuota.
            if (upload.delete_token) {
              await deleteByToken(credentials.cloudName, upload.delete_token).catch(() => cleanupFailures++);
            }
          }
        });

        converted.set(file.path, output);
        update({ status: 'done', finalSize: output.size });
        finish('convert');
      } catch (error) {
        update({ status: 'error', error: errorMessage(error) });
        pending.forEach((stage) => tick(stage));
      }
    })
  );

  // 6. Reescribir HTML

  setStage('rewrite', { status: 'active', total: htmlFiles.length });

  const allPaths = bundle.files.map((file) => file.path);
  const renames = planRenames([...converted.keys()], allPaths, settings.format);
  const rewritten = new Map<string, Blob>();
  const htmlReports: HtmlReport[] = [];

  for (const file of htmlFiles) {
    const text = await file.data.text();
    const { html, count } = rewriteHtml(text, file.path, renames);
    rewritten.set(file.path, new Blob([html], { type: 'text/html' }));
    htmlReports.push({ path: file.path, count });
    tick('rewrite');
  }

  if (htmlFiles.length === 0) setStage('rewrite', { status: 'skipped' });

  // 7. Empaquetar

  setStage('pack', { status: 'active', total: 1 });

  const outputFiles: VFile[] = bundle.files.map((file) => {
    const image = converted.get(file.path);
    if (image) return { path: renames.get(file.path)!, data: image };
    const html = rewritten.get(file.path);
    if (html) return { path: file.path, data: html };
    return file;
  });

  images.forEach((image) => {
    const outputPath = renames.get(image.path);
    if (outputPath) emit({ type: 'image', id: image.id, patch: { outputPath } });
  });

  setStage('pack', { status: 'done', done: 1 });

  const cleanupError =
    cleanupFailures > 0 ? `${cleanupFailures} ${cleanupFailures === 1 ? 'copia quedó' : 'copias quedaron'} en la carpeta ${UPLOADS_FOLDER}/` : undefined;

  const result: PipelineResult = {
    files: outputFiles,
    name: bundle.name,
    // Solo se comparan las imágenes que sí se convirtieron.
    originalBytes: images
      .filter((image) => converted.has(image.path))
      .reduce((sum, image) => sum + image.originalSize, 0),
    finalBytes: [...converted.values()].reduce((sum, data) => sum + data.size, 0),
    converted: converted.size,
    failed: images.length - converted.size,
    htmlReports,
    cleanupError,
  };

  emit({ type: 'result', result });

  return result;
}
