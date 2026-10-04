export default function Loading() {
  return (
    <main className="container page-space" aria-label="Loading page" role="status">
      <div className="skeleton title" />
      <div className="skeleton hero-skeleton" />
      <div className="three-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton card-skeleton" />
        ))}
      </div>
      <span className="sr-only">Getting everything ready…</span>
    </main>
  );
}
