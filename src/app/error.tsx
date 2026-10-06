'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-page">
      <section className="card compact">
        <h1>Não foi possível abrir esta página</h1>
        <p className="subtitle">
          Tente novamente em instantes. Se o problema continuar, entre em contato com o suporte.
        </p>
        <button className="primary" onClick={reset}>
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
