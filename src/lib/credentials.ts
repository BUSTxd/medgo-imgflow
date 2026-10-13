'use client';

import { useSyncExternalStore } from 'react';

/**
 * Credenciales de Cloudinary de quien usa la web. Viven solo en su navegador
 * (localStorage si marca "recordar", si no sessionStorage): nunca se envían a
 * ningún servidor nuestro, porque no hay servidor.
 */

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

const KEY = 'medgo-imgflow:cloudinary';
const listeners = new Set<() => void>();

let cached: CloudinaryCredentials | null | undefined;

function read(): CloudinaryCredentials | null {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const stored = storage.getItem(KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.cloudName && parsed?.apiKey && parsed?.apiSecret) return parsed;
      }
    } catch {}
  }
  return null;
}

function getSnapshot() {
  if (cached === undefined) cached = read();
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  cached = read();
  listeners.forEach((listener) => listener());
}

export function saveCredentials(credentials: CloudinaryCredentials, remember: boolean) {
  clearCredentials(false);
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(credentials));
  } catch {}
  emit();
}

export function clearCredentials(notify = true) {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {}
  if (notify) emit();
}

/** null = sin credenciales; undefined = todavía en el servidor (antes de hidratar). */
export function useCredentials() {
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}
