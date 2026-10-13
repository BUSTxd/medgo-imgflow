import JSZip from 'jszip';

export interface VFile {
  path: string;
  data: Blob;
}

export interface InputBundle {
  name: string;
  files: VFile[];
}

const CONVERTIBLE = /\.(png|jpe?g|webp)$/i;
const HTML = /\.html?$/i;

export const isConvertibleImage = (path: string) => CONVERTIBLE.test(path);
export const isHtml = (path: string) => HTML.test(path);

export function basename(path: string) {
  return path.split('/').pop() || path;
}

function dirname(path: string) {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function normalize(path: string) {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

export function extname(path: string) {
  const match = /\.([^./]+)$/.exec(path);
  return match ? match[1].toLowerCase() : '';
}

export function replaceExt(path: string, ext: string) {
  return path.replace(/\.[^./]+$/, `.${ext}`);
}

export function mimeFromPath(path: string) {
  const ext = extname(path);
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

/**
 * Lectura de ZIP. Notion a veces envuelve el export en otro ZIP
 * (Export-xxx.zip → Export-xxx-Part-1.zip): los ZIP internos se expanden
 * en su misma carpeta.
 */

async function readZip(blob: Blob, prefix = ''): Promise<VFile[]> {
  const zip = await JSZip.loadAsync(blob);
  const files: VFile[] = [];

  for (const entry of Object.values(zip.files)) {
    if (entry.dir || entry.name.startsWith('__MACOSX/')) continue;

    const data = await entry.async('blob');
    const path = prefix + entry.name;

    if (/\.zip$/i.test(entry.name)) {
      const dir = dirname(path);
      files.push(...(await readZip(data, dir ? `${dir}/` : '')));
    } else {
      files.push({ path, data });
    }
  }

  return files;
}

/**
 * Lectura de carpetas arrastradas (webkitGetAsEntry).
 */

function readEntry(entry: FileSystemEntry, path: string): Promise<VFile[]> {
  if (entry.isFile) {
    return new Promise((resolve, reject) =>
      (entry as FileSystemFileEntry).file((file) => resolve([{ path, data: file }]), reject)
    );
  }

  const reader = (entry as FileSystemDirectoryEntry).createReader();

  return new Promise((resolve, reject) => {
    const entries: FileSystemEntry[] = [];
    // readEntries devuelve en lotes de ~100: hay que llamar hasta que venga vacío.
    const readBatch = () =>
      reader.readEntries(async (batch) => {
        if (batch.length > 0) {
          entries.push(...batch);
          readBatch();
          return;
        }
        const nested = await Promise.all(entries.map((child) => readEntry(child, `${path}/${child.name}`)));
        resolve(nested.flat());
      }, reject);
    readBatch();
  });
}

/**
 * Normaliza lo que el usuario soltó (ZIP, carpeta o archivos sueltos)
 * en una lista de archivos con rutas relativas.
 */

export async function bundleFromFiles(files: File[]): Promise<InputBundle> {
  if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
    return { name: files[0].name, files: await readZip(files[0]) };
  }

  // <input webkitdirectory> da webkitRelativePath = "Carpeta/sub/archivo.png"
  const relative = files.map((file) => ({ path: file.webkitRelativePath || file.name, data: file as Blob }));
  return bundleFromRelative(relative);
}

export async function bundleFromDataTransfer(dataTransfer: DataTransfer): Promise<InputBundle> {
  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => !!entry);

  if (entries.length === 0) return bundleFromFiles(Array.from(dataTransfer.files));

  if (entries.length === 1 && entries[0].isFile && /\.zip$/i.test(entries[0].name)) {
    return bundleFromFiles(Array.from(dataTransfer.files));
  }

  const nested = await Promise.all(entries.map((entry) => readEntry(entry, entry.name)));
  return bundleFromRelative(nested.flat());
}

async function bundleFromRelative(files: VFile[]): Promise<InputBundle> {
  // Si todo vive dentro de una única carpeta raíz, esa carpeta da el nombre del ZIP
  // y su contenido queda en la raíz (igual que un export de Notion descomprimido).
  const roots = new Set(files.map((file) => file.path.split('/')[0]));
  const single = roots.size === 1 && files.every((file) => file.path.includes('/'));

  if (single) {
    const root = [...roots][0];
    return {
      name: `${root}.zip`,
      files: files.map((file) => ({ ...file, path: file.path.slice(root.length + 1) })),
    };
  }

  const expanded: VFile[] = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.path)) expanded.push(...(await readZip(file.data, dirname(file.path) ? `${dirname(file.path)}/` : '')));
    else expanded.push(file);
  }

  return { name: 'notion-export.zip', files: expanded };
}

/**
 * Calcula la ruta de salida de cada imagen convertida evitando choques
 * (foo.png y foo.jpg en la misma carpeta → foo.avif y foo-2.avif).
 */

export function planRenames(paths: string[], allPaths: string[], ext: string) {
  const taken = new Set(allPaths.filter((path) => !paths.includes(path)).map((path) => path.toLowerCase()));
  const renames = new Map<string, string>();

  for (const path of paths) {
    let next = replaceExt(path, ext);
    let counter = 2;
    while (taken.has(next.toLowerCase())) {
      next = replaceExt(path, ext).replace(/(\.[^./]+)$/, `-${counter++}$1`);
    }
    taken.add(next.toLowerCase());
    renames.set(path, next);
  }

  return renames;
}

/**
 * Reescribe src/href del HTML que apunten a imágenes renombradas. Solo cambia
 * el nombre del archivo dentro del atributo, conservando su codificación
 * (%20, etc.), así el resto del HTML queda byte a byte igual.
 */

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function rewriteHtml(html: string, htmlPath: string, renames: Map<string, string>) {
  const baseDir = dirname(htmlPath);
  let count = 0;

  const result = html.replace(
    /(\s(?:src|href)\s*=\s*)(["'])([^"']*)\2/gi,
    (match, attr: string, quote: string, value: string) => {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return match;

      const [, rawPath, suffix] = /^([^?#]*)(.*)$/.exec(value) || [];
      if (!rawPath) return match;

      const resolved = normalize(baseDir ? `${baseDir}/${safeDecode(rawPath)}` : safeDecode(rawPath));
      const renamed = renames.get(resolved);
      if (!renamed) return match;

      const oldName = basename(rawPath);
      const newName = basename(renamed);
      const encodedNewName = oldName === safeDecode(oldName) ? newName : encodeURIComponent(newName);
      const nextPath = rawPath.slice(0, rawPath.length - oldName.length) + encodedNewName;

      count++;
      return `${attr}${quote}${nextPath}${suffix}${quote}`;
    }
  );

  return { html: result, count };
}

export async function zipFiles(files: VFile[]) {
  const zip = new JSZip();
  for (const file of files) zip.file(file.path, file.data);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
