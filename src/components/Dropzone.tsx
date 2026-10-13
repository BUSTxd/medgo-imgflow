'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { FileArchive, FolderOpen, Images, UploadCloud } from 'lucide-react';

import { bundleFromDataTransfer, bundleFromFiles, type InputBundle } from '@/lib/notion';
import { cn } from '@/lib/util';

interface DropzoneProps {
  disabled?: boolean;
  onBundle: (getBundle: () => Promise<InputBundle>) => void;
}

export default function Dropzone({ disabled = false, onBundle }: DropzoneProps) {
  const [isOver, setIsOver] = useState(false);
  const depth = useRef(0);
  const zipInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  // React no tipa webkitdirectory: se agrega a mano.
  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '');
  }, []);

  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length > 0) onBundle(() => bundleFromFiles(files));
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    depth.current = 0;
    setIsOver(false);
    if (disabled) return;
    // Los items del DataTransfer solo son válidos durante el evento: se leen ya.
    const bundle = bundleFromDataTransfer(event.dataTransfer);
    onBundle(() => bundle);
  }

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current++;
        setIsOver(true);
      }}
      onDragLeave={() => {
        depth.current--;
        if (depth.current <= 0) setIsOver(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className="relative"
    >
      <div
        aria-hidden
        className={cn(
          'bg-glow animate-glow absolute -inset-px rounded-3xl blur-xl transition-opacity duration-500',
          isOver ? 'opacity-70' : 'opacity-0'
        )}
      />
      <div
        className={cn(
          'relative flex flex-col items-center rounded-3xl border bg-surface/90 px-6 py-14 text-center backdrop-blur transition-colors sm:py-20',
          isOver ? 'border-accent' : 'border-dashed border-border'
        )}
      >
        <motion.div
          animate={isOver ? { y: -8, scale: 1.08 } : { y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="mb-6 grid size-20 place-items-center rounded-2xl bg-gradient-brand shadow-lg shadow-accent/30"
        >
          <UploadCloud className="size-10 text-white" strokeWidth={1.75} />
        </motion.div>

        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {isOver ? 'Suéltalo aquí' : 'Arrastra tu export de Notion'}
        </h2>
        <p className="mt-2 max-w-md text-muted">
          El <span className="text-foreground">.zip</span> tal cual lo descargas, o la carpeta descomprimida con el HTML y sus
          imágenes. Sin límite de 20.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <PickButton icon={FileArchive} primary onClick={() => zipInput.current?.click()} disabled={disabled}>
            Elegir ZIP
          </PickButton>
          <PickButton icon={FolderOpen} onClick={() => folderInput.current?.click()} disabled={disabled}>
            Elegir carpeta
          </PickButton>
          <PickButton icon={Images} onClick={() => filesInput.current?.click()} disabled={disabled}>
            Archivos sueltos
          </PickButton>
        </div>

        <input ref={zipInput} type="file" accept=".zip,application/zip" className="sr-only" onChange={handleInput} />
        <input ref={folderInput} type="file" className="sr-only" onChange={handleInput} />
        <input
          ref={filesInput}
          type="file"
          multiple
          accept=".html,.htm,.png,.jpg,.jpeg,.webp,.gif,.svg,.css"
          className="sr-only"
          onChange={handleInput}
        />
      </div>
    </div>
  );
}

function PickButton({
  icon: Icon,
  primary = false,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: React.ElementType; primary?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-95 disabled:opacity-50',
        primary
          ? 'bg-gradient-brand text-white shadow-lg shadow-accent/25 hover:brightness-110'
          : 'border border-border bg-surface-2 text-foreground hover:border-accent/60'
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
