'use client';

import { Fragment } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  CloudUpload,
  FileArchive,
  FileCode2,
  PackageCheck,
  Scaling,
  ScanSearch,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';

import { STAGES, type StageId, type StageState } from '@/lib/pipeline';
import { cn } from '@/lib/util';

const ICONS: Record<StageId, LucideIcon> = {
  read: FileArchive,
  analyze: ScanSearch,
  resize: Scaling,
  upload: CloudUpload,
  convert: Sparkles,
  rewrite: FileCode2,
  pack: PackageCheck,
};

function stageProgress(state: StageState) {
  if (state.status === 'done' || state.status === 'skipped') return 1;
  if (state.total === 0) return 0;
  return state.done / state.total;
}

interface PipelineFlowProps {
  stages: Record<StageId, StageState>;
}

export default function PipelineFlow({ stages }: PipelineFlowProps) {
  const active = STAGES.filter(({ id }) => stages[id].status === 'active');
  const current = active[active.length - 1];
  const overall = STAGES.reduce((sum, { id }) => sum + stageProgress(stages[id]), 0) / STAGES.length;

  return (
    <section className="rounded-3xl border border-border bg-surface/80 p-6 backdrop-blur sm:p-8">
      <div className="flex flex-col md:flex-row md:items-start">
        {STAGES.map((stage, index) => {
          const state = stages[stage.id];
          const next = STAGES[index + 1];
          return (
            <Fragment key={stage.id}>
              <Node id={stage.id} label={stage.label} state={state} />
              {next && <Connector from={state} to={stages[next.id]} />}
            </Fragment>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div
            className="bg-gradient-brand h-full rounded-full"
            initial={false}
            animate={{ width: `${Math.round(overall * 100)}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <AnimatePresence mode="wait">
            <motion.p
              key={current?.id ?? (overall === 1 ? 'done' : 'idle')}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-muted"
            >
              {current
                ? `${current.hint}…`
                : overall === 1
                  ? 'Todo listo ✨'
                  : 'Preparando…'}
            </motion.p>
          </AnimatePresence>
          <span className="font-mono text-foreground">{Math.round(overall * 100)}%</span>
        </div>
      </div>
    </section>
  );
}

function Node({ id, label, state }: { id: StageId; label: string; state: StageState }) {
  const Icon = ICONS[id];
  const { status } = state;
  const showCounter = state.total > 1 && (status === 'active' || status === 'done');

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-4 md:w-24 md:flex-col md:gap-3 md:text-center',
        status === 'skipped' && 'opacity-40'
      )}
    >
      <div className="relative grid size-14 place-items-center">
        {status === 'active' && (
          <>
            <span className="bg-glow animate-spin-slow absolute inset-0 rounded-2xl [mask:linear-gradient(#000_0_0)_content-box_exclude,linear-gradient(#000_0_0)] p-[2px]" />
            <motion.span
              className="absolute inset-0 rounded-2xl bg-accent/30"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            />
          </>
        )}
        <motion.div
          initial={false}
          animate={{ scale: status === 'active' ? 1.06 : 1 }}
          className={cn(
            'relative grid size-[52px] place-items-center rounded-2xl border transition-colors duration-500',
            status === 'idle' && 'border-border bg-surface-2 text-muted',
            status === 'active' && 'border-transparent bg-surface-2 text-white',
            status === 'done' && 'border-success/40 bg-success/15 text-success',
            status === 'skipped' && 'border-dashed border-border bg-transparent text-muted',
            status === 'error' && 'border-danger/50 bg-danger/15 text-danger'
          )}
        >
          <Icon className="size-6" strokeWidth={1.75} />
          <AnimatePresence>
            {(status === 'done' || status === 'error') && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className={cn(
                  'absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full text-background',
                  status === 'done' ? 'bg-success' : 'bg-danger'
                )}
              >
                {status === 'done' ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <div>
        <p className={cn('text-sm font-medium', status === 'idle' ? 'text-muted' : 'text-foreground')}>{label}</p>
        <p className="h-4 font-mono text-xs text-muted">
          {status === 'skipped' ? 'omitido' : showCounter ? `${state.done}/${state.total}` : ''}
        </p>
      </div>
    </div>
  );
}

function Connector({ from, to }: { from: StageState; to: StageState }) {
  const fill = stageProgress(from);
  const flowing = from.status === 'active' || to.status === 'active';

  return (
    <div className="relative ml-[27px] h-8 w-0.5 md:ml-0 md:mt-[27px] md:h-0.5 md:w-auto md:flex-1">
      <div className="absolute inset-0 rounded-full bg-surface-2" />
      {/* Vertical en móvil, horizontal desde md: el recorte avanza según el progreso de la etapa */}
      <div
        className="bg-gradient-brand absolute inset-0 rounded-full transition-[clip-path] duration-700 ease-out [clip-path:inset(0_0_calc(100%-var(--fill))_0)] md:[clip-path:inset(0_calc(100%-var(--fill))_0_0)]"
        style={{ '--fill': `${fill * 100}%` } as React.CSSProperties}
      />
      {flowing && (
        <span className="animate-flow-y md:animate-flow-x absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-2 shadow-[0_0_12px_3px_rgb(34_211_238/0.7)] md:left-0" />
      )}
    </div>
  );
}
