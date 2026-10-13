'use client';

import { motion } from 'motion/react';
import { AlertTriangle, Download, FileCode2, RotateCcw } from 'lucide-react';

import AnimatedNumber from '@/components/AnimatedNumber';
import type { PipelineResult } from '@/lib/pipeline';
import { basename } from '@/lib/notion';
import { downloadBlob, formatBytes } from '@/lib/util';

interface ResultPanelProps {
  result: PipelineResult;
  onReset: () => void;
}

// Nunca mostrar "100%": con ahorros >99% se muestra un decimal.
const formatPercent = (value: number) => (value >= 99 ? (Math.floor(value * 10) / 10).toFixed(1) : Math.round(value).toString());

export default function ResultPanel({ result, onReset }: ResultPanelProps) {
  const savedRatio = result.originalBytes > 0 ? 1 - result.finalBytes / result.originalBytes : 0;
  const totalRefs = result.htmlReports.reduce((sum, report) => sum + report.count, 0);

  return (
    <motion.aside
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24 }}
      className="space-y-6 rounded-3xl border border-border bg-surface/80 p-6 backdrop-blur"
    >
      <div>
        <p className="text-sm text-muted">Ahorraste</p>
        <p className="text-gradient text-6xl font-bold tracking-tight">
          <AnimatedNumber value={savedRatio * 100} format={formatPercent} />%
        </p>
        <p className="mt-1 text-sm text-muted">
          {result.converted} {result.converted === 1 ? 'imagen convertida' : 'imágenes convertidas'}
        </p>
      </div>

      <div className="space-y-3">
        <Bar label="Antes" bytes={result.originalBytes} ratio={1} className="bg-muted/40" />
        <Bar label="Después" bytes={result.finalBytes} ratio={1 - savedRatio} className="bg-gradient-brand" />
      </div>

      {result.htmlReports.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">
            HTML reescritos <span className="font-mono text-muted">· {totalRefs} rutas</span>
          </p>
          <ul className="max-h-40 space-y-1 overflow-auto pr-1">
            {result.htmlReports.map((report) => (
              <li key={report.path} className="flex items-center gap-2 text-xs">
                <FileCode2 className="size-3.5 shrink-0 text-accent" />
                <span className="truncate" title={report.path}>
                  {basename(report.path)}
                </span>
                <span className="ml-auto shrink-0 font-mono text-muted">{report.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.failed > 0 && (
        <Warning>
          {result.failed} {result.failed === 1 ? 'imagen falló y quedó' : 'imágenes fallaron y quedaron'} en su formato
          original (sus rutas no se tocaron).
        </Warning>
      )}
      {result.cleanupError && <Warning>No se pudieron borrar las copias temporales en Cloudinary: {result.cleanupError}</Warning>}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => downloadBlob(result.blob, result.name)}
          className="bg-gradient-brand flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-[0.98]"
        >
          <Download className="size-5" />
          Descargar {result.name}
        </button>
        <p className="text-center font-mono text-xs text-muted">{formatBytes(result.blob.size)}</p>
        <button
          type="button"
          onClick={onReset}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm text-muted transition hover:border-accent/60 hover:text-foreground"
        >
          <RotateCcw className="size-4" />
          Procesar otro
        </button>
      </div>
    </motion.aside>
  );
}

function Bar({ label, bytes, ratio, className }: { label: string; bytes: number; ratio: number; className: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono">{formatBytes(bytes)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className={`h-full rounded-full ${className}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(2, ratio * 100)}%` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
      <AlertTriangle className="size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
