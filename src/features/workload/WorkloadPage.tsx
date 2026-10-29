import { useOutletContext } from 'react-router-dom';
import type { DashContext } from '@/components/layout/AppShell';
import { WorkloadChart } from '@/components/charts/Charts';
import { OwnerAvatar } from '@/components/common/OwnerAvatar';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/common/States';

export default function WorkloadPage() {
  const dash = useOutletContext<DashContext>();
  if (dash.isLoading && !dash.model) return <PageSkeleton />;
  if (!dash.model) return <EmptyState title="No workload" body="The snapshot did not load." />;
  const unit = dash.snapshot?.meta.capacityUnit;
  return (
    <div>
      <PageHeader
        title="Workload"
        lede="This view is for rebalancing work, not for ranking people. Capacity appears only when the snapshot includes it."
      />
      <WorkloadChart rows={dash.model.workload} />
      <div className="mt-6 overflow-x-auto rounded-[12px] border border-line bg-card">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Workload by person</caption>
          <thead className="bg-sunken">
            <tr>
              {[
                'Person',
                'Open',
                'Overdue',
                'Due in 7 days',
                'Blocked',
                'Resolved, 30 days',
                'Average age',
                'Capacity',
              ].map((header) => (
                <th key={header} scope="col" className="px-3 py-2 font-bold tracking-[0.04em]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dash.model.workload.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <OwnerAvatar name={row.name} color={row.color} size="sm" />
                </td>
                <td className="px-3 py-2">{row.open}</td>
                <td className="px-3 py-2">{row.overdue}</td>
                <td className="px-3 py-2">{row.dueSoon}</td>
                <td className="px-3 py-2">{row.blocked}</td>
                <td className="px-3 py-2">{row.resolved30}</td>
                <td className="px-3 py-2">{row.avgAge == null ? 'n/a' : Math.round(row.avgAge)}</td>
                <td className="px-3 py-2">
                  {row.weeklyCapacity == null
                    ? 'n/a'
                    : `${row.weeklyCapacity}${unit ? ` ${unit}` : ''}`}
                  {row.weeklyCapacity != null && row.open > row.weeklyCapacity ? ' · over' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
