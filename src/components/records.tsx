'use client';

import { useId, useState } from 'react';
import { FileText, Search, SlidersHorizontal, X } from 'lucide-react';
import { Avatar, EmptyState } from './ui';
import { BackLink } from './back-link';
import {
  documentNames,
  documentStatuses,
  formatDateTime,
  normalizeSearch,
  type DocumentSummary,
  type PatientSummary,
} from '@/lib/presentation';

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const id = useId();
  return (
    <div className="search-field">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <span className="input-wrap">
        <Search className="input-icon" size={20} aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          maxLength={120}
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            className="clear-search"
            aria-label="Limpar busca"
            onClick={() => onChange('')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </span>
    </div>
  );
}

export function DocumentCard({ document: doc }: { document: DocumentSummary }) {
  const status = documentStatuses[doc.status];
  return (
    <article
      className={`card document-card ${doc.status === 'desconsiderado' ? 'disregarded' : ''}`}
    >
      <span className="record-icon">
        <FileText size={20} aria-hidden="true" />
      </span>
      <div className="record-body">
        <div className="record-title">
          <h3>{documentNames[doc.tipo] ?? doc.tipo}</h3>
          <span className={`badge ${status.tone}`}>{status.label}</span>
        </div>
        <p className="record-code">Documento #{doc.codigo}</p>
        <div className="document-patient">
          <Avatar name={doc.paciente} />
          <span>{doc.paciente}</span>
        </div>
        <div className="record-meta">
          <span>{doc.autor}</span>
          <time dateTime={doc.criado_em}>{formatDateTime(doc.criado_em)}</time>
        </div>
      </div>
    </article>
  );
}

export function PatientList({ patients }: { patients: PatientSummary[] }) {
  const [search, setSearch] = useState('');
  const filtered = patients.filter((p) =>
    normalizeSearch(`${p.nome_completo} ${p.apelido ?? ''}`).includes(normalizeSearch(search)),
  );
  return (
    <>
      <header className="page-header">
        <BackLink href="/inicio">Voltar ao início</BackLink>
        <div className="page-title">
          <h1>Pacientes</h1>
        </div>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome ou apelido..."
        />
      </header>
      <div className="content">
        <p className="result-count" role="status">
          {filtered.length} {filtered.length === 1 ? 'paciente' : 'pacientes'}
        </p>
        {filtered.length ? (
          <div className="record-list">
            {filtered.map((p) => (
              <article key={p.id} className="card patient-card enter">
                <Avatar name={p.nome_completo} />
                <div className="record-body">
                  <div className="record-title">
                    <h2>{p.nome_completo}</h2>
                    <span className={`badge ${p.ativo ? 'success' : 'neutral'}`}>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {p.apelido && <p className="nickname">{p.apelido}</p>}
                  <p className="record-meta">
                    {p.ultimo_documento
                      ? `Último documento em ${formatDateTime(p.ultimo_documento)}`
                      : 'Sem documentos registrados'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title={search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
            description={
              search
                ? 'Tente buscar por outro nome ou apelido.'
                : 'Os pacientes da instituição aparecerão aqui.'
            }
          />
        )}
      </div>
    </>
  );
}

export function DocumentList({ documents }: { documents: DocumentSummary[] }) {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [patient, setPatient] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [author, setAuthor] = useState('');
  const filterCount = [patient, type, status, author].filter(Boolean).length;
  const reset = () => {
    setSearch('');
    setPatient('');
    setType('');
    setStatus('');
    setAuthor('');
  };
  const pending = documents.filter((d) => ['assinatura', 'reenvio'].includes(d.status)).length;
  const patients = Array.from(
    new Map(documents.map((d) => [d.paciente_id, d.paciente])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const authors = Array.from(new Map(documents.map((d) => [d.autor_id, d.autor])).entries()).sort(
    (a, b) => a[1].localeCompare(b[1], 'pt-BR'),
  );
  const filtered = documents.filter(
    (d) =>
      normalizeSearch(
        `${d.paciente} ${documentNames[d.tipo] ?? d.tipo} ${d.codigo} ${d.autor}`,
      ).includes(normalizeSearch(search)) &&
      (!patient || d.paciente_id === patient) &&
      (!type || d.tipo === type) &&
      (!status || d.status === status) &&
      (!author || d.autor_id === author),
  );
  return (
    <>
      <header className="page-header">
        <BackLink href="/inicio">Voltar ao início</BackLink>
        <div className="page-title">
          <div>
            <h1>Documentos</h1>
            <p className="subtitle">
              {pending
                ? `${pending} ${pending === 1 ? 'pendente' : 'pendentes'} de assinatura`
                : 'Documentos da instituição'}
            </p>
          </div>
          <button
            className={`secondary filter-button ${filterCount ? 'active' : ''}`}
            aria-expanded={showFilters}
            aria-controls="filtros-documentos"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            Filtros{filterCount > 0 && <span className="filter-count">{filterCount}</span>}
          </button>
        </div>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Buscar por paciente, documento ou autor..."
        />
        {showFilters && (
          <section
            className="filter-panel enter"
            id="filtros-documentos"
            aria-label="Filtros de documentos"
          >
            <div className="section-heading">
              <h2>Filtrar por</h2>
              {filterCount > 0 && (
                <button className="text-button" onClick={reset}>
                  <X size={14} aria-hidden="true" />
                  Limpar filtros
                </button>
              )}
            </div>
            <div className="filter-grid">
              <div className="field">
                <label htmlFor="filtro-paciente">Paciente</label>
                <select
                  id="filtro-paciente"
                  value={patient}
                  onChange={(e) => setPatient(e.target.value)}
                >
                  <option value="">Todos</option>
                  {patients.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="filtro-tipo">Tipo</label>
                <select id="filtro-tipo" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">Todos</option>
                  {Object.entries(documentNames).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="filtro-status">Status</label>
                <select
                  id="filtro-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todos</option>
                  {Object.entries(documentStatuses).map(([id, entry]) => (
                    <option key={id} value={id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="filtro-autor">Responsável</label>
                <select
                  id="filtro-autor"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                >
                  <option value="">Todos</option>
                  {authors.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        )}
      </header>
      <div className="content">
        <p className="result-count" role="status">
          {filtered.length} {filtered.length === 1 ? 'documento' : 'documentos'}
        </p>
        {filtered.length ? (
          <div className="record-list enter">
            {filtered.map((doc) => (
              <DocumentCard key={doc.id} document={doc} />
            ))}
          </div>
        ) : (
          <>
            <EmptyState
              icon={FileText}
              title={
                search || filterCount
                  ? 'Nenhum documento encontrado'
                  : 'Nenhum documento cadastrado'
              }
              description={
                search || filterCount
                  ? 'Ajuste os filtros ou tente outra busca.'
                  : 'Os documentos emitidos para os pacientes aparecerão aqui.'
              }
            />
            {(search || filterCount > 0) && (
              <div className="centered">
                <button className="text-button" onClick={reset}>
                  Limpar busca e filtros
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
