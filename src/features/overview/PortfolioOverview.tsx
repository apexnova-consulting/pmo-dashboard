import { Link } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { HealthTrend } from '@/components/charts/Charts';
import { SourceBadge } from '@/components/common/Badges';
import { RagBadge, RagWhy } from '@/components/common/RagBadge';
import { PageHeader } from '@/components/common/States';
import { KpiCard } from '@/components/kpi/KpiCard';
import { formatDay } from '@/domain/dates';
import { useScopedHref } from '@/hooks/useFilters';

function valueOf(value: number | null) {
  return value == null ? 'n/a' : String(value);
}

export function PortfolioOverview({ dash }: { dash: DashContext }) {
  const href = useScopedHref();
  const model = dash.model;
  if (!model || !model.portfolioKpis) return null;
  const kpis = model.portfolioKpis;
  const total = kpis.byRag.red + kpis.byRag.amber + kpis.byRag.green + kpis.byRag.none;
  return (
    <div>
      <PageHeader
        title="Overview"
        lede="Are we okay, and what needs a person today? Health comes from reported status, blocked updates, risks, dates, and silence. Counts follow the owner filter."
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
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiCard label="Projects by health" value={String(total)} metricId="portfolioHealth">
          <p className="text-xs text-muted">
            {kpis.byRag.red} red · {kpis.byRag.amber} amber · {kpis.byRag.green} green ·{' '}
            {kpis.byRag.none} no data
          </p>
        </KpiCard>
        <KpiCard label="Active projects" value={valueOf(kpis.active)} metricId="activeProjects" />
        <KpiCard
          label="Blocked projects"
          value={valueOf(kpis.blockedProjects)}
          metricId="blockedProjects"
        />
        <KpiCard
          label="Open high or critical risks"
          value={valueOf(kpis.openHighCriticalRisks)}
          metricId="openRisks"
        />
        <KpiCard
          label={`No update in ${kpis.staleDays} days`}
          value={valueOf(kpis.staleProjects)}
          metricId="staleProjects"
        />
        <KpiCard
          label="Milestones due in 14 days"
          value={valueOf(kpis.milestonesDue14)}
          metricId="milestonesDue"
        />
        <KpiCard
          label="Updates this week"
          value={valueOf(kpis.updatesThisWeek)}
          metricId="updatesWeek"
          delta={kpis.updatesDelta}
        />
      </div>
      <div className="mt-6">
        <HealthTrend weeks={model.weeks} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[12px] border border-line bg-card p-4">
          <h2 className="section-title text-base">Needs attention</h2>
          {model.needsProjects.length === 0 ? (
            <p className="mt-4 text-muted">No red, blocked, or stale projects in this view.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {model.needsProjects.map((project) => (
                <li key={project.project.key} className="flex flex-wrap items-center gap-3 py-3">
                  <RagBadge rag={project.rag.rag} />
                  <Link to={href(`/projects/${project.project.key}`)} className="link font-bold">
                    {project.project.name}
                  </Link>
                  <span className="text-sm text-muted">
                    {project.lead?.displayName ?? 'Unassigned'}
                  </span>
                  <RagWhy result={project.rag} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-[12px] border border-line bg-card p-4">
          <h2 className="section-title text-base">Latest updates</h2>
          {model.updates.length === 0 ? (
            <p className="mt-4 text-muted">No updates in this view.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {model.updates.slice(0, 10).map((item) => (
                <li key={item.update.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={href('/updates', { update: item.update.id })}
                      className="link font-bold"
                    >
                      {item.update.title}
                    </Link>
                    <SourceBadge source={item.update.source} href={item.update.sourceUrl} />
                  </div>
                  <p className="text-sm text-muted">
                    {item.projectName} · {formatDay(item.update.date, model.timeZone)} ·{' '}
                    {item.author?.displayName ?? item.update.authorName ?? 'Unknown author'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
