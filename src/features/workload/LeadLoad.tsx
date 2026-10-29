import type { DashContext } from '@/components/layout/AppShell';
import { OwnerAvatar } from '@/components/common/OwnerAvatar';
import { PageHeader } from '@/components/common/States';
import { formatDay } from '@/domain/dates';

export function LeadLoad({ dash }: { dash: DashContext }) {
  const model = dash.model;
  if (!model) return null;
  return (
    <div>
      <PageHeader
        title="Projects per lead"
        lede="How many projects each lead holds, plus open blocked work and risks. This is for rebalancing, not ranking."
      />
      <div className="overflow-x-auto rounded-[12px] border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Projects per lead</caption>
          <thead className="bg-sunken">
            <tr>
              {['Lead', 'Projects', 'Blocked projects', 'Open risks', 'Latest update'].map(
                (header) => (
                  <th key={header} scope="col" className="px-3 py-2 font-bold tracking-[0.04em]">
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {model.leadLoad.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <th scope="row" className="px-3 py-3 font-bold">
                  <OwnerAvatar name={row.name} color={row.color} />
                </th>
                <td className="px-3 py-3">{row.projects}</td>
                <td className="px-3 py-3">{row.blocked}</td>
                <td className="px-3 py-3">{row.openRisks}</td>
                <td className="px-3 py-3">
                  {row.latestUpdate ? formatDay(row.latestUpdate, model.timeZone) : 'n/a'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
