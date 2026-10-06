'use client';
import Link from 'next/link';
import { useState, useId } from 'react';
import { ChevronRight, Search, Users } from 'lucide-react';
import { Avatar, EmptyState } from './ui';
import { normalizeSearch } from '@/lib/presentation';
import type { Member } from '@/lib/management';

export function TeamList({ members }: { members: Member[] }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ativos');
  const statusId = useId();
  const filtered = members.filter(
    (m) =>
      (status === 'todos' || m.ativo === (status === 'ativos')) &&
      normalizeSearch(`${m.nome} ${m.email} ${m.cargo}`).includes(normalizeSearch(search)),
  );
  return (
    <>
      <div className="team-filters">
        <label className="field">
          Buscar na equipe
          <span className="input-wrap">
            <Search size={20} className="input-icon" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, e-mail ou cargo"
              maxLength={160}
            />
          </span>
        </label>
        <div className="field">
          <label htmlFor={statusId}>Situação</label>
          <select id={statusId} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
      </div>
      <p className="result-count" role="status">
        {filtered.length} {filtered.length === 1 ? 'pessoa na equipe' : 'pessoas na equipe'}
      </p>
      <div className="record-list">
        {filtered.map((m) => (
          <Link className="card team-card" href={`/configuracoes/equipe/${m.id}`} key={m.id}>
            <Avatar name={m.nome} />
            <div className="record-body">
              <h2>{m.nome}</h2>
              <p>{m.email}</p>
              <div className="team-badges">
                <span className="badge neutral">{m.cargo || 'Cargo não informado'}</span>
                {m.perfil === 'ADMINISTRADOR' && <span className="badge info">Administrador</span>}
                {!m.ativo && <span className="badge danger">Inativo</span>}
              </div>
            </div>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        ))}
      </div>
      {!filtered.length && (
        <EmptyState
          icon={Users}
          title="Nenhum membro encontrado"
          description="Confira a busca e a situação selecionada ou cadastre um membro da equipe."
        />
      )}
    </>
  );
}
