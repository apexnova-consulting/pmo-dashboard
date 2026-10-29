import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-[12px] border border-dashed border-line bg-card px-6 py-10 text-center">
      <h2 className="font-display text-lg font-bold tracking-[0.04em]">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-muted">{body}</p>
      {actionHref && actionLabel ? (
        <Link to={actionHref} className="link mt-4 inline-block font-bold">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[12px] border border-line bg-card p-4 ${className}`}>
      {children}
    </section>
  );
}

export function PageHeader({ title, lede }: { title: string; lede?: string }) {
  return (
    <header className="mb-6">
      <h1 className="section-title text-2xl">{title}</h1>
      {lede ? <p className="mt-3 max-w-3xl text-muted">{lede}</p> : null}
    </header>
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-sunken ${className}`} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <SkeletonBlock className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonBlock key={index} className="h-28" />
        ))}
      </div>
      <SkeletonBlock className="h-72" />
    </div>
  );
}
