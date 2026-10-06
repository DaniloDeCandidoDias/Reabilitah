'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { standardJobs } from '@/lib/management';

function JobDialog({ onAdd, onClose }: { onAdd: (name: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const hintId = useId();
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
    input.current?.focus();
  }, []);
  function close() {
    dialog.current?.close();
    onClose();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const name = (input.current?.value ?? '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) {
      setError('Informe um nome com 2 a 80 caracteres.');
      input.current?.focus();
      return;
    }
    dialog.current?.close();
    onAdd(name);
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="job-dialog"
      aria-labelledby={titleId}
      aria-describedby={hintId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <form className="form-stack" onSubmit={submit}>
        <h2 id={titleId}>Novo cargo</h2>
        <p className="hint" id={hintId}>
          O cargo será salvo junto com o cadastro do membro da equipe.
        </p>
        <label className="field">
          Nome do cargo
          <input
            ref={input}
            required
            minLength={2}
            maxLength={80}
            placeholder="Ex.: Assistente social"
          />
        </label>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={close}>
            Cancelar
          </button>
          <button type="submit" className="primary">
            Adicionar cargo
          </button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}

export function JobPicker({
  jobs,
  value,
  onChange,
}: {
  jobs: string[];
  value: string;
  onChange: (name: string) => void;
}) {
  const id = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const options = [
    ...new Map(
      [...standardJobs, ...jobs, ...added, ...(value ? [value] : [])].map((job) => [
        job.toLocaleLowerCase('pt-BR'),
        job,
      ]),
    ).values(),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  function close() {
    setOpen(false);
    addButton.current?.focus();
  }
  function add(name: string) {
    const existing = options.find(
      (job) => job.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'),
    );
    if (!existing) setAdded([...added, name]);
    onChange(existing ?? name);
    close();
  }
  return (
    <div className="field">
      <label htmlFor={id}>Cargo na instituição</label>
      <div className="job-control">
        <select
          id={id}
          name="cargo"
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="" disabled>
            Selecione
          </option>
          {options.map((job) => (
            <option key={job} value={job}>
              {job}
            </option>
          ))}
        </select>
        <button
          type="button"
          ref={addButton}
          className="secondary add-job"
          aria-label="Adicionar novo cargo"
          title="Adicionar novo cargo"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <Plus size={20} aria-hidden="true" />
        </button>
      </div>
      {open && <JobDialog onAdd={add} onClose={close} />}
    </div>
  );
}
