'use client';
import { useActionState, useState, useId } from 'react';
import { Eye, EyeOff, Mail, LockKeyhole, LoaderCircle } from 'lucide-react';
import { login, changePassword, type FormState } from '@/app/actions';
export function PasswordField({
  label = 'Senha',
  name = 'senha',
  autoComplete = 'current-password',
}: {
  label?: string;
  name?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="input-wrap password-input">
        <LockKeyhole size={20} className="input-icon" aria-hidden="true" />
        <input
          id={id}
          name={name}
          type={show ? 'text' : 'password'}
          required
          maxLength={128}
          autoComplete={autoComplete}
          placeholder="••••••••"
        />
        <button
          type="button"
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={show}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </div>
  );
}
export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, { error: '' });
  return (
    <form action={action} className="form-stack" aria-busy={pending}>
      <label className="field">
        E-mail
        <span className="input-wrap">
          <Mail size={20} className="input-icon" aria-hidden="true" />
          <input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="seu@email.com"
            required
            maxLength={254}
          />
        </span>
      </label>
      <PasswordField />
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <button className="primary full" disabled={pending}>
        {pending && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
        {pending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {
    error: '',
  });
  return (
    <form action={action} className="form-stack" aria-busy={pending}>
      <PasswordField label="Senha atual" name="atual" />
      <PasswordField label="Nova senha" autoComplete="new-password" />
      <PasswordField label="Confirme a nova senha" name="confirmacao" autoComplete="new-password" />
      <p className="hint">
        Use de 12 a 128 caracteres. Após salvar, entre novamente com a nova senha.
      </p>
      {state.error && (
        <p className="notice error" role="alert">
          {state.error}
        </p>
      )}
      <button className="primary full" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar nova senha'}
      </button>
    </form>
  );
}
