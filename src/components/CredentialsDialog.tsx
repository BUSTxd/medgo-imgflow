'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, KeyRound, Loader2, LogOut, ShieldCheck, X } from 'lucide-react';

import { testCredentials } from '@/lib/cloudinary';
import { clearCredentials, saveCredentials, type CloudinaryCredentials } from '@/lib/credentials';
import { cn } from '@/lib/util';

interface CredentialsDialogProps {
  current: CloudinaryCredentials | null;
  onClose?: () => void;
}

export default function CredentialsDialog({ current, onClose }: CredentialsDialogProps) {
  const [values, setValues] = useState<CloudinaryCredentials>(
    current ?? { cloudName: '', apiKey: '', apiSecret: '' }
  );
  const [remember, setRemember] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [state, setState] = useState<'idle' | 'testing' | 'error'>('idle');
  const [error, setError] = useState('');

  const complete = values.cloudName.trim() && values.apiKey.trim() && values.apiSecret.trim();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || state === 'testing') return;

    const credentials = {
      cloudName: values.cloudName.trim(),
      apiKey: values.apiKey.trim(),
      apiSecret: values.apiSecret.trim(),
    };

    setState('testing');
    try {
      await testCredentials(credentials);
      saveCredentials(credentials, remember);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con Cloudinary.');
      setState('error');
    }
  }

  const field = (key: keyof CloudinaryCredentials, label: string, placeholder: string, secret = false) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <span className="relative block">
        {/* Siempre type="text" (el secret se enmascara por CSS) para que Chrome y los
            gestores de contraseñas no autocompleten usuario/contraseña guardados aquí. */}
        <input
          type="text"
          name={`cld-${key}`}
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          style={secret && !showSecret ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties) : undefined}
          value={values[key]}
          onChange={(event) => {
            setValues({ ...values, [key]: event.target.value });
            if (state === 'error') setState('idle');
          }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-border bg-background/70 px-3.5 py-2.5 font-mono text-sm outline-none transition placeholder:text-muted/50 focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            aria-label={showSecret ? 'Ocultar' : 'Mostrar'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-foreground"
          >
            {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </span>
    </label>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.form
        onSubmit={handleSubmit}
        autoComplete="off"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="relative w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl shadow-accent/10 sm:p-8"
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        )}

        <div className="bg-gradient-brand mb-5 grid size-12 place-items-center rounded-2xl shadow-lg shadow-accent/30">
          <KeyRound className="size-6 text-white" />
        </div>

        <h2 className="text-2xl font-semibold tracking-tight">Conecta tu Cloudinary</h2>
        <p className="mt-2 text-sm text-muted">
          La conversión usa tu cuenta gratuita de Cloudinary. Encuentra estos datos en{' '}
          <a
            href="https://console.cloudinary.com/settings/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline-offset-2 hover:underline"
          >
            Settings → API Keys
          </a>
          .
        </p>

        <div className="mt-6 space-y-4">
          {field('cloudName', 'Cloud name', 'dxxxxxxxx')}
          {field('apiKey', 'API key', '123456789012345')}
          {field('apiSecret', 'API secret', '••••••••••••••••••••', true)}
        </div>

        <label className="mt-5 flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          Recordar en este navegador
        </label>

        <p className="mt-4 flex gap-2 rounded-xl border border-border bg-background/50 p-3 text-xs text-muted">
          <ShieldCheck className="size-4 shrink-0 text-success" />
          Se guardan solo en tu navegador. Esta web no tiene servidor: tus imágenes y credenciales van directo a
          Cloudinary.
        </p>

        {state === 'error' && (
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
            className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
          >
            {error}
          </motion.p>
        )}

        <button
          type="submit"
          disabled={!complete || state === 'testing'}
          className={cn(
            'bg-gradient-brand mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white shadow-lg shadow-accent/25 transition',
            'hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {state === 'testing' ? (
            <>
              <Loader2 className="size-5 animate-spin" /> Probando conexión…
            </>
          ) : (
            'Probar y guardar'
          )}
        </button>

        {current && (
          <button
            type="button"
            onClick={() => {
              clearCredentials();
              onClose?.();
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm text-muted transition hover:text-danger"
          >
            <LogOut className="size-4" /> Olvidar credenciales
          </button>
        )}
      </motion.form>
    </motion.div>
  );
}
