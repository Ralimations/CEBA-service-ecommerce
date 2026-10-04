import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="container page-space empty">
      <span className="eyebrow">A SMALL DETOUR</span>
      <h1>We couldn’t find that page.</h1>
      <p>The listing may be unavailable, or this booking may belong to another account.</p>
      <Link href="/browse" className="btn">
        Back to the marketplace
      </Link>
    </main>
  );
}
