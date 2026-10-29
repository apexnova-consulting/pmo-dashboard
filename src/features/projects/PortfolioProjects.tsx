import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { ExternalAnchor } from '@/components/common/Badges';
import { RiskLevelBadge, SourceBadge } from '@/components/common/Badges';
import { RagBadge, RagWhy } from '@/components/common/RagBadge';
import { PageHeader } from '@/components/common/States';
import { formatDay } from '@/domain/dates';
import { jiraUrl, phaseLabel, type EnrichedProject } from '@/domain/derive';
import { useScopedHref } from '@/hooks/useFilters';

function percent(project: EnrichedProject) {
  if (project.project.percentComplete == null) return 'n/a';
  return `${project.project.percentComplete}%`;
}

export function PortfolioProjects({ dash }: { dash: DashContext }) {
  const navigate = useNavigate();
  const href = useScopedHref();
  const [params, setParams] = useSearchParams();
  const model = dash.model;
  if (!model) return null;
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
        lede="Health uses the lead’s report, blocked updates, risks, milestone and end dates, and how long it has been since an update. No updates and no report is No data, not Green."
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
            <option value="none">No data</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-[12px] border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Projects</caption>
          <thead className="bg-sunken">
            <tr>
              {[
                'Project',
                'Lead',
                'Phase',
                'Health',
                'Complete',
                'Next milestone',
                'Last update',
                'Role',
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
                className="cursor-pointer border-t border-line hover:bg-sunken"
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('button, a')) return;
                  navigate(href(`/projects/${project.project.key}`));
                }}
              >
                <th scope="row" className="px-3 py-3 font-bold">
                  {project.project.name}
                  <span className="mt-1 block text-xs font-normal text-muted">
                    {project.project.key}
                  </span>
                </th>
                <td className="px-3 py-3">{project.lead?.displayName ?? 'Unassigned'}</td>
                <td className="px-3 py-3">{phaseLabel(project.project.phase)}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-2">
                    <RagBadge rag={project.rag.rag} />
                    <RagWhy result={project.rag} />
                  </span>
                </td>
                <td className="px-3 py-3">{percent(project)}</td>
                <td className="px-3 py-3">
                  {project.project.nextMilestoneName ?? 'n/a'}
                  {project.project.nextMilestoneDate
                    ? ` · ${formatDay(project.project.nextMilestoneDate, model.timeZone)}`
                    : ''}
                </td>
                <td className="px-3 py-3">
                  {project.lastUpdated ? formatDay(project.lastUpdated, model.timeZone) : 'n/a'}
                </td>
                <td className="px-3 py-3">
                  {project.role === 'lead'
                    ? 'Lead'
                    : project.role === 'contributor'
                      ? 'Contributor'
                      : project.role === 'unassigned'
                        ? 'Unassigned'
                        : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PortfolioDetail({ dash, projectKey }: { dash: DashContext; projectKey: string }) {
  const href = useScopedHref();
  const model = dash.model;
  if (!model) return null;
  const enriched = model.projects.find((item) => item.project.key === projectKey);
  if (!enriched) return null;
  const project = enriched.project;
  const updates = model.updates.filter((item) => item.update.projectKey === projectKey);
  const risks = model.risks.filter(
    (risk) => risk.projectKey === projectKey && risk.status !== 'closed',
  );
  const link = jiraUrl(model.jiraBaseUrl, project.key, project.url);
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
        {project.reportedHealth ? (
          <span className="text-sm">
            Reported <RagBadge rag={project.reportedHealth} />
          </span>
        ) : (
          <span className="text-sm text-muted">No reported health</span>
        )}
        {link ? (
          <ExternalAnchor href={link} sr="project link">
            Open project link
          </ExternalAnchor>
        ) : null}
      </div>
      <dl className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-sm text-muted">Percent complete</dt>
          <dd className="font-bold">{percent(enriched)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Next milestone</dt>
          <dd>
            {project.nextMilestoneName ?? 'n/a'}
            {project.nextMilestoneDate
              ? ` · ${formatDay(project.nextMilestoneDate, model.timeZone)}`
              : ''}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Target end</dt>
          <dd>
            {project.targetEndDate ? formatDay(project.targetEndDate, model.timeZone) : 'n/a'}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Last update</dt>
          <dd>{enriched.lastUpdated ? formatDay(enriched.lastUpdated, model.timeZone) : 'n/a'}</dd>
        </div>
      </dl>
      {project.notes ? <p className="mb-6 whitespace-pre-wrap">{project.notes}</p> : null}
      <section className="rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Updates</h2>
        {updates.length === 0 ? (
          <p className="mt-3 text-muted">No updates for this project.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {updates.map((item) => (
              <li key={item.update.id} className="border-l-2 border-line pl-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{item.update.title}</span>
                  <span className="text-sm capitalize">{item.update.type}</span>
                  <SourceBadge source={item.update.source} href={item.update.sourceUrl} />
                  {item.update.riskLevel ? <RiskLevelBadge level={item.update.riskLevel} /> : null}
                  {item.update.blocked ? <span className="text-sm font-bold">Blocked</span> : null}
                </div>
                <p className="text-sm text-muted">
                  {formatDay(item.update.date, model.timeZone)} ·{' '}
                  {item.author?.displayName ?? item.update.authorName ?? 'Unknown author'}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{item.update.summary}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Open risks</h2>
        {risks.length === 0 ? (
          <p className="mt-3 text-muted">No open risks on this project.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {risks.map((risk) => (
              <li key={risk.id}>
                <span className="font-bold">{risk.title}</span>
                {risk.riskLevel ? (
                  <span className="ml-2">
                    <RiskLevelBadge level={risk.riskLevel} />
                  </span>
                ) : null}
                {risk.mitigation ? (
                  <p className="whitespace-pre-wrap text-sm">{risk.mitigation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
