import type { DashContext } from '@/components/layout/AppShell';
import { RiskLevelBadge } from '@/components/common/Badges';
import { RagBadge } from '@/components/common/RagBadge';
import { PageHeader } from '@/components/common/States';
import { formatDay } from '@/domain/dates';
import type { RiskLevel } from '@/data/schema';

const LEVELS: RiskLevel[] = ['critical', 'high', 'medium', 'low'];

export function PortfolioRisks({ dash }: { dash: DashContext }) {
  const model = dash.model;
  if (!model) return null;
  const blocked = model.updates
    .filter((item) => item.update.status === 'open' && item.update.blocked)
    .sort((a, b) => b.ageDays - a.ageDays);
  const risks = model.risks
    .filter((risk) => risk.status !== 'closed')
    .sort((a, b) => levelRank(a.riskLevel) - levelRank(b.riskLevel));
  const withScores = risks.filter((risk) => risk.probability != null && risk.impact != null);
  const stale = model.projects.filter((project) =>
    project.rag.reasons.some((reason) => reason.rule === 'No recent update'),
  );
  return (
    <div>
      <PageHeader
        title="Risks & Blockers"
        lede="Open blocked updates by age, risks by level, and projects that have gone quiet. A heat map is shown only when a risk has both probability and impact."
      />
      <section className="rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Blocked updates</h2>
        {blocked.length === 0 ? (
          <p className="mt-3 text-muted">Nothing is blocked in this view.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {blocked.map((item) => (
              <li key={item.update.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-bold">{item.ageDays} days</span>
                <span>{item.update.title}</span>
                <span className="text-sm text-muted">{item.projectName}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Risks by level</h2>
        {risks.length === 0 ? (
          <p className="mt-3 text-muted">No open risks in this view.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <caption className="sr-only">Open risks sorted by level</caption>
            <thead className="bg-sunken">
              <tr>
                {['Level', 'Risk', 'Project', 'Status'].map((header) => (
                  <th key={header} scope="col" className="px-3 py-2 font-bold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risks.map((risk) => (
                <tr key={risk.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    {risk.riskLevel ? <RiskLevelBadge level={risk.riskLevel} /> : 'n/a'}
                  </td>
                  <td className="px-3 py-2">{risk.title}</td>
                  <td className="px-3 py-2">{risk.projectKey}</td>
                  <td className="px-3 py-2">
                    {risk.status === 'mitigating' ? 'Mitigating' : 'Open'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {withScores.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <h3 className="font-bold">Heat map</h3>
            <p className="text-sm text-muted">
              Rows are impact 5 down to 1. Columns are probability 1 to 5.
            </p>
            <table className="mt-2 text-sm">
              <caption className="sr-only">
                Risk heat map for items that have probability and impact
              </caption>
              <tbody>
                {Array.from({ length: 5 }, (_, row) => (
                  <tr key={row}>
                    {Array.from({ length: 5 }, (_, column) => {
                      const impact = 5 - row;
                      const probability = column + 1;
                      const count = withScores.filter(
                        (risk) => risk.impact === impact && risk.probability === probability,
                      ).length;
                      return (
                        <td key={column} className="border border-line px-3 py-2 text-center">
                          <span className="sr-only">
                            Impact {impact}, probability {probability}:{' '}
                          </span>
                          {count}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Stale projects</h2>
        {stale.length === 0 ? (
          <p className="mt-3 text-muted">No project is past the silence threshold.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stale.map((project) => (
              <li key={project.project.key} className="flex flex-wrap items-center gap-3">
                <RagBadge rag={project.rag.rag} />
                <span className="font-bold">{project.project.name}</span>
                <span className="text-sm text-muted">
                  {project.lastUpdated
                    ? `Last update ${formatDay(project.lastUpdated, model.timeZone)}`
                    : 'No update date'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function levelRank(level: RiskLevel | undefined) {
  if (!level) return LEVELS.length;
  const index = LEVELS.indexOf(level);
  return index === -1 ? LEVELS.length : index;
}
