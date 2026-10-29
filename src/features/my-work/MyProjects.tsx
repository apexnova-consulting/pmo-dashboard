import { Link } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { RagBadge } from '@/components/common/RagBadge';
import { PageHeader } from '@/components/common/States';
import { formatDay } from '@/domain/dates';
import { isAllOwners } from '@/domain/filters';
import { useScopedHref } from '@/hooks/useFilters';

export function MyProjects({ dash }: { dash: DashContext }) {
  const href = useScopedHref();
  const model = dash.model;
  if (!model) return null;
  const selection = dash.owners.selection;
  const people = model.team.filter((member) => selection.ids.includes(member.id));
  const title = isAllOwners(selection)
    ? 'All leads'
    : people.length === 1
      ? (people[0]?.displayName ?? 'My Projects')
      : 'Selected people';
  const rows = isAllOwners(selection)
    ? model.projects.filter((project) => project.project.phase !== 'closed')
    : model.projects;
  return (
    <div>
      <PageHeader
        title="My Projects"
        lede={`${title}. A project is listed when the selected person leads it, or wrote or owns an open update.`}
      />
      {rows.length === 0 ? (
        <p className="text-muted">No projects in this view.</p>
      ) : (
        <ul className="divide-y divide-line rounded-[12px] border border-line bg-card">
          {rows.map((project) => (
            <li key={project.project.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <RagBadge rag={project.rag.rag} />
              <Link to={href(`/projects/${project.project.key}`)} className="link font-bold">
                {project.project.name}
              </Link>
              <span className="text-sm">
                {project.role === 'lead'
                  ? 'Lead'
                  : project.role === 'contributor'
                    ? 'Contributor'
                    : (project.lead?.displayName ?? 'Unassigned')}
              </span>
              <span className="text-sm text-muted">
                {project.blocked} blocked · {project.openRisks} open risks ·{' '}
                {project.lastUpdated
                  ? `Updated ${formatDay(project.lastUpdated, model.timeZone)}`
                  : 'No update'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
