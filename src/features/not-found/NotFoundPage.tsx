import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="section-title text-2xl">That page is not in the dashboard</h1>
      <p className="mt-4">
        <Link to="/" className="link">
          Back to overview
        </Link>
      </p>
    </main>
  );
}
