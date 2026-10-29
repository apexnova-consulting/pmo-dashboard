import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { PageHeader, PageSkeleton } from '@/components/common/States';
import { formatDataAsOf, formatWhen } from '@/domain/dates';
import { METRICS } from '@/domain/metrics';
import { RAG_CONFIG, config } from '@/lib/config';
import { SCENARIOS } from '@/data/mock/generate';
import { useRefreshHistory } from '@/hooks/useSnapshot';

export default function AboutPage() {
  const dash = useOutletContext<DashContext>();
  const history = useRefreshHistory();
  const [params, setParams] = useSearchParams();
  if (dash.isLoading && !dash.snapshot) return <PageSkeleton />;
  const snapshot = dash.snapshot;
  return (
    <div>
      <PageHeader
        title="Data & Status"
        lede="Where the numbers come from, when they were last refreshed, and how health is decided."
      />
      <section className="rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Snapshot</h2>
        {snapshot ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Data as of</dt>
              <dd className="font-bold">
                {formatDataAsOf(snapshot.generatedAt, snapshot.meta.timezone)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Schema</dt>
              <dd>Version {snapshot.schemaVersion}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Source</dt>
              <dd>{snapshot.meta.source ?? 'n/a'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Rows</dt>
              <dd>
                {snapshot.projects.length} projects · {snapshot.tickets.length} tickets ·{' '}
                {snapshot.milestones.length} milestones · {snapshot.risks.length} risks ·{' '}
                {snapshot.history.length} history points
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">App version</dt>
              <dd>{config.appVersion}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Data source</dt>
              <dd>{config.dataSource}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3">
            No snapshot is loaded. {dash.error instanceof Error ? dash.error.message : ''}
          </p>
        )}
      </section>
      <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Refresh history</h2>
        {history.isLoading ? <p className="mt-3">Loading history…</p> : null}
        {history.data && history.data.length === 0 ? (
          <p className="mt-3 text-muted">No runs yet.</p>
        ) : null}
        {history.data && history.data.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-sunken">
                <tr>
                  {['Started', 'Finished', 'Status', 'Who', 'Note'].map((header) => (
                    <th key={header} scope="col" className="px-2 py-2 font-bold">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.data.map((run) => (
                  <tr key={run.runId} className="border-t border-line">
                    <td className="px-2 py-2">
                      {formatWhen(
                        run.startedAt,
                        snapshot?.meta.timezone ?? config.timezone,
                        'MMM d, h:mm a',
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {run.finishedAt
                        ? formatWhen(
                            run.finishedAt,
                            snapshot?.meta.timezone ?? config.timezone,
                            'MMM d, h:mm a',
                          )
                        : 'n/a'}
                    </td>
                    <td className="px-2 py-2 capitalize">{run.status}</td>
                    <td className="px-2 py-2">{run.triggeredBy ?? 'n/a'}</td>
                    <td className="px-2 py-2">{run.message ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Health rules</h2>
        <p className="mt-3 text-sm">
          A project is red if any red rule is true. Otherwise amber if any amber rule is true.
          Otherwise green. A health override on the project wins.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>
            Red overdue share {Math.round(RAG_CONFIG.red.overduePct * 100)}%, amber{' '}
            {Math.round(RAG_CONFIG.amber.overduePct * 100)}%.
          </li>
          <li>
            Red blocked count {RAG_CONFIG.red.blockedCount}, amber {RAG_CONFIG.amber.blockedCount}.
          </li>
          <li>
            Red milestone slip {RAG_CONFIG.red.milestoneSlipDays} days, amber{' '}
            {RAG_CONFIG.amber.milestoneSlipDays} days.
          </li>
          <li>
            Red silence {RAG_CONFIG.red.maxStaleDays} days, amber {RAG_CONFIG.amber.maxStaleDays}{' '}
            days.
          </li>
          <li>
            A ticket is stale after {config.staleDays} days without an update. Blocked statuses:{' '}
            {config.blockedStatuses.join(', ')}.
          </li>
        </ul>
      </section>
      <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Glossary</h2>
        <dl className="mt-4 space-y-3">
          {METRICS.map((metric) => (
            <div key={metric.id}>
              <dt className="font-bold">{metric.name}</dt>
              <dd className="text-sm text-muted">{metric.definition}</dd>
            </div>
          ))}
        </dl>
      </section>
      {config.dataSource === 'mock' ? (
        <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
          <h2 className="section-title text-base">Demo scenarios</h2>
          <p className="mt-3 text-sm text-muted">
            These switch the mock snapshot. They are ignored when the app is pointed at the real
            API.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SCENARIOS.map((scenario) => (
              <li key={scenario}>
                <button
                  type="button"
                  className="link font-bold"
                  aria-current={
                    params.get('scenario') === scenario ||
                    (!params.get('scenario') && scenario === 'normal')
                      ? 'page'
                      : undefined
                  }
                  onClick={() => {
                    setParams((prev) => {
                      const next = new URLSearchParams(prev);
                      if (scenario === 'normal') next.delete('scenario');
                      else next.set('scenario', scenario);
                      return next;
                    });
                  }}
                >
                  {scenario}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            <Link to="/" className="link">
              Return to overview
            </Link>
          </p>
        </section>
      ) : null}
    </div>
  );
}
