'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="container page-space empty">
      <h1>A little hiccup in the plans.</h1>
      <p>We couldn’t load this page. Please try again.</p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
      <Link className="text-link" href="/">
        Return home
      </Link>
    </main>
  );
}
