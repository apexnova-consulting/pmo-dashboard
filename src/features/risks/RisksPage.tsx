import { useOutletContext } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { ExternalAnchor } from '@/components/common/Badges';
import { AgingChart, OverdueBars } from '@/components/charts/Charts';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/common/States';
import { jiraUrl } from '@/domain/derive';
import { PortfolioRisks } from '@/features/risks/PortfolioRisks';
import { FEATURE_FLAGS } from '@/lib/config';

export default function RisksPage() {
  const dash = useOutletContext<DashContext>();
  if (dash.isLoading && !dash.model) return <PageSkeleton />;
  if (!dash.model) return <EmptyState title="No risk view" body="The snapshot did not load." />;
  const { model } = dash;
  if (model.mode === 'portfolio') return <PortfolioRisks dash={dash} />;
  const activeRisks = model.risks.filter((risk) => risk.status !== 'closed');
  const heat = Array.from({ length: 5 }, (_, impact) =>
    Array.from(
      { length: 5 },
      (_, probability) =>
        activeRisks.filter(
          (risk) =>
            risk.impact != null &&
            risk.probability != null &&
            risk.impact === 5 - impact &&
            risk.probability === probability + 1,
        ).length,
    ),
  );
  return (
    <div>
      <PageHeader
        title="Risks & Blockers"
        lede="What is stuck, aging, or likely to slip. Days blocked are days since the last update, because the snapshot has no blocked-since field."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <AgingChart rows={model.aging} />
        <OverdueBars
          rows={model.overdueByProject.map((row) => ({ name: row.key, count: row.count }))}
        />
      </div>
      <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Blocked or flagged</h2>
        {model.blockedTickets.length === 0 ? (
          <p className="mt-3 text-muted">Nothing is blocked in this view.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {model.blockedTickets.map((item) => (
              <li
                key={item.ticket.key}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <span>
                  <ExternalAnchor
                    className="font-bold"
                    href={jiraUrl(model.jiraBaseUrl, item.ticket.key, item.ticket.url)}
                  >
                    {item.ticket.key}
                  </ExternalAnchor>{' '}
                  {item.ticket.summary}
                </span>
                <span className="text-sm text-muted">{item.daysSinceUpdate} days since update</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
        <h2 className="section-title text-base">Stale</h2>
        {model.staleTickets.length === 0 ? (
          <p className="mt-3 text-muted">No open ticket is past the stale threshold.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {model.staleTickets.slice(0, 20).map((item) => (
              <li key={item.ticket.key} className="py-2 text-sm">
                <span className="font-bold">{item.ticket.key}</span> {item.ticket.summary}
                <span className="text-muted"> · {item.daysSinceUpdate} days</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {FEATURE_FLAGS.showRiskRegister && model.risks.length > 0 ? (
        <section className="mt-6 rounded-[12px] border border-line bg-card p-4">
          <h2 className="section-title text-base">Risk register</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-[16rem_1fr]">
            <table className="text-center text-xs">
              <caption className="mb-2 text-left font-bold">
                Open risks by probability and impact
              </caption>
              <tbody>
                {heat.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((count, colIndex) => (
                      <td
                        key={colIndex}
                        className="border border-line p-2"
                        aria-label={`Impact ${5 - rowIndex}, probability ${colIndex + 1}, ${count} risks`}
                      >
                        {count}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-sunken">
                  <tr>
                    {['Title', 'Score', 'Owner', 'Status', 'Mitigation'].map((header) => (
                      <th key={header} scope="col" className="px-2 py-2 font-bold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.risks.map((risk) => (
                    <tr key={risk.id} className="border-t border-line">
                      <td className="px-2 py-2">{risk.title}</td>
                      <td className="px-2 py-2">
                        {risk.probability != null && risk.impact != null
                          ? risk.probability * risk.impact
                          : 'n/a'}
                      </td>
                      <td className="px-2 py-2">
                        {model.team.find((member) => member.id === risk.ownerId)?.displayName ??
                          'Unassigned'}
                      </td>
                      <td className="px-2 py-2 capitalize">{risk.status}</td>
                      <td className="px-2 py-2">{risk.mitigation ?? 'n/a'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
