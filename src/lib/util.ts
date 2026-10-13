export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/**
 * formatBytes
 */

export function formatBytes(bytes: number, fixed = 0) {
  if (bytes >= 1000 * 1000) return `${(bytes / 1000 / 1000).toFixed(2)} MB`;
  return `${(bytes / 1000).toFixed(fixed)} KB`;
}

/**
 * getFileBlob
 * @via imgto.xyz
 */

export async function getFileBlob(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('UNAUTHORIZED');
    }
    throw new Error('UNKNOWN_ERROR');
  }

  return response.blob();
}

/**
 * downloadBlob
 */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * withRetry
 */

export async function withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, 800));
    return withRetry(fn, retries - 1);
  }
}
