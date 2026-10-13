import type { VFile } from '@/lib/notion';

/**
 * Guardar directo en una carpeta del disco (File System Access API).
 * Solo existe en Chrome y Edge; en el resto se usa el ZIP.
 */

type DirectoryPicker = (options?: { mode?: 'read' | 'readwrite'; startIn?: 'downloads' }) => Promise<FileSystemDirectoryHandle>;

export function canSaveToFolder() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function exists(parent: FileSystemDirectoryHandle, name: string) {
  try {
    await parent.getDirectoryHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pide una carpeta y escribe ahí una subcarpeta con todos los archivos y su
 * estructura. Si ya existe una con ese nombre (por ejemplo el export original)
 * se usa "<nombre>-avif" para no pisar los archivos originales.
 * Devuelve la ruta legible donde se guardó, o null si se canceló.
 */

export async function saveToFolder(
  files: VFile[],
  folderName: string,
  onProgress?: (done: number, total: number) => void
): Promise<string | null> {
  const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker;

  let root: FileSystemDirectoryHandle;
  try {
    // Siempre abre en Descargas (sin 'id', que haría recordar la última carpeta).
    root = await picker({ mode: 'readwrite', startIn: 'downloads' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }

  let name = folderName;
  for (let counter = 1; await exists(root, name); counter++) {
    name = counter === 1 ? `${folderName}-avif` : `${folderName}-avif-${counter}`;
  }

  const target = await root.getDirectoryHandle(name, { create: true });

  for (const [index, file] of files.entries()) {
    const parts = file.path.split('/');
    const filename = parts.pop()!;

    let dir = target;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });

    const handle = await dir.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file.data);
    await writable.close();

    onProgress?.(index + 1, files.length);
  }

  return `${root.name}/${name}`;
}
