import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { RagBadge, RagWhy } from '@/components/common/RagBadge';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/common/States';
import { formatDay } from '@/domain/dates';
import { jiraUrl, phaseLabel, type EnrichedProject } from '@/domain/derive';
import { useScopedHref } from '@/hooks/useFilters';

function percent(project: EnrichedProject) {
  if (project.completion.ratio == null) return 'n/a';
  const basis = project.completion.basis === 'story_points' ? 'points' : 'tickets';
  return `${Math.round(project.completion.ratio * 100)}% (${basis})`;
}

export default function ProjectsPage() {
  const dash = useOutletContext<DashContext>();
  const navigate = useNavigate();
  const href = useScopedHref();
  const [params, setParams] = useSearchParams();
  if (dash.isLoading && !dash.model) return <PageSkeleton />;
  if (!dash.model) return <EmptyState title="No projects" body="The snapshot did not load." />;
  const model = dash.model;
  const view = params.get('view') === 'cards' ? 'cards' : 'table';
  const phase = params.get('phase') ?? '';
  const rag = params.get('rag') ?? '';
  const lead = params.get('lead') ?? '';
  const q = (params.get('q') ?? '').trim().toLowerCase();
  const set = (key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };
  const rows = model.projects.filter((project) => {
    if (phase && project.project.phase !== phase) return false;
    if (rag && project.rag.rag !== rag) return false;
    if (lead && project.project.leadId !== lead) return false;
    if (q && !`${project.project.name} ${project.project.key}`.toLowerCase().includes(q))
      return false;
    return true;
  });
  return (
    <div>
      <PageHeader
        title="Projects"
        lede="Health is calculated from overdue share, blocked work, milestone slip, and silence. A PMO override wins when one is present."
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Search
          <input
            value={params.get('q') ?? ''}
            onChange={(event) => set('q', event.target.value)}
            className="mt-1 block rounded-md border border-line bg-sunken px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Phase
          <select
            value={phase}
            onChange={(event) => set('phase', event.target.value)}
            className="mt-1 block rounded-md border border-line bg-card px-3 py-2"
          >
            <option value="">Any</option>
            {['intake', 'planning', 'active', 'on_hold', 'closing', 'closed'].map((item) => (
              <option key={item} value={item}>
                {phaseLabel(item as EnrichedProject['project']['phase'])}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Health
          <select
            value={rag}
            onChange={(event) => set('rag', event.target.value)}
            className="mt-1 block rounded-md border border-line bg-card px-3 py-2"
          >
            <option value="">Any</option>
            <option value="red">Red</option>
            <option value="amber">Amber</option>
            <option value="green">Green</option>
          </select>
        </label>
        <label className="text-sm">
          Lead
          <select
            value={lead}
            onChange={(event) => set('lead', event.target.value)}
            className="mt-1 block rounded-md border border-line bg-card px-3 py-2"
          >
            <option value="">Any</option>
            {model.team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="link font-bold"
            aria-pressed={view === 'table'}
            onClick={() => set('view', '')}
          >
            Table
          </button>
          <button
            type="button"
            className="link font-bold"
            aria-pressed={view === 'cards'}
            onClick={() => set('view', 'cards')}
          >
            Cards
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No projects match"
          body="Clear a filter or choose another owner in the header."
        />
      ) : view === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((project) => (
            <ProjectCard
              key={project.project.key}
              project={project}
              href={href(`/projects/${project.project.key}`)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-line bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Projects sorted red, then amber, then green, then overdue
            </caption>
            <thead className="bg-sunken">
              <tr>
                {[
                  'Health',
                  'Project',
                  'Lead',
                  'Phase',
                  'Complete',
                  'Open',
                  'Overdue',
                  'Blocked',
                  'Next milestone',
                  'Updated',
                  '8-week trend',
                  'Jira',
                ].map((header) => (
                  <th key={header} scope="col" className="px-3 py-2 font-bold tracking-[0.04em]">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((project) => (
                <tr
                  key={project.project.key}
                  className="cursor-pointer border-t border-line hover:bg-brand-tint"
                  onClick={() => navigate(href(`/projects/${project.project.key}`))}
                >
                  <td className="px-3 py-2">
                    <RagBadge rag={project.rag.rag} />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={href(`/projects/${project.project.key}`)}
                      className="link font-bold"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {project.project.name}
                    </Link>
                    <span className="block text-muted">{project.project.key}</span>
                    {project.role ? (
                      <span className="mt-1 inline-block rounded-full bg-sunken px-2 text-xs font-bold">
                        {project.role === 'lead'
                          ? 'Lead'
                          : project.role === 'contributor'
                            ? 'Contributor'
                            : 'Unassigned'}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{project.lead?.displayName ?? 'Unassigned'}</td>
                  <td className="px-3 py-2">{phaseLabel(project.project.phase)}</td>
                  <td className="px-3 py-2">{percent(project)}</td>
                  <td className="px-3 py-2">{project.open}</td>
                  <td className="px-3 py-2">{project.overdue}</td>
                  <td className="px-3 py-2">{project.blocked}</td>
                  <td className="px-3 py-2">
                    {project.nextMilestone
                      ? `${project.nextMilestone.milestone.name} · ${formatDay(project.nextMilestone.milestone.forecastDate ?? project.nextMilestone.milestone.plannedDate, 'UTC')}`
                      : 'n/a'}
                  </td>
                  <td className="px-3 py-2">
                    {project.lastUpdated ? formatDay(project.lastUpdated, model.timeZone) : 'n/a'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="flex gap-1"
                      aria-label={
                        project.trend.length ? `Trend ${project.trend.join(', ')}` : 'No trend'
                      }
                    >
                      {project.trend.map((level, index) => (
                        <span
                          key={`${project.project.key}-${index}`}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                          title={level}
                        >
                          <RagBadge rag={level} className="px-1" />
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      className="link"
                      href={jiraUrl(model.jiraBaseUrl, project.project.key, project.project.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, href }: { project: EnrichedProject; href: string }) {
  return (
    <article className="rounded-[12px] border border-line bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-bold">
          <Link to={href} className="link">
            {project.project.name}
          </Link>
        </h2>
        <RagBadge rag={project.rag.rag} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {phaseLabel(project.project.phase)} · {project.lead?.displayName ?? 'Unassigned'} ·{' '}
        {percent(project)}
      </p>
      <p className="mt-2 text-sm">
        {project.open} open · {project.overdue} overdue · {project.blocked} blocked
      </p>
      <div className="mt-2">
        <RagWhy result={project.rag} />
      </div>
    </article>
  );
}
