'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, ListFilter } from 'lucide-react';
import type { HistoryType } from '@/lib/management';

export function HistoryFilters({
  options,
  selected,
  memberId,
}: {
  options: HistoryType[];
  selected: string[] | null;
  memberId?: string;
}) {
  const [checked, setChecked] = useState(selected ?? options.map((option) => option.codigo));
  const all = checked.length === options.length;
  const groups = [...new Set(options.map((option) => option.grupo))];
  const clearHref = `/configuracoes/historico${memberId ? `?membro=${memberId}` : ''}`;
  return (
    <details className="card history-filters" open={selected !== null}>
      <summary>
        <ListFilter size={20} aria-hidden="true" />
        <span>Filtrar atividades</span>
        <small>
          {all
            ? 'Todas selecionadas'
            : `${checked.length} ${checked.length === 1 ? 'selecionada' : 'selecionadas'}`}
        </small>
        <ChevronDown size={18} className="filter-chevron" aria-hidden="true" />
      </summary>
      <form
        action="/configuracoes/historico"
        method="get"
        className="history-filter-form"
        aria-label="Filtrar atividades"
      >
        {memberId && <input type="hidden" name="membro" value={memberId} />}
        {!all && <input type="hidden" name="filtrar" value="1" />}
        <p className="hint">
          Marque as atividades que deseja ver. As opções desmarcadas ficam ocultas.
        </p>
        <div className="filter-selection-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => setChecked(options.map((option) => option.codigo))}
          >
            Marcar todas
          </button>
          <button type="button" className="text-button" onClick={() => setChecked([])}>
            Desmarcar todas
          </button>
        </div>
        <div className="history-filter-groups">
          {groups.map((group) => (
            <fieldset className="history-filter-group" key={group}>
              <legend>{group}</legend>
              {options
                .filter((option) => option.grupo === group)
                .map((option) => (
                  <label className="check-row" key={option.codigo}>
                    <input
                      type="checkbox"
                      name={all ? undefined : 'tipo'}
                      value={option.codigo}
                      checked={checked.includes(option.codigo)}
                      onChange={(event) =>
                        setChecked(
                          event.target.checked
                            ? [...checked, option.codigo]
                            : checked.filter((code) => code !== option.codigo),
                        )
                      }
                    />
                    <span>{option.nome}</span>
                  </label>
                ))}
            </fieldset>
          ))}
        </div>
        {!checked.length && (
          <p className="hint" role="status">
            Nenhuma atividade selecionada. Ao aplicar, nenhum registro será exibido.
          </p>
        )}
        <div className="form-actions">
          {selected !== null && (
            <Link className="secondary" href={clearHref}>
              Limpar filtros
            </Link>
          )}
          <button className="primary" type="submit">
            Aplicar filtros
          </button>
        </div>
      </form>
    </details>
  );
}
