import { Link, useOutletContext, useParams } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { BurnupChart } from '@/components/charts/Charts';
import { PriorityBadge, StatusLabel } from '@/components/common/Badges';
import { RagBadge, RagWhy } from '@/components/common/RagBadge';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/common/States';
import { KpiCard } from '@/components/kpi/KpiCard';
import { addDaysYmd, calendarDate, formatDay } from '@/domain/dates';
import { jiraUrl, phaseLabel } from '@/domain/derive';
import { useScopedHref } from '@/hooks/useFilters';

export default function ProjectDetailPage() {
  const { key = '' } = useParams();
  const dash = useOutletContext<DashContext>();
  const href = useScopedHref();
  if (dash.isLoading && !dash.model) return <PageSkeleton />;
  if (!dash.model || !dash.snapshot)
    return <EmptyState title="Project unavailable" body="The snapshot did not load." />;
  const project = dash.snapshot.projects.find((item) => item.key === key);
  const enriched = dash.model.projects.find((item) => item.project.key === key);
  if (!project || !enriched) {
    return (
      <EmptyState
        title="Project not in this view"
        body="It may be outside the owner filter, or the key is unknown."
        actionHref={href('/projects')}
        actionLabel="Back to projects"
      />
    );
  }
  const tickets = dash.model.tickets.filter((item) => item.ticket.projectKey === key);
  const milestones = dash.model.milestones.filter((item) => item.milestone.projectKey === key);
  const timeZone = dash.model.timeZone;
  const asOfDay = calendarDate(dash.model.asOf, timeZone);
  const weekEnds = Array.from({ length: 12 }, (_, index) => addDaysYmd(asOfDay, -7 * (11 - index)));
  const burnup = weekEnds.map((date, index) => {
    const prev = index === 0 ? '0000-01-01' : weekEnds[index - 1]!;
    let scope = 0;
    let completed = 0;
    for (const item of tickets) {
      const created = calendarDate(item.ticket.created, timeZone);
      if (created <= date) scope += 1;
      if (
        item.ticket.resolvedAt &&
        calendarDate(item.ticket.resolvedAt, timeZone) <= date &&
        created <= date
      )
        completed += 1;
    }
    void prev;
    return { date, scope, completed };
  });
  return (
    <div>
      <p className="mb-3 text-sm">
        <Link to={href('/projects')} className="link">
          Projects
        </Link>
      </p>
      <PageHeader
        title={project.name}
        lede={`${project.key} · ${phaseLabel(project.phase)} · Lead ${enriched.lead?.displayName ?? 'Unassigned'}`}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <RagBadge rag={enriched.rag.rag} />
        <RagWhy result={enriched.rag} />
        <a
          className="link"
          href={jiraUrl(dash.model.jiraBaseUrl, project.key, project.url)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in Jira
        </a>
        <span className="text-sm text-muted">
          Updated {enriched.lastUpdated ? formatDay(enriched.lastUpdated, timeZone) : 'n/a'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open" value={String(enriched.open)} metricId="open" />
        <KpiCard label="Overdue" value={String(enriched.overdue)} metricId="overdue" />
        <KpiCard label="Blocked" value={String(enriched.blocked)} metricId="blocked" />
        <KpiCard
          label="Complete"
          value={
            enriched.completion.ratio == null
              ? 'n/a'
              : `${Math.round(enriched.completion.ratio * 100)}%`
          }
          metricId="complete"
        />
      </div>
      <div className="mt-6">
        <BurnupChart points={burnup} />
      </div>
      <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Milestones</h2>
        {milestones.length === 0 ? (
          <p className="mt-3 text-muted">No milestones were included for this project.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {milestones.map((item) => (
              <li
                key={item.milestone.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2"
              >
                <span className="font-bold">{item.milestone.name}</span>
                <span className="text-sm">
                  Planned {formatDay(item.milestone.plannedDate, 'UTC')}
                  {item.milestone.forecastDate
                    ? ` · Forecast ${formatDay(item.milestone.forecastDate, 'UTC')}`
                    : ''}
                  {item.milestone.completedDate
                    ? ` · Done ${formatDay(item.milestone.completedDate, 'UTC')}`
                    : ''}
                  {item.slipped ? (
                    <span className="ml-2 font-bold text-rag-amber">
                      Slipped {item.slipDays} days
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Status history</h2>
        {enriched.trend.length === 0 ? (
          <p className="mt-3 text-muted">
            This snapshot has no weekly health history for the project.
          </p>
        ) : (
          <ol className="mt-4 flex flex-wrap gap-2" aria-label="Weekly health">
            {enriched.trend.map((level, index) => (
              <li key={`${level}-${index}`}>
                <RagBadge rag={level} />
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="mt-6">
        <h2 className="section-title text-base">Tickets</h2>
        <div className="mt-4 overflow-x-auto rounded-[12px] border border-line bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-sunken">
              <tr>
                {['Key', 'Summary', 'Assignee', 'Status', 'Priority', 'Due'].map((header) => (
                  <th key={header} scope="col" className="px-3 py-2 font-bold tracking-[0.04em]">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((item) => (
                <tr key={item.ticket.key} className="border-t border-line">
                  <td className="px-3 py-2">
                    <a
                      className="link font-bold"
                      href={jiraUrl(dash.model!.jiraBaseUrl, item.ticket.key, item.ticket.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.ticket.key}
                    </a>
                  </td>
                  <td className="px-3 py-2">{item.ticket.summary}</td>
                  <td className="px-3 py-2">{item.assignee?.displayName ?? 'Unassigned'}</td>
                  <td className="px-3 py-2">
                    <StatusLabel
                      name={item.ticket.statusName}
                      category={item.ticket.statusCategory}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <PriorityBadge priority={item.ticket.priority} />
                  </td>
                  <td className="px-3 py-2">
                    {item.ticket.dueDate ? formatDay(item.ticket.dueDate, 'UTC') : 'n/a'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
