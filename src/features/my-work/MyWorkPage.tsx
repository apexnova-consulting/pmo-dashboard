import { Link, useOutletContext } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { PriorityBadge, StatusLabel } from '@/components/common/Badges';
import { OwnerAvatar } from '@/components/common/OwnerAvatar';
import { RagBadge } from '@/components/common/RagBadge';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/common/States';
import { KpiCard } from '@/components/kpi/KpiCard';
import { formatDay } from '@/domain/dates';
import { jiraUrl, phaseLabel } from '@/domain/derive';
import { isAllOwners } from '@/domain/filters';
import { useScopedHref } from '@/hooks/useFilters';

export default function MyWorkPage() {
  const dash = useOutletContext<DashContext>();
  const href = useScopedHref();
  if (dash.isLoading && !dash.model) return <PageSkeleton />;
  if (!dash.model || !dash.snapshot) {
    return (
      <EmptyState
        title="No work to show"
        body="A snapshot is required before My Work can be built."
      />
    );
  }
  const { model } = dash;
  const selection = dash.owners.selection;
  const people = model.team.filter((member) => selection.ids.includes(member.id));
  const title = isAllOwners(selection)
    ? 'Team view'
    : people.length === 1
      ? (people[0]?.displayName ?? 'My Work')
      : 'Selected people';
  const open = model.tickets.filter((item) => item.open).length;
  return (
    <div>
      <PageHeader
        title="My Work"
        lede="What is on this plate, what is late, and what just got finished."
      />
      <div className="mb-6 flex items-center gap-3">
        {people.length === 1 && people[0] ? (
          <OwnerAvatar member={people[0]} />
        ) : (
          <h2 className="font-display text-xl font-bold tracking-[0.04em]">{title}</h2>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Open" value={String(open)} metricId="open" />
        <KpiCard label="Overdue" value={String(model.kpis.overdue)} metricId="overdue" />
        <KpiCard label="Due this week" value={String(model.kpis.dueSoon)} metricId="dueSoon" />
        <KpiCard label="Blocked" value={String(model.kpis.blocked)} metricId="blocked" />
        <KpiCard
          label="Resolved, 7 days"
          value={String(model.kpis.throughput)}
          metricId="throughput"
        />
      </div>
      <div className="mt-6 space-y-3">
        {model.myWork.groups.map((group) => (
          <details
            key={group.id}
            open={
              group.tickets.length > 0 &&
              (group.id === 'overdue' || group.id === 'dueSoon' || group.id === 'blocked')
            }
            className="rounded-[12px] border border-line bg-card"
          >
            <summary className="cursor-pointer px-4 py-3 font-display font-bold tracking-[0.04em]">
              {group.title} <span className="text-muted">({group.tickets.length})</span>
            </summary>
            {group.tickets.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted">Nothing in this group.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {group.tickets.map((item) => (
                  <li
                    key={item.ticket.key}
                    className="grid gap-2 px-4 py-3 md:grid-cols-[8rem_1fr_8rem_8rem]"
                  >
                    <a
                      className="link font-bold"
                      href={jiraUrl(model.jiraBaseUrl, item.ticket.key, item.ticket.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.ticket.key}
                    </a>
                    <span>
                      <span className="block">{item.ticket.summary}</span>
                      <span className="text-sm text-muted">{item.projectName}</span>
                    </span>
                    <PriorityBadge priority={item.ticket.priority} />
                    <span className="text-sm">
                      <StatusLabel
                        name={item.ticket.statusName}
                        category={item.ticket.statusCategory}
                      />
                      <span className="block text-muted">
                        {item.ticket.dueDate
                          ? formatDay(item.ticket.dueDate, 'UTC')
                          : 'No due date'}{' '}
                        · {item.ageDays}d old
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </details>
        ))}
      </div>
      <h2 className="section-title mt-8 text-base">Projects I lead</h2>
      {model.myWork.leadProjects.length === 0 ? (
        <p className="mt-3 text-muted">No led projects in this view.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {model.myWork.leadProjects.map((project) => (
            <Link
              key={project.project.key}
              to={href(`/projects/${project.project.key}`)}
              className="rounded-[12px] border border-line bg-card p-4 hover:bg-brand-tint"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold">{project.project.name}</h3>
                <RagBadge rag={project.rag.rag} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {project.project.key} · {phaseLabel(project.project.phase)}
              </p>
              <p className="mt-3 text-sm">
                {project.completion.ratio == null
                  ? 'n/a complete'
                  : `${Math.round(project.completion.ratio * 100)}% complete`}
                {' · '}
                {project.open} open · {project.overdue} overdue
              </p>
              <p className="mt-1 text-sm text-muted">
                Next:{' '}
                {project.nextMilestone
                  ? `${project.nextMilestone.milestone.name} (${formatDay(project.nextMilestone.milestone.forecastDate ?? project.nextMilestone.milestone.plannedDate, 'UTC')})`
                  : 'n/a'}
              </p>
            </Link>
          ))}
        </div>
      )}
      <h2 className="section-title mt-8 text-base">Recently resolved</h2>
      {model.myWork.recentlyResolved.length === 0 ? (
        <p className="mt-3 text-muted">Nothing was resolved in the last 7 days of this snapshot.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {model.myWork.recentlyResolved.slice(0, 8).map((item) => (
            <li key={item.ticket.key} className="text-sm">
              <span className="font-bold">{item.ticket.key}</span> {item.ticket.summary}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
