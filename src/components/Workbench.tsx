'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { toast } from 'sonner';
import { AlertTriangle, RotateCcw, Settings2 } from 'lucide-react';

import CredentialsDialog from '@/components/CredentialsDialog';
import Dropzone from '@/components/Dropzone';
import ImageGrid from '@/components/ImageGrid';
import PipelineFlow from '@/components/PipelineFlow';
import ResultPanel from '@/components/ResultPanel';
import SettingsPanel from '@/components/SettingsPanel';
import { useCredentials } from '@/lib/credentials';
import type { InputBundle } from '@/lib/notion';
import {
  DEFAULT_SETTINGS,
  STAGES,
  runPipeline,
  type ImageItem,
  type PipelineEvent,
  type PipelineResult,
  type Settings,
  type StageId,
  type StageState,
} from '@/lib/pipeline';
import { formatBytes } from '@/lib/util';

const SETTINGS_KEY = 'medgo-imgflow:settings';

type Phase = 'idle' | 'running' | 'done' | 'error';

interface State {
  phase: Phase;
  format: string;
  stages: Record<StageId, StageState>;
  images: ImageItem[];
  result?: PipelineResult;
  error?: string;
}

type Action =
  | { type: 'start'; format: string }
  | { type: 'event'; event: PipelineEvent }
  | { type: 'fail'; message: string }
  | { type: 'reset' };

const initialStages = () =>
  Object.fromEntries(STAGES.map(({ id }) => [id, { status: 'idle', done: 0, total: 0 }])) as Record<StageId, StageState>;

const initialState: State = { phase: 'idle', format: DEFAULT_SETTINGS.format, stages: initialStages(), images: [] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return { ...initialState, stages: initialStages(), phase: 'running', format: action.format };
    case 'fail':
      return { ...state, phase: 'error', error: action.message };
    case 'reset':
      return { ...initialState, stages: initialStages() };
    case 'event': {
      const { event } = action;
      if (event.type === 'stage') return { ...state, stages: { ...state.stages, [event.stage]: event.state } };
      if (event.type === 'images') return { ...state, images: event.images };
      if (event.type === 'image') {
        return {
          ...state,
          images: state.images.map((image) => (image.id === event.id ? { ...image, ...event.patch } : image)),
        };
      }
      return { ...state, phase: 'done', result: event.result };
    }
  }
}

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export default function Workbench() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const credentials = useCredentials();
  const [editingCredentials, setEditingCredentials] = useState(false);
  const imagesRef = useRef<ImageItem[]>([]);

  // localStorage solo existe en el navegador: se lee después de hidratar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    imagesRef.current = state.images;
  }, [state.images]);

  function updateSettings(next: Settings) {
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {}
  }

  function releasePreviews() {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  }

  async function handleBundle(getBundle: () => Promise<InputBundle>) {
    if (!credentials) {
      setEditingCredentials(true);
      return;
    }

    releasePreviews();
    dispatch({ type: 'start', format: settings.format });

    try {
      const result = await runPipeline(getBundle, settings, credentials, (event) => dispatch({ type: 'event', event }));
      toast.success(`Listo: ${result.converted} imágenes en ${settings.format.toUpperCase()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Algo salió mal';
      dispatch({ type: 'fail', message });
      toast.error(message);
    }
  }

  function reset() {
    releasePreviews();
    dispatch({ type: 'reset' });
  }

  const finished = state.images.filter((image) => image.status === 'done');
  const liveOriginal = finished.reduce((sum, image) => sum + image.originalSize, 0);
  const liveFinal = finished.reduce((sum, image) => sum + (image.finalSize ?? 0), 0);

  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 sm:px-6">
        <Header
          cloudName={credentials === undefined ? undefined : (credentials?.cloudName ?? null)}
          onEditCredentials={() => setEditingCredentials(true)}
        />

        {/* Sin credenciales el diálogo es obligatorio (no se puede cerrar). */}
        <AnimatePresence>
          {(credentials === null || editingCredentials) && state.phase !== 'running' && (
            <CredentialsDialog
              key="credentials"
              current={credentials ?? null}
              onClose={credentials ? () => setEditingCredentials(false) : undefined}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {state.phase === 'idle' ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              className="grid gap-6 lg:grid-cols-[1fr_320px]"
            >
              <Dropzone onBundle={handleBundle} />
              <SettingsPanel settings={settings} onChange={updateSettings} />
            </motion.div>
          ) : (
            <motion.div
              key="work"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <PipelineFlow stages={state.stages} />

              <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
                <ImageGrid images={state.images} format={state.format} />

                <div className="lg:sticky lg:top-6">
                  {state.phase === 'done' && state.result && <ResultPanel result={state.result} onReset={reset} />}

                  {state.phase === 'running' && (
                    <aside className="space-y-4 rounded-3xl border border-border bg-surface/80 p-6 backdrop-blur">
                      <p className="text-sm text-muted">Procesando</p>
                      <p className="text-4xl font-bold">
                        {finished.length}
                        <span className="text-muted">/{state.images.length || '…'}</span>
                      </p>
                      {liveOriginal > 0 && (
                        <p className="font-mono text-sm text-muted">
                          {formatBytes(liveOriginal)} → <span className="text-success">{formatBytes(liveFinal)}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted">No cierres esta pestaña: todo ocurre en tu navegador.</p>
                    </aside>
                  )}

                  {state.phase === 'error' && (
                    <aside className="space-y-4 rounded-3xl border border-danger/40 bg-danger/10 p-6">
                      <p className="flex items-center gap-2 font-medium text-danger">
                        <AlertTriangle className="size-5" /> No se pudo completar
                      </p>
                      <p className="text-sm">{state.error}</p>
                      <button
                        type="button"
                        onClick={reset}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm transition hover:border-accent/60"
                      >
                        <RotateCcw className="size-4" /> Intentar de nuevo
                      </button>
                    </aside>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}

function Header({ cloudName, onEditCredentials }: { cloudName?: string | null; onEditCredentials: () => void }) {
  return (
    <header className="py-10 sm:py-14">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-brand grid size-9 place-items-center rounded-xl font-bold text-white shadow-lg shadow-accent/30">
            M
          </div>
          <span className="font-semibold tracking-tight">
            MedGO <span className="text-muted">ImgFlow</span>
          </span>
        </div>
        {cloudName !== undefined && (
          <button
            type="button"
            onClick={onEditCredentials}
            title="Cambiar credenciales"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition hover:bg-surface-2 ${
              cloudName ? 'border-success/30 text-success' : 'border-amber-500/30 text-amber-300'
            }`}
          >
            <span className={`size-1.5 rounded-full ${cloudName ? 'bg-success' : 'bg-amber-400'}`} />
            {cloudName ? `Cloudinary · ${cloudName}` : 'Conectar Cloudinary'}
            <Settings2 className="size-3.5 opacity-70" />
          </button>
        )}
      </div>

      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
        De Notion a la web, <span className="text-gradient">en un solo arrastre.</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Suelta el export HTML: reduzco el peso, convierto todas las imágenes a AVIF con la misma configuración de
        imgto.xyz y te devuelvo el ZIP con los mismos nombres y el HTML ya actualizado.
      </p>
    </header>
  );
}
