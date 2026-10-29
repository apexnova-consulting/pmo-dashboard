import { Link, useOutletContext } from 'react-router-dom';
import { PortfolioOverview } from '@/features/overview/PortfolioOverview';
import type { DashContext } from '@/components/layout/AppShell';
import { BurnChart, HealthTrend, StatusDonut } from '@/components/charts/Charts';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/common/States';
import { KpiCard } from '@/components/kpi/KpiCard';
import { ExternalAnchor, PriorityBadge } from '@/components/common/Badges';
import { jiraUrl } from '@/domain/derive';
import { formatDay } from '@/domain/dates';
import { useScopedHref } from '@/hooks/useFilters';

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 32 - (value / max) * 28;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg
      viewBox="0 0 100 36"
      className="h-9 w-full text-brand"
      role="img"
      aria-label={`Resolved by week: ${values.join(', ')}`}
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

export default function OverviewPage() {
  const dash = useOutletContext<DashContext>();
  const href = useScopedHref();
  if (dash.isLoading && !dash.model) return <PageSkeleton />;
  if (!dash.model) {
    return (
      <EmptyState
        title="No snapshot yet"
        body={
          dash.error instanceof Error
            ? dash.error.message
            : 'The dashboard could not load a snapshot.'
        }
        actionHref={href('/')}
        actionLabel="Try again"
      />
    );
  }
  const { model } = dash;
  if (model.mode === 'portfolio') return <PortfolioOverview dash={dash} />;
  const { kpis } = model;
  const totalRag = Math.max(kpis.projects.red + kpis.projects.amber + kpis.projects.green, 1);
  return (
    <div>
      <PageHeader
        title="Overview"
        lede="Are we okay, and what needs a person today? Counts follow the owner filter in the header."
      />
      {model.attention.length > 0 ? (
        <ul className="mb-6 flex flex-wrap gap-2">
          {model.attention.map((item) => (
            <li key={item.id}>
              <Link
                to={href(
                  item.href.split('?')[0] ?? item.href,
                  Object.fromEntries(new URLSearchParams(item.href.split('?')[1] ?? '')),
                )}
                className={
                  item.tone === 'red'
                    ? 'inline-flex rounded-full bg-rag-red-bg px-3 py-1 text-sm font-bold text-rag-red underline-offset-4 hover:underline'
                    : 'inline-flex rounded-full bg-rag-amber-bg px-3 py-1 text-sm font-bold text-rag-amber underline-offset-4 hover:underline'
                }
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
        <KpiCard label="Active projects" value={String(kpis.projects.total)} metricId="assigned">
          <div className="flex h-2 overflow-hidden rounded-full" aria-hidden="true">
            <span
              className="bg-rag-red"
              style={{ width: `${(kpis.projects.red / totalRag) * 100}%` }}
            />
            <span
              className="bg-rag-amber"
              style={{ width: `${(kpis.projects.amber / totalRag) * 100}%` }}
            />
            <span
              className="bg-rag-green"
              style={{ width: `${(kpis.projects.green / totalRag) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted">
            {kpis.projects.red} red · {kpis.projects.amber} amber · {kpis.projects.green} green
          </p>
        </KpiCard>
        <KpiCard
          label="Open tickets"
          value={String(kpis.open)}
          metricId="open"
          delta={kpis.openDelta}
          higherIsWorse
        />
        <KpiCard
          label="Overdue"
          value={String(kpis.overdue)}
          metricId="overdue"
          delta={kpis.overdueDelta}
          higherIsWorse
        />
        <KpiCard label="Due in 7 days" value={String(kpis.dueSoon)} metricId="dueSoon" />
        <KpiCard label="Blocked" value={String(kpis.blocked)} metricId="blocked" />
        <KpiCard label="Throughput, 7 days" value={String(kpis.throughput)} metricId="throughput">
          <Spark values={kpis.throughputSeries} />
        </KpiCard>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <HealthTrend weeks={model.weeks} />
        </div>
        <div className="lg:col-span-2">
          <StatusDonut counts={model.statusCounts} />
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="rounded-[12px] border border-line bg-card p-4 lg:col-span-3">
          <h2 className="section-title text-base">Needs attention</h2>
          {model.needsAttention.length === 0 ? (
            <p className="mt-4 text-muted">Nothing overdue or blocked in this view.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Tickets that are overdue or blocked</caption>
                <thead className="bg-sunken">
                  <tr>
                    {['Key', 'Summary', 'Project', 'Owner', 'Due', 'Days overdue', 'Priority'].map(
                      (header) => (
                        <th
                          key={header}
                          scope="col"
                          className="px-2 py-2 font-bold tracking-[0.04em]"
                        >
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {model.needsAttention.map((item) => (
                    <tr key={item.ticket.key} className="border-t border-line">
                      <td className="px-2 py-2">
                        <ExternalAnchor
                          className="font-bold"
                          href={jiraUrl(model.jiraBaseUrl, item.ticket.key, item.ticket.url)}
                          sr={
                            jiraUrl(model.jiraBaseUrl, item.ticket.key, item.ticket.url)
                              ? '(opens in the tracker)'
                              : undefined
                          }
                        >
                          {item.ticket.key}
                        </ExternalAnchor>
                      </td>
                      <td className="px-2 py-2">{item.ticket.summary}</td>
                      <td className="px-2 py-2">{item.projectName}</td>
                      <td className="px-2 py-2">
                        {item.assignee?.displayName ?? item.ticket.assigneeName ?? 'Unassigned'}
                      </td>
                      <td className="px-2 py-2">
                        {item.ticket.dueDate ? formatDay(item.ticket.dueDate, 'UTC') : 'n/a'}
                      </td>
                      <td className="px-2 py-2">{item.daysOverdue ?? 'n/a'}</td>
                      <td className="px-2 py-2">
                        <PriorityBadge priority={item.ticket.priority} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="rounded-[12px] border border-line bg-card p-4 lg:col-span-2">
          <h2 className="section-title text-base">Next 14 days</h2>
          {model.upcoming.length === 0 ? (
            <p className="mt-4 text-muted">No milestones due in the next 14 days.</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {model.upcoming.map((group) => (
                <li key={group.day}>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
                    {formatDay(group.day, 'UTC')}
                  </p>
                  <ul className="mt-1 space-y-2">
                    {group.items.map((item) => (
                      <li
                        key={item.milestone.id}
                        className="flex items-start justify-between gap-3"
                      >
                        <span>
                          <span className="font-bold">{item.milestone.name}</span>
                          <span className="block text-sm text-muted">
                            {item.milestone.projectKey}
                          </span>
                        </span>
                        {item.slipped ? (
                          <span className="text-sm text-rag-amber">
                            Slipped {item.slipDays} days
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      <div className="mt-6">
        <BurnChart weeks={model.weeks} netFlow={kpis.netFlow} />
        <p className="mt-2 text-sm text-muted">
          Net flow last week:{' '}
          {kpis.netFlow == null
            ? 'n/a'
            : kpis.netFlow > 0
              ? `+${kpis.netFlow} (backlog growing)`
              : kpis.netFlow < 0
                ? `${kpis.netFlow} (backlog shrinking)`
                : 'flat'}
        </p>
      </div>
    </div>
  );
}
