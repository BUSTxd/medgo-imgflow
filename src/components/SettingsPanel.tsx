'use client';

import { Settings2 } from 'lucide-react';

import { OUTPUT_FORMATS, type Settings } from '@/lib/pipeline';
import { cn } from '@/lib/util';

interface SettingsPanelProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  disabled?: boolean;
}

export default function SettingsPanel({ settings, onChange, disabled = false }: SettingsPanelProps) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <aside className={cn('rounded-3xl border border-border bg-surface/80 p-6 backdrop-blur', disabled && 'opacity-60')}>
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
        <Settings2 className="size-4" /> Ajustes
      </h3>

      <fieldset disabled={disabled} className="mt-5 space-y-6">
        <div>
          <legend className="mb-2 text-sm font-medium">Formato de salida</legend>
          <div className="grid grid-cols-5 gap-1 rounded-xl border border-border bg-background/60 p-1">
            {OUTPUT_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => set({ format })}
                className={cn(
                  'rounded-lg py-1.5 font-mono text-xs uppercase transition',
                  settings.format === format ? 'bg-gradient-brand text-white shadow' : 'text-muted hover:text-foreground'
                )}
              >
                {format}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Cloudinary <span className="font-mono text-foreground">f_{settings.format}, q_auto:low</span> — la misma
            configuración de imgto.xyz.
          </p>
        </div>

        <div>
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Reducir por peso antes</span>
              <span className="block text-xs text-muted">Achica las imágenes que superan el objetivo.</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.resize}
              onClick={() => set({ resize: !settings.resize })}
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                settings.resize ? 'bg-accent' : 'bg-surface-2 border border-border'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
                  settings.resize ? 'left-[22px]' : 'left-0.5'
                )}
              />
            </button>
          </label>

          <div className={cn('mt-4 transition-opacity', !settings.resize && 'pointer-events-none opacity-40')}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Peso objetivo</span>
              <span className="font-mono">
                <input
                  type="number"
                  min={100}
                  max={5000}
                  step={50}
                  value={settings.targetKB}
                  onChange={(event) => set({ targetKB: Math.max(50, Number(event.target.value) || 0) })}
                  className="w-16 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-right"
                />{' '}
                KB
              </span>
            </div>
            <input
              type="range"
              min={200}
              max={1500}
              step={50}
              value={Math.min(1500, Math.max(200, settings.targetKB))}
              onChange={(event) => set({ targetKB: Number(event.target.value) })}
              className="mt-3 w-full accent-[var(--accent)]"
            />
          </div>
        </div>
      </fieldset>
    </aside>
  );
}
