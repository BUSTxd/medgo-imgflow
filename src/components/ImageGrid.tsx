'use client';

import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowRight, Check, CloudUpload, Loader2, Scaling, Sparkles } from 'lucide-react';

import { extname } from '@/lib/notion';
import type { ImageItem, ImageStatus } from '@/lib/pipeline';
import { cn, formatBytes } from '@/lib/util';

const STATUS: Partial<Record<ImageStatus, { label: string; icon: React.ElementType }>> = {
  queued: { label: 'En cola', icon: Loader2 },
  resizing: { label: 'Reduciendo', icon: Scaling },
  uploading: { label: 'Subiendo', icon: CloudUpload },
  converting: { label: 'Convirtiendo', icon: Sparkles },
};

export default function ImageGrid({ images, format }: { images: ImageItem[]; format: string }) {
  if (images.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image, index) => (
        <motion.li
          key={image.id}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: Math.min(index * 0.03, 0.6), type: 'spring', stiffness: 260, damping: 24 }}
        >
          <Card image={image} format={format} />
        </motion.li>
      ))}
    </ul>
  );
}

function Card({ image, format }: { image: ImageItem; format: string }) {
  const working = image.status !== 'done' && image.status !== 'error';
  const status = STATUS[image.status];
  const saved = image.finalSize ? 1 - image.finalSize / image.originalSize : 0;

  return (
    <div
      className={cn(
        'group overflow-hidden rounded-2xl border bg-surface transition-colors',
        image.status === 'error' ? 'border-danger/60' : image.status === 'done' ? 'border-success/30' : 'border-border'
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
        <img
          src={image.previewUrl}
          alt={image.name}
          loading="lazy"
          decoding="async"
          className={cn(
            'size-full object-cover transition duration-700',
            working && 'scale-105 blur-[2px] brightness-50',
            image.status === 'done' && 'group-hover:scale-105'
          )}
        />

        {working && (
          <div className="absolute inset-0 overflow-hidden">
            <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        )}

        <AnimatePresence mode="wait">
          {status && (
            <motion.span
              key={image.status}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute inset-0 grid place-items-center"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-xs font-medium backdrop-blur">
                <status.icon className={cn('size-3.5', image.status === 'queued' ? 'animate-spin' : 'animate-pulse')} />
                {status.label}
              </span>
            </motion.span>
          )}
        </AnimatePresence>

        {image.status === 'done' && (
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-success text-background shadow-lg"
          >
            <Check className="size-4" strokeWidth={3} />
          </motion.span>
        )}

        {image.status === 'done' && saved > 0 && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-xs font-semibold text-success backdrop-blur">
            −{Math.round(saved * 100)}%
          </span>
        )}
      </div>

      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-medium" title={image.path}>
          {image.name}
        </p>
        <p className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted">
          <span className="rounded bg-surface-2 px-1 uppercase">{extname(image.path)}</span>
          {formatBytes(image.originalSize)}
          {image.resizedSize && (
            <span title="Después de reducir por peso" className="text-accent">
              ↘ {formatBytes(image.resizedSize)}
            </span>
          )}
          {image.finalSize !== undefined && (
            <>
              <ArrowRight className="size-3 text-success" />
              <span className="rounded bg-success/15 px-1 uppercase text-success">{format}</span>
              <span className="font-semibold text-success">{formatBytes(image.finalSize)}</span>
            </>
          )}
        </p>
        {image.error && (
          <p className="flex items-start gap-1 text-xs text-danger">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            {image.error}
          </p>
        )}
      </div>
    </div>
  );
}
